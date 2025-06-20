
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
  // This layout is nested within RootLayout (src/app/layout.tsx).
  // It should not re-render <html> or <body> tags.
  // The `lang` attribute from params.lang was previously on this layout's <html> tag.
  // RootLayout's <html> tag (currently with lang="en") will now be the sole one.
  // This change primarily fixes the hydration error due to nested document structures.
  return <>{children}</>;
}
