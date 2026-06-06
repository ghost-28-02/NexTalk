import { AuthGuard } from '@/features/auth/guards/AuthGuard';
import { AppSidebar, MobileNav } from '@/components/layout';

export default function MainLayout({ children }) {
  return (
    <AuthGuard>
      <div className="h-screen flex overflow-hidden bg-background">
        {/* Narrow icon rail — desktop only */}
        <div className="hidden md:flex">
          <AppSidebar />
        </div>
        {/* Page content fills the rest */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
          {/* Bottom nav — mobile only */}
          <div className="md:hidden">
            <MobileNav />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
