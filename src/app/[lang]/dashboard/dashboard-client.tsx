
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { TermsDialog } from '@/components/auth/terms-dialog';
import { acceptUserTerms } from '@/app/actions/user';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const [hasCheckedTerms, setHasCheckedTerms] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  useEffect(() => {
    // If auth has finished loading...
    if (!authLoading) {
      if (!user) {
        // ...and there's no user, redirect to login.
        router.push(`/${lang}/auth/login`);
      } else if (user && !hasCheckedTerms) {
        // ...and there is a user, and we haven't checked terms yet, then perform the check.
        const checkTerms = async () => {
          setHasCheckedTerms(true); // Mark as checked to prevent re-running the check.
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              const userData = userDoc.data();
              const acceptedVersion = userData.termsVersion || 0;
              if (!userData.termsAccepted || acceptedVersion < currentTermsVersion) {
                setShowTermsDialog(true);
              }
            } else {
              // This case might happen if a user was created in Auth but not in Firestore.
              // Forcing acceptance is a safe default.
              setShowTermsDialog(true);
            }
          } catch (error) {
            console.error("Failed to check user terms:", error);
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Failed to check your account status. Please try again.',
            });
          }
        };
        checkTerms();
      }
    }
  }, [user, authLoading, hasCheckedTerms, lang, router, toast, currentTermsVersion]);
  
  const handleAcceptTerms = async () => {
    if (!user) return;
    setIsAcceptingTerms(true);
    const result = await acceptUserTerms(user.uid);
    if (result.success) {
      setShowTermsDialog(false);
    } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: result.message || 'Could not save your acceptance. Please try again.',
        });
    }
    setIsAcceptingTerms(false);
  };

  // The main loading state now ONLY depends on authentication.
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4">Loading...</p>
      </div>
    );
  }

  // If auth is done but there is no user, we render nothing while the redirect happens.
  if (!user) {
    return null;
  }
  
  const dashboardDict = dictionary.dashboard;
  const navDict = dashboardDict.nav;

  // The dashboard is rendered immediately after auth. The TermsDialog will appear on top if needed.
  return (
    <SidebarProvider>
      <TermsDialog 
        isOpen={showTermsDialog} 
        dictionary={dictionary.termsDialog}
        onAccept={handleAcceptTerms}
        isAccepting={isAcceptingTerms}
      />
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
