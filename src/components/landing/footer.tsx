import Link from 'next/link';
import { Github, Linkedin, Twitter, ShieldIcon } from 'lucide-react';
import type { Locale } from '@/middleware';

interface FooterProps {
  lang: Locale;
  dictionary: {
    appName: string;
    copyright: string;
    privacyPolicy: string;
    termsOfService: string;
    developedByPrefix: string;
    developerName: string;
  };
}

export default function Footer({ lang, dictionary }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const socialLinks = [
    { name: 'GitHub', icon: <Github className="h-5 w-5" />, href: 'https://github.com' },
    { name: 'LinkedIn', icon: <Linkedin className="h-5 w-5" />, href: 'https://linkedin.com' },
    { name: 'Twitter', icon: <Twitter className="h-5 w-5" />, href: 'https://twitter.com' },
  ];

  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="flex flex-col items-center md:items-start">
            <Link href={`/${lang}`} className="flex items-center space-x-2 font-headline text-lg font-bold text-primary mb-2">
              <ShieldIcon className="h-6 w-6" />
              <span>{dictionary.appName}</span>
            </Link>
            <p className="text-sm text-muted-foreground text-center md:text-left">
              {dictionary.copyright.replace('{year}', currentYear.toString())}
            </p>
            <p className="text-sm text-muted-foreground text-center md:text-left mt-1">
              {dictionary.developedByPrefix}
              <Link href="https://www.synera.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-medium">
                {dictionary.developerName}
              </Link>
            </p>
          </div>

          <div className="flex justify-center space-x-6">
            {socialLinks.map((social) => (
              <Link
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {social.icon}
              </Link>
            ))}
          </div>
          
          <nav className="flex flex-col md:flex-row justify-center md:justify-end space-y-2 md:space-y-0 md:space-x-6 text-sm">
            <Link href={`/${lang}/privacy-policy`} className="text-muted-foreground hover:text-primary transition-colors">
              {dictionary.privacyPolicy}
            </Link>
            <Link href={`/${lang}/terms-of-service`} className="text-muted-foreground hover:text-primary transition-colors">
              {dictionary.termsOfService}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
