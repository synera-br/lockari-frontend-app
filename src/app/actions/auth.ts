
'use server';

import { headers } from 'next/headers';
import { fetchWithAuthHeaders } from '@/lib/api-client';
import { BACKEND_URL } from '@/lib/firebase/config';
import { debugLog, debugError } from '@/lib/debug';

interface AuditEventPayload {
  eventType: 'LOGIN_SUCCESS' | 'SIGNUP_SUCCESS';
  user: {
    uid: string;
    email: string | null;
    name?: string;
    plan?: string;
  };
  clientInfo: {
    ipAddress: string | null;
    userAgent: string | null;
  };
  timestamp: string;
}

/**
 * Sends an audit event to a backend service.
 * This now uses the encrypted fetch client.
 */
export async function auditAuthEvent(
  data: Omit<AuditEventPayload, 'clientInfo' | 'timestamp'>
) {
  const headersList = headers();
  const ipAddress = headersList.get('x-forwarded-for') ?? '127.0.0.1';
  const userAgent = headersList.get('user-agent');

  const payload: AuditEventPayload = {
    ...data,
    timestamp: new Date().toISOString(),
    clientInfo: {
      ipAddress,
      userAgent,
    },
  };
  
  if (!BACKEND_URL) {
    debugLog('AUDIT EVENT (simulated - BACKEND_URL not set):', JSON.stringify(payload, null, 2));
    return { success: true, message: "Simulated audit event. BACKEND_URL not configured." };
  }

  try {
    // The fetchWithAuthHeaders function will handle encryption and custom headers
    const response = await fetchWithAuthHeaders(`${BACKEND_URL}/v1/audit/auth`, {
      method: 'POST',
      body: JSON.stringify(payload), // The body will be encrypted by the client
    });

    if (!response.ok) {
      // The response body might be encrypted, but for errors, it's often plain text.
      // The api-client doesn't decrypt error responses.
      const errorText = await response.text();
      debugError('Failed to send audit event to backend:', response.status, errorText);
      // Attempt to parse the error text in case it's a JSON from our Go backend
      try {
        const errorJson = JSON.parse(errorText);
        return { success: false, message: errorJson.error || 'Failed to send audit event.' };
      } catch (e) {
        return { success: false, message: `Failed to send audit event: ${errorText}` };
      }
    }
    
    // The response from a successful audit might be empty or a simple confirmation.
    // The api-client will attempt to decrypt it if it has a payload.
    debugLog('Successfully sent audit event to backend.');
    return { success: true };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    debugError('Error sending audit event:', message);
    return { success: false, message: `An unexpected error occurred while sending the audit event: ${message}` };
  }
}
