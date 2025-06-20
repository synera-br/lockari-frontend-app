import type { ReactNode } from 'react';
import type { Locale } from '@/middleware';
import { getDictionary } from '@/dictionaries';
import type { Metadata } from 'next';

type Props = {
  children: ReactNode;
  params: { lang: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: {
      default: dict.appName,
      template: `%s | ${dict.appName}`,
    },
    description: dict.hero.subtitle,
  };
}

export default function LangLayout({ children, params }: Props) {
  return (
    <html lang={params.lang} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
