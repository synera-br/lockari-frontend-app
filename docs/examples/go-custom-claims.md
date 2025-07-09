# Go Example: Setting Firebase Custom Claims

This document provides a practical Go code example demonstrating how to set custom claims on a user's Firebase account from a trusted backend server.

Custom claims are key-value pairs that you can embed into a user's ID token. They are used to implement role-based access control and pass tenant information securely to the frontend.

**Key Security Principle:** Only backend services using the Firebase Admin SDK can set custom claims. The frontend client can only *read* them from the token after they have been set.

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
// by the backend to locate the user's data in Firestore.
func setUserClaims(ctx context.Context, authClient *auth.Client, uid string, tenantId string, role string) error {
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

// --- Usage Example (e.g., inside a Gin HTTP handler) ---
//
// func (server *Server) handleSetUserRole(c *gin.Context) {
//     // In a real application, you would get these values from the request body.
//     // Ensure the calling user has permission to perform this action! (e.g., is an owner/admin of the tenant).
//     var req struct {
//         TargetUID string `json:"targetUid" binding:"required"`
//         Role      string `json:"role" binding:"required"`
//     }
//
//     if err := c.ShouldBindJSON(&req); err != nil {
//         c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
//         return
//     }
//
//     // Extract the calling user's claims from the context (set by your auth middleware).
//     claims := c.MustGet("claims").(YourClaimsType)
//     
//     // Here you would call the function to set the claims on the *target* user.
//     // The tenantId comes from the *calling admin's* token to prevent them from
//     // assigning users to other tenants.
//     err := setUserClaims(c.Request.Context(), server.firebaseAuthClient, req.TargetUID, claims.TenantID, req.Role)
//     if err != nil {
//         c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user role"})
//         return
//     }
//
//     c.JSON(http.StatusOK, gin.H{"message": "user role updated successfully"})
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
    *   The commented-out code shows a conceptual example of how you would use this function.
    *   An admin user (e.g., an `owner`) would make an API call to an endpoint like `/users/set-role`.
    *   The backend middleware would first verify the admin's token and permissions.
    *   The handler would then call `setUserClaims` to apply the new role to the *target* user.
