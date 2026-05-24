'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import Link from 'next/link';
import { UserAvatar } from '@/components/common';
import { MobileNav } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Search,
  MessageSquare,
  Phone,
  MoreVertical,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { selectAllPresence } from '@/features/presence/store/presenceSlice';
import { activeChatSet } from '@/features/chat/store/chatSlice';
import { useGetOrCreateDirectMutation } from '@/features/chat/services/chatApi';
import {
  useGetContactsQuery,
  useGetPendingRequestsQuery,
  useSearchUsersQuery,
  useSendContactRequestMutation,
  useAcceptContactRequestMutation,
  useRejectContactRequestMutation,
  useRemoveContactMutation,
  useBlockUserMutation,
} from '@/features/profile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(name) {
  return (name || '?')[0].toUpperCase();
}

/** Group a sorted array of users by first letter of their display name. */
function groupByLetter(users) {
  return users.reduce((acc, user) => {
    const letter = (user.name || user.displayName || user.username || '#')[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(user);
    return acc;
  }, {});
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 rounded bg-muted" />
        <div className="h-2.5 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ searchFilter }) {
  const router          = useRouter();
  const dispatch        = useDispatch();
  const presences       = useSelector(selectAllPresence);
  const currentUser     = useSelector((s) => s.auth.user);

  const { data, isLoading, error } = useGetContactsQuery({ page: 1, limit: 100 });
  const [getOrCreateDirect]        = useGetOrCreateDirectMutation();
  const [removeContact]            = useRemoveContactMutation();
  const [blockUser]                = useBlockUserMutation();
  const [actionId, setActionId]    = useState(null); // userId currently being acted on

  const contactsData = data?.data?.contacts ?? data?.contacts ?? data?.data ?? [];
  const contacts = Array.isArray(contactsData)
    ? contactsData.map((c) => ({
        ...c,
        name: c.displayName || c.username,
        status: presences[c.id?.toString()] ?? c.status ?? 'offline',
      }))
    : [];

  const filtered = searchFilter
    ? contacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
          c.username?.toLowerCase().includes(searchFilter.toLowerCase()),
      )
    : contacts;

  const sorted  = [...filtered].sort((a, b) =>
    (a.name || '').localeCompare(b.name || ''),
  );
  const grouped = groupByLetter(sorted);
  const letters = Object.keys(grouped).sort();

  const handleMessage = async (userId) => {
    setActionId(userId);
    try {
      const res = await getOrCreateDirect(userId).unwrap();
      dispatch(activeChatSet(res.data?.id?.toString()));
      router.push('/chat');
    } catch {
      toast.error('Could not open conversation');
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (userId, name) => {
    try {
      await removeContact(userId).unwrap();
      toast.success(`${name} removed from contacts`);
    } catch {
      toast.error('Failed to remove contact');
    }
  };

  const handleBlock = async (userId, name) => {
    try {
      await blockUser(userId).unwrap();
      toast.success(`${name} blocked`);
    } catch {
      toast.error('Failed to block user');
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error)     return <EmptyState icon={Users} title="Failed to load contacts" subtitle="Please try again" />;
  if (sorted.length === 0) {
    return searchFilter
      ? <EmptyState icon={Search} title="No contacts match" subtitle={`No results for "${searchFilter}"`} />
      : <EmptyState icon={Users} title="No contacts yet" subtitle="Search for people to add them as contacts" />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {letters.map((letter) => (
          <div key={letter}>
            <div className="sticky top-0 bg-background py-1 z-10">
              <span className="text-xs font-bold text-primary uppercase">{letter}</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {grouped[letter].map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                >
                  <UserAvatar
                    user={{ name: contact.name, avatar: contact.avatar, status: contact.status }}
                    size="lg"
                    showStatus
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{contact.username}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMessage(contact.id?.toString())}
                      disabled={actionId === contact.id?.toString()}
                      title="Message"
                    >
                      {actionId === contact.id?.toString()
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <MessageSquare className="h-4 w-4" />
                      }
                    </Button>
                    <Link href="/call/audio">
                      <Button variant="ghost" size="icon" title="Voice call">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMessage(contact.id?.toString())}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemove(contact.id?.toString(), contact.name)}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Remove contact
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleBlock(contact.id?.toString(), contact.name)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Block
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ─── Pending Tab ──────────────────────────────────────────────────────────────

function PendingTab() {
  const presences = useSelector(selectAllPresence);
  const { data, isLoading, error } = useGetPendingRequestsQuery();
  const [acceptRequest] = useAcceptContactRequestMutation();
  const [rejectRequest] = useRejectContactRequestMutation();
  const [actionId, setActionId] = useState(null);

  const received = (data?.data?.received ?? []);
  const sent     = (data?.data?.sent ?? []);

  const handleAccept = async (userId, name) => {
    setActionId(userId);
    try {
      await acceptRequest(userId).unwrap();
      toast.success(`${name} added to contacts`);
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (userId, name) => {
    setActionId(userId);
    try {
      await rejectRequest(userId).unwrap();
      toast.success(`Request from ${name} declined`);
    } catch {
      toast.error('Failed to decline request');
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (error)     return <EmptyState icon={Clock} title="Failed to load requests" subtitle="Please try again" />;
  if (received.length === 0 && sent.length === 0) {
    return <EmptyState icon={Clock} title="No pending requests" subtitle="Contact requests you send and receive will appear here" />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Received */}
        {received.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Received ({received.length})
            </p>
            <div className="space-y-2">
              {received.map((req) => {
                const user   = req.requester;
                const status = presences[user?.id?.toString()] ?? 'offline';
                const name   = user?.displayName || user?.username || 'Unknown';
                return (
                  <div
                    key={req.requestId}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50"
                  >
                    <UserAvatar
                      user={{ name, avatar: user?.avatar, status }}
                      size="lg"
                      showStatus
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{user?.username}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="gradient-primary text-white border-0"
                        onClick={() => handleAccept(user?.id?.toString(), name)}
                        disabled={actionId === user?.id?.toString()}
                      >
                        {actionId === user?.id?.toString()
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><UserCheck className="h-4 w-4 mr-1" />Accept</>
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(user?.id?.toString(), name)}
                        disabled={actionId === user?.id?.toString()}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {received.length > 0 && sent.length > 0 && <Separator />}

        {/* Sent */}
        {sent.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Sent ({sent.length})
            </p>
            <div className="space-y-2">
              {sent.map((req) => {
                const user   = req.recipient;
                const status = presences[user?.id?.toString()] ?? 'offline';
                const name   = user?.displayName || user?.username || 'Unknown';
                return (
                  <div
                    key={req.requestId}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50"
                  >
                    <UserAvatar
                      user={{ name, avatar: user?.avatar, status }}
                      size="lg"
                      showStatus
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{user?.username}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Request pending
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
                      Pending
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Find People Tab ──────────────────────────────────────────────────────────

function FindPeopleTab() {
  const router          = useRouter();
  const dispatch        = useDispatch();
  const presences       = useSelector(selectAllPresence);
  const currentUser     = useSelector((s) => s.auth.user);
  const searchRef       = useRef(null);

  const [query,         setQuery]         = useState('');
  const [debouncedQ,    setDebouncedQ]    = useState('');
  const [actionId,      setActionId]      = useState(null);

  const [getOrCreateDirect]   = useGetOrCreateDirectMutation();
  const [sendRequest]          = useSendContactRequestMutation();

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const isSearching = debouncedQ.length >= 2;
  const { data, isFetching, error } = useSearchUsersQuery(
    { q: debouncedQ, page: 1, limit: 30 },
    { skip: !isSearching },
  );
  const results = (data?.data?.users ?? []).filter(
    (u) => u.id?.toString() !== currentUser?.id?.toString(),
  );

  const handleMessage = async (userId) => {
    setActionId(userId + '_msg');
    try {
      const res = await getOrCreateDirect(userId).unwrap();
      dispatch(activeChatSet(res.data?.id?.toString()));
      router.push('/chat');
    } catch {
      toast.error('Could not open conversation');
    } finally {
      setActionId(null);
    }
  };

  const handleAddContact = async (userId, name) => {
    setActionId(userId + '_add');
    try {
      await sendRequest(userId).unwrap();
      toast.success(`Contact request sent to ${name}`);
    } catch (err) {
      const code = err?.data?.code;
      if (code === 'ALREADY_CONTACTS') {
        toast.info(`You're already connected with ${name}`);
      } else if (code === 'REQUEST_ALREADY_SENT') {
        toast.info('Request already sent — waiting for them to accept');
      } else {
        toast.error(err?.data?.message ?? 'Could not send request');
      }
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search by name or @username..."
            className="pl-10 bg-muted/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 pt-2 space-y-1">
          {!isSearching ? (
            <EmptyState
              icon={Search}
              title="Find people"
              subtitle="Type at least 2 characters to search all users"
            />
          ) : isFetching ? (
            <LoadingSkeleton rows={5} />
          ) : error ? (
            <EmptyState icon={Search} title="Search failed" subtitle="Please try again" />
          ) : results.length === 0 ? (
            <EmptyState
              icon={Search}
              title={`No results for "${debouncedQ}"`}
              subtitle="Try a different name or @username"
            />
          ) : (
            results.map((user) => {
              const status = presences[user.id?.toString()] ?? 'offline';
              const name   = user.name || user.displayName || user.username;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <UserAvatar
                    user={{ name, avatar: user.avatar, status }}
                    size="lg"
                    showStatus
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{user.username}
                      {user.bio ? ` · ${user.bio}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMessage(user.id?.toString())}
                      disabled={actionId === user.id + '_msg'}
                      title="Message"
                    >
                      {actionId === user.id + '_msg'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <MessageSquare className="h-4 w-4" />
                      }
                    </Button>
                    <Button
                      size="sm"
                      className="gradient-primary text-white border-0"
                      onClick={() => handleAddContact(user.id?.toString(), name)}
                      disabled={actionId === user.id + '_add'}
                    >
                      {actionId === user.id + '_add'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><UserPlus className="h-4 w-4 mr-1" />Add</>
                      }
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [activeTab,     setActiveTab]     = useState('contacts');
  const [searchQuery,   setSearchQuery]   = useState('');
  const { data: pendingData }             = useGetPendingRequestsQuery();
  const pendingCount = (pendingData?.data?.received ?? []).length;

  // Search only applies to the Contacts tab
  const showSearch = activeTab === 'contacts';

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/chat" className="md:hidden">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Contacts</h1>
          </div>
        </div>

        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter contacts..."
              className="pl-10 bg-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => { setActiveTab(v); setSearchQuery(''); }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="mx-4 mt-4 w-fit shrink-0">
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-1.5" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            <Clock className="h-4 w-4 mr-1.5" />
            Pending
            {pendingCount > 0 && (
              <span className="ml-1.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="find">
            <Search className="h-4 w-4 mr-1.5" />
            Find People
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="flex-1 overflow-hidden m-0 mt-2">
          <ContactsTab searchFilter={searchQuery} />
        </TabsContent>

        <TabsContent value="pending" className="flex-1 overflow-hidden m-0 mt-2">
          <PendingTab />
        </TabsContent>

        <TabsContent value="find" className="flex-1 overflow-hidden m-0 mt-2 flex flex-col">
          <FindPeopleTab />
        </TabsContent>
      </Tabs>

      {/* Mobile nav */}
      <div className="md:hidden">
        <MobileNav activePage="contacts" />
      </div>
    </div>
  );
}
