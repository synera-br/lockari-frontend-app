
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type Locale, locales } from '@/middleware';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  dictionary: {
    label: string;
    en: string;
    pt: string;
    es: string;
  };
}

interface LanguageOption {
  locale: Locale;
  name: string;
  flag: string;
}

export default function LanguageSwitcher({ currentLocale, dictionary }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    if (!pathname) return;
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  };

  const languageOptions: LanguageOption[] = [
    { locale: 'en', name: dictionary.en, flag: '🇺🇸' },
    { locale: 'pt', name: dictionary.pt, flag: '🇧🇷' },
    { locale: 'es', name: dictionary.es, flag: '🇪🇸' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={dictionary.label}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languageOptions.map((option) => (
          <DropdownMenuItem
            key={option.locale}
            onClick={() => handleLocaleChange(option.locale)}
            disabled={currentLocale === option.locale}
            className="flex items-center gap-2"
          >
            <span>{option.flag}</span>
            <span>{option.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
