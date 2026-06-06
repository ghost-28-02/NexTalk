'use client';

/**
 * Profile page — /profile
 *
 * Layout: avatar header card + individual editable sections, each with its own
 * Save/Discard row so partial changes are never lost.
 *
 * Sections:
 *   1. Avatar upload  — AvatarUpload (instant preview + async confirm)
 *   2. Display name   — displayName
 *   3. Username       — inline debounced availability check, 3-day cooldown hint
 *   4. About / Bio    — textarea, 200 chars
 *   5. Social links   — website, github, twitter, instagram, linkedin
 *   6. Profile visibility — public / contacts / private
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useRouter }   from 'next/navigation';
import {
  ArrowLeft, Check, X, Loader2, Globe, AtSign, User, FileText,
  ShieldCheck, AlertCircle,
} from 'lucide-react';

import { FaGithub, FaInstagram, FaLinkedin, FaTwitterSquare } from "react-icons/fa";
import { toast } from 'sonner';

import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Label }     from '@/components/ui/label';
import { Textarea }  from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { AvatarUpload } from '@/features/profile/components/AvatarUpload';
import {
  useUpdateProfileMutation,
  useUpdateUsernameMutation,
  useLazyCheckUsernameQuery,
} from '@/features/profile/services/userApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usernameFormatError(val) {
  if (!val) return null;
  if (val.length < 2)  return 'At least 2 characters';
  if (val.length > 30) return 'Max 30 characters';
  if (!/^[a-zA-Z0-9_.]+$/.test(val)) return 'Letters, numbers, _ and . only';
  return null;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function SaveRow({ onSave, onReset, isSaving, isDirty, canSave = true }) {
  if (!isDirty) return null;
  return (
    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
      <Button variant="ghost" size="sm" onClick={onReset} disabled={isSaving}>
        <X className="h-3.5 w-3.5 mr-1" />Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={isSaving || !canSave}>
        {isSaving
          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          : <Check   className="h-3.5 w-3.5 mr-1" />}
        Save
      </Button>
    </div>
  );
}

// ─── Identity section (displayName) ───────────────────────────────────────────

function IdentitySection({ user }) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  useEffect(() => { setDisplayName(user?.displayName ?? ''); }, [user?.displayName]);

  const isDirty = displayName.trim() !== (user?.displayName ?? '');

  async function handleSave() {
    if (!displayName.trim()) return;
    try {
      await updateProfile({ displayName: displayName.trim() }).unwrap();
      toast.success('Display name updated');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to update display name');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader icon={User} title="Display Name" description="Shown in your conversations and profile" />
      <div className="space-y-2">
        <Label htmlFor="displayName" className="text-xs">Full name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          placeholder="Your display name"
        />
        <p className="text-[11px] text-muted-foreground text-right">{displayName.length}/50</p>
      </div>
      <SaveRow
        isDirty={isDirty}
        isSaving={isLoading}
        onSave={handleSave}
        onReset={() => setDisplayName(user?.displayName ?? '')}
      />
    </div>
  );
}

// ─── Username section ─────────────────────────────────────────────────────────

function UsernameSection({ user }) {
  const [username,     setUsername]     = useState(user?.username ?? '');
  const [checkResult,  setCheckResult]  = useState(null); // null|'available'|'taken'|'self'
  const [isChecking,   setIsChecking]   = useState(false);
  const debounceRef = useRef(null);

  const [updateUsername, { isLoading }] = useUpdateUsernameMutation();
  const [triggerCheck]                  = useLazyCheckUsernameQuery();

  useEffect(() => {
    setUsername(user?.username ?? '');
    setCheckResult(null);
  }, [user?.username]);

  const isDirty   = username.trim() !== (user?.username ?? '');
  const formatErr = usernameFormatError(username);

  const runCheck = useCallback((val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val === user?.username || usernameFormatError(val)) {
      setCheckResult(val === user?.username ? 'self' : null);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await triggerCheck(val).unwrap();
        setCheckResult(res.available ? 'available' : 'taken');
      } catch {
        setCheckResult(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);
  }, [triggerCheck, user?.username]);

  useEffect(() => { runCheck(username); }, [username, runCheck]);

  async function handleSave() {
    if (formatErr || checkResult === 'taken') return;
    try {
      await updateUsername({ username: username.trim() }).unwrap();
      toast.success('Username updated');
      setCheckResult('self');
    } catch (err) {
      const msg = err?.data?.message ?? 'Failed to update username';
      toast.error(msg);
      if (err?.data?.code === 'USERNAME_COOLDOWN') {
        setUsername(user?.username ?? '');
        setCheckResult('self');
      }
    }
  }

  const canSave = isDirty && !formatErr && checkResult === 'available' && !isChecking;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        icon={AtSign}
        title="Username"
        description="Your unique handle — changeable once every 3 days"
      />
      <div className="space-y-2">
        <Label htmlFor="username" className="text-xs">Username</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
            @
          </span>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            maxLength={30}
            placeholder="yourhandle"
            className="pl-7 pr-8"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {isChecking                          && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
            {!isChecking && checkResult === 'available' && <Check className="h-3.5 w-3.5 text-emerald-500" />}
            {!isChecking && checkResult === 'taken'     && <X     className="h-3.5 w-3.5 text-destructive" />}
          </div>
        </div>

        {formatErr && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />{formatErr}
          </p>
        )}
        {!formatErr && checkResult === 'taken'     && <p className="text-[11px] text-destructive">Username already taken</p>}
        {!formatErr && checkResult === 'available' && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Username is available</p>}
        {checkResult === 'self'                    && <p className="text-[11px] text-muted-foreground">That&apos;s your current username</p>}
      </div>

      <SaveRow
        isDirty={isDirty}
        isSaving={isLoading}
        canSave={canSave}
        onSave={handleSave}
        onReset={() => { setUsername(user?.username ?? ''); setCheckResult('self'); }}
      />
    </div>
  );
}

// ─── Bio section ──────────────────────────────────────────────────────────────

function BioSection({ user }) {
  const [bio, setBio]                  = useState(user?.bio ?? '');
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  useEffect(() => { setBio(user?.bio ?? ''); }, [user?.bio]);

  const isDirty = bio !== (user?.bio ?? '');

  async function handleSave() {
    try {
      await updateProfile({ bio: bio.trim() }).unwrap();
      toast.success('Bio updated');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to update bio');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader icon={FileText} title="About" description="A short bio visible on your profile" />
      <div className="space-y-2">
        <Label htmlFor="bio" className="text-xs">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
          placeholder="Tell people a little about yourself…"
          rows={3}
          className="resize-none"
        />
        <p className="text-[11px] text-muted-foreground text-right">{bio.length}/200</p>
      </div>
      <SaveRow
        isDirty={isDirty}
        isSaving={isLoading}
        onSave={handleSave}
        onReset={() => setBio(user?.bio ?? '')}
      />
    </div>
  );
}

// ─── Social links section ─────────────────────────────────────────────────────

const SOCIAL_FIELDS = [
  { key: 'website',   label: 'Website',   icon: Globe,     placeholder: 'https://yoursite.com' },
  { key: 'github',    label: 'GitHub',    icon: FaGithub,    placeholder: 'https://github.com/you' },
  { key: 'twitter',   label: 'Twitter',   icon: FaTwitterSquare,   placeholder: 'https://twitter.com/you' },
  { key: 'instagram', label: 'Instagram', icon: FaInstagram, placeholder: 'https://instagram.com/you' },
  { key: 'linkedin',  label: 'LinkedIn',  icon: FaLinkedin,  placeholder: 'https://linkedin.com/in/you' },
];

function SocialLinksSection({ user }) {
  const blank = { website: '', github: '', twitter: '', instagram: '', linkedin: '' };
  const [links, setLinks] = useState({ ...blank, ...(user?.socialLinks ?? {}) });
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  useEffect(() => {
    setLinks({ ...blank, ...(user?.socialLinks ?? {}) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.socialLinks]);

  const isDirty = SOCIAL_FIELDS.some(
    ({ key }) => (links[key] ?? '') !== (user?.socialLinks?.[key] ?? '')
  );

  async function handleSave() {
    try {
      await updateProfile({ socialLinks: links }).unwrap();
      toast.success('Social links updated');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to update social links');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader icon={Globe} title="Social Links" description="Share your social profiles" />
      <div className="space-y-3">
        {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`sl-${key}`} className="text-xs flex items-center gap-1.5">
              <Icon className="h-3 w-3" />{label}
            </Label>
            <Input
              id={`sl-${key}`}
              type="url"
              value={links[key] ?? ''}
              onChange={(e) => setLinks((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
      <SaveRow
        isDirty={isDirty}
        isSaving={isLoading}
        onSave={handleSave}
        onReset={() => setLinks({ ...blank, ...(user?.socialLinks ?? {}) })}
      />
    </div>
  );
}

// ─── Profile visibility section ───────────────────────────────────────────────

function VisibilitySection({ user }) {
  const [visibility, setVisibility]    = useState(user?.profileVisibility ?? 'public');
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  useEffect(() => { setVisibility(user?.profileVisibility ?? 'public'); }, [user?.profileVisibility]);

  const isDirty = visibility !== (user?.profileVisibility ?? 'public');

  async function handleSave() {
    try {
      await updateProfile({ profileVisibility: visibility }).unwrap();
      toast.success('Visibility updated');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to update visibility');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader icon={ShieldCheck} title="Profile Visibility" description="Control who can see your profile" />
      <div className="space-y-2">
        <Label htmlFor="visibility" className="text-xs">Who can view your profile?</Label>
        <Select value={visibility} onValueChange={setVisibility}>
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public — anyone can view</SelectItem>
            <SelectItem value="contacts">Contacts only</SelectItem>
            <SelectItem value="private">Private — hidden from search</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SaveRow
        isDirty={isDirty}
        isSaving={isLoading}
        onSave={handleSave}
        onReset={() => setVisibility(user?.profileVisibility ?? 'public')}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router  = useRouter();
  const user    = useSelector((s) => s.auth.user);

  // authSlice stores avatar as the URL string (DTO normalization)
  const avatarUrl = typeof user?.avatar === 'string'
    ? user.avatar
    : user?.avatar?.url ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <div>
          <h1 className="font-semibold text-sm">Edit Profile</h1>
          <p className="text-[11px] text-muted-foreground">Manage your public information</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* ── Avatar card ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <AvatarUpload
              currentAvatarUrl={avatarUrl}
              displayName={user?.displayName || user?.username}
              size="xl"
            />
            <div className="text-center sm:text-left">
              <p className="font-semibold">{user?.displayName || user?.username}</p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              {user?.email && (
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                Click the avatar to upload a new photo.
                <br />JPEG, PNG, WebP or GIF · max 5 MB
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Editable sections ──────────────────────────────────────────── */}
        <IdentitySection    user={user} />
        <UsernameSection    user={user} />
        <BioSection         user={user} />
        <SocialLinksSection user={user} />
        <VisibilitySection  user={user} />

        {/* Bottom padding for mobile */}
        <div className="h-6" />
      </div>
    </div>
  );
}
