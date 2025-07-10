// lib/crypto-cbc.ts
import CryptoJS from 'crypto-js';
import { getEncryptionKey } from './crypto';

export class CryptoCBC {
  private static getKey(): CryptoJS.lib.WordArray {
    const base64Key = getEncryptionKey();
    return CryptoJS.enc.Base64.parse(base64Key);
  }

  // Criptografia AES-CBC compatível com o backend Go
  static encrypt(data: string): string {
    try {
      console.log('DEBUG: Encrypting data:', data);
      
      const key = this.getKey();
      const iv = CryptoJS.lib.WordArray.random(16); // 16 bytes = 128 bits
      
      console.log('DEBUG: Generated IV:', iv.toString(CryptoJS.enc.Hex));
      
      // Criptografar os dados
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      // Combinar IV + Ciphertext em bytes brutos, depois Base64
      // Este é o formato que o backend Go espera: Base64(IV_bytes + Ciphertext_bytes)
      const combined = iv.clone().concat(encrypted.ciphertext);
      const result = combined.toString(CryptoJS.enc.Base64);
      
      console.log('DEBUG: Encrypted result length:', result.length);
      
      return result;
    } catch (error: any) {
      console.error('Encryption error:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  // Descriptografia AES-CBC compatível com o backend Go
  static decrypt(encryptedData: string): string {
    try {
      console.log('DEBUG: Decrypting data length:', encryptedData.length);
      
      if (!encryptedData) {
        throw new Error('Encrypted data is empty');
      }
      
      const key = this.getKey();
      
      // Decodificar Base64 para obter bytes combinados
      const combinedBytes = CryptoJS.enc.Base64.parse(encryptedData);
      
      if (combinedBytes.sigBytes < 16) {
        throw new Error(`Combined data too short: ${combinedBytes.sigBytes} bytes`);
      }
      
      // Extrair IV (primeiros 16 bytes) e ciphertext (resto)
      const iv = CryptoJS.lib.WordArray.create(combinedBytes.words.slice(0, 4), 16);
      const ciphertext = CryptoJS.lib.WordArray.create(combinedBytes.words.slice(4), combinedBytes.sigBytes - 16);
      
      console.log('DEBUG: Extracted IV:', iv.toString(CryptoJS.enc.Hex));
      console.log('DEBUG: Ciphertext length:', ciphertext.sigBytes);
      
      // Descriptografar
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext } as any, // Cast to any to match expected type
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!result) {
        throw new Error('Decryption resulted in empty data (wrong key or corrupted data)');
      }
      
      console.log('DEBUG: Decrypted data:', result);
      
      return result;
    } catch (error: any) {
      console.error('Decryption error:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}
