'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'sonner';
import { Logo } from '@/components/common';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail } from 'lucide-react';
import { useVerifyEmailMutation, useResendVerificationMutation, selectPendingEmail, clearPendingEmail } from '@/features/auth';

export default function VerifyEmailPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const pendingEmail = useSelector(selectPendingEmail);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef([]);
  const didVerifyRef = useRef(false);

  const [verifyEmail, { isLoading }] = useVerifyEmailMutation();
  const [resend, { isLoading: isResending }] = useResendVerificationMutation();

  useEffect(() => {
    if (!pendingEmail && !didVerifyRef.current) {
      router.replace('/signup');
    }
  }, [pendingEmail, router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleChange = (index, value) => {
    if (value.length > 1) {
      const chars = value.slice(0, 6).split('');
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (index + i < 6) newCode[index + i] = char;
      });
      setCode(newCode);
      inputRefs.current[Math.min(index + chars.length, 5)]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.some((c) => !c)) return;
    try {
      await verifyEmail({ email: pendingEmail, otp: code.join('') }).unwrap();
      didVerifyRef.current = true;
      dispatch(clearPendingEmail());
      toast.success('Email verified! Please log in.');
      router.replace('/login');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Invalid or expired code. Please try again.');
    }
  };

  const handleResend = async () => {
    try {
      await resend({ email: pendingEmail }).unwrap();
      setResendTimer(30);
      toast.success('Verification code resent');
    } catch (err) {
      toast.error(err?.data?.message ?? 'Failed to resend code');
    }
  };

  if (!pendingEmail) return null;

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div>
          <Link href="/signup" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Verify your email</h2>
          <p className="text-muted-foreground">
            We sent a verification code to <span className="font-medium text-foreground">{pendingEmail}</span>.
            <br />
            Enter the 6-digit code below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-3">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-11 h-14 sm:w-12 sm:h-16 text-center text-xl font-semibold rounded-xl border border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            ))}
          </div>
          <Button
            type="submit"
            className="w-full gradient-primary text-white border-0"
            disabled={isLoading || code.some((c) => !c)}
          >
            {isLoading ? 'Verifying…' : 'Verify Email'}
          </Button>
        </form>

        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">Didn&apos;t receive the code?</p>
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resendTimer > 0 || isResending}
            className="text-primary"
          >
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
          </Button>
        </div>
      </div>
    </div>
  );
}
