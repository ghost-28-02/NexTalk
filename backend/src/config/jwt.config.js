const jwtConfig = {
  secret: process.env.JWT_ACCESS_SECRET,
  expiresIn: '1d',
  // Auth cookie — stores the JWT, httpOnly so JS cannot read it.
  // SameSite=none required for cross-origin deployments (Vercel frontend → Render backend).
  cookie: {
    name: 'nx_token',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
      path: '/',
    },
  },
};

module.exports = { jwtConfig };
