# NexTalk Learning Session #002
## Topic: JWT Authentication + Refresh Token Flow
**Date:** May 24, 2026
**Files Analyzed:**
- `backend/src/shared/helpers/token.helper.js`
- `backend/src/core/middleware/auth.middleware.js`
- `backend/src/api/auth/auth.service.js`
- `backend/src/api/auth/auth.controller.js`
- `backend/src/api/auth/auth.routes.js`
- `backend/src/sockets/socket.auth.js`
- `backend/src/config/jwt.config.js`
- `backend/src/database/models/RefreshToken.model.js`
- `backend/src/database/repositories/refresh-token.repository.js`
- `frontend/src/services/baseApi.js`
- `frontend/src/features/auth/services/authApi.js`
- `frontend/src/features/auth/store/authSlice.js`
- `frontend/src/features/auth/hooks/useAuthInit.js`

---

## 1. How Your Auth System Works Internally

### The Two-Token Design

Your system uses two completely different tokens for two different jobs:

```
ACCESS TOKEN (JWT — in memory)
  - Lives in Redux: state.auth.accessToken
  - Sent as: Authorization: Bearer <token>
  - Expires: 15 minutes
  - Verified STATELESS — server never stores it, just checks the signature
  - If stolen, damage is limited to 15 minutes

REFRESH TOKEN (JWT — in httpOnly cookie)
  - Lives in browser cookie: refreshToken (httpOnly, secure, sameSite)
  - Never visible to JavaScript (XSS-safe)
  - Expires: 7 days
  - Verified STATEFUL — server stores a record in MongoDB (RefreshToken collection)
  - Can be revoked immediately (unlike access tokens)
```

This is the core insight: **access tokens are fast but unrevokable; refresh tokens are slower but revokable.**

### What Gets Stored in MongoDB

Your `RefreshToken` model stores two derived values from the raw JWT's `jti` (JWT ID):

```javascript
// token.helper.js
function generateRefreshToken(payload) {
  const jti = crypto.randomUUID();           // a random UUID embedded in the JWT
  const token = jwt.sign({ ...payload, jti }, secret, { expiresIn: '7d' });
  return { token, jti };
}
```

Then in `auth.service.js → createSession()`:

```javascript
const tokenId  = hashTokenId(jti);           // SHA-256 hash  → fast O(1) DB lookup
const tokenHash = await hashTokenForStorage(jti);  // bcrypt hash → security in depth
```

Why TWO hashes of the same `jti`?
- **tokenId (SHA-256)** is indexed in MongoDB. SHA-256 is deterministic — given the same jti you always get the same tokenId, so you can do a fast `findOne({ tokenId })` without bcrypt.
- **tokenHash (bcrypt)** adds a second layer: even if an attacker dumps your MongoDB, they can't reverse the hashes back to valid JWTs without bcrypt-cracking each one.

This is defense-in-depth for stored tokens — rarely seen in junior/mid-level codebases but expected in production systems.

---

## 2. Full Request Lifecycle — Every Step

### Step 1: Login

```
Browser                     Express Server                   MongoDB
  |                               |                              |
  |-- POST /auth/login ---------->|                              |
  |   { identifier, password }    |-- findByEmailOrUsername ---->|
  |                               |<-- User doc ------------------|
  |                               |-- comparePassword (bcrypt)   |
  |                               |-- generateAccessToken()      |
  |                               |-- generateRefreshToken()     |
  |                               |   → jti = randomUUID()       |
  |                               |-- hashTokenId(jti)           |
  |                               |-- hashTokenForStorage(jti)   |
  |                               |-- RefreshToken.create() ---->|
  |                               |-- Set-Cookie: refreshToken   |
  |                               |-- Set-Cookie: nx_session=1   |
  |<-- { user, accessToken } -----|                              |
  |   (accessToken in body)       |                              |
  |   (refreshToken in cookie)    |                              |
```

The access token goes in the response body → stored in Redux memory.
The refresh token goes in an httpOnly cookie → JavaScript cannot read it.
The `nx_session=1` cookie (not httpOnly, readable by Next.js server-side code) is used by your Next.js middleware for server-side redirects without exposing the real token.

### Step 2: Authenticated Request

```
RTK Query baseApi.js                Express Server
  |                                       |
  |-- prepareHeaders() adds               |
  |   Authorization: Bearer <accessToken> |
  |-- GET /api/v1/chat/conversations ----->|
  |                                       |-- auth.middleware.js: protect()
  |                                       |-- extractTokenFromHeader()
  |                                       |-- verifyAccessToken() (stateless)
  |                                       |-- userCache.get(userId)?
  |                                       |   → yes: skip DB, use cached user
  |                                       |   → no:  MongoDB lookup, cache 60s
  |<-- 200 { conversations } -------------|
```

The in-memory user cache in `auth.middleware.js` is a production-grade micro-optimization that eliminates a MongoDB round-trip on every request for recently active users. The 60-second TTL is a deliberate trade-off: a deactivated account can still make requests for up to 60 seconds. That's acceptable in a chat app.

### Step 3: Token Expired — Silent Refresh

This is the most important flow to understand:

```
RTK Query baseQueryWithReauth                Express Server
  |                                               |
  |-- Any API call (e.g. GET /messages) -------->|
  |<-- 401 { code: TOKEN_EXPIRED } --------------|
  |                                               |
  |-- Is this the /auth/refresh URL? No, proceed |
  |-- POST /auth/refresh ------------------------>|
  |   (browser auto-sends refreshToken cookie)   |-- Read cookie
  |                                               |-- verifyRefreshToken()
  |                                               |-- hashTokenId(decoded.jti)
  |                                               |-- findByTokenId() → found
  |                                               |-- verifyTokenHash(jti, stored.tokenHash)
  |                                               |-- revokeByTokenId() ← ROTATION
  |                                               |-- createSession() ← new tokens
  |                                               |-- Set-Cookie: new refreshToken
  |<-- 200 { user, accessToken } ----------------|
  |                                               |
  |-- dispatch(tokenRefreshed(newAccessToken))    |
  |-- RETRY original request with new token ----->|
  |<-- 200 { messages } --------------------------|
```

The user never sees a loading spinner or a login redirect. This happens completely invisibly. This is called **silent refresh** or **transparent token refresh**.

### Step 4: App Startup — Session Restore

```
Next.js App mounts
  → AuthInitializer renders → useAuthInit() runs
  → POST /auth/refresh (cookie auto-sent)
    → if valid: setCredentials() → isAuthenticated = true
    → if expired/missing: clearAuth() → isAuthenticated = false
  → isInitialized = true
  → App renders correct UI (dashboard or login)
```

Without `isInitialized`, the app would flash the login page for ~100ms on every load even for logged-in users — a jarring UX bug common in apps that don't handle session restore correctly.

---

## 3. Token Rotation — The Security Detail Everyone Misses

When your server processes a refresh, it does NOT simply validate the old token and issue a new one. It does this:

```javascript
// auth.service.js — refreshSession()
await refreshTokenRepository.revokeByTokenId(tokenId);   // DELETE the old record
const tokens = await createSession(user, meta);            // INSERT a new record
```

This is called **refresh token rotation**. Every refresh creates a new token and destroys the old one.

Why does this matter? Consider a stolen refresh token:

```
Attacker steals refresh token at T=0
Legitimate user refreshes at T=5m  → old token deleted, new token issued
Attacker tries to use stolen token at T=10m → tokenId NOT in DB → rejected
```

The legitimate user's refresh invalidated the attacker's copy. The window of exposure is closed automatically.

But your system goes further — it detects **replay attacks**:

```javascript
// auth.service.js — refreshSession()
const stored = await refreshTokenRepository.findByTokenId(tokenId);

if (!stored) {
  // Token not in DB — already used or never existed
  // If it was already used (rotation), this is a replay attack
  await refreshTokenRepository.revokeAllForUser(decoded.userId);  // NUCLEAR OPTION
  logger.warn('[Auth] Refresh token reuse detected', { userId });
  throw AppError.unauthorized('Session invalidated — please log in again');
}
```

If a token that has already been rotated is used again, the server assumes both the attacker and the legitimate user have this token — meaning there was a breach. It revokes **all sessions** for that user. This is the correct security response (and exactly what Google does).

---

## 4. The Cookie Security Configuration

```javascript
// jwt.config.js
cookieOptions: {
  httpOnly: true,     // JS cannot read — blocks XSS token theft
  secure: true,       // HTTPS only — blocks network sniffing (production)
  sameSite: 'strict', // Not sent on cross-site requests — blocks CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',  // Cookie ONLY sent to auth endpoints — not every request
}
```

The `path: '/api/v1/auth'` is subtle but important. Without it, the browser would send the refresh token cookie on every single API request (including `/messages`, `/users`, etc.). Scoping it to `/api/v1/auth` means:
1. The refresh token travels over the wire less → smaller attack surface
2. Even if a non-auth endpoint has a bug, it can't accidentally expose the token

For development, `sameSite: 'lax'` is used instead of `strict` because strict blocks cross-site redirects which is too aggressive for local development flows.

---

## 5. Socket.IO Authentication — The Forgotten Problem

HTTP requests and WebSocket connections use completely different auth flows. Your `socket.auth.js` handles this:

```javascript
// Client must send token in handshake
socket = io(URL, { auth: { token: accessToken } })

// Server reads it
const token = socket.handshake.auth?.token
```

The key problem: **access tokens expire every 15 minutes, but socket connections can live for hours.** Your `socket.auth.js` solves this with a recovery contract:

```javascript
// socket.auth.js — error codes guide client behavior
TOKEN_EXPIRED    → refresh, get new token, socket.auth.token = newToken, socket.connect()
TOKEN_MISSING    → redirect to /login
TOKEN_INVALID    → redirect to /login
ACCOUNT_DISABLED → show disabled message, do NOT retry
```

The socket auth middleware re-runs on every reconnection attempt, so simply updating `socket.auth.token` and reconnecting is sufficient.

---

## 6. Scalability and Production Concerns

### Current State (Single Server)
Everything works fine. The in-memory user cache is a Map, refresh tokens go to MongoDB.

### The Multi-Server Problem
When you deploy 2+ backend instances (horizontal scaling):

**User cache:** Each server has its own `Map()`. User deactivations won't propagate. Fix: Replace the Map with Redis.
```javascript
// auth.middleware.js — the comment already tells you this:
// FUTURE [Redis]: await redisClient.get(`user:cache:${userId}`)
```

**Refresh tokens in MongoDB:** This actually scales fine — MongoDB is centralized. Both servers see the same tokens.

**Session counting:** `refreshTokenRepository.countActiveSessions()` works across servers because it queries the shared DB.

### The Token Blacklist Problem
Access tokens are stateless — you can't revoke them before 15 minutes. Your code already acknowledges this:
```javascript
// auth.middleware.js
// FUTURE: if token blacklisting is needed, check Redis SET here before allowing.
```

Production solution: Store revoked token JTIs in a Redis SET with TTL = token expiry (15m). On every request, check if the token's JTI is in the blacklist. Cost: one Redis GET per request (fast, ~0.1ms on local Redis).

### TTL Index — The Invisible Janitor
```javascript
// RefreshToken.model.js
expiresAt: {
  type: Date,
  index: { expireAfterSeconds: 0 },
}
```

MongoDB automatically deletes expired RefreshToken documents via a background TTL thread. You never need a cron job to clean up old tokens. This is production-grade — many developers build unnecessary cleanup jobs because they don't know about this feature.

---

## 7. Security Considerations

### What Your System Protects Against

| Attack | Defense |
|--------|---------|
| XSS token theft | Refresh token in httpOnly cookie — JS can't read it |
| CSRF on cookie endpoints | sameSite=strict in production |
| Refresh token replay | Token rotation + reuse detection |
| Account enumeration in login | Generic "Invalid credentials" for both bad email and bad password |
| Account enumeration in forgot-password | Always returns success regardless of whether email exists |
| Brute-force login | authRateLimiter middleware on /login, /signup |
| OTP spam | Per-email 60-second cooldown + IP rate limiting |
| Long-lived compromised sessions | 7-day refresh TTL → auto-expiry |
| Token database leak | bcrypt-hashed tokenHash — can't reverse to valid JWT |

### What Your System Does NOT Yet Protect Against

**Stolen refresh token before rotation:** If an attacker steals the cookie and uses it BEFORE the legitimate user does, the attacker gets a valid new session. The legitimate user's next refresh will see the token is gone and get logged out (which alerts them), but the attacker's session remains valid until it expires or the user does `logout-all`. Mitigation: bind tokens to IP/User-Agent (you already store these in the RefreshToken document — you just don't validate them).

**Access token after logout:** When a user logs out, the refresh token is revoked, but the access token (15m window) still works. If someone had sniffed it, it's still valid. Mitigation: Redis blacklist (noted in your code).

---

## 8. Performance Optimizations Already in Your Code

**1. In-memory user cache in auth.middleware.js**
- 60-second TTL, evicted by a setInterval
- Eliminates MongoDB round-trip for the most common case (active user making repeated requests)
- Trade-off: 60-second stale data window on deactivations

**2. SHA-256 tokenId for O(1) lookups**
- `tokenId` is indexed in MongoDB
- `findByTokenId` is a point lookup — does not scan the collection
- bcrypt comparison (which is slow by design) only runs AFTER the fast SHA-256 lookup confirms the record exists

**3. path: '/api/v1/auth' on refresh token cookie**
- Cookie not sent on non-auth requests
- Saves bytes on every API call

**4. MongoDB TTL index**
- Background automatic cleanup, no cron job overhead

---

## 9. Common Mistakes Developers Make

**Mistake 1: Storing JWT in localStorage**
```javascript
// WRONG — XSS can steal this
localStorage.setItem('accessToken', token)

// RIGHT — your approach
// Access token in Redux (memory), refresh token in httpOnly cookie
```

**Mistake 2: Long-lived access tokens**
```javascript
// WRONG
expiresIn: '30d'  // If stolen, attacker has 30 days

// RIGHT — your approach
expiresIn: '15m'  // Minimizes theft window
```

**Mistake 3: Not rotating refresh tokens**
```javascript
// WRONG — just validate and issue new access token
// stolen refresh token works forever

// RIGHT — your approach
await refreshTokenRepository.revokeByTokenId(tokenId);  // always delete old
const tokens = await createSession(user, meta);           // always create new
```

**Mistake 4: Requiring access token for logout**
```javascript
// WRONG — broken when access token has already expired
router.post('/logout', protect, controller.logout);

// RIGHT — your approach
// Logout only needs the refresh cookie, no protect middleware
router.post('/logout', controller.logout);
```

**Mistake 5: Single generic error for all 401s**
```javascript
// WRONG — client can't distinguish expired vs. invalid
res.status(401).json({ error: 'Unauthorized' });

// RIGHT — your socket.auth.js approach
err.data = { code: ERROR_CODES.TOKEN_EXPIRED }
// vs
err.data = { code: ERROR_CODES.TOKEN_INVALID }
// Client knows: expired → refresh; invalid → redirect to login
```

**Mistake 6: Not handling the refresh-endpoint-401 special case**
```javascript
// WRONG — causes infinite loop
if (result.error?.status === 401) {
  const refreshResult = await rawBaseQuery('/auth/refresh', ...);
  // What if /auth/refresh itself returns 401? → infinite loop!
}

// RIGHT — your baseApi.js approach
if (url.includes('/auth/refresh')) {
  api.dispatch(clearAuth());
  return result;  // Stop, don't retry
}
```

---

## 10. How Large Companies Implement This

**Google / Meta / Twitter approach:**
- Access token: 1 hour (slightly longer than yours but same concept)
- Refresh token: Stored server-side, rotated on use
- Suspicious reuse: Revoke all sessions + security email to user (your code does this)
- Device binding: Refresh token tied to device fingerprint, rejected if device changes
- Concurrent refresh protection: Redis distributed lock prevents two simultaneous refresh calls from both succeeding (race condition your current code has)

**The race condition your code has:**
```
Tab A: gets 401 → calls /auth/refresh
Tab B: gets 401 → calls /auth/refresh (0.5ms later, before Tab A responds)

Both arrive at the server with the same refresh token.
Tab A's request processes first: token found, rotated, new tokens issued.
Tab B's request: token NOT found (already deleted by Tab A) → "reuse detected" → ALL sessions revoked!
```

The user is suddenly logged out across all tabs. Fix: Redis distributed lock on `refresh:${tokenId}` with a 5-second TTL. Only one refresh call wins per token.

**Netflix-style session management:**
- Show users their active sessions (`countActiveSessions` — you already have this method)
- Allow "logout from all devices" (`logoutAll` — you already have this)
- Show IP and User-Agent per session (stored in your RefreshToken model)
- Trust score: unusual IP → require re-authentication

---

## 11. Interview Questions

### Backend Questions

**Q1:** Your access token expires in 15 minutes. What happens if a user's account is disabled mid-session — before their token expires?
> **Your code's answer:** They can continue making requests for up to 60 seconds (user cache TTL) after cache invalidation happens, and up to 15 minutes total until the access token expires. The user cache immediately evicts disabled accounts (`userCache.delete(userId)`) on the first request that hits the DB. But cached requests in the 60-second window still go through. If immediate revocation is required, you'd need a Redis token blacklist.

**Q2:** Why does your system use SHA-256 for tokenId AND bcrypt for tokenHash? Why not just bcrypt?
> SHA-256 is deterministic and fast — it's used as a DB key for O(1) lookup. bcrypt is slow by design (it's a KDF, not a hash) — it can't be used as a DB index. bcrypt adds defense-in-depth: if the DB is leaked, the tokenHash column can't be reversed to valid JWTs without cracking each one. You need both: SHA-256 for lookup speed, bcrypt for storage security.

**Q3:** Why is logout implemented without the `protect` middleware?
> If the access token has expired (15-minute window), requiring it for logout breaks the flow: the user has a valid refresh cookie but can't log out because their access token expired. Logout should work as long as the refresh cookie is valid — it doesn't need proof of a current access token.

**Q4:** Walk me through what happens when a refresh token is reused.
> (Token rotation + full revocation — as described in Section 3 above)

**Q5:** You store `userAgent` and `ip` in the RefreshToken document but don't validate them. What security improvement would this enable, and what's the trade-off?
> Binding tokens to IP/User-Agent would detect stolen cookies used from a different device. Trade-off: legitimate users with dynamic IPs (mobile networks, VPNs) or that switch browsers would be logged out unexpectedly. A softer version: flag unusual device changes for additional verification rather than hard rejection.

### Frontend Questions

**Q6:** What is `isInitialized` in your authSlice, and why does it exist?
> It's a flag that signals whether the app has completed its first session-restore attempt (the `useAuthInit` hook's refresh call). Without it, the app doesn't know if `isAuthenticated = false` means "user is logged out" or "we haven't checked yet." Components that depend on auth state would render the wrong UI during the initial load — commonly causing a flash of the login page for logged-in users.

**Q7:** In `baseApi.js`, after a 401, your code calls `/auth/refresh` directly with `rawBaseQuery` instead of the `refresh` mutation. Why?
> Using the `refresh` mutation would dispatch RTK Query's lifecycle actions and cache the result, which has side effects and could cause additional re-renders. `rawBaseQuery` is a plain HTTP function — it just makes the network call without the RTK Query machinery. It's also simpler in the `baseQueryWithReauth` closure because you don't need the dispatch/getState overhead.

**Q8:** Your `useAuthInit` hook uses refs (`dispatchRef`, `refreshRef`) for the values it uses inside the `useEffect`. Why not use them directly?
> To prevent the `useEffect` from re-running when `dispatch` or `refresh` change reference identity between renders. The effect should only run once (on mount) to restore the session — it's not meant to re-fire if the dispatch function gets a new reference. The refs are stable containers that track the latest value without triggering the effect's dependency array.

### System Design Questions

**Q9:** You have 1 million active users. Each makes ~10 API requests per minute. How does your auth middleware scale?
> With the in-memory cache, each server handles its local cache. For multi-server deployments, the cache must move to Redis — otherwise a request hitting Server A after a user was deactivated on Server B won't see the deactivation. The MongoDB RefreshToken collection needs an index on `tokenId` (which you have) and potentially on `userId` (which you also have) for `revokeAllForUser`. At 10M requests/minute distributed across servers, Redis can handle millions of GET/SET operations per second, making this viable.

**Q10:** Design a "remember me" feature on top of your current system. What changes?
> Your current refresh token is always 7 days. "Remember me" could mean: if checked, 30 days; if unchecked, session-only (expires when browser closes). Implementation: accept a `rememberMe: boolean` in the login body, pass it through to `createSession`, use it to set `expiresAt` and `maxAge`. For session-only, omit `maxAge` from the cookie options (session cookie) but keep a short MongoDB TTL (24h, so the DB doesn't accumulate orphaned records from sessions that were never closed).

### Debugging Questions

**Q11:** A user reports that after clicking "logout", they get logged back in automatically when they refresh the page. What's the bug?
> The logout cleared the refresh token cookie and revoked the DB record. But the `/auth/refresh` call in `useAuthInit` is succeeding. That means either: (a) the cookie wasn't actually cleared (wrong path/domain in clearCookie options — they must match exactly what was set), or (b) there's a second refresh cookie from a different path that wasn't cleared. Check that `clearCookie` uses the same `path: '/api/v1/auth'` that was used when setting it.

**Q12:** In production, you start seeing `REFRESH_TOKEN_REUSED` warnings in your logs, triggering full session revocation for users who weren't being attacked. What's likely happening?
> This is the multi-tab race condition (Section 10). Two browser tabs both get 401s simultaneously and both call `/auth/refresh` with the same token. The first one succeeds and rotates the token; the second one sees the token is gone and triggers the reuse detection. Fix: a Redis distributed lock on `refresh:${tokenId}` or a short-circuit that checks if the user already has a fresh session before revoking everything.

---

## 12. Suggested Improvements and Refactors

**Priority 1 — Concurrent Refresh Race Condition (Production Bug)**
```javascript
// auth.service.js — refreshSession()
// Add before the DB lookup:
const lockKey = `refresh:lock:${tokenId}`;
const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 5);
if (!lockAcquired) {
  // Another tab is refreshing — wait briefly and let them win
  throw AppError.tooManyRequests('Refresh in progress');
}
// ... rest of refresh logic
```
On the frontend, `baseQueryWithReauth` should retry after a short delay when it sees a 429 on the refresh endpoint.

**Priority 2 — Return Active Sessions to User (UX + Security)**
```javascript
// New endpoint: GET /auth/sessions
// Uses: refreshTokenRepository.findAllForUser(userId)
// Returns: [{ id, userAgent, ip, createdAt, expiresAt }] for each session
// Pair with: DELETE /auth/sessions/:sessionId for per-session revocation
```
This is a feature users expect from any modern auth system (like Google's "Manage devices" page). The data is already in your `RefreshToken` model.

**Priority 3 — Access Token Expiry Proactive Refresh**
Currently your frontend only refreshes when it gets a 401. A smoother approach is proactive refresh: check the JWT's `exp` claim before making a request, and if the token expires within 60 seconds, refresh first.
```javascript
// baseApi.js — in baseQueryWithReauth, before the main request:
function isTokenExpiringSoon(accessToken) {
  const { exp } = jwt.decode(accessToken);
  return exp - Date.now() / 1000 < 60;  // less than 60 seconds left
}
```
This eliminates the 401 round-trip for users who are actively using the app.

**Priority 4 — `nx_session` Cookie Explanation**
Your `nx_session=1` cookie is used by Next.js middleware for server-side redirects. This is a clever pattern. Document it explicitly with a comment about which Next.js file reads it, so future developers don't accidentally break it.

---

## Summary — What Makes Your Auth System Production-Grade

Most tutorial auth systems do: JWT in localStorage, single token, no rotation, no reuse detection.

Your system does:
- Two-token system (access in memory, refresh in httpOnly cookie)
- Token rotation on every refresh
- Replay attack detection with full session revocation
- Double-hashing (SHA-256 for speed, bcrypt for security)
- In-memory user cache with TTL
- MongoDB TTL index for automatic cleanup
- Silent reauth in RTK Query base layer
- Infinite loop protection in the reauth flow
- `isInitialized` pattern for clean session restore on app startup
- Logout without requiring a valid access token
- Scoped cookie path to minimize token exposure
- Generic error messages to prevent user enumeration
- Per-email OTP cooldown separate from IP rate limiting

**The one thing missing from a true production system:** A Redis distributed lock to prevent the multi-tab concurrent refresh race condition.

---

## Next Session Suggestion

**Session #003 — Socket.IO Architecture Deep Dive**
- How rooms, namespaces, and event routing work in your codebase
- Presence system (online/offline/away state management)
- How Socket.IO middleware chain works
- Event-driven patterns vs. request/response
- How to handle reconnection state on the frontend
- Scaling Socket.IO beyond a single server (the Redis adapter you already have prepared)
