
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { ReactNode } from 'react';
import DashboardClient from './dashboard-client';
import { CURRENT_TERMS_VERSION } from '@/lib/config';

type Props = {
  children: ReactNode;
  params: { lang: Locale };
};

export default async function DashboardLayout({ children, params: { lang } }: Props) {
  const dict = await getDictionary(lang);
  return (
    <DashboardClient lang={lang} dictionary={dict} currentTermsVersion={CURRENT_TERMS_VERSION}>
      {children}
    </DashboardClient>
  );
}
