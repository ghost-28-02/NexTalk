import { ICE_SERVERS, MEDIA_CONSTRAINTS } from '../constants/callConstants';

/**
 * WebRTCManager — owns one RTCPeerConnection per call.
 * Lifecycle: construct → getUserMedia → createPeerConnection → offer/answer → close.
 * All callbacks are plain properties; assign before calling createPeerConnection.
 */
export class WebRTCManager {
  constructor() {
    this._pc = null;
    this._localStream = null;
    this._screenStream = null;

    // Assign these before calling createPeerConnection
    this.onIceCandidate = null;       // (candidate: RTCIceCandidateInit) => void
    this.onRemoteStream = null;       // (stream: MediaStream) => void
    this.onConnectionStateChange = null; // (state: string) => void
    this.onNegotiationNeeded = null;  // () => void
  }

  // ─── Media ────────────────────────────────────────────────────────────────

  async getUserMedia(callType = 'audio') {
    const constraints = {
      audio: MEDIA_CONSTRAINTS.audio,
      video: callType === 'video' ? MEDIA_CONSTRAINTS.video : false,
    };
    this._localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this._localStream;
  }

  getLocalStream() {
    return this._localStream;
  }

  // ─── Peer connection ──────────────────────────────────────────────────────

  createPeerConnection(iceServers = ICE_SERVERS) {
    if (this._pc) this.closePeerConnection();

    this._pc = new RTCPeerConnection({ iceServers });

    this._pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.onIceCandidate?.(candidate.toJSON());
    };

    this._pc.ontrack = ({ streams }) => {
      if (streams[0]) this.onRemoteStream?.(streams[0]);
    };

    this._pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(this._pc.connectionState);
    };

    this._pc.onnegotiationneeded = () => {
      this.onNegotiationNeeded?.();
    };

    // Add existing local tracks so they are included in the first offer
    this._localStream?.getTracks().forEach((track) => {
      this._pc.addTrack(track, this._localStream);
    });

    return this._pc;
  }

  getPeerConnection() {
    return this._pc;
  }

  // ─── SDP negotiation ──────────────────────────────────────────────────────

  async createOffer() {
    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer() {
    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(sdp) {
    await this._pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addIceCandidate(candidate) {
    if (this._pc && candidate) {
      await this._pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  // ─── Track control ────────────────────────────────────────────────────────

  toggleAudio(muted) {
    this._localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  toggleVideo(off) {
    this._localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !off;
    });
  }

  // ─── Screen sharing ───────────────────────────────────────────────────────

  async startScreenShare() {
    this._screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const screenTrack = this._screenStream.getVideoTracks()[0];

    const sender = this._pc?.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(screenTrack);

    // Browser fires 'ended' when the user clicks "Stop sharing"
    screenTrack.addEventListener('ended', () => this.stopScreenShare(), { once: true });
    return this._screenStream;
  }

  async stopScreenShare() {
    this._screenStream?.getTracks().forEach((t) => t.stop());
    this._screenStream = null;

    const camTrack = this._localStream?.getVideoTracks()[0];
    if (this._pc && camTrack) {
      const sender = this._pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(camTrack);
    }
  }

  isScreenSharing() {
    return Boolean(this._screenStream);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  closePeerConnection() {
    if (!this._pc) return;
    this._pc.onicecandidate = null;
    this._pc.ontrack = null;
    this._pc.onconnectionstatechange = null;
    this._pc.onnegotiationneeded = null;
    this._pc.close();
    this._pc = null;
  }

  stopLocalStream() {
    this._localStream?.getTracks().forEach((t) => t.stop());
    this._localStream = null;
    this._screenStream?.getTracks().forEach((t) => t.stop());
    this._screenStream = null;
  }

  destroy() {
    this.closePeerConnection();
    this.stopLocalStream();
    this.onIceCandidate = null;
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
    this.onNegotiationNeeded = null;
  }
}
