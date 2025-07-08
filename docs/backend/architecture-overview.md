# Backend Architecture & Implementation Guide

This document provides a high-level overview of the proposed backend architecture and key implementation details for the Go services that will power the Lockari Vault application.

## 1. Technology Stack

The backend will be developed in **Golang** using the following core technologies:

- **Web Framework**: **Gin** for building high-performance RESTful APIs.
- **Database**: **Cloud Firestore** for scalable, flexible, and real-time data storage.
- **Authentication**: **Firebase Authentication** for handling user identity, session management, and social logins. The backend will validate Firebase ID Tokens sent from the frontend.
- **Authorization**: **OpenFGA** for managing fine-grained, relationship-based access control (e.g., "user U can read secret S in vault V").
- **Observability**: **OpenTelemetry** for generating and exporting traces, metrics, and logs, providing end-to-end visibility.
- **Asynchronous Tasks**: **RabbitMQ** as a message broker to manage background jobs like sending notifications, processing reports, or handling webhooks.
- **Caching**: **Redis** for in-memory caching of frequently accessed data (e.g., user permissions, hot secrets) to reduce Firestore lookups and improve performance.
- **Encryption**: **AES** for payload encryption between the frontend and backend.

## 2. API Security

### 2.1. Authentication

All authenticated endpoints must be protected. The frontend will include a Firebase ID Token in the `X-AUTHORIZATION` header as a Bearer token.

`X-AUTHORIZATION: Bearer <firebase_id_token>`

The backend **must** implement a middleware to:
1. Extract the token from the header.
2. Verify the token's signature and expiration using the Firebase Admin SDK for Go.
3. Extract the user's UID from the verified token and make it available in the request context for subsequent handlers.

### 2.2. Custom Headers

The backend should expect and can utilize the following headers sent by the frontend:

- **`X-TOKEN`**: A static, shared secret token used to authorize the frontend application itself. This helps prevent unauthorized clients from hitting your API.
- **`X-APP`**: Identifies the calling application (e.g., `LockariVaultApp`).
- **`X-TRACE-ID`**: A unique identifier for tracking a request across services for observability.

---

## 3. Core Backend Flows

### 3.1. Critical User Registration Flow

The user registration process is a critical transaction that spans both Firebase Authentication (handled by the client) and the backend (tenant creation). The backend's success is mandatory for the user account to be considered valid.

**Flow:**
1.  The frontend creates a user in Firebase Authentication (via email/password or social provider).
2.  Immediately after successful Firebase user creation, the frontend sends a `SIGNUP_SUCCESS` audit event to the backend (e.g., `POST /v1/audit/auth`).
3.  The backend **must** receive this event and perform all necessary operations to create the user's tenant and associated resources (e.g., in Firestore and OpenFGA).
4.  **On Success:** The backend must return a `2xx` status code. The frontend sees this and allows the user to proceed to the dashboard.
5.  **On Failure:** The backend must return a non-`2xx` status code (e.g., `500 Internal Server Error`). The frontend is programmed to interpret this failure as a catastrophic error. It will then automatically **delete the user from Firebase Authentication** (rollback) and display an error message to the user, asking them to try again.

This "transactional" approach ensures there are no "orphan" users in the system (i.e., users who exist in Firebase but not in the backend's tenant structure).

---

## 4. Payload Encryption (CRITICAL IMPLEMENTATION DETAIL)

To ensure end-to-end security, all `POST`, `PUT`, and `PATCH` request bodies are encrypted by the frontend. The backend must perform decryption before processing the data.

**The frontend uses AES-256-CBC. The backend MUST implement the same algorithm for compatibility.**

### Encryption Scheme: **AES-256-CBC with PKCS#7 Padding**

- **Key Size**: 256-bit (32 bytes)
- **Mode**: Cipher Block Chaining (CBC)
- **IV Size**: 128-bit (16 bytes)
- **Padding**: PKCS#7 (standard in most crypto libraries)

### Payload Format

The frontend sends a JSON object with a single key, `payload`:
```json
{
  "payload": "<base64_encoded_string>"
}
```

The `<base64_encoded_string>` is a Base64 encoding of the **concatenated raw bytes** of the Initialization Vector (IV) and the Ciphertext.

**`Base64( IV (16 bytes) + Ciphertext (N bytes) )`**

### Decryption Steps in Go

1. Receive the JSON request and extract the `payload` string.
2. Base64-decode the `payload` string to get the raw byte array (`iv_and_ciphertext`).
3. Split the byte array:
   - The first **16 bytes** are the `iv`.
   - The remaining bytes are the `ciphertext`.
4. Create a new AES cipher using the shared secret key (loaded from an environment variable).
5. Create a new CBC decrypter with the AES cipher and the extracted `iv`.
6. Decrypt the `ciphertext`.
7. **Unpad** the decrypted plaintext using the PKCS#7 standard.
8. The result is the original JSON string, which can then be unmarshalled into your Go structs.

> **Warning:** The initial proposal mentioned `AES-GCM`. While GCM is generally preferred for its authenticated encryption, the current frontend implementation uses `AES-CBC`. **Do not implement GCM on the backend unless the frontend is updated first**, as it will lead to decryption failures. The priority is to ensure compatibility with the existing client.
