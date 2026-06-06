'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChatSidebar, ChatWindow, ChatInfoPanel } from '@/features/chat/components';

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
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const dispatch   = useDispatch();
  const isMobile   = useIsMobile();
  const [markRead] = useMarkReadMutation();

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [mobileView,    setMobileView]    = useState('list'); // 'list' | 'chat'

  const chats        = useSelector(selectChats);
  const activeChatId = useSelector(selectActiveChatId);
  const activeChat   = useSelector(selectActiveChat);
  const messages     = useSelector(selectChatMessages(activeChatId));

  useGetMyChatsQuery();
  useGetMessagesQuery(
    { chatId: activeChatId },
    { skip: !activeChatId, refetchOnMountOrArgChange: true },
  );
  useChatSocket();

  const handleChatSelect = (chatId) => {
    dispatch(activeChatSet(chatId));
    dispatch(markChatRead(chatId));
    markRead(chatId).catch(() => {});
    if (isMobile) setMobileView('chat');
  };

  const handleBackToList = () => setMobileView('list');

  useEffect(() => {
    if (!isMobile) setMobileView('list');
  }, [isMobile]);

  const sidebarProps = { chats, activeChatId, onChatSelect: handleChatSelect };
  const windowProps  = {
    chat: activeChat, messages,
    onToggleInfo: () => setShowInfoPanel((p) => !p),
    showInfoPanel,
  };

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">

      {/* ── Desktop: icon-rail | chat-list | chat-window ──────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">

        {/* Chat list — 1 part */}
        <ChatSidebar {...sidebarProps} className="flex-[2]" />

        {/* Chat window — 2 parts */}
        <div className="flex-[4] flex overflow-hidden h-full">
          {activeChat ? (
            <>
              <ChatWindow {...windowProps} />
              {showInfoPanel && (
                <ChatInfoPanel chat={activeChat} onClose={() => setShowInfoPanel(false)} />
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium">Select a conversation</p>
              <p className="text-sm">Choose a chat from the sidebar to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: full-screen list or chat ─────────────────────────── */}
      <div className="flex flex-col flex-1 md:hidden overflow-hidden">
        {mobileView === 'list' ? (
          <ChatSidebar {...sidebarProps} isMobile />
        ) : activeChat ? (
          <ChatWindow {...windowProps} isMobile onBack={handleBackToList} />
        ) : null}
      </div>

    </div>
  );
}
