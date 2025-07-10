
import { auth } from '@/lib/firebase/config';
import CryptoJS from 'crypto-js';
import { BACKEND_URL } from '@/lib/firebase/config';
import { debugError, debugLog, debugWarn, debugInfo } from '@/lib/debug';

const APP_NAME = 'LockariVaultApp';
const API_TIMEOUT = 15000; // 15 seconds

const ENCRYPTION_KEY = (process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "").trim().replace(/\n/g, '');
const BACKEND_API_TOKEN = (process.env.NEXT_PUBLIC_BACKEND_API_TOKEN || "").trim();

let encryptionKeyWordArray: CryptoJS.lib.WordArray;

/**
 * Validates the encryption key's format and size, similar to the Go backend.
 * @param base64Key The Base64 encoded key string.
 * @returns An object with validation status and details.
 */
function validateEncryptionKey(base64Key: string): { valid: boolean; error?: string; keyInfo?: any } {
  try {
    if (!base64Key || base64Key.trim() === '') {
      return { valid: false, error: "Key is empty or null" };
    }

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Key)) {
      return { valid: false, error: "Invalid Base64 format" };
    }
    
    const decodedKey = CryptoJS.enc.Base64.parse(base64Key);
    const validSizes = [16, 24, 32];
    
    if (!validSizes.includes(decodedKey.sigBytes)) {
      return { 
        valid: false, 
        error: `Invalid key size: ${decodedKey.sigBytes} bytes (must be 16, 24, or 32)`,
        keyInfo: { size: decodedKey.sigBytes, validSizes }
      };
    }
    
    return { 
      valid: true, 
      keyInfo: { 
        size: decodedKey.sigBytes, 
        bits: decodedKey.sigBytes * 8,
        type: decodedKey.sigBytes === 16 ? 'AES-128' : 
              decodedKey.sigBytes === 24 ? 'AES-192' : 'AES-256'
      }
    };
    
  } catch (error: any) {
    return { valid: false, error: `Key validation failed: ${error.message}` };
  }
}

// Key Initialization Block
const keyValidationResult = validateEncryptionKey(ENCRYPTION_KEY);

if (keyValidationResult.valid) {
    debugInfo(`✅ Valid AES key loaded: ${keyValidationResult.keyInfo.type} (${keyValidationResult.keyInfo.size} bytes)`);
    encryptionKeyWordArray = CryptoJS.enc.Base64.parse(ENCRYPTION_KEY);
} else {
    debugError("❌ Failed to initialize encryption key:", keyValidationResult.error, keyValidationResult.keyInfo || '');
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        debugWarn("🔧 Using fallback development key - THIS IS NOT FOR PRODUCTION!");
        encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    } else {
        throw new Error(`Invalid encryption key configuration: ${keyValidationResult.error}. Application cannot start.`);
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
  try {
    if (data === null || data === undefined) {
      throw new Error("Encrypt: data is null or undefined");
    }
    
    if (!encryptionKeyWordArray || encryptionKeyWordArray.sigBytes === 0) {
      throw new Error("Encrypt: encryption key is not properly initialized");
    }
    
    const dataString = JSON.stringify(data);
    
    if (!dataString || dataString === 'null' || dataString === 'undefined') {
      throw new Error("Encrypt: failed to serialize data to JSON");
    }
    
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(dataString, encryptionKeyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    if (!encrypted || !encrypted.ciphertext || encrypted.ciphertext.sigBytes === 0) {
      throw new Error("Encrypt: encryption operation failed");
    }
    
    const combined = iv.clone().concat(encrypted.ciphertext);
    const base64Result = combined.toString(CryptoJS.enc.Base64);
    
    if (!base64Result || base64Result.length === 0) {
      throw new Error("Encrypt: failed to generate Base64 output");
    }
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
      debugLog('🔐 Encryption successful:', {
        originalSize: dataString.length,
        encryptedSize: base64Result.length,
        ivSize: iv.sigBytes,
        ciphertextSize: encrypted.ciphertext.sigBytes
      });
    }
    
    return base64Result;
    
  } catch (error) {
    debugError("APIClient: Encryption error details:", {
      error: error instanceof Error ? error.message : String(error),
      dataType: typeof data,
      dataPreview: JSON.stringify(data)?.substring(0, 100) + "...",
      keyInfo: {
        keySize: encryptionKeyWordArray?.sigBytes || 0,
        keyAvailable: !!encryptionKeyWordArray
      }
    });
    
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unexpected error during encryption: " + String(error));
  }
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

  if (newOptions.body && (newOptions.method === 'POST' || newOptions.method === 'PUT' || newOptions.method === 'PATCH')) {
    try {
      const originalBody = typeof newOptions.body === 'string' ? JSON.parse(newOptions.body) : newOptions.body;
      const encryptedPayloadString = encryptData(originalBody);
      
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
