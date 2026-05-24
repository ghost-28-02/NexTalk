import { AuthGuard } from '@/features/auth/guards/AuthGuard';

export default function MainLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
