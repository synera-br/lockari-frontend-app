'use client';

import { Button } from '@/components/ui/button';
import { PlusCircle, KeyRound, Search } from 'lucide-react';
import type { Dictionary } from '@/dictionaries';
import CreateVaultDialog from '@/components/dashboard/vaults/create-vault-dialog';
import { useState, useEffect } from 'react';
import type { Locale } from '@/middleware';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

// NOTE: This is mock data for demonstration purposes.
// In the future, this will be replaced by data fetched from the backend.
interface Vault {
    id: string;
    name: string;
    description: string;
    tags: string[];
    itemCount: number;
    createdAt: string;
}

const mockVaults: Vault[] = [
    { id: '1', name: 'Production API Keys', description: 'All API keys for production services like Stripe, SendGrid, etc.', tags: ['production', 'api', 'backend'], itemCount: 5, createdAt: '2023-05-01' },
    { id: '2', name: 'Staging Database Credentials', description: 'Credentials for the staging PostgreSQL database.', tags: ['staging', 'database'], itemCount: 2, createdAt: '2023-04-20' },
    { id: '3', name: 'Social Media Logins', description: 'Passwords for Twitter, LinkedIn, and other social accounts.', tags: ['social', 'passwords'], itemCount: 3, createdAt: '2023-03-15' },
    { id: '4', name: 'Development SSH Keys', description: 'SSH keys for developer access to development servers.', tags: ['development', 'ssh'], itemCount: 8, createdAt: '2023-05-10' },
];

interface VaultsPageContentProps {
    dictionary: Dictionary;
    lang: Locale;
}

export default function VaultsPageContent({ dictionary, lang }: VaultsPageContentProps) {
    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredVaults, setFilteredVaults] = useState<Vault[]>(mockVaults);
    
    const vaultsDict = dictionary.dashboard.vaults;
    const allVaults = mockVaults; // This would come from props or a fetch hook in a real app.

    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        const newFilteredVaults = allVaults.filter(vault => 
            vault.name.toLowerCase().includes(lowercasedFilter) ||
            vault.description.toLowerCase().includes(lowercasedFilter) ||
            vault.tags.some(tag => tag.toLowerCase().includes(lowercasedFilter))
        );
        setFilteredVaults(newFilteredVaults);
    }, [searchTerm, allVaults]);

    const hasVaults = allVaults.length > 0;

    return (
        <>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-2xl font-bold font-headline self-start sm:self-center">{vaultsDict.title}</h1>
                <div className="flex w-full sm:w-auto items-center gap-2">
                    {hasVaults && (
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder={vaultsDict.searchPlaceholder}
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                    <CreateVaultDialog
                        dictionary={dictionary}
                        lang={lang}
                        isOpen={isCreateDialogOpen}
                        setIsOpen={setCreateDialogOpen}
                    >
                        <Button className="flex-shrink-0">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {vaultsDict.createNew}
                        </Button>
                    </CreateVaultDialog>
                </div>
            </div>

            <div className="mt-6">
                {hasVaults ? (
                    filteredVaults.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredVaults.map(vault => (
                                <Link key={vault.id} href={`/${lang}/dashboard/vaults/${vault.id}`} className="block hover:ring-2 hover:ring-primary rounded-lg transition-all">
                                  <Card className="flex flex-col h-full">
                                      <CardHeader>
                                          <CardTitle className="font-headline">{vault.name}</CardTitle>
                                          <CardDescription className="line-clamp-2">{vault.description}</CardDescription>
                                      </CardHeader>
                                      <CardContent className="flex-grow">
                                          <div className="flex flex-wrap gap-1">
                                              {vault.tags.map(tag => (
                                                  <Badge key={tag} variant="secondary">{tag}</Badge>
                                              ))}
                                          </div>
                                      </CardContent>
                                      <CardFooter className="text-xs text-muted-foreground justify-between">
                                          <span>{vault.itemCount} {vault.itemCount === 1 ? 'item' : 'items'}</span>
                                          <span>{vault.createdAt}</span>
                                      </CardFooter>
                                  </Card>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-card p-12 text-center h-[450px]">
                             <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-4">
                                <Search className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-bold font-headline tracking-tight">{vaultsDict.emptyState.noResultsTitle}</h3>
                            <p className="text-sm text-muted-foreground">{vaultsDict.emptyState.noResultsDescription}</p>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-card p-12 text-center h-[450px]">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-4">
                            <KeyRound className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold font-headline tracking-tight">{vaultsDict.emptyState.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{vaultsDict.emptyState.description}</p>
                        <Button onClick={() => setCreateDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {vaultsDict.createNew}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
