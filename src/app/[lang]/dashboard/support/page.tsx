
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { Metadata } from 'next';
import { SupportForm } from '@/components/dashboard/support-form';

type Props = {
    params: { lang: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: dict.dashboard.userNav.support,
  };
}

export default async function SupportPage({ params: { lang } }: Props) {
  const dict = await getDictionary(lang);
  return (
    <div className="max-w-4xl mx-auto">
      <SupportForm dictionary={dict.dashboard.supportForm} />
    </div>
  );
}
