# NexTalk Learning Session #003
## Topic: Socket.IO Architecture Deep Dive
**Date:** May 24, 2026
**Level:** Level 3 — Advanced Realtime Systems
**Previous Sessions:** WebRTC Signaling (#001), JWT + Refresh Token Flow (#002)

---

## 1. Topic of the Day

**Socket.IO Architecture — Full Lifecycle, Rooms, Presence, Typing Indicators, Reconnection, and Multi-Server Scaling**

Today we go end-to-end through your Socket.IO system: how the server initializes it, how authentication gates every connection, how rooms organize message delivery, how the frontend manages the connection lifecycle in React, and what happens when the network drops or the user opens four tabs at once. We'll finish with the exact changes needed to scale this to multiple servers with Redis.

---

## 2. Why This Matters

HTTP is stateless — every request is independent. But NexTalk needs the opposite: the server needs to *push* to clients the moment something happens — a new message, a user coming online, a typing indicator, a missed call. Socket.IO solves this by holding a persistent TCP connection open between each client and the server.

Understanding this architecture is critical because:

- Every real-time feature you build (messaging, presence, notifications, calls) runs through this layer
- Most production bugs in chat apps trace back to socket lifecycle mismanagement
- Senior interviews at Slack, Discord, WhatsApp, and Telegram-style companies always include "how does your real-time layer work?"
- Scaling from 1 server to N servers requires understanding exactly what state lives where

---

## 3. Where It Exists in Your Project

```
backend/src/sockets/
  socket.manager.js           ← Server initialization + io singleton
  socket.auth.js              ← Authentication middleware for every connection
  handlers/
    presence.handler.js       ← Online/offline/status tracking
    chat.handler.js           ← Messages, typing, rooms, delivery receipts
    call.handler.js           ← WebRTC signaling relay
    notification.handler.js   ← Personal room push delivery
  adapters/
    memory.adapter.js         ← In-process presence store (ACTIVE)
    redis.adapter.js          ← Distributed presence store (FUTURE)

frontend/src/features/socket/
  services/socketService.js   ← Socket.IO client factory
  providers/SocketProvider.jsx← Connection lifecycle (React)
  context/SocketContext.js    ← React Context holding the socket instance
  hooks/useSocket.js          ← Consumer hook
  store/socketSlice.js        ← Redux state for connection status
  constants/socketEvents.js   ← Event name constants (mirror of backend)

frontend/src/features/chat/
  hooks/useChatSocket.js      ← Chat-specific event subscriptions
```

---

## 4. Beginner-Level Explanation

Think of HTTP as sending a letter — you send a request, the post office delivers it, and you get a reply. Done. That connection is over.

Socket.IO is like a phone call — once connected, both sides can speak at any time without waiting for the other to ask. The server can say "new message!" the instant it happens. The client can say "I'm typing" whenever they want.

**Three core concepts:**

**Socket:** A single persistent connection from one browser tab to the server. Each tab has its own unique `socket.id`.

**Room:** A named group that sockets can join. When you emit to a room, every socket in it gets the message. A room is just a Set of socket IDs. No overhead when empty.

**Namespace:** A logical partition of the server (`/`, `/admin`, etc.). NexTalk uses only the default namespace (`/`).

---

## 5. Internal Working Deep Dive

### 5a. Server Initialization — `socket.manager.js`

```js
function initSocketManager(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    perMessageDeflate: { threshold: 1024 },
  });

  io.use(socketAuth);           // ← runs BEFORE 'connection' fires

  io.on('connection', (socket) => {
    socket.join(`user:${userId}`);   // ← personal room
    registerPresenceHandler(io, socket);
    registerChatHandler(io, socket);
    registerCallHandler(io, socket);
    registerNotificationHandler(io, socket);
  });
}
```

**What `pingTimeout` and `pingInterval` do:**
Socket.IO sends an invisible `ping` packet every 25 seconds. If no `pong` comes back within 60 seconds, the server declares the socket dead and fires `disconnect`. This detects silently dropped connections (phone screen locked, VPN cut, etc.) that TCP alone wouldn't catch for minutes.

**Why `perMessageDeflate: { threshold: 1024 }`?**
Compresses WebSocket frames larger than 1KB. A burst of 50 chat messages when opening a conversation could be 50KB. Compression often reduces this to ~15KB. Threshold of 1KB avoids wasting CPU on small presence pings.

**The `io` singleton pattern:**
`ioInstance` is saved in module scope. `getIO()` exposes it to services outside the socket layer (e.g., a notification service called via an HTTP endpoint that needs to push a realtime event). This is the standard Node.js singleton pattern — the module is cached after first `require()`.

### 5b. Authentication Middleware — `socket.auth.js`

Every socket connection runs `socketAuth` before the `connection` event fires. This is Socket.IO middleware — equivalent to Express middleware but for the socket handshake.

```js
async function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token   // client sets: io(url, { auth: { token } })
    || extractTokenFromHeader(socket.handshake.headers?.authorization);

  const decoded = verifyAccessToken(token);    // throws TOKEN_EXPIRED if expired
  const user    = await userRepository.findById(decoded.userId, '-password');

  socket.user = user;   // ← attached to socket for all handlers to use
  next();
}
```

**Why not cookies for socket auth?**
Cookies work for HTTP because the browser attaches them automatically. For WebSocket upgrades, the initial HTTP handshake does include cookies — but Socket.IO's auth handshake (`socket.handshake.auth`) is cleaner and explicit. The frontend sends the access token: `io(url, { auth: { token: accessToken } })`.

**Error codes matter:**
The error attached to `next(err)` carries `err.data.code`. On the client, `connect_error` fires and the code determines what to do: `TOKEN_EXPIRED` → refresh and reconnect, `TOKEN_INVALID` → logout, `ACCOUNT_DISABLED` → show permanent error. Without error codes, clients can only retry blindly.

### 5c. Room Architecture

Your project uses three room types:

| Room Pattern | Purpose | Who joins |
|---|---|---|
| `user:{userId}` | Personal room — all devices for one user | Auto-joined on connect |
| `chat:{chatId}` | Conversation room | Joined on `chat:join_room` event |
| `call:{callId}` | WebRTC signaling room | Joined on call initiation |

**Why the personal room pattern is powerful:**

Without `user:{userId}` rooms, to reach a user you'd have to:
1. Look up their socket IDs in your presence adapter
2. Loop and emit to each one

With the personal room, you just:
```js
io.to(`user:${userId}`).emit('notification:new', data);
```

Socket.IO rooms work across all sockets automatically. If the user has 3 tabs open (3 sockets), all 3 are in `user:{userId}` and all 3 receive the emit. This is also why multi-server scaling with the Redis adapter works — you emit to a room name, not to a socket ID.

**How rooms are joined/left in `chat.handler.js`:**
```js
socket.on(CHAT_EVENTS.JOIN_ROOM, async ({ chatId }, callback) => {
  const isMember = await chatRepository.isMember(chatId, userId);
  if (!isMember) return callback?.({ error: 'NOT_CHAT_MEMBER' });
  socket.join(chatId);
  callback?.({ success: true });
});
```

Notice the **authorization check before joining**. A beginner mistake is to trust the client — "join me to room X" — without verifying they're allowed. Here, the handler queries the DB to confirm membership. If you skip this, any user can receive messages from any conversation.

### 5d. Presence System — `presence.handler.js`

The presence handler is a masterclass in real-world engineering tradeoffs.

**Problem 1: Multi-tab / multi-device**

If a user has 4 tabs open and closes 3, are they offline? No. The memory adapter tracks this with a `Map<userId, Set<socketId>>`. You only become truly offline when your last socket disconnects:

```js
const isFullyOffline = presenceAdapter.removeUserSocket(userId, socket.id);
if (!isFullyOffline) return;  // still has other sockets — do nothing
```

**Problem 2: Mobile network flapping**

When a phone screen locks or briefly loses signal, the socket disconnects and immediately reconnects — often within 500ms. Writing `OFFLINE` to MongoDB on every disconnect, then `ONLINE` on reconnect, would cause:
- Noisy DB writes (hundreds per hour on mobile)
- Users appearing to flash offline/online to their contacts
- Race conditions in the DB

**The 3-second debounce solution:**
```js
// On disconnect:
const timer = setTimeout(() => {
  userRepository.updateStatus(userId, USER_STATUS.OFFLINE);
  socket.broadcast.emit(PRESENCE_EVENTS.USER_OFFLINE, { userId });
}, 3000);
disconnectTimers.set(userId, timer);

// On reconnect (registerPresenceHandler runs again):
if (disconnectTimers.has(userId)) {
  clearTimeout(disconnectTimers.get(userId));
  disconnectTimers.delete(userId);
  // User reconnected within 3s → never went offline from contacts' perspective
}
```

**Problem 3: Broadcast scope**
Currently `socket.broadcast.emit` sends to ALL connected users. Your codebase even has a comment explaining the future improvement:

```js
// FUTURE [Contact-Scoped Broadcast]:
//   const contactIds = await contactRepository.getContactIds(userId);
//   for (const cId of contactIds) io.to(`user:${cId}`).emit(...)
```

This is the approach WhatsApp uses. You don't need to know that a stranger came online. Only your contacts' devices need to update.

### 5e. Chat Handler — `chat.handler.js`

The chat handler is the most complex piece. Let's trace a complete message flow:

**Sending a message (server side):**
```js
socket.on(CHAT_EVENTS.NEW_MESSAGE, async ({ chatId, content, replyTo }, callback) => {
  // 1. Authorize — confirm sender is a member
  const isMember = chat.members.some((m) => m.user.toString() === userId);

  // 2. Persist to DB
  const message = await messageRepository.create({ chat: chatId, sender: userId, ... });

  // 3. Update chat metadata
  await Promise.all([
    chatRepository.setLastMessage(chatId, message._id),
    chatRepository.incrementUnreadCount(chatId, userId),
  ]);

  // 4. Emit to chat room (everyone currently viewing this chat)
  io.to(chatId).emit(CHAT_EVENTS.MESSAGE_SENT, { message: payload });

  // 5. Acknowledge back to sender (callback pattern)
  callback?.({ success: true, message: payload });

  // 6. Push sidebar update to members NOT in the room
  pushChatUpdated(io, chat, message, socket.user);

  // 7. Create notifications for truly offline members
  notifyOfflineMembers(io, chat, message, socket.user);
});
```

**The `pushChatUpdated` pattern deserves special attention.** This solves the "sidebar doesn't update" problem:

Imagine Alice is chatting with Bob in `chat:123`. Carol is online but in a different conversation. When Alice sends a message:
- Bob receives `MESSAGE_SENT` because he's in the `chat:123` room ✓
- Carol does NOT receive `MESSAGE_SENT` because she's not in that room ✗

Without `pushChatUpdated`, Carol's sidebar would be stuck showing an old preview and wrong sort order. The solution: check which users are online but NOT in the room, and emit `chat:chat_updated` to their personal `user:{userId}` room. This carries just `{ chatId, lastMessage }` — enough for the frontend to reorder the chat list and update the preview, like WhatsApp's "chat bubbles to the top" behavior.

**Typing indicators:**
```js
socket.on(CHAT_EVENTS.TYPING_START, ({ chatId }) => {
  socket.to(chatId).emit(CHAT_EVENTS.TYPING_START, { chatId, userId, displayName });
  setTypingTimer(chatId);   // safety net: auto-emit TYPING_STOP after 6s
});
```

Note `socket.to(chatId)` vs `io.to(chatId)` — `socket.to` excludes the sender. You don't need to tell yourself you're typing.

The 6-second timer is critical. If a user's browser crashes mid-typing, no `TYPING_STOP` ever fires. Without the safety net, other users would see "Alice is typing..." forever. On disconnect, all timers are cleared and `TYPING_STOP` is broadcast:
```js
socket.on('disconnect', () => {
  for (const [, timer] of typingTimers) clearTimeout(timer);
  typingTimers.clear();
});
```

---

## 6. Frontend ↔ Backend Flow

### Full Connection Lifecycle in `SocketProvider.jsx`

```
User logs in
    ↓
authSlice.isAuthenticated = true
    ↓
SocketProvider useEffect fires (dependency: isAuthenticated)
    ↓
createSocket(accessToken) → socket instance created, NOT connected
    ↓
registerGlobalHandlers(socket) → all presence + system listeners attached
    ↓
socket.connect()
    ↓
Server: socketAuth middleware runs
    ├── token valid → socket.user = user → fires 'connection' event
    │       ↓
    │   socket.join('user:{userId}')
    │   registerPresenceHandler, registerChatHandler, etc.
    │       ↓
    │   Client: 'connect' fires → dispatch(socketConnected())
    │
    └── token invalid → fires 'connect_error' on client
            ↓
        onConnectError checks err.data.code
        TOKEN_EXPIRED → silentRefresh() → update socket.auth.token → socket.connect()
        TOKEN_INVALID → dispatch(clearAuth()) → user is logged out
```

**Why `autoConnect: false`?**
```js
return io(SOCKET_URL, {
  autoConnect: false,   // ← critical
  auth: { token: accessToken },
});
```

If you used `autoConnect: true` (the default), the socket would try to connect the instant it's created — before you've even called `registerGlobalHandlers`. You'd miss events. `SocketProvider` calls `socket.connect()` explicitly only after all listeners are attached.

**Why `isAuthenticated` is the only dependency in the lifecycle `useEffect`:**
```js
useEffect(() => {
  // ...create and connect socket...
}, [isAuthenticated]); // NOT [isAuthenticated, accessToken]
```

Access tokens refresh every 15 minutes (from Session #002). If `accessToken` were a dependency, a token refresh would destroy and recreate the socket — disconnecting the user briefly every 15 minutes, re-running auth, losing all room subscriptions. Instead, token refreshes are handled by a *separate* effect:
```js
useEffect(() => {
  if (socket && accessToken) socket.auth.token = accessToken;
}, [accessToken]);
```

This just updates the token in memory so the *next* reconnect attempt uses it. The current connection is unaffected.

### Feature Hook Pattern — `useChatSocket.js`

Feature hooks consume the socket from context and own their domain's event subscriptions. This is the separation of concerns pattern:

```
SocketProvider (global: connection lifecycle, presence, system events)
    ↓ provides socket via SocketContext
useChatSocket (chat: messages, typing, rooms, receipts)
useCallSocket (calls: WebRTC signaling events)
useNotificationSocket (notification: notification:new)
```

**The stale closure problem and the ref solution:**

```js
const activeChatIdRef = useRef(activeChatId);
useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

// Inside socket event listener:
const onMessageSent = ({ message }) => {
  // We READ the ref, not the variable
  if (message.chat === activeChatIdRef.current) { ... }
};
```

This is a subtle but critical React pattern. Socket event listeners are registered once (effect runs once per socket). If you use `activeChatId` directly inside the handler, it captures the value from when the effect ran — and never updates. After the user navigates to a different chat, the handler still thinks they're in the old chat. Refs solve this: `.current` is always the latest value, even though the closure that reads it was created once.

---

## 7. Request/Event Lifecycle

### Lifecycle: User sends "Hello" in a group chat

```
[Browser — Alice's Tab]
  useChatSocket: socket.emit('chat:new_message', { chatId, content: 'Hello' }, callback)
        ↓
[Network — WebSocket frame]
        ↓
[Server — chat.handler.js]
  1. Receive 'chat:new_message'
  2. chatRepository.isMember(chatId, aliceId) → true
  3. messageRepository.create({ chat, sender: alice, content: 'Hello' }) → message doc
  4. chatRepository.setLastMessage(chatId, message._id)
  5. chatRepository.incrementUnreadCount(chatId, aliceId)
  6. buildMessagePayload(message, socket.user) → wire-safe DTO
  7. io.to(chatId).emit('chat:message_sent', { message })
     → ALL sockets in room chat:{chatId} receive this
  8. callback({ success: true, message })
     → Alice's tab receives the acknowledgment
  9. pushChatUpdated(io, chat, message, alice)
     → Members online but NOT in room get 'chat:chat_updated' → sidebar updates
  10. notifyOfflineMembers(io, chat, message, alice)
      → Members not online get a Notification document + 'notification:new'
        via their personal room user:{userId}
        ↓
[Browser — Bob's Tab (in the room)]
  useChatSocket onMessageSent → dispatch(messageReceived(message))
  → chatSlice adds message to messages array
  → React re-renders chat window
  → Bob's tab emits 'chat:message_read' (he's actively viewing)
        ↓
[Browser — Carol's Tab (different chat)]
  useChatSocket onChatUpdated → dispatch(chatUpdatedFromBackground({ chatId, lastMessage }))
  → chatSlice updates chat.lastMessage and re-sorts
  → Sidebar shows "Alice: Hello" and moves chat to top

[Browser — Dave's Tab (offline/not connected)]
  → Notification document saved in MongoDB
  → When Dave reconnects, useChatSocket onReconnect → refetchChats()
  → Gets latest unread counts from DB
```

---

## 8. Production Engineering Considerations

### Acknowledgment Pattern (Callbacks)

Socket.IO supports acknowledgments — a callback passed as the last argument to `emit`, called by the server when it has processed the event:

```js
// Frontend
socket.emit('chat:new_message', { chatId, content }, (response) => {
  if (response.error) showErrorToast(response.error);
  else markMessageAsConfirmed(response.message.id);
});

// Backend
socket.on('chat:new_message', async ({ chatId, content }, callback) => {
  // ...
  callback?.({ success: true, message: payload });
});
```

**Why this matters:** Fire-and-forget emits give you no confirmation. On a slow connection, the user might see a message "sent" in the UI that never actually reached the server. The callback pattern gives you a delivery confirmation loop, same as how WhatsApp shows one grey tick (sent to server) vs two grey ticks (delivered to device).

### The `io.to()` vs `socket.to()` distinction

```js
io.to(chatId).emit(...)      // ← includes the SENDER's socket
socket.to(chatId).emit(...)  // ← EXCLUDES the sender's socket
```

Use `io.to()` when everyone in the room should get the event, including the sender (e.g., a server-generated system message). Use `socket.to()` when the sender generated the event and already handled it locally (e.g., typing indicators — you don't need to tell yourself you're typing).

### Event Naming Convention

Your project uses `<domain>:<action>` in snake_case (`chat:new_message`, `presence:user_online`). This is the industry standard. Never use short names like `msg` or `online` — they collide when you add new features, and debugging event traffic is impossible without readable names.

---

## 9. Scalability Considerations

### The Single-Server Limitation

Right now, your memory adapter holds all presence data in one Node.js process. If you start two server instances (horizontal scaling), Socket.IO rooms and presence data are isolated to each instance:

```
Server 1:  Alice, Bob    (in room chat:123)
Server 2:  Carol         (in room chat:123)

Alice sends message → Server 1 emits to room chat:123
→ Bob receives it ✓
→ Carol does NOT receive it ✗  (she's on Server 2, different process)
```

### The Redis Adapter Solution

Your codebase already has `redis.adapter.js` scaffolded and comments marking exactly where to add this:

```js
// socket.manager.js — FUTURE [Redis multi-instance]:
const { createAdapter } = require('@socket.io/redis-adapter');
io.adapter(createAdapter(pubClient, subClient));
```

With the Redis adapter, when Server 1 does `io.to('chat:123').emit(...)`, it:
1. Emits directly to local sockets in that room
2. **Also** publishes to a Redis channel
3. Server 2 subscribes to that channel and emits to its own sockets in the same room

All your handler code stays identical — `io.to(chatId).emit(...)` works the same way. This is why the room-based delivery pattern is so powerful: it's the same abstraction whether you have 1 or 100 servers.

**Memory adapter → Redis adapter: what changes?**

| File | Change required |
|---|---|
| `socket.manager.js` | Add `io.adapter(createAdapter(pubClient, subClient))` |
| `presence.handler.js` | Swap `require('../adapters/memory.adapter')` for `redis.adapter.js` |
| **Every handler file** | **Nothing** — same API |
| **Frontend** | **Nothing** — same socket events |

This is why your code has the `// FUTURE [Redis]` comments — the engineers designed it specifically to minimize the migration effort.

---

## 10. Security Considerations

**1. Always authorize room joins:**
```js
const isMember = await chatRepository.isMember(chatId, userId);
if (!isMember) return callback?.({ error: 'NOT_CHAT_MEMBER' });
socket.join(chatId);
```
Without this check, any authenticated user could call `join_room` with any chatId and listen to private conversations.

**2. Validate all incoming data:**
Your presence handler does:
```js
if (!Object.values(USER_STATUS).includes(status)) return;
```
Without input validation, a malicious client could set `status = '__proto__'` or inject unexpected values into your DB.

**3. Emit only what the client needs to see:**
`buildMessagePayload()` in `chat.handler.js` explicitly constructs the payload from whitelisted fields. Never do `io.to(room).emit('message', message.toObject())` — you might accidentally expose internal fields, soft-deleted content, or security-sensitive metadata.

**4. Rate limiting:**
Not yet in your codebase, but production systems add rate limiting per socket:
```js
// Pattern: track emit counts per userId per window
if (rateLimiter.isLimited(userId, 'chat:new_message')) {
  return callback?.({ error: 'RATE_LIMITED' });
}
```
Discord rate-limits message sends to ~5 messages/second per channel per user.

---

## 11. Performance Optimizations

**1. The typing indicator pattern you have is correct:**
`socket.to(chatId)` only emits to sockets in that specific room. If your server has 10,000 connected users and only 30 are in `chat:abc`, the typing event reaches exactly 30 sockets. Compare this to a naive approach of `io.emit()` which broadcasts to ALL 10,000.

**2. `perMessageDeflate` (already in your code):**
Compresses WebSocket frames > 1KB. Critical for message history bursts. The 1KB threshold avoids compressing small presence pings where the compression overhead would exceed the savings.

**3. Lazy presence queries via `BULK_STATUS`:**
```js
socket.on(PRESENCE_EVENTS.BULK_STATUS, ({ userIds }, callback) => {
  const statuses = {};
  for (const uid of userIds) {
    statuses[uid] = presenceAdapter.isUserOnline(uid) ? 'online' : 'offline';
  }
  callback({ statuses });
});
```
Instead of pushing presence updates for every user on your contacts list at connect time, the client can request a batch. This avoids a thundering herd on server restart where hundreds of users reconnect simultaneously and each would broadcast online status to their full contact list.

**4. The `Promise.all` pattern in message send:**
```js
await Promise.all([
  chatRepository.setLastMessage(chatId, message._id),
  chatRepository.incrementUnreadCount(chatId, userId),
]);
```
These two DB writes are independent. Running them in parallel halves the latency vs sequential `await`.

---

## 12. Common Developer Mistakes

**Mistake 1: Forgetting to clean up listeners**

```js
// WRONG — adds a new listener every render
useEffect(() => {
  socket.on('chat:message_sent', handler);
});

// CORRECT — cleanup on unmount / socket change
useEffect(() => {
  socket.on('chat:message_sent', handler);
  return () => socket.off('chat:message_sent', handler);
}, [socket]);
```

Without cleanup, every time the component re-renders, you stack another listener. After navigating between chats 20 times, you have 20 listeners all dispatching the same action. Your Redux store gets updated 20 times per message. This is one of the most common bugs in Socket.IO React apps.

**Mistake 2: Stale closures in event handlers (and how your refs fix it)**

Covered in Section 6. Without `useRef`, a listener created in an effect captures the value of `activeChatId` at the time the effect ran. Navigating to a new chat doesn't update the listener's captured value.

**Mistake 3: Emitting to a room the user hasn't joined**

```js
// WRONG — assuming the socket is in the room
socket.to(chatId).emit('typing', ...);

// The user might have navigated away and left the room
// Your code correctly handles this: LEAVE_ROOM event fires on navigation
```

**Mistake 4: Sending the full Mongoose document over the wire**

```js
// WRONG
io.to(chatId).emit('message', messageDoc.toObject());

// RIGHT — your code builds a whitelisted DTO
const payload = buildMessagePayload(message, socket.user);
io.to(chatId).emit('message', payload);
```

MongoDB documents can have internal fields (`__v`, `_id` on sub-docs) and sensitive data. Always shape your socket payloads explicitly.

**Mistake 5: Not accounting for reconnection**

When a socket reconnects after a network drop, it does NOT automatically rejoin rooms it was in. Your `useChatSocket.js` handles this correctly: the `JOIN_ROOM` effect depends on `[socket, activeChatId]` — when `socket` changes (new socket object after reconnect), it re-emits `JOIN_ROOM`. And `onReconnect` calls `refetchChats()` to re-sync stale DB state.

---

## 13. Real-World Industry Comparison

**How Discord handles this:**

Discord uses Gateway connections — persistent WebSocket connections, functionally identical to Socket.IO but custom-built. Each Gateway shard handles ~2,500 guilds. Users connect to a specific shard based on their user ID. Presence is tracked in a distributed cache (Redis equivalent). When a user comes online, the Gateway pushes `PRESENCE_UPDATE` events only to guilds the user is in — exactly the contact-scoped broadcast your codebase marks as `FUTURE`.

**How WhatsApp handles typing:**

Typing indicators in WhatsApp use a 3-state system: "not typing", "composing", "paused". They expire server-side after ~10 seconds if no update arrives — same as your 6-second typing timer. WhatsApp sends typing updates at most once per second even if the user is typing continuously (debouncing the start event), which your architecture doesn't yet do but would be a natural next step.

**How Slack handles reconnection:**

Slack uses an RTM (Real-Time Messaging) API with "connection count" tracking. When you reconnect, Slack sends you a `hello` event with a `latest_event_id`. Your client requests all events since that ID. This is more robust than NexTalk's current approach (refetch chat list) and is the production pattern for ensuring zero missed messages during network drops.

**How Telegram handles presence at scale:**

Telegram's servers shard users by datacenter region. Presence is stored in memory on the region's servers. Cross-region presence (a user in India coming online, visible to a friend in US) goes through inter-datacenter messaging. This is the logical extension of your memory adapter → Redis adapter path.

---

## 14. Interview Questions

**Conceptual:**

1. What is the difference between `socket.to(room)` and `io.to(room)` in Socket.IO?
2. How do you handle the case where a user has multiple browser tabs open? What problems does this cause for presence tracking?
3. Why would you use the personal room pattern (`user:{userId}`) instead of tracking socket IDs directly?
4. Explain the thundering herd problem in Socket.IO reconnection scenarios. How would you mitigate it?
5. What happens to room membership when a socket disconnects and reconnects? How does NexTalk handle this?

**Architecture:**

6. Your NexTalk backend has one server. If you need to scale to three servers behind a load balancer, what breaks and how do you fix it?
7. How would you implement "last seen 5 minutes ago" with the debounce pattern you have?
8. Describe the security implications of `socket.join(chatId)` without any authorization check.
9. What is the stale closure problem in React with Socket.IO, and how do refs solve it?
10. How does NexTalk's `BULK_STATUS` event avoid a thundering herd on server restart?

**Debugging:**

11. A user reports that typing indicators from others never disappear. Where in the code would you look first, and what's the most likely cause?
12. After deploying to two servers, users on Server B stop receiving messages sent by users on Server A. What's the architectural cause and what's the fix?
13. A user reports their sidebar chat order doesn't update when they receive messages in background chats. Which event and which Redux action handles this? Trace the exact flow.

---

## 15. Debugging Scenarios

**Scenario 1: Messages appear twice in the chat window**

*Symptom:* Every message shows up twice for one user.
*Root cause:* `useChatSocket` registered the `MESSAGE_SENT` listener twice — likely because cleanup wasn't returning properly, or the effect ran twice (React StrictMode double-invokes effects in development).
*How to debug:* Log inside `onMessageSent`, count how many times it fires per event. Check that `socket.off(...)` in the cleanup matches every `socket.on(...)`.

**Scenario 2: Typing indicator shows for the wrong chat**

*Symptom:* Alice opens chat with Bob, then navigates to chat with Carol. She sees "Bob is typing..." in Carol's chat.
*Root cause:* The typing state in Redux is stored per `userId` without the `chatId` as part of the key. Look at `typingStarted({ chatId, userId })` in `chatSlice.js` — the reducer should scope typing state by both chatId and userId.
*Alternative cause:* The `LEAVE_ROOM` emit on navigation didn't fire, so the socket is still in Bob's room and receiving Bob's typing events.

**Scenario 3: User appears online to themselves on another device**

*Symptom:* The presence broadcast uses `socket.broadcast.emit` which sends to ALL sockets including the user's own other devices.
*This is actually correct behavior* — if you open two tabs, both tabs should show your own status. But it could look like a bug if the UI doesn't handle "this is my own status" correctly. The fix is in the frontend: filter out presence updates where `userId === currentUser.id` and update the local user state instead.

---

## 16. Small Refactor Suggestions

**1. Add socket ID logging to join/leave for easier debugging:**
```js
socket.on(CHAT_EVENTS.JOIN_ROOM, async ({ chatId }, callback) => {
  // ...
  socket.join(chatId);
  logger.debug(`[Chat] ${socket.user.username} joined room ${chatId} (socket: ${socket.id})`);
});
```

**2. Add typing debounce on the frontend:**
Currently, every keystroke emits `TYPING_START`. Better:
```js
// Only emit if we weren't already typing
if (!isTypingRef.current) {
  socket.emit(CHAT_EVENTS.TYPING_START, { chatId });
  isTypingRef.current = true;
}
// Debounce the stop
clearTimeout(typingStopTimerRef.current);
typingStopTimerRef.current = setTimeout(() => {
  socket.emit(CHAT_EVENTS.TYPING_STOP, { chatId });
  isTypingRef.current = false;
}, 2000);
```
This reduces `TYPING_START` emits from 100/minute to ~1/typing-session.

**3. Implement contact-scoped presence broadcast:**
The code already has `FUTURE [Contact-Scoped Broadcast]` comments with the exact implementation plan. This is the single highest-impact scalability improvement — prevents every online user being notified of every other user's status changes.

**4. Add a reconnect event to `useChatSocket` join:**
```js
socket.on('connect', () => {
  if (activeChatIdRef.current) {
    socket.emit(CHAT_EVENTS.JOIN_ROOM, { chatId: activeChatIdRef.current });
  }
  refetchChats();
});
```
After a reconnect, the socket needs to rejoin its room. Your join effect currently handles this because `socket` changes on reconnect (new socket object), re-running the join effect. But adding an explicit `connect` listener makes the intent clearer.

---

## 17. What We Will Learn Next

**Session #004 — RTK Query + baseApi Architecture**

We'll go deep into your frontend data fetching layer:

- How `createApi` and `baseQuery` work internally
- How `baseQueryWithReauth` integrates with the JWT refresh flow from Session #002
- The lifecycle of an RTK Query endpoint (pending → fulfilled → rejected)
- Cache tags and invalidation strategy
- How `providesTags` and `invalidatesTags` power your chat list's auto-refresh
- Optimistic updates for message sending
- The `selectFromResult` pattern for derived selectors
- How RTK Query's subscription model interacts with React component mounting/unmounting

**Files we'll cover:** `baseApi.js`, `chatApi.js`, `authApi.js`, `notificationApi.js`, and the relevant slice selectors.

---

## Session Summary

Today you learned how the entire Socket.IO layer of NexTalk works — from the moment `initSocketManager` is called at server startup, through the JWT-authenticated handshake, into the room-based delivery architecture, and all the way to the React hooks that consume events and dispatch to Redux.

**The most important architectural insight from today:** The personal room pattern (`user:{userId}`) is the single design decision that makes the entire system scalable, notification delivery correct, multi-device safe, and Redis-adapter-ready — all without changing any handler code.

**The most important production insight:** The 3-second debounce on presence disconnect and the stale-closure ref pattern in React are not clever tricks — they're the standard industry solution to real bugs that every production chat system hits.
