'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Logo } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useResetPasswordMutation } from '@/features/auth';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Invalid reset link</h2>
          <p className="text-muted-foreground">
            This link is missing the reset token. Please request a new one.
          </p>
        </div>
        <Link href="/forgot-password">
          <Button className="w-full gradient-primary text-white border-0">
            Request new link
          </Button>
        </Link>
      </div>
    );
  }

  const strength = (() => {
    if (!password) return null;
    if (password.length < 6) return { label: 'Weak', color: 'bg-destructive', width: '33%' };
    if (password.length < 10) return { label: 'Medium', color: 'bg-warning', width: '66%' };
    return { label: 'Strong', color: 'bg-success', width: '100%' };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await resetPassword({ token, newPassword: password }).unwrap();
      setIsSuccess(true);
    } catch (err) {
      toast.error(err?.data?.message ?? 'Reset link is invalid or expired. Please request a new one.');
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Password reset successful</h2>
          <p className="text-muted-foreground">
            Your password has been updated. You can now sign in with your new password.
          </p>
        </div>
        <Button className="w-full gradient-primary text-white border-0" onClick={() => router.push('/login')}>
          Continue to Sign In
        </Button>
      </div>
    );
  }

  return (
    <>
      <div>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Set new password</h2>
        <p className="text-muted-foreground">Your new password must be at least 6 characters.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                className="pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {strength && (
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Strength: <span className="font-medium">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                className="pl-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full gradient-primary text-white border-0"
          disabled={isLoading || password !== confirmPassword || password.length < 6}
        >
          {isLoading ? 'Resetting…' : 'Reset Password'}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <Suspense fallback={<div className="h-8 w-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
