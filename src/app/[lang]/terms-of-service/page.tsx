
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldIcon } from 'lucide-react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';

type Props = {
    params: { lang: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: dict.termsPage.title,
  };
}

export default async function TermsOfServicePage({ params: { lang } }: Props) {
  const dict = await getDictionary(lang);
  const termsDict = dict.termsPage;
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header lang={lang} dictionary={{
        appName: dict.appName,
        nav: dict.nav,
        languageSwitcher: dict.languageSwitcher,
        auth: dict.auth
      }} />
      <main className="flex-grow bg-secondary/30">
        <div className="container mx-auto max-w-4xl py-12 px-4">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <ShieldIcon className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="font-headline text-3xl sm:text-4xl">{termsDict.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{termsDict.lastUpdated}</p>
            </CardHeader>
            <CardContent className="space-y-6 text-base">
              <p className="text-muted-foreground">{termsDict.introduction}</p>
              
              <div className="space-y-4">
                {termsDict.sections.map((section) => (
                  <div key={section.title}>
                    <h2 className="font-headline text-xl font-semibold mb-2">{section.title}</h2>
                    <p className="text-muted-foreground whitespace-pre-line">{section.content}</p>
                  </div>
                ))}
              </div>

              <div>
                <h2 className="font-headline text-xl font-semibold mb-2">{termsDict.agreement.title}</h2>
                <p className="text-muted-foreground mb-4">{termsDict.agreement.description}</p>
                <ul className="space-y-3">
                  {termsDict.agreement.items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </CardContent>
          </Card>
        </div>
      </main>
      <Footer lang={lang} dictionary={{
          appName: dict.appName,
          copyright: dict.footer.copyright,
          privacyPolicy: dict.footer.privacyPolicy,
          termsOfService: dict.footer.termsOfService,
          developedByPrefix: dict.footer.developedByPrefix,
          developerName: dict.footer.developerName
        }} 
      />
    </div>
  );
}
