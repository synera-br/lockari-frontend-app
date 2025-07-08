
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type Props = {
  params: { lang: Locale; vaultId: string };
};

export async function generateMetadata({ params: { lang, vaultId } }: Props): Promise<Metadata> {
    const dict = await getDictionary(lang);
    return {
        title: `${dict.dashboard.nav.vaults} - ID: ${vaultId}`,
    };
}

export default async function VaultDetailPage({ params: { lang, vaultId } }: Props) {
    const dict = await getDictionary(lang);
    
    return (
        <div className="space-y-4">
            <Link href={`/${lang}/dashboard/vaults`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                {dict.dashboard.vaults.backToVaults} 
            </Link>
            <h1 className="text-2xl font-bold font-headline">Vault: {vaultId}</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Vault Details</CardTitle>
                    <CardDescription>{dict.dashboard.wip}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Details and items for vault with ID: {vaultId} will be displayed here.</p>
                </CardContent>
            </Card>
        </div>
    );
}
