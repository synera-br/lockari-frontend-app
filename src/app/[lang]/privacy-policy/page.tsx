import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import Link from 'next/link';
import type { Metadata } from 'next';

type Props = {
    params: { lang: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: dict.footer.privacyPolicy,
  };
}

export default async function PrivacyPolicyPage({ params: { lang } }: Props) {
  const dict = await getDictionary(lang);
  return (
    <div className="container mx-auto max-w-4xl py-10 px-4">
      <h1 className="text-4xl font-bold font-headline mb-4">{dict.footer.privacyPolicy}</h1>
      <p className="text-muted-foreground">Content for the privacy policy will be added here soon.</p>
      <Link href={`/${lang}`} className="text-primary hover:underline mt-8 inline-block">
        &larr; Back to Home
      </Link>
    </div>
  );
}
