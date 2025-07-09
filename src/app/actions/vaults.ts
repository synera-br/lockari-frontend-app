'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { debugLog, debugError } from '@/lib/debug';

const createVaultSchema = z.object({
  name: z.string().min(2, { message: 'Vault name must be at least 2 characters.' }),
  description: z.string().optional(),
  tags: z.string().optional(),
});

export interface CreateVaultFormState {
  message: string;
  fields?: Record<string, string>;
  issues?: string[];
  type?: 'success' | 'error';
}

export async function createVault(
  lang: string, // for revalidation
  prevState: CreateVaultFormState,
  formData: FormData
): Promise<CreateVaultFormState> {
  const validatedFields = createVaultSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    tags: formData.get('tags'),
  });

  if (!validatedFields.success) {
    const issues = validatedFields.error.issues.map((issue) => issue.message);
    return {
      message: 'Invalid form data. Please correct the errors.',
      issues,
      fields: {
        name: formData.get('name')?.toString() ?? '',
        description: formData.get('description')?.toString() ?? '',
        tags: formData.get('tags')?.toString() ?? '',
      },
      type: 'error',
    };
  }

  const { name, description, tags } = validatedFields.data;

  try {
    // TODO: Call the Go backend here to create the vault in Firestore.
    // This is a simulation.
    debugLog('--- CREATING VAULT (SIMULATION) ---');
    debugLog('Name:', name);
    debugLog('Description:', description);
    debugLog('Tags:', tags?.split(',').map(t => t.trim()).filter(Boolean) ?? []);
    debugLog('------------------------------------');
    
    // Simulate a network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Revalidate the path to show the new vault in the list.
    revalidatePath(`/${lang}/dashboard/vaults`);

    return {
      message: 'Vault created successfully!',
      type: 'success',
    };
  } catch (error) {
    debugError('Error creating vault:', error);
    return {
      message: 'An unexpected error occurred. Please try again later.',
      type: 'error',
      fields: { 
        name, 
        description: description ?? '', 
        tags: tags ?? '' 
      },
    };
  }
}
