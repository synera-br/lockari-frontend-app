
// lib/crypto.ts
import CryptoJS from 'crypto-js';
import { debugError, debugInfo, debugLog } from './debug';

let encryptionKeyWordArray: CryptoJS.lib.WordArray | null = null;
let rawEncryptionKey: string | null = null;

/**
 * Validates a Base64 encoded key for proper format and AES-compatible size.
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

/**
 * Initializes the encryption module by reading and validating the key from environment variables.
 * This function is called automatically when the module is loaded.
 */
function initializeKey() {
  debugInfo("🔍 Environment check:", {
      hasEncryptionKey: !!process.env.NEXT_PUBLIC_ENCRYPT_KEY,
      keyLength: process.env.NEXT_PUBLIC_ENCRYPT_KEY?.length || 0,
      mode: process.env.NEXT_PUBLIC_MODE
  });

  const keyFromEnv = process.env.NEXT_PUBLIC_ENCRYPT_KEY;

  if (!keyFromEnv) {
    debugError("❌ Encryption key (NEXT_PUBLIC_ENCRYPT_KEY) not found in environment.");
    return;
  }
  
  rawEncryptionKey = keyFromEnv.trim().replace(/\s/g, '');
  const keyValidationResult = validateEncryptionKey(rawEncryptionKey);

  if (keyValidationResult.valid) {
    debugInfo(`✅ Valid AES key loaded: ${keyValidationResult.keyInfo.type} (${keyValidationResult.keyInfo.size} bytes)`);
    encryptionKeyWordArray = CryptoJS.enc.Base64.parse(rawEncryptionKey);
  } else {
    debugError("❌ Failed to initialize encryption key:", keyValidationResult.error, keyValidationResult.keyInfo || '');
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        debugError("🔧 USING FALLBACK DEVELOPMENT KEY - THIS IS NOT FOR PRODUCTION!");
        encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    }
  }
}

// Initialize the key when the module is first imported.
initializeKey();

/**
 * Encrypts a data object into a Base64 string using AES-CBC.
 */
export function encrypt(data: any): string {
  if (!encryptionKeyWordArray) {
    throw new Error('Encryption key is not initialized. Please check your NEXT_PUBLIC_ENCRYPT_KEY environment variable and restart the server.');
  }

  try {
    const dataString = JSON.stringify(data);
    const iv = CryptoJS.lib.WordArray.random(16); // 128-bit IV

    const encrypted = CryptoJS.AES.encrypt(dataString, encryptionKeyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const combined = iv.clone().concat(encrypted.ciphertext);
    const base64Result = combined.toString(CryptoJS.enc.Base64);

    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        debugLog('--- ENCRYPTION ---', {
            ivHex: iv.toString(CryptoJS.enc.Hex),
            payload: base64Result,
        });
    }
    
    return base64Result;
  } catch (error) {
    debugError("Encryption failed:", error);
    throw new Error("Encryption failed. See console for details.");
  }
}

/**
 * Decrypts a Base64 string using AES-CBC into its original data.
 */
export function decrypt(encryptedData: string): any {
  if (!encryptionKeyWordArray) {
    throw new Error('Encryption key is not initialized for decryption.');
  }

  try {
    const combinedBytes = CryptoJS.enc.Base64.parse(encryptedData);
    if (combinedBytes.sigBytes < 16) {
      throw new Error("Invalid encrypted data: too short.");
    }

    const iv = CryptoJS.lib.WordArray.create(combinedBytes.words.slice(0, 4), 16);
    const ciphertext = CryptoJS.lib.WordArray.create(combinedBytes.words.slice(4), combinedBytes.sigBytes - 16);

    const decrypted = CryptoJS.AES.decrypt({ ciphertext } as any, encryptionKeyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      throw new Error("Decryption resulted in empty data (possible wrong key).");
    }

    return JSON.parse(decryptedString);
  } catch (error) {
    debugError("Decryption failed:", error);
    throw new Error("Decryption failed. See console for details.");
  }
}
