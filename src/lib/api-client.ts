

import { auth } from '@/lib/firebase/config';
import CryptoJS from 'crypto-js';
import { BACKEND_URL } from '@/lib/firebase/config';
import { debugError, debugLog, debugWarn, debugInfo } from '@/lib/debug';

const APP_NAME = 'LockariVaultApp';
const API_TIMEOUT = 15000; // 15 seconds

const ENCRYPTION_KEY = (process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "").trim().replace(/\n/g, '');
const BACKEND_API_TOKEN = (process.env.NEXT_PUBLIC_BACKEND_API_TOKEN || "").trim();

let encryptionKeyWordArray: CryptoJS.lib.WordArray;

try {
    if (!ENCRYPTION_KEY) {
        throw new Error("NEXT_PUBLIC_ENCRYPTION_KEY is not defined in the environment variables.");
    }
    
    const decodedKey = CryptoJS.enc.Base64.parse(ENCRYPTION_KEY);
    
    if (decodedKey.sigBytes !== 16 && decodedKey.sigBytes !== 24 && decodedKey.sigBytes !== 32) {
        throw new Error(
            `Invalid AES key size: ${decodedKey.sigBytes} bytes (must be 16, 24, or 32 bytes). ` +
            `Current key in Base64 starts with: ${ENCRYPTION_KEY.substring(0, 20)}...`
        );
    }
    
    debugInfo(`✅ Valid AES key loaded: ${decodedKey.sigBytes} bytes (${decodedKey.sigBytes * 8} bits)`);
    
    encryptionKeyWordArray = decodedKey;

} catch (e: any) {
    debugError("❌ Failed to initialize encryption key:", e.message);
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        debugError("Key analysis:", {
            provided: ENCRYPTION_KEY,
            length: ENCRYPTION_KEY.length,
            isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(ENCRYPTION_KEY)
        });
        debugWarn("🔧 Using fallback development key - THIS IS NOT FOR PRODUCTION!");
        encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    } else {
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
  try {
    // Validação da entrada
    if (data === null || data === undefined) {
      throw new Error("Encrypt: data is null or undefined");
    }
    
    // Validar se a chave está inicializada
    if (!encryptionKeyWordArray || encryptionKeyWordArray.sigBytes === 0) {
      throw new Error("Encrypt: encryption key is not properly initialized");
    }
    
    const dataString = JSON.stringify(data);
    
    // Validar se o JSON foi serializado corretamente
    if (!dataString || dataString === 'null' || dataString === 'undefined') {
      throw new Error("Encrypt: failed to serialize data to JSON");
    }
    
    // Gerar IV aleatório (16 bytes)
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Criptografar usando AES-CBC com PKCS7 padding
    const encrypted = CryptoJS.AES.encrypt(dataString, encryptionKeyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Validar se a criptografia foi bem-sucedida
    if (!encrypted || !encrypted.ciphertext || encrypted.ciphertext.sigBytes === 0) {
      throw new Error("Encrypt: encryption operation failed");
    }
    
    // Combinar IV + Ciphertext em bytes brutos
    const combined = iv.clone().concat(encrypted.ciphertext);
    
    // Converter para Base64 (formato esperado pelo backend)
    const base64Result = combined.toString(CryptoJS.enc.Base64);
    
    // Validação final do resultado
    if (!base64Result || base64Result.length === 0) {
      throw new Error("Encrypt: failed to generate Base64 output");
    }
    
    // Log para debug em desenvolvimento
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
      debugLog('🔐 Encryption successful:', {
        originalSize: dataString.length,
        encryptedSize: base64Result.length,
        ivSize: iv.sigBytes,
        ciphertextSize: encrypted.ciphertext.sigBytes
      });
      debugLog('--- API CLIENT REQUEST ---');
      debugLog('Original Payload:', data);
      debugLog('Encrypted Payload:', base64Result);
      debugLog('------------------------');
    }
    
    return base64Result;
    
  } catch (error: any) {
    // Log detalhado para debug
    debugError("APIClient: Encryption error details:", {
      error: error.message,
      dataType: typeof data,
      dataPreview: JSON.stringify(data)?.substring(0, 100) + "...",
      keyInfo: {
        keySize: encryptionKeyWordArray?.sigBytes || 0,
        keyAvailable: !!encryptionKeyWordArray
      }
    });
    
    // Re-throw com contexto adicional
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
      // Force a token refresh to get the very latest token. This is crucial after login/signup.
      token = await currentUser.getIdToken(true); 
    } catch (error) {
      debugError("APIClient: Error getting Firebase ID token:", error);
    }
  }

  const headers = new Headers(options.headers || {});
  
  // Shared secret to authenticate the frontend application itself to the backend.
  headers.set('X-Token', BACKEND_API_TOKEN);

  // User's JWT for user-specific authentication.
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
