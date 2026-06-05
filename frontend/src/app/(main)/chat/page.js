'use client';

/**
 * ChatPage — the main chat view.
 *
 * Data flow:
 *   1. useGetMyChatsQuery fires on mount → onQueryStarted seeds chatSlice.chats
 *   2. User selects a chat → dispatch activeChatSet → chatSlice.activeChatId updated
 *   3. useGetMessagesQuery fires for the active chat → seeds chatSlice.messages[chatId]
 *   4. useChatSocket joins the room and wires all realtime events → chatSlice updates
 *   5. Components read from chatSlice selectors — no prop drilling of raw API data
 */

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChatSidebar, ChatWindow, ChatInfoPanel } from '@/features/chat/components';
import { MobileNav } from '@/components/layout';
import { useIsMobile } from '@/hooks';
import {
  useGetMyChatsQuery,
  useGetMessagesQuery,
  useMarkReadMutation,
} from '@/features/chat/services/chatApi';
import { useChatSocket } from '@/features/chat/hooks/useChatSocket';
import {
  selectChats,
  selectActiveChatId,
  selectActiveChat,
  selectChatMessages,
  activeChatSet,
  markChatRead,
} from '@/features/chat/store/chatSlice';

export default function ChatPage() {
  const dispatch      = useDispatch();
  const isMobile      = useIsMobile();
  const [markRead]    = useMarkReadMutation();

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [mobileView,    setMobileView]    = useState('list');  // 'list' | 'chat'

  // ── Redux chat state ──────────────────────────────────────────────────────
  const chats        = useSelector(selectChats);
  const activeChatId = useSelector(selectActiveChatId);
  const activeChat   = useSelector(selectActiveChat);
  const messages     = useSelector(selectChatMessages(activeChatId));

  // ── API — load chat list once on mount ───────────────────────────────────
  // onQueryStarted in chatApi seeds chatSlice via dispatch(chatsLoaded(...))
  useGetMyChatsQuery();

  // ── API — load messages when active chat changes ──────────────────────────
  // refetchOnMountOrArgChange: true — forces a fresh fetch every time activeChatId
  // changes. Without this, RTK Query serves the stale cached result and
  // onQueryStarted never re-runs, so messages that arrived while the user was
  // in a different chat never appear until a full page refresh.
  useGetMessagesQuery(
    { chatId: activeChatId },
    { skip: !activeChatId, refetchOnMountOrArgChange: true },
  );

  // ── Socket — join room + listen for realtime events ──────────────────────
  useChatSocket();

  // ── Chat selection ────────────────────────────────────────────────────────
  const handleChatSelect = (chatId) => {
    dispatch(activeChatSet(chatId));
    dispatch(markChatRead(chatId));     // clear local unread badge immediately
    markRead(chatId).catch(() => {});   // persist lastReadAt + cross-device unread sync
    if (isMobile) setMobileView('chat');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  // On desktop, reset mobile view state when switching to desktop breakpoint
  useEffect(() => {
    if (!isMobile) setMobileView('list');
  }, [isMobile]);

  // ── Shared props ──────────────────────────────────────────────────────────
  const sidebarProps = {
    chats,
    activeChatId,
    onChatSelect: handleChatSelect,
  };

  const windowProps = {
    chat:         activeChat,
    messages,
    onToggleInfo: () => setShowInfoPanel((prev) => !prev),
    showInfoPanel,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-background flex flex-col">

      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <ChatSidebar {...sidebarProps} />

        <div className="flex-1 flex overflow-hidden h-full">
          {activeChat ? (
            <>
              <ChatWindow {...windowProps} />
              {showInfoPanel && (
                <ChatInfoPanel
                  chat={activeChat}
                  onClose={() => setShowInfoPanel(false)}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">
                  Choose a chat from the sidebar to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 md:hidden overflow-hidden">
        {mobileView === 'list' ? (
          <ChatSidebar {...sidebarProps} isMobile />
        ) : activeChat ? (
          <ChatWindow {...windowProps} isMobile onBack={handleBackToList} />
        ) : null}
        <MobileNav activePage="chat" />
      </div>

    </div>
  );
}
