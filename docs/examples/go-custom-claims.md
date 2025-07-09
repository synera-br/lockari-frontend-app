# Go Example: Setting and Updating Firebase Custom Claims

This document provides a practical Go code example demonstrating how to safely set and update custom claims on a user's Firebase account from a trusted backend server.

Custom claims are key-value pairs that you can embed into a user's ID token. They are used to implement role-based access control and pass tenant information securely to the frontend.

**Key Security Principle:** Only backend services using the Firebase Admin SDK can set custom claims. The frontend client can only *read* them from the token after they have been set.

---

## When Does This Code Run?

This logic is typically executed in two main scenarios:

1.  **User Registration:** Immediately after a new user signs up, the backend calls this function to set their initial claims, such as `tenantId` and `role: 'owner'`.
2.  **Permission Changes:** When an administrator changes a user's role or adds them to a new group, the backend calls this function to update their claims.

## Critical Best Practice: Read-Merge-Write

The `SetCustomUserClaims` function **overwrites all existing custom claims** for a user. A naive implementation that only sets new claims will erase any previous ones. For example, setting a `role` would erase the `tenantId`.

The correct and safe pattern is to **read** the existing claims, **merge** them with your changes, and then **write** the complete, updated map back. The example below implements this safe approach.

---

## The Go Code

This example shows a robust function `updateUserClaims` that safely adds or modifies claims without deleting existing ones.

```go
package examples

import (
	"context"
	"fmt"
	"log"

	"firebase.google.com/go/v4/auth"
)

// updateUserClaims safely updates custom claims for a user by merging them with existing claims.
// This function MUST be executed on a trusted backend server.
//
// The `authClient` should be an initialized Firebase Auth client from the Admin SDK.
// The `newClaims` map contains only the claims you want to add or change.
func updateUserClaims(ctx context.Context, authClient *auth.Client, uid string, newClaims map[string]interface{}) error {
	// 1. Get the full user record.
	user, err := authClient.GetUser(ctx, uid)
	if err != nil {
		log.Printf("error getting user for claims update: %v\n", err)
		return fmt.Errorf("could not retrieve user %s: %w", uid, err)
	}

	// 2. Initialize a new map with the user's existing custom claims.
	// This is the crucial step to avoid overwriting.
	mergedClaims := make(map[string]interface{})
	if user.CustomClaims != nil {
		for key, value := range user.CustomClaims {
			mergedClaims[key] = value
		}
	}

	// 3. Merge the new claims into the map, overwriting any existing keys.
	for key, value := range newClaims {
		mergedClaims[key] = value
	}
	
	// IMPORTANT: The total size of the claims object must not exceed 1000 bytes.
	// Add a check here in a real application if the claims can be large.

	// 4. Set the newly merged claims object.
	err = authClient.SetCustomUserClaims(ctx, uid, mergedClaims)
	if err != nil {
		log.Printf("error setting custom claims for user %s: %v\n", uid, err)
		return fmt.Errorf("failed to set custom claims: %w", err)
	}

	log.Printf("Successfully updated custom claims for user %s.", uid)
	return nil
}

// --- Usage Example (e.g., inside a Gin HTTP handler for user signup) ---
//
// func (server *Server) handleNewUserSignup(c *gin.Context) {
//     var req struct {
//         UID string `json:"uid" binding:"required"`
//     }
//     if err := c.ShouldBindJSON(&req); err != nil { /* ... */ }
//
//     // 1. Generate a new, unique tenant ID.
//     newTenantID := uuid.New().String() 
//
//     // 2. Define the initial claims for the new user.
//     initialClaims := map[string]interface{}{
//         "tenantId": newTenantID,
//         "role":     "owner",
//     }
//
//     // 3. Call the safe update function.
//     err := updateUserClaims(c.Request.Context(), server.firebaseAuthClient, req.UID, initialClaims)
//     if err != nil {
//         // IMPORTANT: If this fails, roll back any other setup steps (like Firestore writes).
//         c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize user setup"})
//         return
//     }
//
//     c.JSON(http.StatusOK, gin.H{"message": "user setup complete"})
// }
//
// --- Usage Example (e.g., changing a user's role) ---
//
// func (server *Server) handleChangeUserRole(c *gin.Context) {
//     // ... get target UID and new role from request ...
//
//     roleUpdate := map[string]interface{}{"role": "admin"}
//
//     // This will ONLY update the role, leaving the tenantId and other claims intact.
//     err := updateUserClaims(c.Request.Context(), server.firebaseAuthClient, targetUID, roleUpdate)
//     if err != nil { /* ... handle error ... */ }
//
//     c.JSON(http.StatusOK, gin.H{"message": "role updated successfully"})
// }
```

### How It Works

1.  **`updateUserClaims` function**:
    *   It takes the `uid` and a map of `newClaims` (only the ones you want to change).
    *   It first fetches the complete `UserRecord`.
    *   It copies the `user.CustomClaims` into a new `mergedClaims` map.
    *   It then merges the `newClaims` into the `mergedClaims` map. This ensures any old claims are preserved.
    *   Finally, it calls `authClient.SetCustomUserClaims` with the complete, merged map.

2.  **Propagation to the ID Token**:
    *   Once the claims are set, the Firebase Authentication backend ensures that the **next time** the user's ID token is minted (either on a new login or when the current token is refreshed), these updated claims will be included in the token's payload.
    *   This propagation is handled automatically by the Firebase SDKs on the client.