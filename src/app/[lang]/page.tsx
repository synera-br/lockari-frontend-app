import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import Header from '@/components/landing/header';
import HeroSection from '@/components/landing/hero-section';
import FeaturesSection from '@/components/landing/features-section';
import PricingSection from '@/components/landing/pricing-section';
import ContactForm from '@/components/landing/contact-form';
import Footer from '@/components/landing/footer';

type Props = {
  params: { lang: Locale };
};

export default async function LandingPage({ params: { lang } }: Props) {
  const dict = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} dictionary={{
        appName: dict.appName,
        nav: dict.nav,
        languageSwitcher: dict.languageSwitcher,
        auth: dict.auth
      }} />
      <main className="flex-grow">
        <HeroSection lang={lang} dictionary={dict.hero} />
        <FeaturesSection dictionary={dict.features} />
        <PricingSection lang={lang} dictionary={dict.pricing} />
        <ContactForm dictionary={dict.contact} />
      </main>
      <Footer lang={lang} dictionary={{
        appName: dict.appName,
        copyright: dict.footer.copyright,
        privacyPolicy: dict.footer.privacyPolicy,
        termsOfService: dict.footer.termsOfService,
        developedByPrefix: dict.footer.developedByPrefix,
        developerName: dict.footer.developerName
      }} />
    </>
  );
}
