
import { getDictionary } from '@/dictionaries';
import type { Locale } from '@/middleware';
import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Vault, KeyRound, FileKey2, Terminal, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';


export async function generateMetadata({ params: { lang } }: Props): Promise<Metadata> {
    const dict = await getDictionary(lang);
    return {
        title: dict.dashboard.nav.dashboard,
    };
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  href: string;
  footerText: string;
  lang: Locale;
}

const StatCard = ({ title, value, icon, href, footerText, lang }: StatCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent className="pb-2">
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
    <CardFooter>
      <Link href={`/${lang}${href}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
        {footerText} <ArrowRight className="h-3 w-3" />
      </Link>
    </CardFooter>
  </Card>
);

type Props = {
  params: { lang: Locale };
};

export default async function DashboardPage({ params: { lang } }: Props) {
    const dict = await getDictionary(lang);
    const statsDict = dict.dashboard.stats;
    
    // Mock data, to be replaced with real data from backend
    const statsData = [
      {
        title: statsDict.totalVaults,
        value: 4,
        icon: <Vault className="h-4 w-4" />,
        href: '/dashboard/vaults',
      },
      {
        title: statsDict.totalSecrets,
        value: 18,
        icon: <KeyRound className="h-4 w-4" />,
        href: '/dashboard/vaults', // Link to vaults for now
      },
      {
        title: statsDict.totalCertificates,
        value: 3,
        icon: <FileKey2 className="h-4 w-4" />,
        href: '/dashboard/vaults', // Link to vaults for now
      },
      {
        title: statsDict.totalSshKeys,
        value: 8,
        icon: <Terminal className="h-4 w-4" />,
        href: '/dashboard/vaults', // Link to vaults for now
      },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold font-headline">{dict.dashboard.nav.dashboard}</h1>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statsData.map((stat) => (
                <StatCard 
                  key={stat.title} 
                  title={stat.title}
                  value={stat.value}
                  icon={stat.icon}
                  href={stat.href}
                  footerText={statsDict.viewDetails}
                  lang={lang}
                />
              ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{dict.auth.welcomeTitle}</CardTitle>
                    <CardDescription>{dict.auth.welcomeSubtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>{dict.auth.dashboardWip}</p>
                </CardContent>
            </Card>
        </div>
    );
}
