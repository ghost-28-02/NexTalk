const jwtConfig = {
  access: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    cookieName: 'refreshToken',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // 'none' is required for cross-origin deployments (Vercel frontend → Render backend).
      // SameSite=Strict silently drops the cookie on cross-site requests, causing /auth/refresh
      // to always return 401. SameSite=None + Secure=true is the correct combo for cross-origin
      // httpOnly auth cookies. In development, 'lax' works fine (same-origin localhost).
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    },
  },
  // Lightweight session presence cookie — readable by Next.js middleware for route redirects.
  // Contains no sensitive data. Backend sets/clears it alongside the refresh token.
  session: {
    cookieName: 'nx_session',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    },
  },
};

module.exports = { jwtConfig };
