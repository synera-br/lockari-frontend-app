import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import { SignupForm } from '@/components/auth/signup-form';
import Link from 'next/link';
import { ShieldIcon } from 'lucide-react';

type Props = {
  params: { lang: Locale };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function SignupPage({ params: { lang }, searchParams }: Props) {
  const dict = await getDictionary(lang);
  const plan = typeof searchParams?.plan === 'string' ? searchParams.plan : 'free';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-8">
        <Link href={`/${lang}`} className="flex items-center space-x-2 font-headline text-2xl font-bold text-primary">
          <ShieldIcon className="h-8 w-8" />
          <span>{dict.appName}</span>
        </Link>
      </div>
      <SignupForm lang={lang} dictionary={dict.auth} plan={plan} />
    </div>
  );
}
