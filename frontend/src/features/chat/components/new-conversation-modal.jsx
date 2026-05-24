'use client';

/**
 * NewConversationModal — floating dialog for starting a direct conversation.
 *
 * Three content modes:
 *   Default  → "Recent" (last DMs from Redux) + "Contacts" (GET /users/contacts)
 *   Search   → debounced GET /users/search results (activates at ≥ 2 chars)
 *   Loading  → pulse skeletons while contacts API resolves
 *
 * Clicking a user:
 *   1. POST /chats/direct { userId }  (getOrCreateDirect — idempotent)
 *   2. dispatch activeChatSet(chat.id)
 *   3. Close modal
 *   4. router.push('/chat')
 *
 * The other user's sidebar updates automatically via chat:new_chat socket
 * (emitted by the backend on new chat creation).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Search, Loader2, Users2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/common';
import { useGetOrCreateDirectMutation } from '../services/chatApi';
import { activeChatSet, selectChats } from '../store/chatSlice';
import { selectAllPresence } from '@/features/presence/store/presenceSlice';
import {
  useSearchUsersQuery,
  useGetContactsQuery,
} from '@/features/profile';

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-2.5 w-20 rounded bg-muted" />
      </div>
    </div>
  );
}

function LoadingSkeleton({ rows = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptySearch({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">No results for &ldquo;{query}&rdquo;</p>
      <p className="text-xs text-muted-foreground mt-1">Try a different name or @username</p>
    </div>
  );
}

function EmptyContacts() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <Users2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">No contacts yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Search above to find people to message
      </p>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────

/**
 * Defined outside the modal to avoid re-mount on every modal render.
 * presenceStatuses is passed as a prop (from selectAllPresence) so this
 * component does not need its own useSelector call.
 */
function UserRow({ user, presenceStatuses, onClick, isStarting }) {
  const status     = presenceStatuses[user.id?.toString()] ?? 'offline';
  const displayName = user.name || user.displayName || user.username || 'Unknown';
  const avatarUser = { name: displayName, avatar: user.avatar, status };

  return (
    <button
      type="button"
      onClick={() => onClick(user.id?.toString())}
      disabled={isStarting}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <UserAvatar user={avatarUser} size="md" showStatus />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
      </div>
      {isStarting ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      ) : status === 'online' ? (
        <span className="text-xs text-green-500 font-medium shrink-0">Online</span>
      ) : null}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function NewConversationModal({ open, onOpenChange }) {
  const router          = useRouter();
  const dispatch        = useDispatch();
  const searchRef       = useRef(null);

  const [searchQuery,    setSearchQuery]    = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [startingUserId, setStartingUserId] = useState(null);

  const currentUser      = useSelector((s) => s.auth.user);
  const chats            = useSelector(selectChats);
  const presenceStatuses = useSelector(selectAllPresence);

  const [getOrCreateDirect] = useGetOrCreateDirectMutation();

  // ── Debounce search input ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Reset + focus when modal opens ───────────────────────────────────────
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setDebouncedQuery('');
      setStartingUserId(null);
      // Small delay to let the dialog animation finish before focusing
      const t = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Recent DMs — derived free from Redux, no API call ────────────────────
  const recentUsers = (chats ?? [])
    .filter((c) => c.type === 'direct')
    .slice(0, 6)
    .map((c) => {
      const other = (c.participants ?? []).find(
        (p) => p.id?.toString() !== currentUser?.id?.toString(),
      );
      return other
        ? { ...other, name: other.name || other.displayName || other.username }
        : null;
    })
    .filter(Boolean);

  // ── Contacts from API ────────────────────────────────────────────────────
  const { data: contactsRes, isLoading: contactsLoading } = useGetContactsQuery(
    { page: 1, limit: 50 },
    { skip: !open },
  );
  const contactsData = contactsRes?.data?.contacts ?? contactsRes?.contacts ?? contactsRes?.data ?? [];
  const contacts = Array.isArray(contactsData)
    ? contactsData.map((c) => ({
        ...c,
        name: c.displayName || c.username,
      }))
    : [];

  // ── Search results (activates at ≥ 2 chars) ──────────────────────────────
  const isSearchMode = debouncedQuery.length >= 2;
  const { data: searchRes, isFetching: isSearching } = useSearchUsersQuery(
    { q: debouncedQuery, page: 1, limit: 20 },
    { skip: !open || !isSearchMode },
  );
  const searchResults = searchRes?.data?.users ?? [];

  // ── Start a conversation ──────────────────────────────────────────────────
  const startChat = useCallback(
    async (userId) => {
      if (!userId || startingUserId) return;
      setStartingUserId(userId);
      try {
        const result = await getOrCreateDirect(userId).unwrap();
        // chatAdded is already dispatched by chatApi.onQueryStarted
        dispatch(activeChatSet(result.data?.id?.toString()));
        onOpenChange(false);
        router.push('/chat');
      } catch {
        toast.error('Could not open conversation. Please try again.');
      } finally {
        setStartingUserId(null);
      }
    },
    [getOrCreateDirect, dispatch, router, onOpenChange, startingUserId],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-md overflow-hidden">
        {/* Header + search */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border space-y-2">
          <DialogTitle className="text-base font-semibold">New Conversation</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search by name or @username..."
              className="pl-10 bg-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2">
            {isSearchMode ? (
              // ── Search mode ──────────────────────────────────────────────
              isSearching ? (
                <LoadingSkeleton rows={5} />
              ) : searchResults.length > 0 ? (
                <>
                  <SectionLabel>Results for &ldquo;{debouncedQuery}&rdquo;</SectionLabel>
                  {searchResults.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      presenceStatuses={presenceStatuses}
                      onClick={startChat}
                      isStarting={startingUserId === user.id?.toString()}
                    />
                  ))}
                </>
              ) : (
                <EmptySearch query={debouncedQuery} />
              )
            ) : (
              // ── Default mode ─────────────────────────────────────────────
              <>
                {/* Recent DMs */}
                {recentUsers.length > 0 && (
                  <>
                    <SectionLabel>Recent</SectionLabel>
                    {recentUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        presenceStatuses={presenceStatuses}
                        onClick={startChat}
                        isStarting={startingUserId === user.id?.toString()}
                      />
                    ))}
                    <Separator className="my-2" />
                  </>
                )}

                {/* Contacts */}
                {contactsLoading ? (
                  <>
                    <SectionLabel>Contacts</SectionLabel>
                    <LoadingSkeleton rows={4} />
                  </>
                ) : contacts.length > 0 ? (
                  <>
                    <SectionLabel>Contacts</SectionLabel>
                    {contacts.map((contact) => (
                      <UserRow
                        key={contact.id}
                        user={contact}
                        presenceStatuses={presenceStatuses}
                        onClick={startChat}
                        isStarting={startingUserId === contact.id?.toString()}
                      />
                    ))}
                  </>
                ) : recentUsers.length === 0 ? (
                  <EmptyContacts />
                ) : null}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        {!isSearchMode && (contacts.length > 0 || recentUsers.length > 0) && (
          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Type to search all users &mdash; or{' '}
              <button
                type="button"
                onClick={() => { onOpenChange(false); router.push('/contacts'); }}
                className="text-primary hover:underline font-medium"
              >
                manage contacts
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
