import { baseApi } from '@/services/baseApi';
import { setCredentials, clearAuth } from '../store/authSlice';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    signup: builder.mutation({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),

    login: builder.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // JWT is set as httpOnly cookie by the backend.
          // We only store user in Redux for UI use.
          dispatch(setCredentials({ user: data.data.user }));
        } catch {
          // Error handled by the component
        }
      },
    }),

    logout: builder.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearAuth());
        }
      },
    }),

    verifyEmail: builder.mutation({
      query: (body) => ({ url: '/auth/verify-email', method: 'POST', body }),
    }),

    resendVerification: builder.mutation({
      query: (body) => ({ url: '/auth/resend-verification', method: 'POST', body }),
    }),

    forgotPassword: builder.mutation({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    resetPassword: builder.mutation({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),

    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Auth'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({ user: data.data }));
        } catch {
          dispatch(clearAuth());
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useSignupMutation,
  useLoginMutation,
  useLogoutMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
} = authApi;
