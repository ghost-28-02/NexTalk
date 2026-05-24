'use client';

/**
 * useChatActions — optimistic message send with socket-first, HTTP fallback.
 *
 * Flow:
 *   1. Generate a tempId (nanoid)
 *   2. Dispatch `optimisticMessageAdded` → message appears with status 'sending'
 *   3a. Socket connected → emit NEW_MESSAGE with ack callback
 *       Ack success  → dispatch `optimisticMessageConfirmed` (replace temp with real)
 *       Ack failure  → dispatch `optimisticMessageFailed` (show retry UI)
 *   3b. Socket offline → HTTP POST via RTK Query mutation
 *       Success → dispatch `optimisticMessageConfirmed`
 *       Failure → dispatch `optimisticMessageFailed`
 *
 * retryMessage:
 *   Re-enters the same flow using the existing tempId and content.
 *   Resets status to 'sending' first so the spinner shows again.
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';
import { useSocket } from '@/features/socket';
import { CHAT_EVENTS } from '@/features/socket/constants/socketEvents';
import { useSendMessageMutation } from '../services/chatApi';
import {
  optimisticMessageAdded,
  optimisticMessageConfirmed,
  optimisticMessageFailed,
  optimisticMessageRetry,
  selectActiveChatId,
} from '../store/chatSlice';

export function useChatActions() {
  const dispatch        = useDispatch();
  const socket          = useSocket();
  const activeChatId    = useSelector(selectActiveChatId);
  const currentUser     = useSelector((s) => s.auth.user);
  const [sendMsgHttp]   = useSendMessageMutation();

  // ── Core send logic (shared by sendMessage and retryMessage) ─────────────
  const _dispatchSend = useCallback(
    (tempId, chatId, content, replyTo) => {
      if (socket?.connected) {
        socket.emit(
          CHAT_EVENTS.NEW_MESSAGE,
          { chatId, content, replyTo, tempId },
          (ack) => {
            if (ack?.success && ack?.message) {
              dispatch(optimisticMessageConfirmed({ tempId, message: ack.message }));
            } else {
              dispatch(optimisticMessageFailed(tempId));
            }
          },
        );
      } else {
        // HTTP fallback (socket disconnected / reconnecting)
        sendMsgHttp({ chatId, content, replyTo })
          .unwrap()
          .then((res) => {
            dispatch(optimisticMessageConfirmed({ tempId, message: res.data }));
          })
          .catch(() => {
            dispatch(optimisticMessageFailed(tempId));
          });
      }
    },
    [socket, dispatch, sendMsgHttp],
  );

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a new message in the active chat.
   * @param {string} content  — message text
   * @param {{ replyTo?: string }} options
   */
  const sendMessage = useCallback(
    (content, { replyTo } = {}) => {
      const text = content?.trim();
      if (!text || !activeChatId || !currentUser) return;

      const tempId = nanoid();

      dispatch(
        optimisticMessageAdded({
          tempId,
          chatId: activeChatId,
          content: text,
          sender: {
            id:          currentUser.id,
            name:        currentUser.displayName || currentUser.username,
            displayName: currentUser.displayName,
            username:    currentUser.username,
            avatar:      currentUser.avatar ?? null,
          },
        }),
      );

      _dispatchSend(tempId, activeChatId, text, replyTo);
    },
    [activeChatId, currentUser, dispatch, _dispatchSend],
  );

  /**
   * Retry a previously failed optimistic message.
   * @param {string} tempId   — the original temp message ID
   * @param {string} chatId   — which chat the message belongs to
   * @param {string} content  — the original message content
   */
  const retryMessage = useCallback(
    (tempId, chatId, content) => {
      dispatch(optimisticMessageRetry(tempId));
      _dispatchSend(tempId, chatId, content, undefined);
    },
    [dispatch, _dispatchSend],
  );

  return { sendMessage, retryMessage };
}
