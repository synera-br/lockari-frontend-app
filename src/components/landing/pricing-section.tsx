import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@/middleware';

interface PricingSectionProps {
  lang: Locale;
  dictionary: {
    title: string;
    comingSoon: string;
    freeTier: { name: string; description: string; features: string[]; cta: string };
    proTier: { name: string; description: string; features: string[]; cta: string };
    enterpriseTier: { name: string; description: string; features: string[]; cta: string };
  };
}

export default function PricingSection({ lang, dictionary }: PricingSectionProps) {
  const plans = [
    {
      name: dictionary.freeTier.name,
      description: dictionary.freeTier.description,
      price: '$0',
      period: '/month',
      features: dictionary.freeTier.features,
      cta: dictionary.freeTier.cta,
      href: `/${lang}/auth/signup`, // Placeholder
      variant: 'outline' as const,
    },
    {
      name: dictionary.proTier.name,
      description: dictionary.proTier.description,
      price: 'Coming Soon',
      period: '',
      features: dictionary.proTier.features,
      cta: dictionary.proTier.cta,
      href: `/${lang}#contact`, // Placeholder
      variant: 'default' as const,
      popular: true,
    },
    {
      name: dictionary.enterpriseTier.name,
      description: dictionary.enterpriseTier.description,
      price: 'Custom',
      period: '',
      features: dictionary.enterpriseTier.features,
      cta: dictionary.enterpriseTier.cta,
      href: `/${lang}#contact`, // Placeholder
      variant: 'outline' as const,
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <h2 className="font-headline text-3xl font-bold text-center text-foreground sm:text-4xl md:text-5xl mb-4">
          {dictionary.title}
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">{dictionary.comingSoon}</p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={`flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 ${plan.popular ? 'border-primary border-2 ring-2 ring-primary/50' : ''}`}>
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-full shadow-md">
                  POPULAR
                </div>
              )}
              <CardHeader className="pt-8">
                <CardTitle className="font-headline text-2xl font-semibold text-foreground">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <Check className="h-5 w-5 text-accent mr-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full font-semibold" variant={plan.variant} size="lg">
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
