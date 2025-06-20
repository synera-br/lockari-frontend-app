'use server';

import { z } from 'zod';

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

  // In a real application, you would send this data to an email service, CRM, or Firestore.
  // For now, we'll just log it.
  console.log('Contact form submission:');
  console.log('Name:', name);
  console.log('Email:', email);
  console.log('Message:', message);

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulate success
  const success = true; // Math.random() > 0.2; // Simulate occasional errors

  if (success) {
    return {
      message: 'Message sent successfully! We will get back to you soon.',
      type: 'success',
    };
  } else {
    return {
      message: 'An unexpected error occurred. Please try again later.',
      type: 'error',
      fields: { name, email, message }
    };
  }
}
