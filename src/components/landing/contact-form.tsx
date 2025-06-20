
'use client';

import { useEffect } from 'react';
import { useActionState } from 'react'; // Changed from 'react-dom'
import { useFormStatus } from 'react-dom';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm, type ContactFormState } from '@/app/actions/contact';
import { Loader2 } from 'lucide-react';

interface ContactFormProps {
  dictionary: {
    title: string;
    subtitle: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    message: string;
    messagePlaceholder: string;
    submit: string;
    success: string;
    error: string;
  };
}

const initialState: ContactFormState = {
  message: '',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full md:w-auto font-semibold" size="lg">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

export default function ContactForm({ dictionary }: ContactFormProps) {
  const [state, formAction] = useActionState(submitContactForm, initialState); // Renamed useFormState to useActionState
  const { toast } = useToast();

  useEffect(() => {
    if (state.type === 'success') {
      toast({
        title: 'Success!',
        description: dictionary.success, // Use dynamic success message from dictionary
      });
      // Optionally reset form here if you manage form fields with React state
    } else if (state.type === 'error') {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: state.message || dictionary.error, // Use dynamic error message
      });
    }
  }, [state, toast, dictionary.success, dictionary.error]);

  return (
    <section id="contact" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-headline text-3xl font-bold text-foreground sm:text-4xl md:text-5xl mb-4">
            {dictionary.title}
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            {dictionary.subtitle}
          </p>
        </div>

        <form action={formAction} className="max-w-xl mx-auto space-y-6 bg-card p-8 rounded-lg shadow-xl">
          <div>
            <Label htmlFor="name" className="font-semibold">{dictionary.name}</Label>
            <Input
              type="text"
              id="name"
              name="name"
              placeholder={dictionary.namePlaceholder}
              className="mt-1"
              defaultValue={state.fields?.name}
              aria-describedby="name-error"
              required
            />
            {state.issues?.find(issue => issue.toLowerCase().includes('name')) && (
                 <p id="name-error" className="text-sm text-destructive mt-1">{state.issues.find(issue => issue.toLowerCase().includes('name'))}</p>
            )}
          </div>
          <div>
            <Label htmlFor="email" className="font-semibold">{dictionary.email}</Label>
            <Input
              type="email"
              id="email"
              name="email"
              placeholder={dictionary.emailPlaceholder}
              className="mt-1"
              defaultValue={state.fields?.email}
              aria-describedby="email-error"
              required
            />
             {state.issues?.find(issue => issue.toLowerCase().includes('email')) && (
                 <p id="email-error" className="text-sm text-destructive mt-1">{state.issues.find(issue => issue.toLowerCase().includes('email'))}</p>
            )}
          </div>
          <div>
            <Label htmlFor="message" className="font-semibold">{dictionary.message}</Label>
            <Textarea
              id="message"
              name="message"
              rows={5}
              placeholder={dictionary.messagePlaceholder}
              className="mt-1"
              defaultValue={state.fields?.message}
              aria-describedby="message-error"
              required
            />
            {state.issues?.find(issue => issue.toLowerCase().includes('message')) && (
                 <p id="message-error" className="text-sm text-destructive mt-1">{state.issues.find(issue => issue.toLowerCase().includes('message'))}</p>
            )}
          </div>
          <div className="flex justify-end">
            <SubmitButton label={dictionary.submit} />
          </div>
           {state.message && !state.issues && state.type === 'error' && (
            <p className="text-sm text-destructive mt-2">{state.message}</p>
          )}
        </form>
      </div>
    </section>
  );
}
