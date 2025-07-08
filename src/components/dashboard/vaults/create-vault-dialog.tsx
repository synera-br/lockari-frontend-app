'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction, useMemo } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { createVault, type CreateVaultFormState } from '@/app/actions/vaults';
import type { Dictionary } from '@/dictionaries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import type { Locale } from '@/middleware';

interface CreateVaultDialogProps {
  children: React.ReactNode;
  dictionary: Dictionary;
  lang: Locale;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const initialState: CreateVaultFormState = {
  message: '',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}

export default function CreateVaultDialog({ children, dictionary, lang, isOpen, setIsOpen }: CreateVaultDialogProps) {
  const dialogDict = dictionary.dashboard.vaults.createDialog;
  const feedbackDict = dictionary.dashboard.vaults.formFeedback;

  const createVaultWithLang = useMemo(() => createVault.bind(null, lang), [lang]);
  const [state, formAction] = useFormState(createVaultWithLang, initialState);
  
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.type === 'success') {
      toast({
        title: feedbackDict.successTitle,
        description: feedbackDict.successDescription,
      });
      setIsOpen(false);
      formRef.current?.reset();
    } else if (state.type === 'error') {
      toast({
        variant: 'destructive',
        title: feedbackDict.errorTitle,
        description: state.message || feedbackDict.validationError,
      });
    }
  }, [state, toast, feedbackDict, setIsOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{dialogDict.title}</DialogTitle>
          <DialogDescription>{dialogDict.description}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{dialogDict.nameLabel}</Label>
            <Input
              id="name"
              name="name"
              placeholder={dialogDict.namePlaceholder}
              defaultValue={state?.fields?.name}
              required
            />
            {state?.issues?.find(issue => issue.toLowerCase().includes('name')) && (
                 <p className="text-sm text-destructive mt-1">{state.issues.find(issue => issue.toLowerCase().includes('name'))}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{dialogDict.descriptionLabel}</Label>
            <Textarea
              id="description"
              name="description"
              placeholder={dialogDict.descriptionPlaceholder}
              defaultValue={state?.fields?.description}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">{dialogDict.tagsLabel}</Label>
            <Input
              id="tags"
              name="tags"
              placeholder={dialogDict.tagsPlaceholder}
              defaultValue={state?.fields?.tags}
            />
            <p className="text-xs text-muted-foreground">{dialogDict.tagsHint}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="ghost">{dialogDict.cancel}</Button>
            </DialogClose>
            <SubmitButton label={dialogDict.submit} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
