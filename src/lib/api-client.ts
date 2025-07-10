
import { auth } from '@/lib/firebase/config';
import CryptoJS from 'crypto-js';
import { BACKEND_URL } from '@/lib/firebase/config';
import { debugError, debugLog, debugWarn, debugInfo } from '@/lib/debug';

// Initial environment variable check
debugInfo("🔍 Environment check:", {
    hasEncryptionKey: !!process.env.NEXT_PUBLIC_ENCRYPTION_KEY,
    keyLength: process.env.NEXT_PUBLIC_ENCRYPTION_KEY?.length || 0,
    keyPreview: process.env.NEXT_PUBLIC_ENCRYPTION_KEY?.substring(0, 20) + "...",
    mode: process.env.NEXT_PUBLIC_MODE
});

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
    // Validar se a chave não está vazia
    if (!base64Key || base64Key.trim() === '') {
      return { valid: false, error: "Key is empty or null" };
    }

    // Validar formato Base64 (mesmo regex do backend)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Key)) {
      return { valid: false, error: "Invalid Base64 format" };
    }
    
    // Decodificar e validar tamanho
    const decodedKey = CryptoJS.enc.Base64.parse(base64Key);
    const validSizes = [16, 24, 32]; // AES-128, AES-192, AES-256
    
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
    
    // 🔍 LOGS DE DEBUG ADICIONAIS
    debugInfo("🔑 FRONTEND DEBUG: Raw encryption key:", ENCRYPTION_KEY);
    debugInfo("🔑 FRONTEND DEBUG: Key hex:", encryptionKeyWordArray.toString(CryptoJS.enc.Hex));
    debugInfo("🔑 FRONTEND DEBUG: Key size:", encryptionKeyWordArray.sigBytes);
    
} else {
    debugError("❌ Failed to initialize encryption key:", keyValidationResult.error, keyValidationResult.keyInfo || '');
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        debugWarn("🔧 Using fallback development key - THIS IS NOT FOR PRODUCTION!");
        encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
        
        // 🔍 LOG DA CHAVE DE FALLBACK
        debugWarn("🔑 FRONTEND DEBUG: Using fallback key hex:", encryptionKeyWordArray.toString(CryptoJS.enc.Hex));
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
      console.log('🔐 Encryption successful:', {
        originalSize: dataString.length,
        encryptedSize: base64Result.length,
        ivSize: iv.sigBytes,
        ciphertextSize: encrypted.ciphertext.sigBytes
      });
    }
    
    return base64Result;
    
  } catch (error) {
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
    // Validação inicial do payload
    if (!base64Payload || base64Payload.trim() === '') {
      throw new Error("Decrypt: base64 payload is empty");
    }

    // Validar se é um Base64 válido
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Payload)) {
      throw new Error("Decrypt: invalid Base64 format in payload");
    }

    const combined = CryptoJS.enc.Base64.parse(base64Payload);
    
    // Validação do tamanho mínimo (como no backend Go)
    const minSize = 16; // AES block size (IV size)
    if (combined.sigBytes < minSize) {
      throw new Error(
        `Decrypt: combined payload too short to contain IV ` +
        `(got ${combined.sigBytes} bytes, expected at least ${minSize})`
      );
    }
    
    const combinedHex = combined.toString(CryptoJS.enc.Hex);
    
    // Validar se o ciphertext tem tamanho válido (múltiplo do block size)
    const ivSize = 32; // 16 bytes = 32 hex chars
    const ciphertextHex = combinedHex.substring(ivSize);
    const ciphertextSizeBytes = ciphertextHex.length / 2;
    
    if (ciphertextSizeBytes === 0) {
      throw new Error("Decrypt: ciphertext is empty after IV extraction");
    }
    
    if (ciphertextSizeBytes % 16 !== 0) {
      throw new Error(
        `Decrypt: ciphertext length (${ciphertextSizeBytes}) is not a multiple of AES block size (16)`
      );
    }
    
    const ivHex = combinedHex.substring(0, ivSize);
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
    
    // Validação mais rigorosa do resultado
    if (!decryptedDataString || decryptedDataString.length === 0) {
      throw new Error("Decryption failed: empty data after conversion (possible wrong key or corrupted data)");
    }
    
    // Log para debug em desenvolvimento
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
      debugLog('--- API CLIENT RESPONSE ---');
      debugLog('Encrypted Payload:', base64Payload);
      debugLog('Decrypted Data:', decryptedDataString);
      debugLog('---------------------------');
    }
    
    // Tentar fazer parse do JSON
    try {
      return JSON.parse(decryptedDataString);
    } catch (jsonError) {
      throw new Error("Failed to parse JSON after decryption. Data may be corrupt or not valid JSON.");
    }
    
  } catch (error: any) {
    // Log detalhado para debug
    debugError("APIClient: Decryption error details:", {
      error: error.message,
      payloadLength: base64Payload?.length || 0,
      payloadPreview: base64Payload?.substring(0, 50) + "...",
      keyInfo: {
        keySize: encryptionKeyWordArray?.sigBytes || 0,
        keyPreview: ENCRYPTION_KEY?.substring(0, 20) + "..."
      }
    });
    
    // Re-throw com contexto adicional
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unexpected error during decryption: " + String(error));
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
  
  if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
    const clonedResponse = response.clone(); 
    try {
      const responseBody = await clonedResponse.json();
      
      if (responseBody && typeof responseBody.payload === 'string') {
        // Validar payload antes de descriptografar
        if (!responseBody.payload.trim()) {
          throw new Error("Server returned empty encrypted payload");
        }
        
        // Validar formato Base64
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(responseBody.payload)) {
          throw new Error("Server returned invalid Base64 payload");
        }
        
        const decryptedData = decryptData(responseBody.payload);
        
        // Validar se a descriptografia retornou dados válidos
        if (decryptedData === null || decryptedData === undefined) {
          throw new Error("Decryption resulted in null/undefined data");
        }
        
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'application/json');
  
        return new Response(JSON.stringify(decryptedData), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return response;
    } catch (error: any) {
      // Log detalhado do erro
      debugError("APIClient: Response processing error:", {
        url: url,
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        error: error.message,
        traceId: traceId
      });
      
      // Se o erro for de descriptografia, retornar erro mais específico
      if (error.message.includes('Decrypt:') || error.message.includes('decryption')) {
        throw new Error(`Failed to decrypt server response: ${error.message}`);
      }
      
      throw error;
    }
  }

  return response;
}
