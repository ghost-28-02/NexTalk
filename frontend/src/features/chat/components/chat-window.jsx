'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { MessageBubble, TypingIndicator } from './message-bubble';
import { UserAvatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Mic,
  Image as ImageIcon,
  FileText,
  Info,
  Search,
  Pin,
  VolumeX,
  Trash2,
  Archive,
} from 'lucide-react';
import { useSocket } from '@/features/socket';
import { useTyping } from '@/features/socket/hooks/useTyping';
import { useChatActions } from '../hooks/useChatActions';
import { selectTypingUsers } from '../store/chatSlice';

/**
 * ChatWindow
 *
 * Props:
 *   chat          — active chat DTO from chatSlice (name/avatar pre-computed)
 *   messages      — message array from chatSlice for this chat
 *   onToggleInfo  — toggle the info panel
 *   showInfoPanel — whether info panel is visible
 *   isMobile      — layout switch
 *   onBack        — back button (mobile only)
 */
export function ChatWindow({
  chat,
  messages,
  onToggleInfo,
  showInfoPanel,
  isMobile,
  onBack,
}) {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef                   = useRef(null);
  const inputRef                    = useRef(null);

  // Auth state — currentUser drives "is own message?" logic
  const currentUser = useSelector((s) => s.auth.user);

  // Typing users in this chat from Redux (set by useChatSocket)
  const typingUsers = useSelector(selectTypingUsers(chat?.id?.toString()));

  // Socket + typing hook
  const socket = useSocket();
  const { handleTyping, stopTyping } = useTyping(socket, chat?.id?.toString());

  // Optimistic send hook
  const { sendMessage } = useChatActions();

  const isGroupChat = chat?.type === 'group';

  // Derive display values from the DTO (already pre-computed by backend)
  const chatName   = chat?.name || 'Chat';
  const chatAvatar = chat?.avatar;

  // For DMs: find the other participant for status display
  const otherParticipant = !isGroupChat
    ? (chat?.participants ?? []).find(
        (p) => p.id?.toString() !== currentUser?.id?.toString(),
      )
    : null;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;
    stopTyping();
    sendMessage(text);
    setNewMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  if (!chat) return null;

  return (
    <div className={cn('flex flex-col bg-background h-full overflow-hidden', isMobile ? 'w-full' : 'flex-1')}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-16 px-4 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          {isMobile && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <button
            onClick={onToggleInfo}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {isGroupChat ? (
              <Avatar className="h-10 w-10 border-2 border-background">
                <AvatarImage src={chatAvatar} alt={chatName} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {chatName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : otherParticipant ? (
              <UserAvatar user={otherParticipant} size="md" />
            ) : null}

            <div className="text-left">
              <h2 className="font-semibold">{chatName}</h2>
              {isGroupChat ? (
                <p className="text-xs text-muted-foreground">
                  {(chat.participants ?? []).length} members
                </p>
              ) : otherParticipant ? (
                <p className="text-xs text-muted-foreground">
                  {otherParticipant.status === 'online' ? (
                    <span className="text-success">Online</span>
                  ) : (
                    'Offline'
                  )}
                </p>
              ) : null}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Link href={`/call/audio?chat=${chat.id}`}>
            <Button variant="ghost" size="icon">
              <Phone className="h-5 w-5" />
            </Button>
          </Link>
          <Link href={`/call/video?chat=${chat.id}`}>
            <Button variant="ghost" size="icon">
              <Video className="h-5 w-5" />
            </Button>
          </Link>
          {!isMobile && (
            <Button
              variant={showInfoPanel ? 'secondary' : 'ghost'}
              size="icon"
              onClick={onToggleInfo}
            >
              <Info className="h-5 w-5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Search className="h-4 w-4 mr-2" />
                Search in chat
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pin className="h-4 w-4 mr-2" />
                {chat.isPinned ? 'Unpin chat' : 'Pin chat'}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <VolumeX className="h-4 w-4 mr-2" />
                {chat.isMuted ? 'Unmute' : 'Mute notifications'}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="h-4 w-4 mr-2" />
                Archive chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      {/*
        min-h-0 is required: without it a flex child won't shrink below its
        content size, so the messages area expands and pushes the input off-screen.
        overflow-y-auto on the same element makes it the scroll container so
        scrollRef.current.scrollTop works correctly.
      */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
              Today
            </span>
          </div>

          {(messages ?? []).map((message, index) => {
            const prevMessage = messages[index - 1];
            const showAvatar  =
              !prevMessage || prevMessage.senderId !== message.senderId;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                currentUserId={currentUser?.id}
                showAvatar={showAvatar}
                isGroupChat={isGroupChat}
              />
            );
          })}

          {/* Typing indicators from real socket state */}
          {typingUsers.map(({ userId, displayName }) => (
            <TypingIndicator key={userId} userName={displayName} />
          ))}
        </div>
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 hidden sm:flex"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Photo or Video
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="pr-10 bg-muted/50"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {newMessage.trim() ? (
            <Button
              size="icon"
              className="gradient-primary text-white border-0 shrink-0"
              onClick={handleSendMessage}
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="shrink-0">
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
