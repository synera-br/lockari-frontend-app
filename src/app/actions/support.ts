'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const supportFormSchema = z.object({
  subject: z.string().min(5, { message: 'Subject must be at least 5 characters.' }),
  type: z.enum(['support', 'feedback', 'new-feature']),
  category: z.string().min(1, { message: 'Category is required.' }),
  message: z.string().min(20, { message: 'Message must be at least 20 characters.' }),
  // In a real app, you would also validate the user's identity here from a server session.
});

export interface SupportFormState {
  message: string;
  fields?: Record<string, string>;
  issues?: string[];
  type?: 'success' | 'error';
}

export async function submitSupportForm(
  prevState: SupportFormState,
  formData: FormData
): Promise<SupportFormState> {

  const validatedFields = supportFormSchema.safeParse({
    subject: formData.get('subject'),
    type: formData.get('type'),
    category: formData.get('category'),
    message: formData.get('message'),
  });

  if (!validatedFields.success) {
    const issues = validatedFields.error.issues.map((issue) => issue.message);
    return {
      message: 'Invalid form data. Please correct the errors and try again.',
      issues,
      fields: {
        subject: formData.get('subject')?.toString() ?? '',
        type: formData.get('type')?.toString() ?? '',
        category: formData.get('category')?.toString() ?? '',
        message: formData.get('message')?.toString() ?? '',
      },
      type: 'error',
    };
  }

  const { subject, type, category, message } = validatedFields.data;

  try {
    const submissionsCollection = collection(db, 'supportSubmissions');
    await addDoc(submissionsCollection, {
      // In a real application, you'd get the user ID from a server-side session
      // For now, this is anonymous, but in a real app this must be secured.
      subject,
      type,
      category,
      message,
      submittedAt: serverTimestamp(),
      status: 'open', // default status
    });
    console.log('Support form submission saved to Firestore.');

    return {
      message: 'Your request has been submitted successfully.',
      type: 'success',
    };
  } catch (error) {
    console.error('Error saving support submission to Firestore:', error);
    return {
      message: 'An unexpected error occurred. Please try again later.',
      type: 'error',
      fields: { subject, type, category, message },
    };
  }
}
