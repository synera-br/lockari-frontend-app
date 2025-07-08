import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';
import { type Locale } from '@/middleware';
import { Button } from '@/components/ui/button';
import { ShieldIcon } from 'lucide-react';

interface HeaderProps {
  lang: Locale;
  dictionary: {
    appName: string;
    nav: {
      features: string;
      pricing: string;
      contact: string;
    };
    languageSwitcher: {
      label: string;
      en: string;
      pt: string;
      es: string;
    };
    auth: {
      loginLink: string;
      signupLink: string;
    };
  };
}

export default function Header({ lang, dictionary }: HeaderProps) {
  const navItems = [
    { href: '#features', label: dictionary.nav.features },
    { href: '#pricing', label: dictionary.nav.pricing },
    { href: '#contact', label: dictionary.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href={`/${lang}`} className="flex items-center space-x-2 font-headline text-xl font-bold text-primary">
          <ShieldIcon className="h-7 w-7" />
          <span>{dictionary.appName}</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={`/${lang}${item.href}`}
              className="transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center space-x-4">
          <LanguageSwitcher currentLocale={lang} dictionary={dictionary.languageSwitcher} />
          <div className="hidden items-center space-x-2 md:flex">
            <Button asChild variant="ghost">
              <Link href={`/${lang}/auth/login`}>{dictionary.auth.loginLink}</Link>
            </Button>
            <Button asChild>
              <Link href={`/${lang}/auth/signup`}>{dictionary.auth.signupLink}</Link>
            </Button>
          </div>
          {/* Mobile Menu Trigger (optional, can be added later) */}
        </div>
      </div>
    </header>
  );
}
