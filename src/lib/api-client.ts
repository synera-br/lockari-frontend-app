import { auth } from '@/lib/firebase/config';
import { BACKEND_URL } from '@/lib/firebase/config';
import { debugError, debugInfo } from '@/lib/debug';
import { CryptoCBC } from './crypto-cbc';

// Initial environment variable check
debugInfo("🔍 Environment check:", {
    hasEncryptionKey: !!(process.env.NEXT_PUBLIC_ENCRYPT_KEY || process.env.ENCRYPT_KEY),
    mode: process.env.NEXT_PUBLIC_MODE
});

const APP_NAME = 'LockariVaultApp';
const API_TIMEOUT = 15000; // 15 seconds
const BACKEND_API_TOKEN = (process.env.NEXT_PUBLIC_BACKEND_API_TOKEN || "").trim();

function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export async function fetchWithAuthHeaders(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  let token: string | null = null;
  const traceId = generateTraceId();

  if (currentUser) {
    try {
      token = await currentUser.getIdToken(true); 
    } catch (error) {
      debugError("APIClient: Error getting Firebase ID token:", error);
    }
  }

  const headers = new Headers(options.headers || {});
  
  headers.set('X-Token', BACKEND_API_TOKEN);

  if (token) {
    headers.set('X-AUTHORIZATION', `Bearer ${token}`);
  }

  headers.set('X-APP', APP_NAME);
  headers.set('X-TRACE-ID', traceId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const newOptions: RequestInit = { ...options, headers, signal: controller.signal };

  // Encrypt body if present for relevant methods
  if (newOptions.body && (newOptions.method === 'POST' || newOptions.method === 'PUT' || newOptions.method === 'PATCH')) {
    try {
      const originalBodyString = typeof newOptions.body === 'string' ? newOptions.body : JSON.stringify(newOptions.body);
      const encryptedPayloadString = CryptoCBC.encrypt(originalBodyString);
      
      newOptions.body = JSON.stringify({ payload: encryptedPayloadString });
      headers.set('Content-Type', 'application/json'); 
    } catch (error) {
      clearTimeout(timeoutId);
      debugError("APIClient: Error encrypting request body:", error);
      throw error;
    }
  }

  let response: Response;
  try {
    if (!BACKEND_URL) {
      throw new Error("Backend URL is not configured. Please set NEXT_PUBLIC_BACKEND_URL.");
    }
    response = await fetch(url, newOptions);
  } catch (networkError: any) {
    clearTimeout(timeoutId);
    if (networkError.name === 'AbortError') {
      debugError(`APIClient: Request to ${url} timed out after ${API_TIMEOUT / 1000}s.`);
      throw new Error(`Request to the server timed out. Please check if the backend is running and accessible at ${url}.`);
    }
    debugError(`APIClient: Network error during fetch to URL: ${url}. Error:`, networkError);
    throw new Error(
      `Failed to communicate with the server (${url}). Check your connection and if the backend server is accessible. Details: ${networkError.message || 'Unknown network error'}`
    );
  } finally {
      clearTimeout(timeoutId);
  }
  
  // Decrypt response body if present and encrypted
  if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
    const clonedResponse = response.clone(); 
    try {
      const responseBody = await clonedResponse.json();
      
      if (responseBody && typeof responseBody.payload === 'string') {
        const decryptedDataString = CryptoCBC.decrypt(responseBody.payload);
        const decryptedData = JSON.parse(decryptedDataString);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'application/json');
  
        return new Response(JSON.stringify(decryptedData), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return response; // Return original response if payload is not encrypted
    } catch (error: any) {
      debugError("APIClient: Response processing error:", {
        url: url,
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        error: error.message,
        traceId: traceId
      });
      throw new Error(`Failed to process server response: ${error.message}`);
    }
  }

  return response;
}
