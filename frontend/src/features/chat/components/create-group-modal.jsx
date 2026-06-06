'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Search, X, Users, ArrowRight, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/common';
import { useCreateGroupMutation } from '../services/chatApi';
import { activeChatSet } from '../store/chatSlice';
import { selectAllPresence } from '@/features/presence/store/presenceSlice';
import {
  useSearchUsersQuery,
  useGetContactsQuery,
} from '@/features/profile';

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2].map((s) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            s === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Selected member chip ─────────────────────────────────────────────────────

function MemberChip({ user, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full pl-1 pr-2 py-0.5 text-xs font-medium shrink-0">
      <UserAvatar user={user} size="sm" showStatus={false} className="!h-5 !w-5 shrink-0" />
      <span className="max-w-[80px] truncate">{user.name}</span>
      <button
        onClick={() => onRemove(user.id)}
        className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
        aria-label={`Remove ${user.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({ user, isSelected, onToggle, presenceStatuses }) {
  const isOnline = presenceStatuses[user.id?.toString()]?.status === 'online';

  return (
    <button
      onClick={() => onToggle(user)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
    >
      <UserAvatar
        user={user}
        size="md"
        showStatus
        isOnline={isOnline}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
      </div>
      <div
        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          isSelected
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/30'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </button>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ rows = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-2.5 w-20 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CreateGroupModal ─────────────────────────────────────────────────────────

export function CreateGroupModal({ open, onOpenChange }) {
  const router   = useRouter();
  const dispatch = useDispatch();
  const currentUser      = useSelector((s) => s.auth.user);
  const presenceStatuses = useSelector(selectAllPresence);

  // ── State ────────────────────────────────────────────────────────────────
  const [step,        setStep]        = useState(1);   // 1 = details, 2 = members
  const [groupName,   setGroupName]   = useState('');
  const [description, setDescription] = useState('');
  const [selected,    setSelected]    = useState([]);  // array of user objects
  const [searchQuery, setSearchQuery] = useState('');
  const [debounced,   setDebounced]   = useState('');

  const nameRef   = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation();

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(1);
      setGroupName('');
      setDescription('');
      setSelected([]);
      setSearchQuery('');
      setDebounced('');
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open]);

  // ── Search debounce ──────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(searchQuery), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  // ── Focus search on step 2 ───────────────────────────────────────────────
  useEffect(() => {
    if (step === 2) setTimeout(() => searchRef.current?.focus(), 80);
  }, [step]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: contactsRes, isLoading: contactsLoading } = useGetContactsQuery(
    { page: 1, limit: 100 },
    { skip: !open || step !== 2 },
  );
  const contactsRaw = contactsRes?.data?.contacts ?? contactsRes?.contacts ?? contactsRes?.data ?? [];
  const contacts = Array.isArray(contactsRaw)
    ? contactsRaw
        .filter((c) => c.id?.toString() !== currentUser?.id?.toString())
        .map((c) => ({ ...c, name: c.displayName || c.username }))
    : [];

  const isSearchMode = debounced.length >= 2;
  const { data: searchRes, isFetching: isSearching } = useSearchUsersQuery(
    { q: debounced, page: 1, limit: 20 },
    { skip: !open || step !== 2 || !isSearchMode },
  );
  const searchResults = (searchRes?.data?.users ?? [])
    .filter((u) => u.id?.toString() !== currentUser?.id?.toString())
    .map((u) => ({ ...u, name: u.displayName || u.username }));

  const selectedIds = new Set(selected.map((u) => u.id?.toString()));

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleUser = useCallback((user) => {
    setSelected((prev) => {
      const id = user.id?.toString();
      return prev.some((u) => u.id?.toString() === id)
        ? prev.filter((u) => u.id?.toString() !== id)
        : [...prev, user];
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim()) return toast.error('Group name is required');
    if (selected.length === 0) return toast.error('Add at least one member');
    try {
      const result = await createGroup({
        name: groupName.trim(),
        description: description.trim() || undefined,
        memberIds: selected.map((u) => u.id),
      }).unwrap();
      const chatId = result.data?.id?.toString();
      if (chatId) dispatch(activeChatSet(chatId));
      onOpenChange(false);
      router.push('/chat');
      toast.success(`"${groupName.trim()}" created`);
    } catch (err) {
      toast.error(err?.data?.message ?? 'Could not create group');
    }
  }, [groupName, description, selected, createGroup, dispatch, router, onOpenChange]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-md overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border space-y-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">New Group</DialogTitle>
            <StepDots step={step} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {step === 1 ? 'Name your group' : `Add members · ${selected.length} selected`}
          </p>
        </DialogHeader>

        {/* ── Step 1: details ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-7 w-7 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-name">Group name <span className="text-destructive">*</span></Label>
              <Input
                id="group-name"
                ref={nameRef}
                placeholder="e.g. Project Alpha"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && groupName.trim() && setStep(2)}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground text-right">{groupName.length}/60</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-desc">Description <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Textarea
                id="group-desc"
                placeholder="What's this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={200}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full gap-2"
              disabled={!groupName.trim()}
              onClick={() => setStep(2)}
            >
              Next: Add Members
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── Step 2: member picker ─────────────────────────────────────── */}
        {step === 2 && (
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto">
                {selected.map((u) => (
                  <MemberChip key={u.id} user={u} onRemove={(id) =>
                    setSelected((prev) => prev.filter((p) => p.id?.toString() !== id?.toString()))
                  } />
                ))}
              </div>
            )}

            {/* Search bar */}
            <div className="px-3 py-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Search contacts or users..."
                  className="pl-10 bg-muted/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* User list */}
            <ScrollArea className="max-h-[280px]">
              <div className="p-2">
                {isSearchMode ? (
                  isSearching ? (
                    <Skeleton rows={4} />
                  ) : searchResults.length > 0 ? (
                    searchResults.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isSelected={selectedIds.has(u.id?.toString())}
                        onToggle={toggleUser}
                        presenceStatuses={presenceStatuses}
                      />
                    ))
                  ) : (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      No users found for &ldquo;{debounced}&rdquo;
                    </p>
                  )
                ) : contactsLoading ? (
                  <Skeleton rows={4} />
                ) : contacts.length > 0 ? (
                  <>
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Contacts
                    </p>
                    {contacts.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isSelected={selectedIds.has(u.id?.toString())}
                        onToggle={toggleUser}
                        presenceStatuses={presenceStatuses}
                      />
                    ))}
                  </>
                ) : (
                  <p className="text-center py-8 text-sm text-muted-foreground">
                    Search to find users to add
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={selected.length === 0 || isCreating}
                onClick={handleCreate}
              >
                {isCreating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                ) : (
                  `Create Group (${selected.length})`
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
