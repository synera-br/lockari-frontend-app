
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { Metadata } from 'next';
import VaultsPageContent from '@/components/dashboard/vaults/vaults-page-content';

type Props = {
  params: { lang: Locale };
};

export async function generateMetadata({ params: { lang } }: Props): Promise<Metadata> {
    const dict = await getDictionary(lang);
    return {
        title: dict.dashboard.nav.vaults,
    };
}

export default async function VaultsPage({ params: { lang } }: Props) {
    const dict = await getDictionary(lang);
    
    // In the future, you would fetch the user's vaults here and pass them as a prop.
    // const vaults = await fetchUserVaults();

    return (
      <div className="space-y-4">
        <VaultsPageContent dictionary={dict} lang={lang} />
      </div>
    );
}
