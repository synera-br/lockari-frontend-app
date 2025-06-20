import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { Locale } from '@/middleware';

interface HeroSectionProps {
  lang: Locale;
  dictionary: {
    title: string;
    subtitle: string;
    cta: string;
    learnMore: string;
  };
}

export default function HeroSection({ lang, dictionary }: HeroSectionProps) {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-background to-secondary/30">
      <div className="container mx-auto px-4 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          {dictionary.title}
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg text-muted-foreground sm:text-xl md:text-2xl">
          {dictionary.subtitle}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="font-semibold shadow-lg hover:shadow-xl transition-shadow duration-300">
            <Link href={`/${lang}/auth/signup`}> {/* Placeholder link */}
              {dictionary.cta}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-semibold shadow-sm hover:shadow-md transition-shadow duration-300">
            <Link href={`/${lang}#features`}>
              {dictionary.learnMore}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
