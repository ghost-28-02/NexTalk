'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Logo } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { useForgotPasswordMutation } from '@/features/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await forgotPassword({ email }).unwrap();
      setIsSubmitted(true);
    } catch {
      // Always show success — backend never reveals if email exists
      setIsSubmitted(true);
    }
  };

  const handleResend = async () => {
    try {
      await forgotPassword({ email }).unwrap();
      toast.success('Reset link resent');
    } catch {
      toast.success('If that email exists, a new reset link was sent');
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {!isSubmitted && (
          <div>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        )}
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {!isSubmitted ? (
          <>
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Forgot password?</h2>
              <p className="text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Check your email</h2>
              <p className="text-muted-foreground">
                If <span className="font-medium text-foreground">{email}</span> is registered,
                you&apos;ll receive a reset link shortly.
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                (During development: check the backend console for the reset URL)
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleResend}>
              Didn&apos;t receive it? Resend
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
