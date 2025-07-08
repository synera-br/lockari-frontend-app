# API Contracts: Vault Management

This document outlines the API endpoints, request/response payloads, and authorization rules for managing Vaults in the Lockari Vault application. The backend team will use this contract to build the Go services.

**Related Documents:**
*   [Backend Architecture Overview](./architecture-overview.md)
*   [Authentication Auditing Payloads](../auth/backend-payload.md)

---

## 1. General Considerations

### 1.1. Authentication & Headers
All endpoints documented here are protected and require a valid Firebase ID Token in the `X-AUTHORIZATION` header. Refer to the `architecture-overview.md` for details on all required headers (`X-TOKEN`, `X-APP`, `X-TRACE-ID`).

### 1.2. Payload Encryption
All `POST` and `PUT` request bodies sent by the frontend will be encrypted. The backend **must** decrypt the `{ "payload": "..." }` object to access the JSON body described in this document. Refer to `architecture-overview.md` for decryption steps.

### 1.3. Authorization (OpenFGA)
Authorization for each endpoint must be checked using OpenFGA. The required relations (e.g., `owner`, `writer`, `viewer`) are specified for each endpoint.

---

## 2. Data Model: The Vault Object

This is the standard JSON structure for a Vault object returned by the API.

```json
{
  "id": "vault-uuid-12345",
  "name": "Production API Keys",
  "description": "All API keys for production services like Stripe, SendGrid, etc.",
  "tags": ["production", "api", "backend"],
  "itemCount": 5,
  "createdAt": "2023-10-28T10:00:00Z",
  "updatedAt": "2023-10-28T10:00:00Z"
}
```

-   **`id`** (string): Unique identifier for the vault.
-   **`name`** (string): User-defined name for the vault.
-   **`description`** (string, optional): A brief description of the vault's purpose.
-   **`tags`** (array of strings, optional): User-defined tags for organization and searching.
-   **`itemCount`** (integer): The number of items (secrets, keys, etc.) stored within the vault.
-   **`createdAt`** (string, ISO 8601): Timestamp of when the vault was created.
-   **`updatedAt`** (string, ISO 8601): Timestamp of the last update.

---

## 3. API Endpoints

### 3.1. List Vaults

*   **Endpoint:** `GET /v1/vaults`
*   **Description:** Retrieves a list of all vaults that the authenticated user has permission to view.
*   **Request Body:** None.
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Body:** 
        ```json
        {
          "vaults": [
            {
              "id": "vault-uuid-12345",
              "name": "Production API Keys",
              "description": "...",
              "tags": ["production"],
              "itemCount": 5,
              "createdAt": "2023-10-28T10:00:00Z",
              "updatedAt": "2023-10-28T10:00:00Z"
            }
          ]
        }
        ```
    *   **Note:** If the user has access to no vaults, the API must return a `200 OK` with an empty `vaults` array: `{"vaults": []}`.
*   **Permissions (OpenFGA):** The endpoint should perform a `ListObjects` call to find all `vault` objects where the `user:{userId}` has a `viewer` (or higher) relation.

### 3.2. Create Vault

*   **Endpoint:** `POST /v1/vaults`
*   **Description:** Creates a new vault. The user making the request becomes the `owner` of the new vault.
*   **Request Body (unencrypted structure):**
    ```json
    {
      "name": "Staging Database Credentials",
      "description": "Credentials for the staging PostgreSQL database.",
      "tags": ["staging", "database"]
    }
    ```
*   **Success Response:**
    *   **Code:** `201 Created`
    *   **Body:** The full `Vault` object of the newly created vault.
*   **Backend Logic:**
    1.  Validate the input (`name` is required).
    2.  Create the vault document in Firestore.
    3.  In OpenFGA, write a tuple to establish the ownership relation: `user:{userId}` is `owner` of `vault:{newVaultId}`.
*   **Permissions:** Any authenticated user can perform this action.

### 3.3. Get Vault Details

*   **Endpoint:** `GET /v1/vaults/{vaultId}`
*   **Description:** Retrieves the details of a single, specific vault.
*   **Request Body:** None.
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Body:** The full `Vault` object.
*   **Error Responses:**
    *   **Code:** `404 Not Found`
    *   **Body:** `{ "error": "Vault not found" }`
    *   **Condition:** Returned if the vault with the specified `vaultId` does not exist, or if the user does not have `viewer` permissions for it (to prevent leaking information about the existence of private vaults).
*   **Permissions (OpenFGA):** Requires the `user:{userId}` to have a `viewer` (or higher) relation on `vault:{vaultId}`.

### 3.4. Update Vault

*   **Endpoint:** `PUT /v1/vaults/{vaultId}`
*   **Description:** Updates the name, description, or tags of an existing vault.
*   **Request Body (unencrypted structure):**
    ```json
    {
      "name": "New Vault Name",
      "description": "Updated description.",
      "tags": ["new", "tags", "updated"]
    }
    ```
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Body:** The full, updated `Vault` object.
*   **Permissions (OpenFGA):** Requires the `user:{userId}` to have a `writer` or `owner` relation on `vault:{vaultId}`.

### 3.5. Delete Vault

*   **Endpoint:** `DELETE /v1/vaults/{vaultId}`
*   **Description:** Permanently deletes a vault and all items within it. This action is irreversible.
*   **Request Body:** None.
*   **Success Response:**
    *   **Code:** `204 No Content`
*   **Backend Logic:**
    1.  Perform the OpenFGA permission check first.
    2.  Delete the vault document (and any sub-collections for items) from Firestore.
    3.  Delete all OpenFGA tuples related to the `vault:{vaultId}`.
*   **Permissions (OpenFGA):** Requires the `user:{userId}` to be the `owner` of `vault:{vaultId}`.
