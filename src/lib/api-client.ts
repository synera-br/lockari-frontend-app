
'use server';

import { auth } from '@/lib/firebase/config';
import CryptoJS from 'crypto-js';
import { BACKEND_URL, BACKEND_API_TOKEN } from '@/lib/firebase/config';

const APP_NAME = 'LockariVaultApp';
const API_TIMEOUT = 15000; // 15 seconds

// IMPORTANT: This key MUST be a Base64 encoded string of a 16, 24, or 32-byte key for AES-128, AES-192, or AES-256 respectively.
const SHARED_SECRET_BASE64 = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;

let encryptionKeyWordArray: CryptoJS.lib.WordArray | null = null;

if (!SHARED_SECRET_BASE64) {
  if (process.env.NODE_ENV === 'development') {
    console.warn("API Client Encryption WARN: NEXT_PUBLIC_ENCRYPTION_KEY is not set. Using a default insecure key for development. THIS IS NOT FOR PRODUCTION.");
  }
  // Default 32-byte key for AES-256 for dev environments when no key is provided
  encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
} else {
    try {
        const decodedKey = CryptoJS.enc.Base64.parse(SHARED_SECRET_BASE64);
        if (decodedKey.sigBytes !== 16 && decodedKey.sigBytes !== 24 && decodedKey.sigBytes !== 32) {
            console.warn(
                `API Client Encryption WARN: The Base64 decoded encryption key has ${decodedKey.sigBytes} bytes. ` +
                `AES requires keys of 16, 24, or 32 bytes (128, 192, or 256 bits respectively).`
            );
        }
        encryptionKeyWordArray = decodedKey;
    } catch (e) {
        console.error("Failed to parse the Base64 encryption key from NEXT_PUBLIC_ENCRYPTION_KEY. Please ensure it is a valid Base64 string.", e);
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
 * using AES-256-CBC with PKCS7 padding.
 * @param data The object to be encrypted.
 * @returns A Base64 encoded string.
 */
function encryptData(data: any): string {
  if (!encryptionKeyWordArray) {
    throw new Error("Encryption key is not available. Please check your environment configuration.");
  }
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
  if (!encryptionKeyWordArray) {
    throw new Error("Encryption key is not available for decryption. Please check your environment configuration.");
  }
  try {
    const combined = CryptoJS.enc.Base64.parse(base64Payload);
    const combinedHex = combined.toString(CryptoJS.enc.Hex);
    
    // IV is the first 16 bytes (32 hex characters)
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
      throw new Error("Failed to decrypt (Utf8): empty data after conversion.");
    }
    return JSON.parse(decryptedDataString);
  } catch (error) {
    console.error("APIClient: Error in decryptData:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to parse JSON after decryption. The data may be corrupt or not valid JSON.");
    }
    throw new Error("Failed to process encrypted response from the server. Check key and data format.");
  }
}

export async function fetchWithAuthHeaders(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  let userToken: string | null = null;
  const traceId = generateTraceId();

  if (currentUser) {
    try {
      userToken = await currentUser.getIdToken(true); // Force refresh for latest token
    } catch (error) {
      console.error("APIClient: Error getting Firebase ID token:", error);
    }
  }

  const headers = new Headers(options.headers || {});
  
  // Static token for authorizing the frontend application with the backend.
  if (BACKEND_API_TOKEN) {
    headers.set('X-TOKEN', BACKEND_API_TOKEN);
  }
  
  // User-specific token for authenticating the user.
  if (userToken) {
    headers.set('X-AUTHORIZATION', `Bearer ${userToken}`);
  }
  
  headers.set('X-APP', APP_NAME);
  headers.set('X-TRACE-ID', traceId);

  // Set up AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const newOptions: RequestInit = { ...options, headers, signal: controller.signal };

  // Encrypt the body for POST, PUT, and PATCH requests, as required by the backend.
  if (newOptions.body && (newOptions.method === 'POST' || newOptions.method === 'PUT' || newOptions.method === 'PATCH')) {
    try {
      const originalBody = typeof newOptions.body === 'string' ? JSON.parse(newOptions.body) : newOptions.body;
      const encryptedPayloadString = encryptData(originalBody);
      newOptions.body = JSON.stringify({ payload: encryptedPayloadString });
      headers.set('Content-Type', 'application/json'); 
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on early error
      console.error("APIClient: Error encrypting request body:", error);
      throw error;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, newOptions);
  } catch (networkError: any) {
    clearTimeout(timeoutId); // Clear timeout before handling the error
    if (networkError.name === 'AbortError') {
      console.error(`APIClient: Request to ${url} timed out after ${API_TIMEOUT / 1000}s.`);
      throw new Error(`The request to the server timed out. Please check if the backend is running and accessible at ${url}.`);
    }
    console.error(`APIClient: Network error during fetch to URL: ${url}. Error:`, networkError);
    throw new Error(
      `Failed to communicate with the server (${url}). Check your connection and if the backend server is accessible. Details: ${networkError.message || 'Unknown network error'}`
    );
  } finally {
      clearTimeout(timeoutId);
  }
  
  // Check if the response is OK and seems to contain an encrypted JSON payload to decrypt.
  if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
    const clonedResponse = response.clone(); 
    try {
      const responseBody = await clonedResponse.json();
      
      // If a 'payload' field exists and is a string, assume it's encrypted and decrypt it.
      if (responseBody && typeof responseBody.payload === 'string') {
        const decryptedData = decryptData(responseBody.payload);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'application/json');

        // Return a new response with the decrypted body.
        return new Response(JSON.stringify(decryptedData), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      // If no 'payload' field, return the original response as is.
      return response;
    } catch (error) {
      // If JSON parsing or decryption fails, return the original response for the caller to handle.
      console.error("APIClient: Error trying to process/decrypt JSON response:", error);
      return response;
    }
  }

  return response;
}
