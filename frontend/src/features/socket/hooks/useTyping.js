'use client';

/**
 * useTyping — client-side typing indicator with debounce.
 *
 * Strategy:
 *   - First keystroke → emit typing_start immediately (low latency)
 *   - Each subsequent keystroke → reset 3s debounce timer
 *   - After 3s of no keystrokes → emit typing_stop
 *   - Sending a message → emit typing_stop immediately
 *   - Unmount / chat change → emit typing_stop + clear all timers
 *
 * Server has a 6s safety timeout as backup — so even if the browser
 * freezes, the typing indicator clears within 6s on the receiver side.
 *
 * Usage:
 *   const { handleTyping, stopTyping } = useTyping(socket, chatId);
 *
 *   // In your message input handler:
 *   <input onChange={handleTyping} />
 *
 *   // When message is sent:
 *   stopTyping(); // call before / after sending
 */

import { useRef, useCallback, useEffect } from 'react';
import { CHAT_EVENTS } from '../constants/socketEvents';

const TYPING_DEBOUNCE_MS = 3000; // emit stop after 3s of silence

/**
 * @param {import('socket.io-client').Socket | null} socket
 * @param {string | null} chatId — the active chat room; resets typing state on change
 * @returns {{ handleTyping: () => void, stopTyping: () => void }}
 */
export function useTyping(socket, chatId) {
  const isTypingRef  = useRef(false);
  const timerRef     = useRef(null);
  const chatIdRef    = useRef(chatId);

  // Keep chatIdRef current so the timeout closure has the latest chatId
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const clearDebounce = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Emit typing_stop if currently typing. Idempotent — safe to call multiple times.
   */
  const stopTyping = useCallback(() => {
    clearDebounce();
    if (isTypingRef.current && socket?.connected && chatIdRef.current) {
      socket.emit(CHAT_EVENTS.TYPING_STOP, { chatId: chatIdRef.current });
    }
    isTypingRef.current = false;
  }, [socket, clearDebounce]);

  /**
   * Call this on every input change event (e.g., <input onChange={handleTyping}>).
   * Handles debounce internally — does not need throttling from the caller.
   */
  const handleTyping = useCallback(() => {
    if (!socket?.connected || !chatIdRef.current) return;

    if (!isTypingRef.current) {
      // First keystroke after silence — emit immediately
      socket.emit(CHAT_EVENTS.TYPING_START, { chatId: chatIdRef.current });
      isTypingRef.current = true;
    }

    // Reset the debounce timer on every keystroke
    clearDebounce();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (isTypingRef.current && socket?.connected && chatIdRef.current) {
        socket.emit(CHAT_EVENTS.TYPING_STOP, { chatId: chatIdRef.current });
      }
      isTypingRef.current = false;
    }, TYPING_DEBOUNCE_MS);
  }, [socket, clearDebounce]);

  // Cleanup on unmount or chat change — always stop typing before leaving
  useEffect(() => {
    return () => {
      clearDebounce();
      if (isTypingRef.current && socket?.connected && chatIdRef.current) {
        socket.emit(CHAT_EVENTS.TYPING_STOP, { chatId: chatIdRef.current });
      }
      isTypingRef.current = false;
    };
  }, [socket, chatId, clearDebounce]); // chatId in deps resets on room change

  return { handleTyping, stopTyping };
}
