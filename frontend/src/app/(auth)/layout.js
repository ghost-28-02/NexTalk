import { GuestGuard } from '@/features/auth/guards/GuestGuard';

export default function AuthLayout({ children }) {
  return (
    <GuestGuard>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 -right-32 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        {children}
      </div>
    </GuestGuard>
  );
}
