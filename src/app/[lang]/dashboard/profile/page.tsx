
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

type Props = {
    params: { lang: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: dict.dashboard.userNav.profile,
  };
}

export default async function ProfilePage({ params: { lang } }: Props) {
  const dict = await getDictionary(lang);
  return (
      <Card>
          <CardHeader>
              <CardTitle>{dict.dashboard.userNav.profile}</CardTitle>
              <CardDescription>{dict.dashboard.wip}</CardDescription>
          </CardHeader>
          <CardContent>
              <p>User profile settings will be here.</p>
          </CardContent>
      </Card>
  );
}
