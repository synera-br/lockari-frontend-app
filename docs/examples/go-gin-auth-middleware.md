# Go Example: Gin Authentication Middleware for Firebase

This document provides a practical Go code example of an authentication middleware for the Gin web framework. This middleware is designed to protect API endpoints by verifying a Firebase ID Token sent from the frontend.

## Key Concepts

-   **Validate Once, Use Everywhere (DRY):** Instead of validating the token in every single API handler, the middleware does it once at the beginning of the request lifecycle.
-   **Passing Data via Context:** If the token is valid, the middleware extracts crucial information (like the user's UID and their `tenantId`) and stores it in Gin's request context. Subsequent handlers can then safely retrieve and use this data.
-   **Fail Fast:** If the token is missing, malformed, or invalid, the middleware immediately stops the request chain and returns a `401 Unauthorized` error, preventing any unauthorized access to the handlers.

---

## The Go Code

This example assumes you have an `Authenticator` interface with a `ValidateToken` method.

```go
package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"your-project/auth" // Assuming your authenticator is in this package
)

// ContextKey is a custom type for context keys to avoid collisions.
type ContextKey string

const (
	// Key for storing the user's UID in the context.
	UserIDContextKey = ContextKey("userID")
	// Key for storing the user's tenant ID in the context.
	TenantIDContextKey = ContextKey("tenantID")
    // Key for storing all claims in the context.
    ClaimsContextKey = ContextKey("claims")
)


// AuthMiddleware creates a Gin middleware for Firebase token validation.
func AuthMiddleware(authenticator auth.Authenticator) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Get the token from the X-AUTHORIZATION header.
		authHeader := c.GetHeader("X-AUTHORIZATION")
		if authHeader == "" {
			log.Println("Authorization header is missing")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization token not provided"})
			return
		}

		// The token should be in the format "Bearer <token>".
		idToken := strings.TrimPrefix(authHeader, "Bearer ")
		if idToken == authHeader {
			log.Println("Bearer token not found in Authorization header")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization token format"})
			return
		}

		// 2. Validate the token using our authenticator.
		// This is the ONLY time we call the validation function.
		claims, err := authenticator.ValidateToken(c.Request.Context(), idToken)
		if err != nil {
			log.Printf("Token validation failed: %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
        
        // 3. Extract the UID from the claims (the 'sub' field is the UID).
		uid, ok := claims["sub"].(string)
		if !ok || uid == "" {
			log.Println("UID not found in token claims")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User identifier not found in token"})
			return
		}

        // 4. Extract our CUSTOM claim 'tenantId'.
		tenantId, ok := claims["tenantId"].(string)
		if !ok || tenantId == "" {
			log.Printf("Custom claim 'tenantId' not found for user %s", uid)
			// For this application, a missing tenantId is a critical error.
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User is not associated with a tenant"})
			return
		}

		// 5. Store the extracted information in the Gin context.
		c.Set(string(UserIDContextKey), uid)
		c.Set(string(TenantIDContextKey), tenantId)
        c.Set(string(ClaimsContextKey), claims) // Optional: store all claims if needed elsewhere

		// 6. Continue to the next handler in the chain.
		c.Next()
	}
}
```

### How to Use the Middleware

You would apply this middleware to your Gin router for all routes that require authentication. The following example demonstrates the complete flow from middleware to handler to service.

```go
package main

import (
    "context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"your-project/auth"
	"your-project/middleware"
    "your-project/services" // Assume you have a services package
)

func main() {
	// Initialize Firebase Authenticator, services, etc.
    ctx := context.Background()
	authenticator, err := auth.InitializeAuth(ctx, &auth.FirebaseConfig{ /* ... */ })
	if err != nil { /* ... */ }
    
    vaultService := services.NewVaultService(/* ... */)

	router := gin.Default()

    // Example of a public route (e.g., health check)
    router.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "ok"})
    })
    
	// Create a group for all authenticated API routes
	v1 := router.Group("/v1")
	// Apply the middleware to this entire group
	v1.Use(middleware.AuthMiddleware(authenticator))
	{
		// All handlers defined here are now protected.
		v1.GET("/vaults", handleListVaults(vaultService))
		// ... other routes
	}

	router.Run(":8080")
}

// handleListVaults is an example of a protected handler.
// It receives the vaultService as a dependency (Dependency Injection).
func handleListVaults(vaultService services.VaultService) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. Retrieve the user and tenant ID from the context.
        // We can be sure these values exist and are valid because the middleware passed.
        
        // We use c.GetString() which is convenient. It returns an empty string if the key doesn't exist.
        // For critical data like this, you could also use c.Get() and a type assertion for more safety.
        userID := c.GetString(string(middleware.UserIDContextKey))
        tenantID := c.GetString(string(middleware.TenantIDContextKey))

        // 2. Call the service layer, passing the request context and the necessary data.
        // The handler's job is to orchestrate, not to contain business logic.
        // Notice we pass c.Request.Context(), which carries timeouts, cancellations, and our values.
        vaults, err := vaultService.ListVaultsForUser(c.Request.Context(), userID, tenantID)
        if err != nil {
            // The service layer should return appropriate errors.
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve vaults"})
            return
        }

        // 3. Return the successful response.
        c.JSON(http.StatusOK, gin.H{"vaults": vaults})
    }
}

/*
// --- Example Service Method (in your services package) ---
//
// func (s *vaultService) ListVaultsForUser(ctx context.Context, userID, tenantID string) ([]Vault, error) {
//     // Now, use userID and tenantID to:
//     // 1. Perform OpenFGA checks to see what the user is allowed to view.
//     // 2. Call the repository to fetch data from Firestore, e.g., from the path `/tenants/{tenantID}/vaults`.
//     log.Printf("Service: Fetching vaults for user %s in tenant %s", userID, tenantID)
//     
//     // ... repository call ...
//     return vaults, nil
// }
*/
```
This layered approach is clean, secure, and highly scalable for building out your Go backend. The `handler` translates HTTP, and the `service` executes business logic, keeping concerns neatly separated.