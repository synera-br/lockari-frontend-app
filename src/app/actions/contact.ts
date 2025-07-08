'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

export interface ContactFormState {
  message: string;
  fields?: Record<string, string>;
  issues?: string[];
  type?: 'success' | 'error';
}

export async function submitContactForm(
  prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const validatedFields = contactFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!validatedFields.success) {
    const issues = validatedFields.error.issues.map((issue) => issue.message);
    return {
      message: 'Invalid form data. Please correct the errors.',
      issues,
      fields: {
        name: formData.get('name')?.toString() ?? '',
        email: formData.get('email')?.toString() ?? '',
        message: formData.get('message')?.toString() ?? '',
      },
      type: 'error',
    };
  }

  const { name, email, message } = validatedFields.data;

  try {
    const submissionsCollection = collection(db, 'contactSubmissions');
    await addDoc(submissionsCollection, {
      name,
      email,
      message,
      submittedAt: serverTimestamp(),
    });
    console.log('Contact form submission saved to Firestore.');

    return {
      message: 'Message sent successfully! We will get back to you soon.',
      type: 'success',
    };
  } catch (error) {
    console.error('Error saving contact submission to Firestore:', error);
    return {
      message: 'An unexpected error occurred. Please try again later.',
      type: 'error',
      fields: { name, email, message },
    };
  }
}
