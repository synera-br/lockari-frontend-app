import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, KeyRound, ScrollText, TerminalSquare, CheckCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
}

interface FeaturesSectionProps {
  dictionary: {
    title: string;
    secretsManagement: { title: string; description: string };
    keyValueStore: { title: string; description: string };
    certificateManagement: { title: string; description: string };
    sshKeyManagement: { title: string; description: string };
  };
}

export default function FeaturesSection({ dictionary }: FeaturesSectionProps) {
  const features: FeatureItem[] = [
    {
      icon: <ShieldCheck className="h-10 w-10 text-primary mb-4" />,
      title: dictionary.secretsManagement.title,
      description: dictionary.secretsManagement.description,
    },
    {
      icon: <KeyRound className="h-10 w-10 text-primary mb-4" />,
      title: dictionary.keyValueStore.title,
      description: dictionary.keyValueStore.description,
    },
    {
      icon: <ScrollText className="h-10 w-10 text-primary mb-4" />,
      title: dictionary.certificateManagement.title,
      description: dictionary.certificateManagement.description,
    },
    {
      icon: <TerminalSquare className="h-10 w-10 text-primary mb-4" />,
      title: dictionary.sshKeyManagement.title,
      description: dictionary.sshKeyManagement.description,
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="font-headline text-3xl font-bold text-center text-foreground sm:text-4xl md:text-5xl mb-12">
          {dictionary.title}
        </h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-center">{feature.icon}</div>
                <CardTitle className="font-headline text-xl font-semibold text-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
