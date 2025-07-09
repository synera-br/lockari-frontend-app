import { auth } from '@/lib/firebase/config';
import CryptoJS from 'crypto-js';
import { BACKEND_URL } from '@/lib/firebase/config';

const APP_NAME = 'LockariVaultApp';
const API_TIMEOUT = 15000; // 15 seconds

// Esta chave DEVE ser a mesma usada pelo backend e é enviada no cabeçalho X-Token.
const SHARED_SECRET_BASE64 = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "VGhpc0lzQTE2Qnl0ZUtleVRoaXNJc0ExNkJ5dGVJVgo="; 

let encryptionKeyWordArray: CryptoJS.lib.WordArray;

try {
    const decodedKey = CryptoJS.enc.Base64.parse(SHARED_SECRET_BASE64);
    if (decodedKey.sigBytes !== 16 && decodedKey.sigBytes !== 24 && decodedKey.sigBytes !== 32) {
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.warn(
            `API Client Encryption WARN: A chave de criptografia decodificada de Base64 possui ${decodedKey.sigBytes} bytes. ` +
            `O AES requer chaves de 16, 24 ou 32 bytes (128, 192 ou 256 bits). `
        );
      }
    }
    encryptionKeyWordArray = decodedKey;
} catch (e) {
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
      console.error("Falha ao parsear a chave de criptografia Base64. Usando uma chave padrão insegura. ISTO NÃO É PARA PRODUÇÃO.", e);
    }
    // Chave de 32 bytes para AES-256 para ambientes de desenvolvimento quando nenhuma chave é fornecida
    encryptionKeyWordArray = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"); 
}

function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Criptografa os dados para o formato esperado pelo backend Go: Base64(raw_iv_bytes + raw_ciphertext_bytes)
 * @param data O objeto a ser criptografado.
 * @returns Uma string Base64.
 */
function encryptData(data: any): string {
  const dataString = JSON.stringify(data);
  const iv = CryptoJS.lib.WordArray.random(16); // IV de 16 bytes para AES

  const encrypted = CryptoJS.AES.encrypt(dataString, encryptionKeyWordArray, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  const combined = iv.clone().concat(encrypted.ciphertext);
  
  return combined.toString(CryptoJS.enc.Base64);
}

/**
 * Descriptografa um payload Base64 no formato: Base64(raw_iv_bytes + raw_ciphertext_bytes)
 * @param base64Payload A string Base64 recebida do servidor.
 * @returns O objeto original.
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
      throw new Error("Falha ao descriptografar (Utf8): dados vazios após conversão.");
    }
    return JSON.parse(decryptedDataString);
  } catch (error) {
    console.error("APIClient: Erro na descriptografia em decryptData:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Falha ao fazer parse do JSON após descriptografar. Os dados podem estar corrompidos ou não são um JSON válido.");
    }
    throw new Error("Falha ao processar resposta criptografada do servidor. Verifique a chave e o formato dos dados.");
  }
}

export async function fetchWithAuthHeaders(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  let token: string | null = null;
  const traceId = generateTraceId();

  if (currentUser) {
    try {
      token = await currentUser.getIdToken(true); // Forçar atualização para o token mais recente
    } catch (error) {
      console.error("APIClient: Erro ao obter token de ID do Firebase:", error);
    }
  }

  const headers = new Headers(options.headers || {});
  
  // O backend espera este cabeçalho para obter a chave para descriptografia.
  headers.set('X-Token', SHARED_SECRET_BASE64);

  if (token) {
    headers.set('X-AUTHORIZATION', `Bearer ${token}`);
  }
  
  if (currentUser?.uid) {
    headers.set('X-USERID', currentUser.uid);
  }

  headers.set('X-APP', APP_NAME);
  headers.set('X-TRACE-ID', traceId);

  // Configurar AbortController para timeout
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
      console.error("APIClient: Erro ao criptografar o corpo da requisição:", error);
      throw error;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, newOptions);
  } catch (networkError: any) {
    clearTimeout(timeoutId);
    if (networkError.name === 'AbortError') {
      console.error(`APIClient: A requisição para ${url} expirou após ${API_TIMEOUT / 1000}s.`);
      throw new Error(`A requisição ao servidor expirou. Verifique se o backend está rodando e acessível em ${url}.`);
    }
    console.error(`APIClient: Erro de rede durante o fetch para a URL: ${url}. Erro:`, networkError);
    throw new Error(
      `Falha na comunicação com o servidor (${url}). Verifique sua conexão e se o servidor backend está acessível. Detalhes: ${networkError.message || 'Erro de rede desconhecido'}`
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
      console.error("APIClient: Erro ao tentar processar/descriptografar resposta JSON:", error);
      return response;
    }
  }

  return response;
}
