# 🧑‍💻 NexTalk Mentor Session #01
**Date:** May 25, 2026  
**Level:** 1→2 (Foundations → Intermediate Architecture)  
**Topic:** Project Architecture, Request-Response Cycle & The Full HTTP Flow Through Your App

---

## 1. Topic of the Day

**How Your Entire Application Works — From Browser Click to Database and Back**

Before diving into any specific feature, you need to understand the *complete journey* of a single request through your system. Every feature you'll ever build follows this same path. Get this right and everything else clicks into place.

Today we'll map out:
- How your two applications are structured and why
- What happens the moment a user clicks "Login"
- How data travels from browser → Next.js → Express → MongoDB → back to browser
- Why your backend is organized into controllers, services, and repositories
- How your frontend's RTK Query layer sits between React and the server

---

## 2. Why This Matters

Most developers can build individual features but can't explain *why* they're organized the way they are. In interviews, the very first question about a project is usually:

> "Walk me through your system architecture."

If you can't trace a request end-to-end, you can't debug it confidently, you can't optimize it, and you can't scale it. This is the single most foundational skill in full-stack engineering.

---

## 3. Where It Exists in Your Project

Your project has two completely separate applications:

```
NexTalk/
├── frontend/          ← Next.js app (what the browser runs)
│   └── src/
│       ├── app/           ← Next.js App Router pages
│       ├── features/      ← Feature-sliced architecture
│       │   ├── auth/      ← Auth logic (hooks, store, services)
│       │   ├── chat/      ← Chat feature
│       │   ├── socket/    ← Socket connection management
│       │   ├── presence/  ← Online/offline tracking
│       │   ├── call/      ← Audio/video calls
│       │   └── notification/
│       ├── services/      ← Shared API layer (baseApi.js)
│       └── store/         ← Redux store
│
└── backend/           ← Express.js + Node.js (what the server runs)
    └── src/
        ├── api/           ← Route handlers (controller/service/routes per feature)
        │   ├── auth/
        │   ├── chat/
        │   ├── message/
        │   ├── user/
        │   └── notification/
        ├── config/        ← App configuration (JWT, database, etc.)
        ├── core/          ← Shared infrastructure (middleware, errors, responses)
        │   ├── middleware/    ← auth, error, rate-limit, request-id, validate
        │   ├── errors/        ← AppError class + error codes
        │   └── response/      ← Standardized API response shapes
        ├── database/      ← Mongoose models and repositories
        │   ├── models/        ← MongoDB schemas
        │   └── repositories/  ← DB query abstraction layer
        ├── shared/        ← Cross-cutting helpers
        │   ├── email/         ← Email sending (adapters: Brevo, console)
        │   ├── upload/        ← File uploads (adapters: Cloudinary, local)
        │   └── helpers/       ← Token, OTP, file utilities
        └── sockets/       ← Socket.IO real-time layer
            ├── adapters/      ← Presence storage (memory now, Redis-ready)
            ├── handlers/      ← Event handlers (presence, chat, call, notification)
            └── socket.manager.js
```

---

## 4. Beginner-Level Explanation

### The Restaurant Analogy

Think of your system like a restaurant:

| Restaurant | Your App |
|---|---|
| Customer | Browser (React UI) |
| Waiter | RTK Query / baseApi.js |
| Kitchen manager | Express Controller |
| Chef | Service layer |
| Pantry/storage | Repository layer |
| Refrigerator | MongoDB |
| Menu | API routes |
| Order receipt | HTTP Request |
| Food on the plate | HTTP Response (JSON) |

The customer (browser) never goes into the kitchen (backend). They talk to the waiter (API layer). The waiter takes the order (request) to the kitchen manager (controller), who delegates to the chef (service), who gets ingredients from the pantry (repository), which pulls from the refrigerator (database).

### Why Are Frontend and Backend Separate?

You might wonder: "Why two separate apps? Why not one?"

**Reason 1: Different responsibilities.**
The frontend's job is to display UI and manage user interaction. The backend's job is to store data, enforce business rules, and handle security. Mixing them creates a mess where UI code and database code fight for the same space.

**Reason 2: Different deployment targets.**
Your frontend runs in the user's browser (or on Vercel's servers for server-side rendering). Your backend runs on a server (Render, AWS, etc.). They need to be deployed independently.

**Reason 3: Multiple clients.**
If you later build a mobile app, it can talk to the same backend without any backend changes. The backend doesn't care if you're a browser, a mobile app, or a desktop client — it just speaks HTTP.

**Reason 4: Security.**
Database credentials, JWT secrets, and API keys live only on the backend. The frontend never touches them. If someone reverse-engineers your frontend JS, they find nothing sensitive.

---

## 5. Internal Working Deep Dive

### The Complete Login Flow — Step by Step

Let's trace exactly what happens when a user types their email + password and clicks "Login":

#### Step 1: User interaction → React component
```
User fills LoginForm → clicks Submit → React form onSubmit fires
```

In your frontend at `frontend/src/app/(auth)/login/page.js`, the login form calls:
```js
const [login, { isLoading }] = useLoginMutation();
await login({ identifier: email, password });
```

#### Step 2: RTK Query sends the HTTP request
`useLoginMutation` is generated by RTK Query from this definition in `features/auth/services/authApi.js`:
```js
login: builder.mutation({
  query: (body) => ({ url: '/auth/login', method: 'POST', body }),
  async onQueryStarted(_, { dispatch, queryFulfilled }) {
    const { data } = await queryFulfilled;
    dispatch(setCredentials({ user: data.data.user, accessToken: data.data.accessToken }));
  },
}),
```

This uses the `baseApi` from `services/baseApi.js`, which sets the base URL to `NEXT_PUBLIC_API_URL/api/v1` and attaches the Bearer token from Redux state to every request header.

RTK Query fires: `POST http://localhost:4000/api/v1/auth/login`  
Body: `{ identifier: "sachin@example.com", password: "mypassword" }`  
Headers: `Content-Type: application/json`, `Authorization: Bearer <token if any>`

#### Step 3: Express receives the request
In `backend/src/app.js`, your middleware stack processes it in order:
```
1. helmet()          → sets security headers (X-Frame-Options, etc.)
2. cors()            → checks Origin header, allows frontend URL
3. compression()     → enables gzip (for responses)
4. requestId         → stamps req.id = unique UUID (for logging/tracing)
5. express.json()    → parses JSON body → req.body = { identifier, password }
6. cookieParser()    → parses cookies (refresh token lives here)
7. requestLogger     → logs: POST /api/v1/auth/login 
8. apiRateLimiter    → checks: has this IP sent too many requests?
9. apiRoutes         → routes the request to auth.routes.js
```

#### Step 4: The router finds the handler
In `api/auth/auth.routes.js`, the route is registered:
```js
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
```

Two things happen here before the controller runs:
- `validate(loginSchema)` runs the Joi/Zod schema — if body is invalid, it throws immediately
- `asyncHandler` wraps the controller so any thrown error propagates to Express error middleware automatically (no try/catch in every controller)

#### Step 5: The Controller receives it
`api/auth/auth.controller.js`:
```js
login: async (req, res) => {
  const { identifier, password } = req.body;
  const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
  const { user, tokens } = await authService.login({ identifier, password }, meta);
  
  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, jwtConfig.refresh.cookieOptions);
  res.cookie('nx_session', '1', jwtConfig.session.cookieOptions);
  
  ApiResponse.success(res, { user: userDTO(user), accessToken: tokens.accessToken });
}
```

The controller's job is narrow: extract data from req, call the service, shape the response. **It does NOT contain business logic.**

#### Step 6: The Service does the business logic
`api/auth/auth.service.js`:
```js
async function login({ identifier, password }, meta = {}) {
  // 1. Find user by email or username
  const user = await userRepository.findByEmailOrUsername(identifier);
  if (!user) throw AppError.unauthorized('Invalid credentials');

  // 2. Check account is active
  if (!user.isActive) throw AppError.unauthorized('Account is disabled');

  // 3. Fetch user WITH password field (excluded by default)
  const userDoc = await User.findById(user._id).select('+password');
  
  // 4. Compare password with bcrypt hash
  const isMatch = await userDoc.comparePassword(password);
  if (!isMatch) throw AppError.unauthorized('Invalid credentials');

  // 5. Create session (access token + refresh token)
  const tokens = await createSession(user, meta);
  
  return { user, tokens };
}
```

The service's job: business rules, validation logic, orchestration of multiple DB calls.

#### Step 7: The Repository hits the database
`database/repositories/user.repository.js`:
```js
async findByEmailOrUsername(identifier) {
  return User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() },
    ],
  })
    .select('+password')
    .lean();
}
```

The repository's job: one responsibility only — talk to MongoDB. No business logic here.

#### Step 8: MongoDB returns the document
Mongoose translates the query to: 
```json
db.users.findOne({ "$or": [{"email": "sachin@example.com"}, {"username": "sachin@example.com"}] })
```
Returns the user document or `null`.

#### Step 9: Tokens are created and stored
In `createSession()` inside auth.service.js:
```js
const accessToken = generateAccessToken({ userId, email });  // expires 15m
const { token: refreshToken, jti } = generateRefreshToken({ userId, email });  // expires 7d

// Store hashed refresh token ID in MongoDB (for rotation/revocation)
await refreshTokenRepository.create({ userId, tokenId, tokenHash, ... });
```

#### Step 10: Response travels back to the browser
```
Express sends:
  Status: 200 OK
  Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth
  Set-Cookie: nx_session=1; HttpOnly; Secure; SameSite=None; Path=/
  Body: { success: true, data: { user: {...}, accessToken: "eyJ..." } }
```

#### Step 11: RTK Query's onQueryStarted fires
```js
const { data } = await queryFulfilled;
dispatch(setCredentials({ user: data.data.user, accessToken: data.data.accessToken }));
```

This dispatches to Redux, updating `auth.user`, `auth.accessToken`, `auth.isAuthenticated = true`.

#### Step 12: React re-renders
The auth state change causes components watching `isAuthenticated` to re-render. The AuthGuard detects the user is now authenticated and redirects to `/chat`.

#### Step 13: Socket connects
`SocketProvider.jsx` watches `isAuthenticated`:
```js
useEffect(() => {
  if (!isAuthenticated || !accessToken) return;
  const socket = createSocket(accessToken);
  socket.connect();
}, [isAuthenticated]);
```

The Socket.IO connection is established, sending the accessToken in the handshake. The server's `socketAuth` middleware verifies it. The user is now online.

**Total time: ~150-400ms on a good connection.**

---

## 6. Frontend ↔ Backend Communication Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  React Components                                               │
│       ↕ hooks (useLoginMutation, useGetChatsQuery, etc.)        │
│  RTK Query (baseApi.js)                                         │
│       ↕ HTTP (REST) on port 4000                                │
│  Redux Store (auth, chat, presence, socket, notification)       │
│       ↕ state updates                                           │
│  Socket.IO Client (SocketProvider)                              │
│       ↕ WebSocket on port 4000                                  │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NODE.JS SERVER                           │
│                                                                 │
│  Express (app.js) — HTTP requests                               │
│    Middleware chain: helmet → cors → compression → ...          │
│    Routes: /api/v1/auth, /api/v1/chat, /api/v1/message, ...    │
│    Controllers → Services → Repositories                        │
│                                                                 │
│  Socket.IO (socket.manager.js) — WebSocket events              │
│    Handlers: presence, chat, call, notification                 │
│                                                                 │
│  Both share: same process, same database connections            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          MONGODB                                │
│  Collections: users, chats, messages, notifications,            │
│               refreshtokens, otps, contacts, ...                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Request/Event Lifecycle (Visual)

### HTTP Request Lifecycle (REST)
```
Browser
  │ POST /api/v1/auth/login
  ▼
Express Middleware Stack
  │ 1. helmet (security headers)
  │ 2. cors (origin check)
  │ 3. requestId (stamp UUID)
  │ 4. body parser (JSON → req.body)
  │ 5. requestLogger (log request)
  │ 6. rateLimiter (IP throttle)
  ▼
Router (auth.routes.js)
  │ validate(schema) → 400 if invalid
  │ protect middleware → 401 if no token (for protected routes)
  ▼
Controller (auth.controller.js)
  │ extract: req.body, req.params, req.user
  │ call: authService.login(...)
  ▼
Service (auth.service.js)
  │ business logic: find user, verify password, create session
  │ call: userRepository.findByEmailOrUsername(...)
  ▼
Repository (user.repository.js)
  │ mongoose query: User.findOne({...})
  ▼
MongoDB
  │ returns document
  ▼
Repository → Service → Controller
  │ build response object
  ▼
ApiResponse.success(res, data)
  │ res.status(200).json({...})
  ▼
Browser (RTK Query receives it)
  │ onQueryStarted fires
  │ dispatch(setCredentials(...))
  ▼
Redux Store updated → React re-renders
```

### Socket.IO Event Lifecycle (Real-time)
```
Browser (SocketProvider)
  │ socket.connect() with { auth: { token: accessToken } }
  ▼
Socket.IO Server Middleware (socketAuth)
  │ verifyAccessToken(token)
  │ userRepository.findById(userId)
  │ socket.user = user
  ▼
io.on('connection', socket => ...)
  │ socket.join(`user:${userId}`)  ← personal room
  │ registerPresenceHandler(io, socket)
  │ registerChatHandler(io, socket)
  │ registerCallHandler(io, socket)
  │ registerNotificationHandler(io, socket)
  ▼
Client emits: socket.emit('presence:status_change', { status: 'away' })
  ▼
presence.handler.js receives it
  │ validates status value
  │ updates presenceAdapter (in-memory Map)
  │ userRepository.updateStatus(userId, status) → MongoDB
  │ socket.broadcast.emit('presence:status_change', { userId, status })
  ▼
All other connected clients receive the event
  │ SocketProvider's onStatusChange handler fires
  │ dispatch(userStatusChanged({ userId, status }))
  ▼
Redux presenceSlice updates → React re-renders status indicator
```

---

## 8. Production Engineering Considerations

### What Your App Already Does Well

**1. Graceful Shutdown** (`server.js`)
```js
process.on('SIGTERM', () => shutdown('SIGTERM'));
```
When your server receives a stop signal (e.g., Render deploying a new version), it finishes in-flight requests before dying. Without this, users get broken mid-request.

**2. Trust Proxy** (`app.js`)
```js
app.set('trust proxy', 1);
```
Without this, `req.ip` returns the load balancer's IP, not the user's IP. Rate limiting would treat every user as the same person.

**3. Request IDs** (`requestId` middleware)
Every request gets a UUID (`X-Request-ID`). When a bug is reported, you can search your logs by this ID to trace the entire request chain. In production with thousands of concurrent requests, this is essential.

**4. Standardized API Responses** (`ApiResponse`)
Every success response is `{ success: true, message, data }`. Every error is `{ success: false, message, code }`. Consistency makes frontend error handling and debugging predictable.

**5. The `isOperational` flag on AppError**
```js
this.isOperational = true;
```
In your error middleware, operational errors (user sent bad data, not found, etc.) are returned to the client. Non-operational errors (unexpected crashes) are logged and return a generic "Internal server error" — never leaking stack traces to users.

---

## 9. Scalability Considerations

### Current Architecture
Your backend is a **single Node.js process** that handles both HTTP (Express) and WebSocket (Socket.IO) traffic. This is perfectly fine for thousands of users but hits walls at scale.

### The Single Process Problem
If you run 2 servers for load balancing:
```
Server A handles user Alice's HTTP requests
Server B handles user Bob's HTTP requests
Bob sends Alice a message → his socket is on Server B
Alice's socket is on Server A
Server B doesn't know where Alice's socket is!
```

**Your app is already designed for this.** Look at `sockets/adapters/memory.adapter.js` and `sockets/adapters/redis.adapter.js`. The comments everywhere say:
```js
// FUTURE [Redis]: swap above import for redis.adapter.js — no changes needed
```

And in `socket.manager.js`:
```js
// FUTURE [Redis multi-instance]:
//   io.adapter(createAdapter(pubClient, subClient));
```

This is a Redis Pub/Sub adapter. When Server B needs to send a message to Alice (on Server A), it publishes to a Redis channel. Server A is subscribed to that channel and delivers the message to Alice's socket. The app was designed with this upgrade in mind.

### The User Cache in auth.middleware.js
```js
const USER_CACHE_TTL_MS = 60 * 1000;
const userCache = new Map(); // in-memory
```
Every protected HTTP request currently does at most 1 DB lookup per minute per user (cache hit = zero DB calls). This eliminates what would otherwise be a MongoDB round-trip on every authenticated request — critical for a chat app where users make dozens of requests per minute.

**Scalability limit:** This cache is per-process. With 2 servers, each has its own cache. If you invalidate a user on Server A, Server B still has them cached for up to 60 seconds. The comment says to move this to Redis when you scale out.

---

## 10. Security Considerations

### What Your App Gets Right

**1. Password never in plain text anywhere**
`User.model.js` pre-saves `bcrypt.hash(password)`. The repository's `findByEmailOrUsername` uses `.select('+password')` — meaning password is explicitly excluded from all other queries by default.

**2. Account enumeration prevention**
```js
// auth.service.js
if (!user) throw AppError.unauthorized('Invalid credentials');
// ...
if (!isMatch) throw AppError.unauthorized('Invalid credentials');
```
Both "wrong email" and "wrong password" return the same error. An attacker can't determine whether an account exists.

**3. Refresh token stored as hash, not plaintext**
```js
const tokenHash = await hashTokenForStorage(jti);  // bcrypt hash of the token ID
```
Even if your MongoDB is compromised, attackers can't use the stored token values.

**4. HTTP-only Cookies for Refresh Token**
The refresh token (long-lived, 7 days) is stored in an `httpOnly` cookie. JavaScript in the browser **cannot read it**. XSS attacks that steal `localStorage` tokens can't steal the refresh token.

**5. The Access Token is short-lived (15 minutes)**
Even if someone intercepts an access token (e.g., in a log file), it expires in 15 minutes.

**6. Refresh Token Rotation + Reuse Detection**
```js
// auth.service.js - refreshSession()
if (!stored) {
  // Token not in DB — replay attack detected
  await refreshTokenRepository.revokeAllForUser(decoded.userId);
  logger.warn('[Auth] Refresh token reuse detected');
  throw AppError.unauthorized('Session invalidated — please log in again');
}
```
If an attacker steals your refresh token and uses it, **both sessions are invalidated**. The attacker and the real user are both logged out.

**7. RegEx injection prevention in search**
```js
// user.repository.js
const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(escaped, 'i');
```
Without escaping, a user searching for `.*` would match every user in the database.

---

## 11. Performance Optimizations

### What's Already Optimized

**gzip compression** — responses over 1KB are compressed before sending. A 50KB JSON response becomes ~8KB.

**`.lean()` on Mongoose queries** — your repositories all use `.lean()`. Without it, Mongoose wraps every document in a full Mongoose Document object with all its methods. `.lean()` returns plain JavaScript objects — ~3-5x faster and less memory.

**`Promise.all` in parallel DB queries**
```js
// user.repository.js - searchUsers()
const [users, total] = await Promise.all([
  User.find(filter)...,
  User.countDocuments(filter),
]);
```
Both DB calls run simultaneously instead of sequentially. If each takes 20ms, the total is 20ms instead of 40ms.

---

## 12. Common Developer Mistakes

### Mistake 1: Putting business logic in controllers
```js
// ❌ Bad — controller doing database work directly
app.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const match = bcrypt.compareSync(req.body.password, user.password);
  if (!match) return res.status(401).json({ error: 'Bad password' });
  const token = jwt.sign({ userId: user._id }, 'secret');
  res.json({ token });
});

// ✅ Good — your pattern
// controller extracts, calls service
// service does logic, calls repository
// repository talks to database
```

### Mistake 2: Storing tokens in localStorage
```js
// ❌ Bad
localStorage.setItem('token', accessToken); // XSS attack → stolen token

// ✅ Your approach
// accessToken: short-lived (15m), stored in Redux memory only
// refreshToken: long-lived (7d), stored in httpOnly cookie (JS cannot read it)
```

### Mistake 3: Not using asyncHandler
```js
// ❌ Bad — if authService.login() throws, Express crashes without error handler
app.post('/login', async (req, res) => {
  const result = await authService.login(req.body); // throws → unhandled!
  res.json(result);
});

// ✅ Your pattern
router.post('/login', asyncHandler(authController.login));
// asyncHandler wraps in try/catch → forwards errors to Express error middleware
```

### Mistake 4: Not separating fetch state from business state in Redux
```js
// ❌ Bad — mixing UI loading state with auth data
auth: { user, token, isLoading, loginError, isLoggingOut }

// ✅ Your pattern
// RTK Query owns loading/error state per endpoint
// authSlice owns the business state: user, accessToken, isAuthenticated, isInitialized
```

---

## 13. Real-World Industry Comparison

### How WhatsApp Handles This

WhatsApp's architecture at scale is similar to what you've built, just multiplied by billions:

- **Frontend ↔ Backend:** React Native app → WhatsApp's servers (Ejabberd, XMPP-based, but conceptually same as your Express + Socket.IO)
- **Auth tokens:** Short-lived auth tokens, long-lived session credentials stored in device keychain (their version of your httpOnly cookie)
- **Refresh token rotation:** Same pattern you have — if a session token is used twice, both sessions are invalidated
- **Presence system:** WhatsApp uses a similar debounce pattern for online/offline — mobile phones drop connections constantly and you don't want to thrash "online/offline" DB writes on every blip
- **Request IDs:** Every WhatsApp server request has a trace ID — this is standard at all major companies (they call it distributed tracing)

### How Slack Handles Auth
Slack uses OAuth 2.0 tokens with refresh, stored in httpOnly cookies with the same SameSite=None + Secure strategy you have. Their `trust proxy` setting is identical.

### The Pattern That Scales
Controller → Service → Repository is called the **three-tier architecture**. It's used by Netflix, Uber, and every major tech company. The names change (Controller might be "Handler" or "Router Handler", Repository might be "DAO" or "Data Access Object") but the pattern is identical.

---

## 14. Interview Questions

### Beginner Level
1. What is the difference between `req.body`, `req.params`, and `req.query` in Express?
2. Why do we separate frontend and backend into different applications?
3. What does `cors()` middleware do? What happens if you remove it?
4. Explain what `express.json()` does. What happens if you POST JSON without it?
5. What is a REST API? How is it different from your Socket.IO real-time layer?

### Intermediate Level
6. Why do we use short-lived access tokens (15m) AND long-lived refresh tokens (7d) instead of one token?
7. What is the difference between `httpOnly` and regular cookies? Why does it matter for security?
8. Explain the `asyncHandler` utility in your codebase. What problem does it solve?
9. Why does your auth middleware use an in-memory user cache? What are the trade-offs?
10. What is `trust proxy` and why is it required for correct IP-based rate limiting?
11. Trace the login request from the browser `fetch()` call through to the MongoDB query.
12. What is `.lean()` in Mongoose and why does your repository always use it?

### Advanced Level
13. Explain refresh token rotation and reuse detection. How does your implementation prevent session hijacking?
14. Your backend uses both HTTP and WebSocket on the same port. How does that work? (`http.createServer(app)` + `new Server(httpServer)`)
15. What breaks if you run two backend instances with the current memory-based presence adapter? How would you fix it?
16. Why is the refresh token stored as a bcrypt hash in MongoDB instead of plaintext?
17. Your `apiResponse.js` has an `isOperational` flag. What's the difference between operational and programming errors, and why does that distinction matter in production?

---

## 15. Debugging Scenarios

**Scenario 1:** A user logs in successfully but gets immediately redirected back to `/login`. What do you check?
> Look at `auth.isInitialized` in Redux. The `AuthGuard` may be redirecting before the session restore completes. Check `useAuthInit.js` and whether `refresh` mutation is being awaited before `authInitialized` is dispatched.

**Scenario 2:** Login works, but after 15 minutes all requests start failing with 401. What's happening?
> The access token expired. Check if `baseQueryWithReauth` in `baseApi.js` is properly calling `/auth/refresh` and storing the new token via `dispatch(tokenRefreshed(...))`. Also verify the refresh token cookie's `sameSite` and `secure` settings match the deployment environment.

**Scenario 3:** Users on mobile go offline and immediately show as offline, then keep flickering online/offline. What's wrong?
> Missing debounce on the presence handler. Mobile connections drop constantly. The 3-second `OFFLINE_DEBOUNCE_MS` in `presence.handler.js` is the fix. Without it, every network blip triggers an offline write + broadcast.

**Scenario 4:** Your rate limiter is blocking all users from the same office building. Why?
> They're behind a corporate NAT — everyone shares one public IP. The rate limit is per-IP. Solutions: increase the limit, rate limit per authenticated user ID instead, or add IP whitelist logic for known corporate CIDRs.

**Scenario 5:** You add a new API endpoint but it doesn't require authentication. 6 months later, you discover users are accessing other users' data through it. What went wrong?
> The `protect` middleware was not added to the route. In your app, always add `protect` to any route that returns private data. Review `auth.routes.js` as your reference for the correct pattern.

---

## 16. Small Refactor Suggestions

### 1. Add a session log to the user cache
Your current cache evicts silently. Adding a metric would help in production:
```js
// auth.middleware.js
const cacheHit = cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS;
if (cacheHit) {
  // Future: increment metrics.cacheHit counter (Prometheus/Datadog)
  req.user = cached.user;
  return next();
}
// Future: increment metrics.cacheMiss counter
```

### 2. The `generateUniqueUsername` function should be in a helper, not auth.service
```js
// auth.service.js currently contains generateUniqueUsername
// Better location: shared/helpers/username.helper.js
// Reason: if you ever generate usernames from a different flow (OAuth, mobile signup),
// the same logic is reusable without importing auth.service
```

### 3. Consider adding a `dto` transformation step in the controller layer
Your `auth.controller.js` should call `toPublicUser(user)` to strip sensitive fields before sending. Currently you rely on individual field exclusions (like `-password` projection). A dedicated DTO function is more explicit and easier to audit:
```js
// auth.dto.js — already exists in your project!
// Make sure every controller response goes through it
ApiResponse.success(res, { user: authDTO.toPublicUser(user), accessToken });
```

---

## 17. What We Will Learn Next

**Session #02 Topic: Redux Toolkit Architecture — How Your State Machine Works**

We'll go deep on:
- Why your app uses Redux instead of just React state
- The slice pattern and how `authSlice`, `chatSlice`, `presenceSlice` work
- How RTK Query sits on top of Redux and manages server state
- The `baseApi.injectEndpoints()` pattern and why all your feature APIs share one API instance
- The `baseQueryWithReauth` token refresh loop — every line explained
- How `onQueryStarted` in RTK Query lets you intercept API responses and update Redux before the UI renders
- Cache invalidation with tags (`providesTags`, `invalidatesTags`)
- Common Redux anti-patterns and how your codebase avoids them
- Interview questions: "What is Redux used for?", "When should you use RTK Query vs useState?", "Explain the Redux data flow"

---

## Summary

Today you learned that every interaction in NexTalk follows the same path:

```
User Action → React Component → RTK Query → HTTP Request →
Express Middleware → Router → Controller → Service → Repository → MongoDB →
Response travels back the same path →
Redux State Update → React Re-renders
```

On top of that, a parallel channel exists for real-time events:
```
Socket.IO Connection → socketAuth → Handler Registration →
Event Emission → Redux Update → React Re-renders
```

Your codebase demonstrates several production patterns already:
- Three-tier architecture (Controller → Service → Repository)
- Stateless JWT authentication with refresh token rotation
- Standardized error and response shapes
- Security headers, CORS, rate limiting, gzip compression
- Graceful shutdown, request IDs, structured logging
- Redis-ready socket and presence adapters

Understanding *why* each of these exists — not just *what* they do — is what separates a junior developer who can write the code from a senior engineer who can design, debug, and scale the system.

---

*Session prepared by your NexTalk Engineering Mentor — May 25, 2026*
