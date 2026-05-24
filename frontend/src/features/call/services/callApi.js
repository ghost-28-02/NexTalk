import { baseApi } from '@/services/baseApi';

/**
 * RTK Query slice for call-history endpoints.
 * Uses the shared baseApi so token refresh (reauth) is handled automatically.
 * Backend: GET /api/v1/calls, GET /api/v1/calls/:id, DELETE /api/v1/calls/:id
 */
export const callApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCallHistory: builder.query({
      query: ({ page = 1, limit = 20 } = {}) =>
        `/calls?page=${page}&limit=${limit}`,
      providesTags: ['CallHistory'],
    }),

    getCallById: builder.query({
      query: (callId) => `/calls/${callId}`,
    }),

    getIceCredentials: builder.query({
      query: () => '/calls/ice-credentials',
    }),

    deleteCallRecord: builder.mutation({
      query: (callId) => ({ url: `/calls/${callId}`, method: 'DELETE' }),
      invalidatesTags: ['CallHistory'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCallHistoryQuery,
  useGetCallByIdQuery,
  useGetIceCredentialsQuery,
  useDeleteCallRecordMutation,
} = callApi;
