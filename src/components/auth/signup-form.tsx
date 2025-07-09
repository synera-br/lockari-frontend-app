'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, updateProfile, type AuthError, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth, db } from '@/lib/firebase/config';
import { auditAuthEvent } from '@/app/actions/auth';
import type { Locale } from '@/middleware';
import { Github, Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';

interface SignupFormProps {
  lang: Locale;
  dictionary: any;
  plan: string;
}

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="h-4 w-4 mr-2">
      <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.03,4.73 15.1,5.5 15.79,6.14L17.87,4.22C16.14,2.53 14.37,1.73 12.19,1.73C6.88,1.73 3,6.13 3,12C3,17.87 6.88,22.27 12.19,22.27C17.6,22.27 21.7,18.35 21.7,12.33C21.7,11.77 21.52,11.44 21.35,11.1Z"></path>
    </svg>
);

export function SignupForm({ lang, dictionary, plan }: SignupFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signupSchema = useMemo(() => {
    return z.object({
        name: z.string().min(2, { message: dictionary.errorNameTooShort }),
        email: z.string().email({ message: dictionary.errorInvalidEmail }),
        password: z.string().min(8, { message: dictionary.errorWeakPassword }),
        confirmPassword: z.string(),
        plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
      }).refine((data) => data.password === data.confirmPassword, {
        message: dictionary.errorPasswordsDoNotMatch,
        path: ["confirmPassword"],
      });
  }, [dictionary]);

  type SignupSchema = z.infer<typeof signupSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: { plan: plan as 'free' | 'pro' | 'enterprise' }
  });

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return dictionary.errorEmailInUse;
      case 'auth/invalid-email':
        return dictionary.errorInvalidEmail;
      case 'auth/weak-password':
        return dictionary.errorWeakPassword;
      default:
        return dictionary.errorGeneric;
    }
  };

  const onSubmit: SubmitHandler<SignupSchema> = async (data) => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      // Step 2: Update user profile with name
      await updateProfile(userCredential.user, { displayName: data.name });
      
      // Step 3: Create user document in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: data.name,
        email: data.email,
        plan: data.plan,
        termsAccepted: false,
        termsVersion: 0,
        createdAt: serverTimestamp(),
        authProvider: 'email',
      });

      // Step 4: Notify backend to create tenant. This is a mandatory step.
      console.log('User created in Firebase. Notifying backend to create tenant...');
      const auditResult = await auditAuthEvent({
        eventType: 'SIGNUP_SUCCESS',
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: data.name,
          plan: data.plan
        }
      });

      // Step 5: Handle backend response (Rollback or Success)
      if (!auditResult.success) {
        // This is the critical rollback step if backend fails
        console.error('Backend tenant creation failed. Rolling back Firebase user...');
        try {
          await userCredential.user.delete();
          console.log('Firebase user rolled back successfully.');
        } catch (deleteError) {
          console.error("CRITICAL: Failed to roll back user creation after backend failure:", deleteError);
        }
        // Display the specific error from the backend call
        setError(auditResult.message || 'Failed to create your account on our servers. Please try again.');
        setLoading(false); // Stop loading indicator on failure
        return; 
      }
      
      console.log('Backend tenant created successfully. Redirecting to dashboard.');
      router.push(`/${lang}/dashboard`);

    } catch (e) {
      const authError = e as AuthError;
      console.error("Firebase Signup Error:", authError);
      setError(getFirebaseErrorMessage(authError.code));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser;
      
      if (isNewUser) {
        // Create user profile in Firestore for new Google user
        await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            name: result.user.displayName,
            email: result.user.email,
            plan: 'free', // Default plan
            termsAccepted: false,
            termsVersion: 0,
            createdAt: serverTimestamp(),
            authProvider: 'google',
        });
        
        // Notify backend to create the tenant. This is a mandatory step.
        const auditResult = await auditAuthEvent({
          eventType: 'SIGNUP_SUCCESS',
          user: {
            uid: result.user.uid,
            email: result.user.email,
            name: result.user.displayName || 'Google User',
            plan: 'free',
          }
        });

        // If backend tenant creation fails, roll back user creation.
        if (!auditResult.success) {
            try {
              await result.user.delete();
            } catch (deleteError) {
              console.error("Failed to roll back Google user creation:", deleteError);
            }
            setError(auditResult.message || 'Failed to create your account on our servers. Please try again.');
            setLoading(false);
            return;
        }

      } else {
        // This is a login, not a signup. The login form handles profile backfilling.
        await auditAuthEvent({
          eventType: 'LOGIN_SUCCESS',
          user: {
            uid: result.user.uid,
            email: result.user.email,
          }
        });
      }
      
      router.push(`/${lang}/dashboard`);
    } catch (e) {
      const authError = e as AuthError;
      switch (authError.code) {
        case 'auth/popup-closed-by-user':
          // User closed the popup, do nothing.
          setLoading(false);
          break;
        case 'auth/account-exists-with-different-credential':
          setError(dictionary.errorAccountExists);
          setLoading(false);
          break;
        default:
           // This can happen due to misconfiguration (e.g., Authorized domains in Firebase).
          setError(dictionary.errorGoogleSignInFailed);
          console.error("Google Sign-In Error:", authError);
          setLoading(false);
      }
    }
  };

  return (
    <Card className="w-full max-w-sm shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold font-headline">{dictionary.signupTitle}</CardTitle>
        <CardDescription>{dictionary.signupSubtitle} ({dictionary.planLabel}: {plan})</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('plan')} />
          <div className="space-y-2">
            <Label htmlFor="name">{dictionary.nameLabel}</Label>
            <Input id="name" placeholder={dictionary.namePlaceholder} {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{dictionary.emailLabel}</Label>
            <Input id="email" type="email" placeholder={dictionary.emailPlaceholder} {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{dictionary.passwordLabel}</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{dictionary.confirmPasswordLabel}</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dictionary.signupButton}
          </Button>
        </form>
        <div className="my-4 flex items-center">
          <div className="flex-grow border-t border-muted" />
          <span className="mx-4 text-xs uppercase text-muted-foreground">{dictionary.orContinueWith}</span>
          <div className="flex-grow border-t border-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleGoogleSignIn} disabled={loading}><GoogleIcon /> Google</Button>
          <Button variant="outline" disabled><Github className="mr-2 h-4 w-4" /> GitHub</Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-center justify-center text-sm gap-4">
        <p className="px-8 text-center text-sm text-muted-foreground">
          {dictionary.termsAgreementPrefix}
          <Link href={`/${lang}/terms-of-service`} target="_blank" className="underline underline-offset-4 hover:text-primary">
            {dictionary.termsAgreementLink}
          </Link>
          {dictionary.termsAgreementSuffix}
        </p>
        <Separator />
        <p className="text-muted-foreground">
          {dictionary.loginCta}
          <Link href={`/${lang}/auth/login`} className="font-medium text-primary hover:underline ml-1">
            {dictionary.loginLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
