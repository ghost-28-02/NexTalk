'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'sonner';
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
  ArrowLeft, MoreVertical, Send, Paperclip,
  Smile, Image as ImageIcon, FileText, Info, Search, Pin,
  VolumeX, Trash2, Archive, X, Loader2, Film, File,
} from 'lucide-react';
import { useSocket } from '@/features/socket';
import { useTyping } from '@/features/socket/hooks/useTyping';
import { useChatActions } from '../hooks/useChatActions';
import { selectTypingUsers, messageReceived, selectActiveChatId } from '../store/chatSlice';
import { useSendMediaMessageMutation } from '../services/chatApi';

// ─── Emoji data ───────────────────────────────────────────────────────────────

const EMOJI_CATEGORIES = [
  {
    label: '😊 Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
      '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😔','😪','🤤','😴','😷','🤒','🤕',
      '🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥸','😎','🤓','🧐','😕','😟','🙁','☹️',
      '😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞',
      '😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺',
      '👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    ],
  },
  {
    label: '👋 Gestures',
    emojis: [
      '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
      '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️',
      '💅','🤳','💪','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👁','👅','👄',
    ],
  },
  {
    label: '❤️ Hearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞',
      '💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🪯','🛐','⛎','♈',
      '♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️',
    ],
  },
  {
    label: '🎉 Celebration',
    emojis: [
      '🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗',
      '🎆','🎇','🧨','✨','🎃','🎄','🎋','🎍','🎎','🎐','🎑','🧧','🎠','🎡','🎢','🎪',
      '🤹','🎭','🩰','🎨','🖼','🎰','🎲','🧩','🪀','🪁','🎯','🎳','🎮','🎰','🗺','🧸',
    ],
  },
  {
    label: '🍕 Food',
    emojis: [
      '🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🫓',
      '🥨','🥯','🧀','🥗','🥙','🌮','🌯','🫔','🥪','🍱','🍘','🍙','🍚','🍛','🍜','🍝',
      '🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦',
      '🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','☕','🫖','🍵',
      '🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🫗','🧊','🥄','🍴',
    ],
  },
  {
    label: '🌍 Travel',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵',
      '🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🚨','🚥','🚦','🛑','🚧','🚣','⛵',
      '🚤','🛥','🛳','⛴','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛸',
      '🚀','🛰','🪐','🌍','🌎','🌏','🗺','🧭','⛰','🏔','🗻','🏕','🏖','🏜','🏝','🏞',
    ],
  },
  {
    label: '⚽ Sports',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥅','⛳',
      '🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🪂','🏋',
      '🤼','🤸','⛹','🤺','🏊','🚴','🏇','🧘','🛀','🏄','🤽','🚵','🤾','🏌','🏃','🚶',
    ],
  },
  {
    label: '💻 Objects',
    emojis: [
      '💻','🖥','🖨','⌨️','🖱','🖲','💾','💿','📀','📱','☎️','📞','📟','📠','📺','📻',
      '🧭','⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯','🪔','🧯','🛢',
      '💸','💵','💴','💶','💷','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒','🛠',
      '⛏','🔩','🪝','🧲','🔫','💣','🪤','🔪','🗡','⚔️','🛡','🚬','⚰️','⚱️','🏺','🔮',
    ],
  },
  {
    label: '🔥 Symbols',
    emojis: [
      '🔥','💥','✨','🌟','⭐','🌙','☀️','🌈','⚡','❄️','💧','🌊','🌀','🌪','🌫','🌬',
      '🌡','⛱','🌂','☂️','☔','⛄','☃️','🌁','💫','✅','❎','🆗','🆙','🆒','🆕','🆓',
      '0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔠','🔡','🔢','🔣','🔤',
      '🅰️','🆎','🅱️','🆑','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','📵',
    ],
  },
];

// ─── Emoji Picker ─────────────────────────────────────────────────────────────

function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-80 bg-popover border border-border rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b border-border bg-muted/30 scrollbar-hide">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActiveCategory(i)}
            className={cn(
              'px-3 py-2 text-base shrink-0 transition-colors',
              activeCategory === i ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            title={cat.label}
          >
            {cat.emojis[0]}
          </button>
        ))}
      </div>

      {/* Category label */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {EMOJI_CATEGORIES[activeCategory].label}
        </p>
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 px-2 pb-3 max-h-52 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            className="text-xl p-1 rounded-lg hover:bg-muted transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── File preview (before send) ──────────────────────────────────────────────

function FilePreview({ file, onRemove }) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const previewUrl = isImage || isVideo ? URL.createObjectURL(file) : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-xl border border-border max-w-xs">
      {isImage && previewUrl && (
        <img src={previewUrl} alt={file.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
      )}
      {isVideo && (
        <Film className="h-8 w-8 text-primary shrink-0" />
      )}
      {!isImage && !isVideo && (
        <File className="h-8 w-8 text-primary shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────

export function ChatWindow({ chat, messages, onToggleInfo, showInfoPanel, isMobile, onBack }) {
  const [newMessage,    setNewMessage]    = useState('');
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [pendingFile,   setPendingFile]   = useState(null); // file selected but not yet sent
  const [isUploading,   setIsUploading]   = useState(false);

  const scrollRef     = useRef(null);
  const inputRef      = useRef(null);
  const mediaInputRef = useRef(null); // for image/video
  const fileInputRef  = useRef(null); // for documents

  const dispatch     = useDispatch();
  const currentUser  = useSelector((s) => s.auth.user);
  const activeChatId = useSelector(selectActiveChatId);
  const typingUsers  = useSelector(selectTypingUsers(chat?.id?.toString()));

  const socket                      = useSocket();
  const { handleTyping, stopTyping } = useTyping(socket, chat?.id?.toString());
  const { sendMessage }              = useChatActions();
  const [sendMediaMessage]           = useSendMediaMessageMutation();
  const isGroupChat      = chat?.type === 'group';
  const chatName         = chat?.name || 'Chat';
  const chatAvatar       = chat?.avatar;
  const otherParticipant = !isGroupChat
    ? (chat?.participants ?? []).find((p) => p.id?.toString() !== currentUser?.id?.toString())
    : null;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  // ── Send text ────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = newMessage.trim();
    if (!text) return;
    stopTyping();
    sendMessage(text);
    setNewMessage('');
    inputRef.current?.focus();
  }, [newMessage, stopTyping, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pendingFile) {
        handleSendFile();
      } else {
        handleSend();
      }
    }
    if (e.key === 'Escape') {
      setShowEmoji(false);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  // ── Emoji ────────────────────────────────────────────────────────────────

  const handleEmojiSelect = useCallback((emoji) => {
    const input = inputRef.current;
    if (!input) {
      setNewMessage((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? newMessage.length;
    const end   = input.selectionEnd   ?? newMessage.length;
    const next  = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(next);
    // Restore cursor position after emoji insertion
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  }, [newMessage]);

  // ── File pick ────────────────────────────────────────────────────────────

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 50 MB limit (matches backend)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 50 MB.');
      return;
    }
    setPendingFile(file);
    setShowEmoji(false);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // ── Send file ────────────────────────────────────────────────────────────

  const handleSendFile = useCallback(async () => {
    if (!pendingFile || !activeChatId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      const res = await sendMediaMessage({ chatId: activeChatId, formData }).unwrap();

      // Dispatch the real message into Redux immediately so it appears
      // in the chat without waiting for a socket broadcast or page refresh.
      const msg = res?.data ?? res;
      if (msg) dispatch(messageReceived(msg));

      setPendingFile(null);
    } catch {
      toast.error('Failed to send file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [pendingFile, activeChatId, sendMediaMessage, dispatch]);

  const canSend = newMessage.trim().length > 0 || pendingFile;

  if (!chat) return null;

  return (
    <div className={cn('flex flex-col bg-background h-full overflow-hidden', isMobile ? 'w-full' : 'flex-1')}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
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
                  {otherParticipant.status === 'online'
                    ? <span className="text-success">Online</span>
                    : 'Offline'}
                </p>
              ) : null}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {!isMobile && (
            <Button variant={showInfoPanel ? 'secondary' : 'ghost'} size="icon" onClick={onToggleInfo}>
              <Info className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-1 max-w-3xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <span className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">Today</span>
          </div>

          {(messages ?? []).map((message, index) => {
            const prevMessage = messages[index - 1];
            const nextMessage = messages[index + 1];
            const showAvatar = isGroupChat && (
              !prevMessage || prevMessage.senderId !== message.senderId
            );
            const isNewSender = !prevMessage || prevMessage.senderId !== message.senderId;
            const isLastFromSender = !nextMessage || nextMessage.senderId !== message.senderId;
            return (
              <div key={message.id} className={cn(isNewSender && 'mt-3')}>
                <MessageBubble
                  message={message}
                  currentUserId={currentUser?.id}
                  showAvatar={showAvatar}
                  isGroupChat={isGroupChat}
                  isLastFromSender={isLastFromSender}
                />
              </div>
            );
          })}

          {/* Typing indicator — appears at bottom of message list, same position as incoming messages */}
          {typingUsers.length > 0 && (
            <div className="mt-3">
              {typingUsers.map(({ userId, displayName }) => (
                <TypingIndicator key={userId} userName={displayName} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">

          {/* File preview strip */}
          {pendingFile && (
            <div className="flex items-center gap-2">
              <FilePreview file={pendingFile} onRemove={() => setPendingFile(null)} />
              {newMessage.trim() === '' && (
                <p className="text-xs text-muted-foreground">Press Enter or Send to upload</p>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">

            {/* Hidden file inputs */}
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChosen}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
              className="hidden"
              onChange={handleFileChosen}
            />

            {/* Attachment button */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              title="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            {/* Media button (image / video) */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 hidden sm:flex"
              title="Send image or video"
              onClick={() => mediaInputRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>

            {/* Text input + emoji trigger */}
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="pr-10 bg-muted/50"
                disabled={isUploading}
              />
              {/* Emoji button inside input */}
              <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    showEmoji ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
              </div>

              {/* Emoji picker popover */}
              {showEmoji && (
                <EmojiPicker
                  onSelect={(emoji) => { handleEmojiSelect(emoji); }}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>

            {/* Send button */}
            <Button
              size="icon"
              className={cn(
                'shrink-0 transition-all',
                canSend ? 'gradient-primary text-white border-0' : 'opacity-40 cursor-not-allowed',
              )}
              disabled={!canSend || isUploading}
              onClick={pendingFile && !newMessage.trim() ? handleSendFile : handleSend}
            >
              {isUploading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Send className="h-5 w-5" />
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
