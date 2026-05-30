import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearAuth } from '@/features/auth/store/authSlice';

// Use relative URL so requests go through Next.js rewrites (same domain as frontend).
// This ensures cookies set by the backend are on the Vercel domain and readable
// by proxy.js middleware. In development, NEXT_PUBLIC_API_URL is used directly.
const BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api/v1'
  : `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: 'include', // sends httpOnly JWT cookie automatically
});

/**
 * On 401 — session expired or cookie missing — clear auth state so the app
 * redirects the user to login. No refresh token logic needed.
 */
const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    api.dispatch(clearAuth());
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'User', 'Chat', 'Message', 'Notification', 'CallHistory'],
  endpoints: () => ({}),
});
