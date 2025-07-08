
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

type Props = {
  params: { lang: Locale };
};

export async function generateMetadata({ params: { lang } }: Props): Promise<Metadata> {
    const dict = await getDictionary(lang);
    return {
        title: dict.dashboard.nav.accessControl,
    };
}

export default async function AccessControlPage({ params: { lang } }: Props) {
    const dict = await getDictionary(lang);
    
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold font-headline">{dict.dashboard.nav.accessControl}</h1>
            <Card>
                <CardHeader>
                    <CardTitle>{dict.dashboard.nav.accessControl}</CardTitle>
                    <CardDescription>{dict.dashboard.wip}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Access control management will be here.</p>
                </CardContent>
            </Card>
        </div>
    );
}
