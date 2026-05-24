import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/services/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import callReducer from '@/features/call/store/callSlice';
import socketReducer from '@/features/socket/store/socketSlice';
import presenceReducer from '@/features/presence/store/presenceSlice';
import chatReducer from '@/features/chat/store/chatSlice';
import notificationReducer from '@/features/notification/store/notificationSlice';

export const store = configureStore({
  reducer: {
    auth:         authReducer,
    call:         callReducer,
    socket:       socketReducer,
    presence:     presenceReducer,
    chat:         chatReducer,
    notification: notificationReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
