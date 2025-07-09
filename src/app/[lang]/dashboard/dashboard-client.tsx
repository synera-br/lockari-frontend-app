'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { ShieldIcon, LayoutDashboard, Loader2, Vault, Users, History, UserCog } from 'lucide-react';
import type { Locale } from '@/middleware';
import type { Dictionary } from '@/dictionaries';
import { UserNav } from '@/components/dashboard/user-nav';
// TODO: Re-implement terms acceptance logic via backend/claims
// import { TermsDialog } from '@/components/auth/terms-dialog';
// import { acceptUserTerms } from '@/app/actions/user';
// import { useToast } from '@/hooks/use-toast';

interface DashboardLayoutClientProps {
  children: ReactNode;
  lang: Locale;
  dictionary: Dictionary;
  currentTermsVersion: number;
}

export default function DashboardClient({ children, lang, dictionary, currentTermsVersion }: DashboardLayoutClientProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // const { toast } = useToast();

  // TODO: The logic for checking and accepting terms has been temporarily disabled
  // because it relied on direct Firestore access, which is now correctly blocked by security rules.
  // This needs to be re-implemented by:
  // 1. Having the backend add a `termsVersion` custom claim to the user's ID token.
  // 2. Reading this claim from the `useAuth()` hook.
  // 3. Creating a backend endpoint for the `acceptUserTerms` action.

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${lang}/auth/login`);
    }
  }, [user, authLoading, lang, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4">Loading...</p>
      </div>
    );
  }
  
  const dashboardDict = dictionary.dashboard;
  const navDict = dashboardDict.nav;

  return (
    <SidebarProvider>
      {/* <TermsDialog ... /> */}
      <Sidebar>
        <SidebarHeader>
          <Link href={`/${lang}/dashboard`} className="flex items-center gap-2">
            <ShieldIcon className="h-7 w-7 text-primary" />
            <span className="font-headline text-lg font-bold text-primary">{dictionary.appName}</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/${lang}/dashboard`}>
                <Link href={`/${lang}/dashboard`}>
                  <LayoutDashboard />
                  {navDict.dashboard}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith(`/${lang}/dashboard/vaults`)}>
                <Link href={`/${lang}/dashboard/vaults`}>
                  <Vault />
                  {navDict.vaults}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith(`/${lang}/dashboard/access-control`)}>
                <Link href={`/${lang}/dashboard/access-control`}>
                  <Users />
                  {navDict.accessControl}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith(`/${lang}/dashboard/audit-trail`)}>
                <Link href={`/${lang}/dashboard/audit-trail`}>
                  <History />
                  {navDict.auditTrail}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith(`/${lang}/dashboard/account`)}>
                <Link href={`/${lang}/dashboard/account`}>
                  <UserCog />
                  {navDict.account}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:justify-end sm:px-6">
          <SidebarTrigger className="sm:hidden" />
          <UserNav lang={lang} user={user} dictionary={dictionary} />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
