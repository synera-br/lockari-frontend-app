'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User, type IdTokenResult } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

// Define a type for the custom claims we expect
export interface AppClaims {
  tenantId?: string;
  role?: 'owner' | 'admin' | 'writer' | 'viewer';
  // Add other roles or claims as needed in the future
}

interface AuthContextType {
  user: User | null;
  claims: AppClaims | null; // Add claims to the context
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AppClaims | null>(null); // State for claims
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          // When a user is found, get their token result to access custom claims
          // The `true` argument forces a token refresh to get the latest claims,
          // which is crucial after login/signup to check for tenantId.
          const idTokenResult: IdTokenResult = await user.getIdTokenResult(true); 
          
          // Set the custom claims in our state
          setClaims(idTokenResult.claims as AppClaims);
        } catch (error) {
          console.error("Error fetching user claims:", error);
          setClaims(null); // Clear claims on error
        }
      } else {
        setUser(null);
        setClaims(null); // Clear user and claims on logout
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);
  
  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setClaims(null); // Clear claims on sign out
  };

  const value = { user, claims, loading, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
