

import { auth } from '@/lib/firebase/config';
import CryptoJS from 'crypto-js';
import { BACKEND_URL } from '@/lib/firebase/config';
import { debugError, debugLog, debugWarn, debugInfo } from '@/lib/debug';

const APP_NAME = 'LockariVaultApp';
const API_TIMEOUT = 15000; // 15 seconds

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "";

let encryptionKeyWordArray: CryptoJS.lib.WordArray;

try {
    if (!ENCRYPTION_KEY) {
        throw new Error("NEXT_PUBLIC_ENCRYPTION_KEY is not defined in the environment variables.");
    }
    
    const decodedKey = CryptoJS.enc.Base64.parse(ENCRYPTION_KEY);
    
    // Strict validation like the Go backend
    if (decodedKey.sigBytes !== 16 && decodedKey.sigBytes !== 24 && decodedKey.sigBytes !== 32) {
        throw new Error(
            `Invalid AES key size: ${decodedKey.sigBytes} bytes (must be 16, 24, or 32 bytes). ` +
            `Current key in Base64 starts with: ${ENCRYPTION_KEY.substring(0, 20)}...`
        );
    }
    
    debugInfo(`✅ Valid AES key loaded: ${decodedKey.sigBytes} bytes (${decodedKey.sigBytes * 8} bits)`);
    
    encryptionKeyWordArray = decodedKey;

} catch (e: any) {
    // Detailed error logging for debugging
    debugError("❌ Failed to initialize encryption key:", e.message);
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        debugError("Key analysis:", {
            provided: ENCRYPTION_KEY,
            length: ENCRYPTION_KEY.length,
            isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(ENCRYPTION_KEY)
        });
        // Use fallback key only in development
        debugWarn("🔧 Using fallback development key - THIS IS NOT FOR PRODUCTION!");
        encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    } else {
        // In production, fail completely
        throw new Error("Invalid encryption key configuration. Application cannot start.");
    }
}


function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Encrypts data to the format expected by the Go backend: Base64(raw_iv_bytes + raw_ciphertext_bytes)
 * @param data The object to be encrypted.
 * @returns A Base64 string.
 */
function encryptData(data: any): string {
  const dataString = JSON.stringify(data);
  const iv = CryptoJS.lib.WordArray.random(16); // 16-byte IV for AES

  const encrypted = CryptoJS.AES.encrypt(dataString, encryptionKeyWordArray, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  const combined = iv.clone().concat(encrypted.ciphertext);
  
  return combined.toString(CryptoJS.enc.Base64);
}

/**
 * Decrypts a Base64 payload in the format: Base64(raw_iv_bytes + raw_ciphertext_bytes)
 * @param base64Payload The Base64 string received from the server.
 * @returns The original object.
 */
function decryptData(base64Payload: string): any {
  try {
    const combined = CryptoJS.enc.Base64.parse(base64Payload);
    const combinedHex = combined.toString(CryptoJS.enc.Hex);
    
    const ivHex = combinedHex.substring(0, 32);
    const ciphertextHex = combinedHex.substring(32);

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);

    const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, encryptionKeyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedDataString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedDataString) {
      throw new Error("Decryption failed (Utf8): empty data after conversion.");
    }
    return JSON.parse(decryptedDataString);
  } catch (error) {
    debugError("APIClient: Error during decryption in decryptData:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to parse JSON after decryption. Data may be corrupt or not valid JSON.");
    }
    throw new Error("Failed to process encrypted response from server. Check key and data format.");
  }
}

export async function fetchWithAuthHeaders(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  let token: string | null = null;
  const traceId = generateTraceId();

  if (currentUser) {
    try {
      // Force a token refresh to get the very latest token. This is crucial after login/signup.
      token = await currentUser.getIdToken(true); 
    } catch (error) {
      debugError("APIClient: Error getting Firebase ID token:", error);
    }
  }

  const headers = new Headers(options.headers || {});
  
  // Token JWT para autenticação no backend
  const BACKEND_API_TOKEN = process.env.NEXT_PUBLIC_BACKEND_API_TOKEN || ""
  headers.set('X-Token', BACKEND_API_TOKEN);

  if (token) {
    headers.set('X-AUTHORIZATION', `Bearer ${token}`);
  }

  headers.set('X-APP', APP_NAME);
  headers.set('X-TRACE-ID', traceId);

  // Configure AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const newOptions: RequestInit = { ...options, headers, signal: controller.signal };

  if (newOptions.body && (newOptions.method === 'POST' || newOptions.method === 'PUT' || newOptions.method === 'PATCH')) {
    try {
      const originalBody = typeof newOptions.body === 'string' ? JSON.parse(newOptions.body) : newOptions.body;
      const encryptedPayloadString = encryptData(originalBody);
      
      debugLog('--- API CLIENT REQUEST ---');
      debugLog('URL:', url);
      debugLog('Original Payload:', originalBody);
      debugLog('Encrypted Payload:', encryptedPayloadString);
      debugLog('------------------------');
      
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
  
  if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
    const clonedResponse = response.clone(); 
    try {
      const responseBody = await clonedResponse.json();
      if (responseBody && typeof responseBody.payload === 'string') {
        const decryptedData = decryptData(responseBody.payload);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'application/json');

        return new Response(JSON.stringify(decryptedData), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return response;
    } catch (error) {
      debugError("APIClient: Error attempting to process/decrypt JSON response:", error);
      return response;
    }
  }

  return response;
}
