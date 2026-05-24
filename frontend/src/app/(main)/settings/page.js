'use client';

/**
 * Settings page — /settings
 *
 * Single scrollable page with clearly separated sections.
 * Each section that talks to the server has its own Save button so partial
 * changes are never lost. Theme is client-only (next-themes) and updates
 * instantly without a server round-trip.
 *
 * Sections:
 *   1. Account       — link to profile edit, email display, logout
 *   2. Notifications — messages, contact requests, calls (server-persisted)
 *   3. Privacy       — showLastSeen, showOnlineStatus (server-persisted)
 *   4. Appearance    — light / dark / system theme (client-only)
 *   5. About         — version, links (static)
 *
 * Future sections (wiring points already identified):
 *   - Security (change password, 2FA)
 *   - Sessions (active device list)
 *   - Blocked users
 *   - Data export / account deletion
 */

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useTheme }  from 'next-themes';
import {
  ArrowLeft, Bell, Lock, Palette, LogOut, User,
  ChevronRight, Moon, Sun, Monitor, Check, Loader2,
  MessageSquare, Phone, UserPlus, Eye, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }    from '@/components/ui/button';
import { Switch }    from '@/components/ui/switch';
import { Label }     from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn }        from '@/lib/utils';

import { useLogoutMutation }    from '@/features/auth';
import { clearAuth }            from '@/features/auth/store/authSlice';
import { useUpdateSettingsMutation } from '@/features/profile/services/userApi';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SaveBar({ isDirty, isSaving, onSave, onReset }) {
  if (!isDirty) return null;
  return (
    <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
      <Button variant="ghost" size="sm" onClick={onReset} disabled={isSaving}>
        Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
        Save
      </Button>
    </div>
  );
}

// ─── Account section ──────────────────────────────────────────────────────────

function AccountSection({ user, onLogout, isLoggingOut }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle icon={User} title="Account" />

      {/* Profile quick-link */}
      <button
        onClick={() => router.push('/profile')}
        className="w-full flex items-center gap-3 py-3 rounded-lg hover:bg-muted/50 transition-colors px-1 -mx-1"
      >
        <div className="flex-1 text-left">
          <p className="text-sm font-medium">{user?.displayName || user?.username}</p>
          <p className="text-[11px] text-muted-foreground">@{user?.username} · Edit profile</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <Separator className="my-2" />

      {user?.email && (
        <SettingRow label="Email" description={user.email} />
      )}

      <Separator className="my-2" />

      <div className="pt-1">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut
            ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            : <LogOut   className="h-3.5 w-3.5 mr-2" />}
          Sign out
        </Button>
      </div>
    </div>
  );
}

// ─── Notifications section ────────────────────────────────────────────────────

function NotificationsSection({ user }) {
  const serverSettings = user?.settings?.notifications ?? {};

  const [draft, setDraft] = useState({
    messages:        serverSettings.messages        ?? true,
    contactRequests: serverSettings.contactRequests ?? true,
    calls:           serverSettings.calls           ?? true,
  });

  useEffect(() => {
    setDraft({
      messages:        serverSettings.messages        ?? true,
      contactRequests: serverSettings.contactRequests ?? true,
      calls:           serverSettings.calls           ?? true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.settings?.notifications]);

  const [updateSettings, { isLoading }] = useUpdateSettingsMutation();

  const original = {
    messages:        serverSettings.messages        ?? true,
    contactRequests: serverSettings.contactRequests ?? true,
    calls:           serverSettings.calls           ?? true,
  };

  const isDirty = Object.keys(draft).some((k) => draft[k] !== original[k]);

  function toggle(key) {
    setDraft((p) => ({ ...p, [key]: !p[key] }));
  }

  async function handleSave() {
    try {
      await updateSettings({ notifications: draft }).unwrap();
      toast.success('Notification settings saved');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to save notification settings');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle icon={Bell} title="Notifications" />

      <SettingRow
        label="Messages"
        description="Get notified when you receive a new message"
      >
        <Switch
          checked={draft.messages}
          onCheckedChange={() => toggle('messages')}
          aria-label="Message notifications"
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Contact Requests"
        description="Get notified when someone sends you a contact request"
      >
        <Switch
          checked={draft.contactRequests}
          onCheckedChange={() => toggle('contactRequests')}
          aria-label="Contact request notifications"
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Calls"
        description="Get notified for incoming calls"
      >
        <Switch
          checked={draft.calls}
          onCheckedChange={() => toggle('calls')}
          aria-label="Call notifications"
        />
      </SettingRow>

      <SaveBar
        isDirty={isDirty}
        isSaving={isLoading}
        onSave={handleSave}
        onReset={() => setDraft({ ...original })}
      />
    </div>
  );
}

// ─── Privacy section ──────────────────────────────────────────────────────────

function PrivacySection({ user }) {
  const serverPrivacy = user?.settings?.privacy ?? {};

  const [draft, setDraft] = useState({
    showLastSeen:    serverPrivacy.showLastSeen    ?? true,
    showOnlineStatus: serverPrivacy.showOnlineStatus ?? true,
  });

  useEffect(() => {
    setDraft({
      showLastSeen:     serverPrivacy.showLastSeen     ?? true,
      showOnlineStatus: serverPrivacy.showOnlineStatus ?? true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.settings?.privacy]);

  const [updateSettings, { isLoading }] = useUpdateSettingsMutation();

  const original = {
    showLastSeen:     serverPrivacy.showLastSeen     ?? true,
    showOnlineStatus: serverPrivacy.showOnlineStatus ?? true,
  };

  const isDirty = Object.keys(draft).some((k) => draft[k] !== original[k]);

  function toggle(key) {
    setDraft((p) => ({ ...p, [key]: !p[key] }));
  }

  async function handleSave() {
    try {
      await updateSettings({ privacy: draft }).unwrap();
      toast.success('Privacy settings saved');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to save privacy settings');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle icon={Lock} title="Privacy" />

      <SettingRow
        label="Show Last Seen"
        description="Let others see when you were last active"
      >
        <Switch
          checked={draft.showLastSeen}
          onCheckedChange={() => toggle('showLastSeen')}
          aria-label="Show last seen"
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Show Online Status"
        description="Let others see when you are online"
      >
        <Switch
          checked={draft.showOnlineStatus}
          onCheckedChange={() => toggle('showOnlineStatus')}
          aria-label="Show online status"
        />
      </SettingRow>

      <SaveBar
        isDirty={isDirty}
        isSaving={isLoading}
        onSave={handleSave}
        onReset={() => setDraft({ ...original })}
      />
    </div>
  );
}

// ─── Appearance section ───────────────────────────────────────────────────────
// Client-only — next-themes handles persistence in localStorage.
// No server round-trip needed.

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — render only after mount
  useEffect(() => { setMounted(true); }, []);

  const options = [
    { value: 'light',  label: 'Light',  icon: Sun     },
    { value: 'dark',   label: 'Dark',   icon: Moon    },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle icon={Palette} title="Appearance" />
      <p className="text-xs text-muted-foreground mb-3">Choose your preferred color theme</p>

      {mounted ? (
        <div className="grid grid-cols-3 gap-2">
          {options.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-all',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ─── About section ────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionTitle icon={Monitor} title="About" />
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Version</span>
          <span className="text-foreground font-mono text-xs">1.0.0</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span>Built with</span>
          <span className="text-foreground text-xs">Next.js · Node.js · Socket.IO</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router   = useRouter();
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.auth.user);

  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  async function handleLogout() {
    try {
      await logout().unwrap();
    } catch {
      // Even if the server call fails, clear local auth state
    } finally {
      dispatch(clearAuth());
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-sm">Settings</h1>
          <p className="text-[11px] text-muted-foreground">Preferences and account management</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <AccountSection
          user={user}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
        <NotificationsSection user={user} />
        <PrivacySection       user={user} />
        <AppearanceSection />
        <AboutSection />

        {/* Bottom padding for mobile nav */}
        <div className="h-6" />
      </div>
    </div>
  );
}
