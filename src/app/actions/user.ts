
'use server';

import { db } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { CURRENT_TERMS_VERSION } from '@/lib/config';

/**
 * Updates the user's profile in Firestore to mark terms as accepted.
 * @param uid The user's unique ID.
 */
export async function acceptUserTerms(uid: string) {
  if (!uid) {
    return { success: false, message: 'User ID is required.' };
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
    });
    return { success: true };
  } catch (error) {
    console.error('Error accepting user terms:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { success: false, message: `Failed to update terms: ${message}` };
  }
}
