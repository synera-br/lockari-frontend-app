# Go Example: Setting Firebase Custom Claims

This document provides a practical Go code example demonstrating how to set custom claims on a user's Firebase account from a trusted backend server.

Custom claims are key-value pairs that you can embed into a user's ID token. They are used to implement role-based access control and pass tenant information securely to the frontend.

**Key Security Principle:** Only backend services using the Firebase Admin SDK can set custom claims. The frontend client can only *read* them from the token after they have been set.

---

## When Does This Code Run?

This function is a core part of the **user registration flow**. It is executed on the backend immediately after the frontend confirms that a new user has been created in Firebase Authentication.

1.  **Frontend:** User signs up.
2.  **Frontend:** Calls a backend endpoint like `/v1/on-user-signed-up`.
3.  **Backend:** Executes the logic to create a new tenant and then calls `setUserClaims` to permanently associate that user with their new tenant.

## How to Generate the `tenantId`?

The `tenantId` should be a **Universally Unique Identifier (UUID)**. Do not use a hash. A UUID ensures that each tenant has a completely unique ID that will not collide with any other. Most Go libraries provide a simple way to generate a UUID (e.g., `github.com/google/uuid`).

---

## The Go Code

This example shows a function `setUserClaims` that takes a user's UID and the desired claims (like `tenantId` and `role`) and applies them to the user's account.

```go
package examples

import (
	"context"
	"fmt"
	"log"

	"firebase.google.com/go/v4/auth"
)

// setUserClaims sets custom claims for a user, such as their tenant ID and role.
// This function MUST be executed on a trusted backend server.
// The `authClient` should be an initialized Firebase Auth client from the Admin SDK.
//
// In the Lockari Vault architecture, the `tenantId` claim is CRITICAL.
// It should NEVER be empty or omitted for a valid, active user, as it's required
// by the backend to locate the user's data in Firestore. A user without a tenantId
// is considered an invalid or incomplete user.
func setUserClaims(ctx context.Context, authClient *auth.Client, uid string, tenantId string, role string) error {
	// A check to ensure we never try to set an empty tenantId.
	if tenantId == "" {
		return fmt.Errorf("tenantId cannot be empty for user %s", uid)
	}

	// Define the claims to be set.
	// You can add any key-value pairs you need.
	// IMPORTANT: The total size of the claims object must not exceed 1000 bytes.
	claims := map[string]interface{}{
		"tenantId": tenantId, // This is non-optional for a user to access the system.
		"role":     role,
		// You could add other information like the plan type
		// "plan": "pro",
	}

	// SetCustomUserClaims overwrites any existing custom claims for the user.
	// If you need to add claims without overwriting, you must first read the
	// existing claims, merge them with the new ones, and then set the result.
	err := authClient.SetCustomUserClaims(ctx, uid, claims)
	if err != nil {
		log.Printf("error setting custom claims for user %s: %v\n", uid, err)
		return fmt.Errorf("failed to set custom claims: %w", err)
	}

	log.Printf("Successfully set custom claims for user %s. TenantID: %s, Role: %s", uid, tenantId, role)
	return nil
}

// --- Usage Example (e.g., inside a Gin HTTP handler for user signup) ---
//
// func (server *Server) handleNewUserSignup(c *gin.Context) {
//     var req struct {
//         UID      string `json:"uid" binding:"required"`
//         // ... other signup data from frontend
//     }
//
//     if err := c.ShouldBindJSON(&req); err != nil {
//         c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
//         return
//     }
//
//     // 1. Generate a new, unique tenant ID.
//     newTenantID := uuid.New().String() 
//
//     // 2. Create the tenant and user documents in Firestore...
//     // (Your logic here)
//
//     // 3. Set the custom claims for the new user.
//     err := setUserClaims(c.Request.Context(), server.firebaseAuthClient, req.UID, newTenantID, "owner")
//     if err != nil {
//         // IMPORTANT: If this fails, you should roll back the Firestore changes.
//         c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize user setup"})
//         return
//     }
//
//     c.JSON(http.StatusOK, gin.H{"message": "user and tenant created successfully"})
// }
```

### How It Works

1.  **`setUserClaims` function**:
    *   It takes a `context`, an initialized `auth.Client`, a `uid`, `tenantId`, and a `role`.
    *   It creates a `map[string]interface{}` which will hold the claims.
    *   It calls `authClient.SetCustomUserClaims(ctx, uid, claims)`. This is the core Firebase Admin SDK call that securely applies the claims to the user's record in Firebase's backend.

2.  **Propagation to the ID Token**:
    *   Once the claims are set, the Firebase Authentication backend ensures that the **next time** the user's ID token is minted (either on a new login or when the current token is refreshed), these custom claims will be included in the token's payload.
    *   This propagation can take a few moments, but the frontend will automatically receive the updated token as part of the normal token refresh cycle managed by the Firebase JS SDK.

3.  **Usage in an HTTP Handler**:
    *   The commented-out code shows a conceptual example of how you would use this function during user registration.
    *   A handler receives the new user's `uid` from the frontend.
    *   It generates a new `tenantId`.
    *   It calls `setUserClaims` to apply the `tenantId` and an initial `role` of `owner` to that user.