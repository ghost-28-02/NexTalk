import { baseApi } from '@/services/baseApi';

/**
 * callHistoryApi — RTK Query endpoints for persistent call history.
 *
 * Unlike notifications (which seed a slice because sockets mutate them
 * constantly), call history changes rarely — only when a call ends. So we let
 * the RTK Query cache be the source of truth and refresh it two ways:
 *   - tag invalidation on delete/clear mutations
 *   - a `call:logged` socket event (see useCallSocket) invalidates ['CallHistory']
 *     so a call that just ended appears without a manual reload.
 *
 * Pagination mirrors notifications: cursor-based via `before` (the previous
 * page's nextCursor). Pages are merged with `merge`/`serializeQueryArgs`.
 */
export const callHistoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCallHistory: build.query({
      query: ({ limit = 20, before } = {}) => ({
        url: '/calls',
        params: { limit, ...(before ? { before } : {}) },
      }),
      // Unwrap the ApiResponse envelope → { calls, hasMore, nextCursor }
      transformResponse: (res) => res?.data ?? { calls: [], hasMore: false, nextCursor: null },
      // Treat all pages of the list as a single cache entry (ignore `before`)…
      serializeQueryArgs: ({ endpointName }) => endpointName,
      // …and append older pages onto it.
      merge: (current, incoming, { arg }) => {
        if (!arg?.before) return incoming;          // initial load / refetch → replace
        const seen = new Set(current.calls.map((c) => c.id));
        return {
          calls: [...current.calls, ...incoming.calls.filter((c) => !seen.has(c.id))],
          hasMore: incoming.hasMore,
          nextCursor: incoming.nextCursor,
        };
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.before !== previousArg?.before,
      providesTags: ['CallHistory'],
    }),

    getMissedCallCount: build.query({
      query: () => '/calls/missed-count',
      transformResponse: (res) => res?.data?.count ?? 0,
      providesTags: ['CallHistory'],
    }),

    deleteCallEntry: build.mutation({
      query: (id) => ({ url: `/calls/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CallHistory'],
    }),

    clearCallHistory: build.mutation({
      query: () => ({ url: '/calls', method: 'DELETE' }),
      invalidatesTags: ['CallHistory'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCallHistoryQuery,
  useGetMissedCallCountQuery,
  useDeleteCallEntryMutation,
  useClearCallHistoryMutation,
} = callHistoryApi;
