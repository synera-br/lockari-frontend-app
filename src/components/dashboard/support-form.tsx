'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { submitSupportForm, type SupportFormState } from '@/app/actions/support';
import type { Dictionary } from '@/dictionaries';

interface SupportFormProps {
  dictionary: Dictionary['dashboard']['supportForm'];
}

const initialState: SupportFormState = {
  message: '',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

export function SupportForm({ dictionary }: SupportFormProps) {
  const [state, formAction] = useFormState(submitSupportForm, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.message) return;

    if (state.type === 'success') {
      toast({
        title: dictionary.successTitle,
        description: dictionary.successDescription,
      });
      formRef.current?.reset();
    } else if (state.type === 'error') {
      toast({
        variant: 'destructive',
        title: dictionary.errorTitle,
        description: state.message || dictionary.errorDescription,
      });
    }
  }, [state, toast, dictionary]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.title}</CardTitle>
        <CardDescription>{dictionary.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="subject">{dictionary.subject}</Label>
            <Input
              id="subject"
              name="subject"
              placeholder={dictionary.subjectPlaceholder}
              defaultValue={state?.fields?.subject}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">{dictionary.type}</Label>
              <Select name="type" defaultValue={state?.fields?.type} required>
                <SelectTrigger id="type">
                  <SelectValue placeholder={dictionary.typePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">{dictionary.types.support}</SelectItem>
                  <SelectItem value="feedback">{dictionary.types.feedback}</SelectItem>
                  <SelectItem value="new-feature">{dictionary.types.newFeature}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{dictionary.category}</Label>
              <Select name="category" defaultValue={state?.fields?.category ?? 'other'} required>
                <SelectTrigger id="category">
                  <SelectValue placeholder={dictionary.categoryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">{dictionary.categories.other}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">{dictionary.message}</Label>
            <Textarea
              id="message"
              name="message"
              rows={6}
              placeholder={dictionary.messagePlaceholder}
              defaultValue={state?.fields?.message}
              required
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton label={dictionary.submit} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
