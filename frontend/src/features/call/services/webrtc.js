/**
 * WebRTCManager — thin wrapper around RTCPeerConnection.
 *
 * Owns: peer connection, local media, ICE candidate queueing.
 * Does NOT own: signaling transport (useWebRTC wires callbacks to Socket.IO)
 * or call state (callSlice). This separation keeps the class testable and
 * the socket/Redux glue in one hook.
 *
 * ICE candidate race — THE classic WebRTC bug:
 *   Remote candidates often arrive over the socket BEFORE
 *   setRemoteDescription() has run (trickle ICE is fast, SDP is slow).
 *   addIceCandidate() before a remote description throws.
 *   Fix: queue candidates in `pendingCandidates` and flush after the
 *   remote description is applied. See addRemoteIceCandidate().
 *
 * TURN: STUN alone fails for ~15% of peers (symmetric NAT / strict
 * firewalls). Set the NEXT_PUBLIC_TURN_* env vars in production.
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN relay fallback — required in production for strict NATs
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [{
        urls:       process.env.NEXT_PUBLIC_TURN_URL,
        username:   process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      }]
    : []),
];

export class WebRTCManager {
  /**
   * @param {Object}   callbacks
   * @param {Function} callbacks.onLocalStream      (stream) — local media ready
   * @param {Function} callbacks.onRemoteStream     (stream) — remote track arrived
   * @param {Function} callbacks.onIceCandidate     (candidate) — send to peer via socket
   * @param {Function} callbacks.onConnectionStateChange (state) — 'connected' | 'failed' | 'disconnected' | …
   */
  constructor({ onLocalStream, onRemoteStream, onIceCandidate, onConnectionStateChange }) {
    this.onLocalStream           = onLocalStream;
    this.onRemoteStream          = onRemoteStream;
    this.onIceCandidate          = onIceCandidate;
    this.onConnectionStateChange = onConnectionStateChange;

    this.pc                = null;
    this.localStream       = null;
    this.pendingCandidates = []; // remote ICE queued until remote description set
    this.destroyed         = false;
  }

  // ── Local media ─────────────────────────────────────────────────────────────

  /**
   * Acquire mic (+ camera for video calls). Must run before offer/answer so
   * the tracks are in the SDP.
   * @param {'audio'|'video'} callType
   */
  async initLocalMedia(callType) {
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === 'video'
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
    };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (this.destroyed) { this.#stopLocalTracks(); return null; }
    this.onLocalStream?.(this.localStream);
    return this.localStream;
  }

  // ── Peer connection ─────────────────────────────────────────────────────────

  #createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Trickle ICE: candidates are sent to the peer as they're discovered,
    // instead of waiting for gathering to complete — much faster setup.
    pc.onicecandidate = (e) => {
      if (e.candidate) this.onIceCandidate?.(e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      if (e.streams?.[0]) this.onRemoteStream?.(e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(pc.connectionState);
    };

    // Add local tracks so they're negotiated in the SDP
    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream);
    });

    this.pc = pc;
    return pc;
  }

  // ── Signaling (caller side) ─────────────────────────────────────────────────

  /** Caller: create the connection + SDP offer. Returns the offer to relay. */
  async createOffer() {
    const pc = this.#createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer; // { type: 'offer', sdp }
  }

  /** Caller: apply the callee's answer; flush any queued ICE. */
  async handleAnswer(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.#flushPendingCandidates();
  }

  // ── Signaling (callee side) ─────────────────────────────────────────────────

  /** Callee: apply offer, create + return the answer to relay. */
  async handleOffer(sdp) {
    const pc = this.#createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.#flushPendingCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer; // { type: 'answer', sdp }
  }

  // ── ICE ─────────────────────────────────────────────────────────────────────

  /** Queue-or-apply a remote candidate (see class doc for the race). */
  async addRemoteIceCandidate(candidate) {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Benign: candidates for an already-closed/renegotiated connection
    }
  }

  async #flushPendingCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* benign */ }
    }
  }

  // ── Track controls ──────────────────────────────────────────────────────────

  /** @returns {boolean} new enabled state */
  toggleAudio() {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  /** @returns {boolean} new enabled state */
  toggleVideo() {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  // ── Teardown ────────────────────────────────────────────────────────────────

  #stopLocalTracks() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }

  /** Idempotent. Stops camera/mic (releases the hardware light) + closes pc. */
  destroy() {
    this.destroyed = true;
    this.#stopLocalTracks();
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];
  }
}
