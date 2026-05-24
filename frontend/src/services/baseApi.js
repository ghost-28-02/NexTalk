import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { tokenRefreshed, clearAuth } from '@/features/auth/store/authSlice';

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: 'include', // sends httpOnly cookies (refresh token) automatically
  prepareHeaders: (headers, { getState }) => {
    const token = getState()?.auth?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * Custom base query that automatically refreshes the access token on 401.
 *
 * Flow:
 *   1. Make the original request with the current access token.
 *   2. If 401 and the failing request is NOT the refresh endpoint itself (no infinite loop):
 *      a. Call POST /auth/refresh (refresh cookie auto-sent).
 *      b. If refresh succeeds → store new accessToken → retry original request.
 *      c. If refresh fails → dispatch clearAuth → user is logged out.
 *   3. Return the result (original or retried).
 */
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const url = typeof args === 'string' ? args : args?.url ?? '';
    if (url.includes('/auth/refresh')) {
      // Refresh itself failed — end the session cleanly
      api.dispatch(clearAuth());
      return result;
    }

    const refreshResult = await rawBaseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions
    );

    if (refreshResult.data?.data?.accessToken) {
      api.dispatch(tokenRefreshed(refreshResult.data.data.accessToken));
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(clearAuth());
    }
  }

  return result;
};

/**
 * Single shared RTK Query API instance.
 * All feature APIs use baseApi.injectEndpoints() so they share the same
 * reducer, middleware, and — critically — the same reauth logic.
 *
 * Store wiring (store/index.js):
 *   reducer:    { [baseApi.reducerPath]: baseApi.reducer }
 *   middleware: getDefaultMiddleware().concat(baseApi.middleware)
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'User', 'Chat', 'Message', 'Notification', 'CallHistory'],
  endpoints: () => ({}),
});
