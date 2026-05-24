# 🎓 NexTalk Learning Session #001
**Date:** May 23, 2026  
**Topic:** WebRTC Signaling Architecture — How Your Video/Audio Calls Actually Work  
**Level:** Intermediate → Advanced  
**Files Analyzed:**
- `backend/src/sockets/handlers/call.handler.js`
- `backend/src/sockets/adapters/memory.adapter.js`
- `frontend/src/features/call/services/webrtc.js`
- `frontend/src/features/call/services/callSocket.js`
- `frontend/src/features/call/hooks/useWebRTC.js`
- `frontend/src/features/call/hooks/useAudioCall.js`
- `frontend/src/features/call/store/callSlice.js`
- `frontend/src/features/call/constants/callConstants.js`

---

## 1. How Your WebRTC Signaling Works Internally

### The Core Idea: Your Server Is Just a Post Office

Your NexTalk backend **never touches audio or video data**. It is a pure **signaling relay**. Think of it like two people who want to talk directly to each other — they just need to exchange phone numbers (SDP) and confirm the best route (ICE). Your server hands those notes back and forth.

The two key things being exchanged are:

**SDP (Session Description Protocol):** A text document that says "I can send/receive audio in these codecs, video in these resolutions, and here are my network interfaces." Think of it as a capability advertisement.

**ICE Candidates:** Network paths — IP:port pairs — that each peer exposes so the other peer can try connecting to them. There may be local IPs (inside NAT), relay IPs (via STUN/TURN), and public IPs.

### How Your `WebRTCManager` Class Is Structured

```
WebRTCManager
├── _pc: RTCPeerConnection       ← the browser's WebRTC engine
├── _localStream: MediaStream    ← camera/mic from getUserMedia
├── _screenStream: MediaStream   ← screen capture (replaceTrack pattern)
│
├── getUserMedia(callType)       ← asks browser permission for mic/camera
├── createPeerConnection()       ← wires up ICE + track + state callbacks
├── createOffer()                ← generates SDP offer, sets local description
├── createAnswer()               ← responds to an offer, sets local description
├── setRemoteDescription()       ← consumes the other peer's SDP
├── addIceCandidate()            ← feeds each incoming ICE candidate
│
├── toggleAudio(muted)           ← enables/disables audio track
├── toggleVideo(off)             ← enables/disables video track
├── startScreenShare()           ← replaceTrack() to swap cam → screen
├── stopScreenShare()            ← replaceTrack() back to cam
└── destroy()                    ← closes RTCPeerConnection, stops tracks
```

The class has a clean separation: **it owns the browser WebRTC API and nothing else.** It doesn't know about sockets, Redux, or React. This is excellent single-responsibility design.

---

## 2. Full Frontend ↔ Backend Communication Flow

### Step-by-Step Call Setup (Caller = Alice, Receiver = Bob)

```
ALICE (caller)                  YOUR SERVER              BOB (receiver)
─────────────────────────────────────────────────────────────────────
1. dispatch(callInitiated)         
2. getUserMedia('audio')           
3. callSocket.initiateCall()  ──► call:initiate event              
                                   presenceAdapter.getUserSockets(bobId)
                                   io.to(bobSocketId).emit ──────────► call:incoming
                                                                        dispatch(callInitiated, direction='incoming')
                                                                        [BOB's phone rings]
                               
4. createPeerConnection()          
5. createOffer() [local SDP]       
6. callSocket.sendOffer()     ──► call:offer event                  
                                   socket.to('call:callId').emit ──► call:offer received
                                                                     manager.setRemoteDescription(offer)
                                                                     manager.createAnswer()
                                                                 ──► callSocket.sendAnswer()
                                   ◄── call:answer event            
7. manager.setRemoteDescription
   (answer)
   
8. ICE candidates trickle:
   onicecandidate fires
   callSocket.sendIceCandidate() ► call:ice_candidate relay ──────► addIceCandidate()
   ◄─────────────────────────── ◄── Bob's ICE candidates          
   
9. RTCPeerConnection state = 'connected'
   dispatch(callConnected())                              dispatch(callConnected())
   
10. DIRECT P2P AUDIO STREAM ←─────────────────────────────────────► 
    (your server is NOT involved in this stream)
```

**Key insight:** After step 9, your server is completely out of the loop. The audio/video goes peer-to-peer through the browser's WebRTC engine directly. This is why WebRTC can deliver sub-100ms latency that HTTP could never achieve.

### The Room Strategy in Your Backend

```js
// call.handler.js
socket.join(`call:${callId}`);
socket.to(`call:${callId}`).emit(CALL_EVENTS.ICE_CANDIDATE, { callId, candidate });
```

Both Alice and Bob join the Socket.IO room `call:{callId}`. After that, `socket.to(room)` broadcasts to the other participant automatically. This is elegant because if you add a 3rd participant (future group call), they just join the same room.

---

## 3. Request Lifecycle and Data Flow

### Outgoing Call (from `useAudioCall.initiateCall`)

```
useAudioCall.initiateCall(receiverInfo, callerInfo)
  │
  ├─ 1. generateCallId()                    // uuid-like ID, client-generated
  ├─ 2. dispatch(callInitiated)             // Redux: state → OUTGOING
  ├─ 3. webrtc.initLocalStream('audio')     // getUserMedia → browser prompt
  ├─ 4. callSocket.initiateCall(...)        // socket.emit('call:initiate')
  ├─ 5. webrtc.startCall()
  │       ├─ manager.createPeerConnection()
  │       ├─ assigns onIceCandidate → callSocket.sendIceCandidate
  │       ├─ assigns onRemoteStream → setRemoteStream + dispatch(callConnected)
  │       ├─ assigns onConnectionStateChange → dispatch(callReconnecting/callConnected)
  │       └─ manager.createOffer() → callSocket.sendOffer()
  └─ 6. router.push('/call/audio')          // navigate to call UI
```

Notice: `dispatch(callInitiated)` happens **before** getUserMedia. This is intentional — the UI can immediately show "calling..." state even before the browser grants mic access.

### Redux State Machine

```
IDLE
  │ callInitiated (outgoing)
  ▼
OUTGOING ─────────────────────► DECLINED (remote declined)
  │ callInitiated (incoming)        │
  ▼                                 ▼
RINGING ──────────────────────► MISSED (ring timeout)
  │ callAccepted
  ▼
CONNECTING
  │ callConnected (RTCPeerConnection state = 'connected')
  ▼
CONNECTED ────────────────────► RECONNECTING (ICE drops)
  │ callEnded                        │ callConnected (ICE recovers)
  ▼                                  │
IDLE (history entry added)  ◄────────┘
```

This state machine in `callSlice.js` is very well designed. Each action is idempotent and the history entry is built **before** resetting state using `buildHistoryEntry(state, outcome)`.

---

## 4. Scalability and Production Concerns

### Problem 1: Your Memory Adapter Won't Scale Horizontally

```js
// memory.adapter.js
const userSockets = new Map();  // ← lives in one Node.js process
```

Right now, when Bob connects, his `socketId` is stored in `userSockets` Map of **server instance A**. If your load balancer sends Alice's call initiation to **server instance B**, `presenceAdapter.getUserSockets(bobId)` returns empty — because instance B has no knowledge of Bob.

**Your codebase already anticipates this:**
```js
// redis.adapter.js — placeholder is ready
// SADD user:sockets:{userId} {socketId}
// SMEMBERS user:sockets:{userId}
```

The Redis adapter would store socket IDs in Redis (shared across all instances). Combined with `@socket.io/redis-adapter`, which broadcasts socket rooms across instances, this is the complete horizontal scaling solution.

### Problem 2: ICE Failure Without TURN Servers

```js
// callConstants.js
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // TURN servers are injected at runtime from /api/v1/calls/ice-credentials
];
```

Your code has a comment about TURN credentials from an API endpoint. This is the right pattern. STUN helps peers discover their public IPs, but **15-20% of connections fail with STUN alone** (symmetric NATs, strict corporate firewalls). TURN is a relay server that forwards media when P2P fails — it's slower but always works.

In production at scale: use a service like Twilio NTS, Xirsys, or self-hosted Coturn. Credentials should be time-limited tokens generated per call, which your comment `from /api/v1/calls/ice-credentials` suggests.

### Problem 3: No Call Persistence

```js
// call.handler.js comment:
// FUTURE: Persist call records to database via a call.service.js when needed
// for call history, billing, or analytics.
```

This is a gap. Currently, call history only lives in Redux session memory (`callHistory: []` in `callSlice.js`). If the user refreshes, history is gone. Production apps need a `Call` MongoDB model with fields: `callId, callerId, receiverId, callType, startedAt, endedAt, outcome, duration`.

---

## 5. Security Considerations

### 1. Socket Auth — Short-Lived Token by Design
```js
// socket.auth.js
// NOTE: Access tokens are short-lived (15m). Clients must reconnect with a 
// fresh token after expiry — the reconnect flow re-runs this middleware automatically.
```
This is correct. If an attacker steals a socket token, it's only valid for 15 minutes. On reconnect (token rotation), the middleware re-validates, so stale tokens are rejected.

### 2. Room Membership Validation
```js
// call.handler.js
const targetSockets = presenceAdapter.getUserSockets(targetUserId);
if (targetSockets.length === 0) {
  return socket.emit(CALL_EVENTS.END, { callId, reason: 'USER_OFFLINE' });
}
```
Good — the server validates the target exists before creating the call room. However, there's **no authorization check** that Alice is allowed to call Bob. In a production app, you'd check: are they contacts? Is Bob's privacy setting blocking calls from strangers?

### 3. Call Room Isolation
```js
socket.to(`call:${callId}`)
```
ICE candidates and SDP only go to members of `call:{callId}`. Since `callId` is a UUID (large entropy), it's effectively impossible to guess. No extra auth needed on ICE relay events.

### 4. Media Constraints — Privacy by Default
```js
export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
```
Requesting explicit constraints (not just `{audio: true}`) is good practice — it ensures consistent quality and avoids accidentally capturing system audio. The `noiseSuppression` and `echoCancellation` flags improve privacy by reducing ambient audio leakage.

---

## 6. Performance Optimizations

### 1. Trickle ICE (You Already Do This Correctly)
```js
// WebRTCManager
this._pc.onicecandidate = ({ candidate }) => {
  if (candidate) this.onIceCandidate?.(candidate.toJSON());
};
```
Trickle ICE sends ICE candidates as they're gathered rather than waiting for all candidates. This reduces call setup time from ~3-5 seconds to ~1-2 seconds.

### 2. `replaceTrack` for Screen Share (Zero Renegotiation)
```js
const sender = this._pc?.getSenders().find((s) => s.track?.kind === 'video');
if (sender) await sender.replaceTrack(screenTrack);
```
Using `replaceTrack()` instead of removing and re-adding a track avoids a full SDP renegotiation cycle. This means screen sharing starts instantly without a brief video freeze.

### 3. Typing Indicators — No Acknowledgment Needed
```js
// chat.handler.js
socket.on(CHAT_EVENTS.TYPING_START, ({ chatId }) => {
  socket.to(chatId).emit(CHAT_EVENTS.TYPING_START, { chatId, userId, username });
});
```
Typing events use fire-and-forget (no callback/ack). This is correct — if a typing indicator is lost, it's not critical. This saves round-trip overhead.

### 4. `useCallback` in Hooks — Prevents Unnecessary Re-renders
```js
const initiateCall = useCallback(async (receiverInfo, callerInfo) => {
  ...
}, [dispatch, router, webrtc]);
```
All call action functions are memoized. Child components receiving these as props won't re-render unless the call state actually changes.

---

## 7. Common Mistakes Developers Make

### ❌ Mistake 1: Setting Remote Description Before Creating Peer Connection
```js
// WRONG
await manager.setRemoteDescription(sdp); // _pc is null!
await manager.createAnswer();

// CORRECT (what your code does)
const handleOffer = async ({ sdp }) => {
  const manager = getManager();
  manager.createPeerConnection();       // ← create FIRST
  await manager.setRemoteDescription(sdp);
  const answer = await manager.createAnswer();
};
```

### ❌ Mistake 2: Not Cleaning Up Socket Listeners
```js
// WRONG — listeners accumulate on every render
useEffect(() => {
  socket.on('event', handler);
}, [socket]);

// CORRECT (what your useWebRTC does)
useEffect(() => {
  socket.on(SOCKET_EVENTS.OFFER, handleOffer);
  return () => {
    socket.off(SOCKET_EVENTS.OFFER, handleOffer); // ← cleanup
  };
}, [socket, callId, getManager]);
```

### ❌ Mistake 3: Not Handling the `ended` Event on Screen Tracks
```js
// Your code handles this correctly:
screenTrack.addEventListener('ended', () => this.stopScreenShare(), { once: true });
```
When a user clicks "Stop sharing" in the browser's native UI, the `ended` event fires. Without this listener, the app would keep showing "Screen sharing" in the UI but with a dead track.

### ❌ Mistake 4: Storing Socket IDs in a Single-Instance Map for Multi-Server Deployments
This is the Redis problem mentioned above. The fix is your prepared redis.adapter.js.

### ❌ Mistake 5: Not Providing a TURN Server Fallback
Using only STUN (`stun.l.google.com`) works in ~80% of cases. The other 20% (corporate firewalls, symmetric NAT) will show "Call Failed." This is why your comment about `/api/v1/calls/ice-credentials` is critical — implement it.

---

## 8. How Large Companies Implement This

### Discord's Architecture
Discord runs thousands of TURN servers globally. Their call initiation flow is:
1. REST API creates a "session" in their database, returns a `session_id`
2. Socket event carries `session_id`, not SDP — SDP negotiation is deferred
3. They use WebRTC with SFU (Selective Forwarding Unit) for group calls — a media server that receives all streams and sends each participant only the streams they need
4. In 1:1 calls, they still do P2P just like you

### WhatsApp's Key Differences
WhatsApp uses SRTP (Secure Real-time Transport Protocol) on top of WebRTC, with their own TURN infrastructure. They also generate call tokens server-side to prevent unauthorized call initiation between non-contacts.

### Zoom's Architecture (Different Approach)
Zoom uses their own UDP-based media protocol (not WebRTC). All media goes through Zoom's servers (MCU — Multipoint Control Unit), which is why recording and transcription work but also why it requires more bandwidth.

### Your Architecture vs Production Scale
```
Your NexTalk (current):
Client A ──SDP/ICE──► Node.js Socket.IO ──SDP/ICE──► Client B
Client A ◄──────────────── P2P Audio ──────────────► Client B

Production (e.g., with SFU for groups):
Client A ──media──► SFU (Mediasoup/Janus) ──media──► Client B
                                                     ──media──► Client C
```
For 1:1 calls, your architecture is identical to what Telegram, Signal, and Discord use for direct calls.

---

## 9. Interview Questions

### Backend Questions

**Q1:** Your `call.handler.js` uses `socket.to('call:{callId}')` to relay ICE candidates. What happens if Alice and Bob are connected to different server instances in a load-balanced deployment? How would you fix this?

> **Answer:** `socket.to()` only broadcasts within the same server instance. If Bob is on instance B, Alice's emit on instance A never reaches him. Fix: use `@socket.io/redis-adapter` with a Redis pub/sub backend. The adapter intercepts room broadcasts, publishes to Redis, and all other instances subscribe and forward to their locally-connected sockets.

**Q2:** The `presenceAdapter.getUserSockets(targetUserId)` call in the call handler returns all socket IDs for a user. Why is a user tracked with multiple socket IDs rather than one?

> **Answer:** One user may have multiple browser tabs or devices open simultaneously. Each tab creates a separate socket connection with its own unique `socketId`. The memory adapter stores them in a `Set<socketId>` per user. The incoming call notification is delivered to **all** of Bob's sockets so it rings on every open tab/device simultaneously.

**Q3:** What is the risk of using `socket.to(callId).emit(CALL_EVENTS.ICE_CANDIDATE)` without verifying the sender is actually a call participant?

> **Answer:** A malicious socket could emit ICE candidates to any `callId` room if they know the room name. Since `callId` is a UUID (sufficient entropy), guessing is infeasible. But for extra hardness, you could verify `socket.rooms.has('call:' + callId)` before relaying. Currently there's no such check in `call.handler.js`.

---

### Frontend Questions

**Q4:** In `useWebRTC.js`, the `getManager` callback creates a `WebRTCManager` lazily using a `useRef`. Why use `useRef` instead of `useState` for the manager instance?

> **Answer:** `useState` triggers a re-render when its value changes. Creating a `WebRTCManager` (which wraps `RTCPeerConnection`) is a side effect, not render-relevant data. `useRef` holds the instance across renders without causing re-renders, which is correct for objects with imperative lifecycles like WebRTC.

**Q5:** The `callSlice.js` `callEnded` reducer calls `buildHistoryEntry(state, outcome)` before `Object.assign(state, initialActiveCall)`. Why does the order matter?

> **Answer:** `buildHistoryEntry` reads properties from `state` (callId, callerInfo, duration, etc.). If `Object.assign` runs first, those properties are reset to null/0 by `initialActiveCall`, and the history entry would have no data. Order is critical — always snapshot the outgoing state before clearing it.

**Q6:** Why does `useAudioCall.initiateCall` dispatch `callInitiated` to Redux **before** calling `getUserMedia`? Isn't it premature to show "Calling..." before the mic is ready?

> **Answer:** It's intentional UX. The call UI (route `/call/audio`) renders immediately in `OUTGOING` state while `getUserMedia` happens in the background. If you waited for `getUserMedia` before dispatching, the user would see no feedback during the browser permission prompt, which can take several seconds. The UI handles the "waiting for mic" sub-state internally.

---

### System Design Questions

**Q7:** Design a "missed call" notification system for NexTalk. When Alice calls Bob but Bob doesn't answer within 30 seconds, how should the system handle it?

> **Answer:**
> 1. Client-side: `CALL_TIMEOUTS.RING_TIMEOUT_MS = 30_000` — after 30 seconds, Alice's client emits `call:end` with reason `missed`
> 2. Server: `call.handler.js` receives the end event, emits `call:missed` to Bob's socket(s)
> 3. DB: Create a `Notification` record (type: `missed_call`) for Bob
> 4. Push: If Bob is offline, send a push notification via FCM/APNs
> 5. On next Bob login: `notification.handler.js` fetches unread notifications from DB and emits them

**Q8:** How would you scale NexTalk calls to support 10,000 concurrent 1:1 calls?

> **Answer:**
> 1. WebRTC P2P doesn't stress your servers (media is P2P), so signaling load is small per call
> 2. Horizontal scale: run N Socket.IO servers with Redis adapter + sticky sessions or the Redis adapter handles cross-instance delivery
> 3. TURN servers: deploy multiple Coturn instances behind a load balancer (TURN is stateful per allocation)
> 4. Presence: Redis-backed adapter handles presence across instances
> 5. DB: Call records in MongoDB with write-behind caching (buffer call end events, batch-write every 5 seconds)

---

### Debugging Questions

**Q9:** A user reports "Call connects but remote audio is silent." Walk through how you'd debug this using your codebase.

> **Debugging path:**
> 1. Check `WebRTCManager.getUserMedia` — did audio constraints succeed? Log `localStream.getAudioTracks()`
> 2. Check `createOffer/createAnswer` — is SDP printed with `m=audio` section? Confirm codecs match
> 3. Check ICE candidate exchange — are candidates flowing in both directions? Log `socket.on(ICE_CANDIDATE)`
> 4. Check `RTCPeerConnection.connectionState` via `onConnectionStateChange` — is it actually `'connected'`?
> 5. Check `ontrack` fires: does `onRemoteStream` set `remoteStream`? Is the `<audio>` element's `srcObject` set?
> 6. Check `toggleAudio` — is `isMuted` stuck at `true` in Redux? `getAudioTracks()[0].enabled` should be `true`
> 7. Check TURN server — if ICE connected via RELAY (TURN), is the TURN credential still valid?

**Q10:** The `useWebRTC` hook's `useEffect` has `[socket, callId, getManager]` as dependencies. If `callId` changes (e.g., from a new call), what happens to the old socket listeners?

> **Answer:** The effect's cleanup function (`return () => { socket.off(...) }`) fires before the effect re-runs with the new callId. So old listeners (`handleOffer`, `handleAnswer`, `handleIceCandidate`) are removed, and new ones are registered. However, if `getManager` doesn't re-create the `WebRTCManager` (because `managerRef.current` still exists from the old call), you'd get the wrong peer connection. This is why `callEnded/IDLE` state triggers `managerRef.current?.destroy()` — it ensures a clean WebRTCManager for the new call.

---

## 10. Suggested Improvements and Refactors

### 1. Add Call Record Persistence (High Priority)
Create `backend/src/database/models/Call.model.js`:
```js
const callSchema = new mongoose.Schema({
  callId: { type: String, unique: true, required: true },
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  callType: { type: String, enum: ['audio', 'video'] },
  status: { type: String, enum: ['ended', 'missed', 'declined', 'failed'] },
  startedAt: Date,
  endedAt: Date,
  duration: Number, // seconds
}, { timestamps: true });
```

### 2. Verify Room Membership Before Relaying ICE
```js
// call.handler.js — add this guard to ICE_CANDIDATE handler
socket.on(CALL_EVENTS.ICE_CANDIDATE, ({ callId, candidate }) => {
  if (!socket.rooms.has(`call:${callId}`)) return; // ← add this
  socket.to(`call:${callId}`).emit(CALL_EVENTS.ICE_CANDIDATE, { callId, candidate });
});
```

### 3. Implement TURN Credentials Endpoint
```js
// backend/src/api/call/call.controller.js
async getIceCredentials(req, res) {
  const ttl = 3600; // 1 hour
  const username = `${Math.floor(Date.now() / 1000) + ttl}:nextalk`;
  const credential = hmacSHA1(username, process.env.TURN_SECRET);
  return ApiResponse.success(res, {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: `turn:your-turn-server.com:3478`, username, credential },
    ],
  });
}
```

### 4. Add Ring Timeout on the Server (Currently Client-Only)
If Alice's browser crashes mid-call, the server should auto-close the room after 30 seconds:
```js
// call.handler.js — after INITIATE
const ringTimeout = setTimeout(() => {
  io.to(`call:${callId}`).emit(CALL_EVENTS.MISSED, { callId });
  // cleanup room
}, 30_000);
socket.on(CALL_EVENTS.ACCEPT, () => clearTimeout(ringTimeout));
socket.on(CALL_EVENTS.DECLINE, () => clearTimeout(ringTimeout));
```

### 5. Extract CALL_STATE Machine to a Standalone Module
The state transitions in `callSlice.js` are currently implicit in reducer logic. An explicit state machine (using XState or a simple transition table) would make invalid transitions impossible — e.g., preventing `callConnected` from firing when in `IDLE` state.

---

## 📝 Session Summary

**What you learned today:**
- Your server is a **pure signaling relay** — audio/video never touches it
- SDP = capability advertisement (codecs, resolution, bandwidth)
- ICE = network path discovery (STUN finds public IP, TURN relays when P2P fails)
- Your `WebRTCManager` cleanly encapsulates the browser WebRTC API
- Your Redux state machine tracks all call lifecycle states
- The memory adapter is your current scaling bottleneck — Redis swap is already designed
- `replaceTrack()` for screen share avoids renegotiation overhead

**Key production gaps to address:**
1. Call persistence (MongoDB model)
2. TURN server credentials API
3. Server-side ring timeout
4. ICE relay authorization check

---

## 🔜 Next Session Preview (Session #002)

**Suggested Topic:** JWT + Refresh Token Flow — Deep dive into how `auth.middleware.js`, `token.helper.js`, and the `RefreshToken` MongoDB model work together, why short-lived access tokens matter, how the frontend silently refreshes them, and what happens when tokens are stolen.

*Covers: `backend/src/core/middleware/auth.middleware.js`, `backend/src/shared/helpers/token.helper.js`, `backend/src/database/models/RefreshToken.model.js`, `frontend/src/features/auth/services/authApi.js`*
