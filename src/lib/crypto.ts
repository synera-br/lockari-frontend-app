// lib/crypto.ts
import CryptoJS from 'crypto-js';

// Função para limpar e validar a chave (igual ao backend)
function cleanAndValidateKey(key: string): string {
  if (!key) {
    throw new Error('Encryption key is empty');
  }
  
  // Limpeza AGRESSIVA (igual ao backend Go)
  let cleanKey = key
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\t/g, '')
    .trim();
  
  if (process.env.NEXT_PUBLIC_MODE === 'develop') {
    console.log('DEBUG: Original key:', JSON.stringify(key));
    console.log('DEBUG: Cleaned key:', JSON.stringify(cleanKey));
    console.log('DEBUG: Key length:', cleanKey.length);
  }
  
  if (!cleanKey) {
    throw new Error('Key is empty after cleaning');
  }
  
  // Validar se é Base64 válido
  try {
    const decoded = CryptoJS.enc.Base64.parse(cleanKey);
    const keySize = decoded.sigBytes;
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('DEBUG: Decoded key size:', keySize, 'bytes');
    }
    
    // Validar tamanhos AES suportados
    if (![16, 24, 32].includes(keySize)) {
      throw new Error(`Invalid AES key size: ${keySize} bytes (must be 16, 24, or 32)`);
    }
    
    return cleanKey;
  } catch (error: any) {
    throw new Error(`Invalid Base64 key: ${error.message}`);
  }
}

// Configurar a chave do ambiente
export function getEncryptionKey(): string {
  // Acessa a variável de ambiente. O prefixo NEXT_PUBLIC_ a torna disponível no navegador.
  const key = process.env.NEXT_PUBLIC_ENCRYPT_KEY;
  
  // Se a chave não for encontrada, lança um erro claro.
  // Isso geralmente acontece se o servidor de desenvolvimento não foi reiniciado após a alteração do .env.local.
  if (!key) {
    throw new Error('Encryption key not found. Please set NEXT_PUBLIC_ENCRYPT_KEY in your .env.local file and RESTART your development server.');
  }
  
  return cleanAndValidateKey(key);
}
