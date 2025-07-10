
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
 * Sends an audit event to the backend using the centralized and encrypted API client.
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
    // This now uses the centralized fetch client, which handles encryption,
    // custom headers, timeouts, and debug logging automatically.
    const response = await fetchWithAuthHeaders(`${BACKEND_URL}/v1/audit/auth`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugError('Backend returned an error for audit event:', response.status, errorText);
      try {
        // Try to parse a structured error from the backend
        const errorJson = JSON.parse(errorText);
        return { success: false, message: errorJson.error || 'Failed to send audit event.' };
      } catch (e) {
        // If parsing fails, return the raw text
        return { success: false, message: `Failed to send audit event: ${errorText}` };
      }
    }
    
    // A successful audit call might return an empty body or a simple confirmation.
    debugLog('Successfully sent audit event to backend.');
    return { success: true };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    debugError('Error during fetchWithAuthHeaders for audit event:', message);
    return { success: false, message: `An unexpected error occurred while sending the audit event: ${message}` };
  }
}
