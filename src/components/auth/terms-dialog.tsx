
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/dictionaries';
import { CheckCircle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TermsDialogProps {
  isOpen: boolean;
  isAccepting: boolean;
  onAccept: () => void;
  dictionary: Dictionary['termsDialog'];
}

export function TermsDialog({ isOpen, isAccepting, onAccept, dictionary }: TermsDialogProps) {
  return (
    <Dialog open={isOpen} modal={true}>
      <DialogContent className="sm:max-w-2xl" hideCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{dictionary.title}</DialogTitle>
          <DialogDescription asChild>
            <div className='pt-2 text-base text-muted-foreground'>
                <p>{dictionary.introduction}</p>
                <p className="mt-2 font-semibold text-foreground">{dictionary.securityPledge}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium text-foreground mt-4">{dictionary.agreementClause}</p>

        <ScrollArea className="h-72 w-full rounded-md border p-4">
            <ul className="space-y-4">
                {dictionary.items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                    </li>
                ))}
            </ul>
        </ScrollArea>
        
        <DialogFooter className="mt-4">
          <Button type="button" className="w-full" onClick={onAccept} disabled={isAccepting}>
            {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dictionary.acceptButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
