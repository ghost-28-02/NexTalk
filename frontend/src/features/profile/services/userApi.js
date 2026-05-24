'use client';

/**
 * userApi — RTK Query endpoints for the user profile & settings system.
 *
 * All mutations use optimistic updates:
 *   1. Snapshot the current Redux user state.
 *   2. Dispatch the optimistic change to authSlice.user immediately.
 *   3. Await the server response.
 *      → Success: dispatch the authoritative server payload (replaces optimistic).
 *      → Error:   dispatch the snapshot to revert.
 *
 * Tags:
 *   'User' — invalidated on any mutation so getMe() refetches fresh data
 *             if something external (e.g., admin change) caused a mismatch.
 *
 * Avatar upload uses a FormData body — RTK Query passes it through unchanged;
 * no Content-Type header is set manually so the browser sets the correct
 * multipart boundary automatically.
 */

import { baseApi } from '@/services/baseApi';
import { updateUser } from '@/features/auth/store/authSlice';

export const userApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── GET /users/me ──────────────────────────────────────────────────────
    // Fetches the full owner profile (email, settings, usernameChangedAt).
    // Used on profile page mount and after reconnect to ensure freshness.
    getUserMe: build.query({
      query: () => '/users/me',
      transformResponse: (res) => res.data?.user ?? res.data,
      providesTags: ['User'],
    }),

    // ── PATCH /users/me ────────────────────────────────────────────────────
    // Updates displayName, bio, profileVisibility, socialLinks.
    // Optimistic: immediately updates authSlice.user; server response confirms.
    updateProfile: build.mutation({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      transformResponse: (res) => res.data?.user ?? res.data,
      invalidatesTags: ['User'],
      async onQueryStarted(body, { dispatch, getState, queryFulfilled }) {
        const prev = getState().auth.user;
        // Optimistic — merge flat fields; flatten socialLinks for immediate display
        const optimistic = { ...prev };
        if (body.displayName !== undefined) optimistic.displayName = body.displayName;
        if (body.bio         !== undefined) optimistic.bio         = body.bio;
        if (body.profileVisibility !== undefined)
          optimistic.profileVisibility = body.profileVisibility;
        if (body.socialLinks) {
          optimistic.socialLinks = { ...(prev?.socialLinks ?? {}), ...body.socialLinks };
        }
        dispatch(updateUser(optimistic));

        try {
          const { data } = await queryFulfilled;
          dispatch(updateUser(data));
        } catch {
          dispatch(updateUser(prev)); // revert on error
        }
      },
    }),

    // ── PATCH /users/me/username ───────────────────────────────────────────
    // Username changes are gated by a 3-day server-side cooldown.
    // Optimistic: updates username immediately; reverts on error.
    updateUsername: build.mutation({
      query: (body) => ({ url: '/users/me/username', method: 'PATCH', body }),
      transformResponse: (res) => res.data?.user ?? res.data,
      invalidatesTags: ['User'],
      async onQueryStarted(body, { dispatch, getState, queryFulfilled }) {
        const prev = getState().auth.user;
        dispatch(updateUser({ ...prev, username: body.username }));

        try {
          const { data } = await queryFulfilled;
          dispatch(updateUser(data));
        } catch {
          dispatch(updateUser(prev)); // revert — shows previous username
        }
      },
    }),

    // ── PATCH /users/me/avatar ─────────────────────────────────────────────
    // Multipart form upload. Body must be a FormData object with key 'avatar'.
    // No optimistic dispatch here — avatar URL is server-assigned (local path
    // or Cloudinary URL); we wait for the confirmed URL before updating the UI.
    updateAvatar: build.mutation({
      query: (formData) => ({
        url:    '/users/me/avatar',
        method: 'PATCH',
        body:   formData,
        // Do NOT set Content-Type — browser sets multipart/form-data with boundary
        formData: true,
      }),
      transformResponse: (res) => res.data?.user ?? res.data,
      invalidatesTags: ['User'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Merge confirmed avatar URL into auth user state
          dispatch(updateUser({ avatar: data.avatar }));
        } catch {
          // No revert needed — we never dispatched an optimistic avatar change
        }
      },
    }),

    // ── PATCH /users/me/settings ───────────────────────────────────────────
    // Updates notifications and/or privacy sub-settings.
    // Body shape: { notifications?: {...}, privacy?: {...} }
    // Optimistic: deep-merges settings immediately; reverts on error.
    updateSettings: build.mutation({
      query: (body) => ({ url: '/users/me/settings', method: 'PATCH', body }),
      transformResponse: (res) => res.data?.user ?? res.data,
      invalidatesTags: ['User'],
      async onQueryStarted(body, { dispatch, getState, queryFulfilled }) {
        const prev = getState().auth.user;
        const optimistic = {
          ...prev,
          settings: {
            ...prev?.settings,
            notifications: {
              ...(prev?.settings?.notifications ?? {}),
              ...(body.notifications ?? {}),
            },
            privacy: {
              ...(prev?.settings?.privacy ?? {}),
              ...(body.privacy ?? {}),
            },
          },
        };
        dispatch(updateUser(optimistic));

        try {
          const { data } = await queryFulfilled;
          dispatch(updateUser(data));
        } catch {
          dispatch(updateUser(prev)); // revert
        }
      },
    }),

    // ── GET /users/check-username?username=xxx ─────────────────────────────
    // Inline username availability check (debounced on the UI side).
    // Returns: { available: boolean }
    checkUsername: build.query({
      query: (username) => `/users/check-username?username=${encodeURIComponent(username)}`,
      transformResponse: (res) => res.data,
    }),

  }),
  overrideExisting: false,
});

export const {
  useGetUserMeQuery,
  useUpdateProfileMutation,
  useUpdateUsernameMutation,
  useUpdateAvatarMutation,
  useUpdateSettingsMutation,
  useLazyCheckUsernameQuery,
} = userApi;
