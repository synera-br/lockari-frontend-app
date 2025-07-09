
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInWithEmailAndPassword, type AuthError, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/firebase/config';
import { auditAuthEvent } from '@/app/actions/auth';
import type { Locale } from '@/middleware';
import { Github, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { debugLog, debugError } from '@/lib/debug';

interface LoginFormProps {
  lang: Locale;
  dictionary: any;
}

const createLoginSchema = (dictionary: any) => z.object({
  email: z.string().email({ message: dictionary.errorInvalidEmail }),
  password: z.string().min(1, { message: dictionary.errorPasswordRequired }),
});

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="h-4 w-4 mr-2">
      <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.03,4.73 15.1,5.5 15.79,6.14L17.87,4.22C16.14,2.53 14.37,1.73 12.19,1.73C6.88,1.73 3,6.13 3,12C3,17.87 6.88,22.27 12.19,22.27C17.6,22.27 21.7,18.35 21.7,12.33C21.7,11.77 21.52,11.44 21.35,11.1Z"></path>
    </svg>
);

export function LoginForm({ lang, dictionary }: LoginFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginSchema = useMemo(() => createLoginSchema(dictionary), [dictionary]);
  type LoginSchema = z.infer<typeof loginSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return dictionary.errorInvalidCredential;
      case 'auth/invalid-email':
        return dictionary.errorInvalidEmail;
      default:
        return dictionary.errorGeneric;
    }
  };

  const onSubmit: SubmitHandler<LoginSchema> = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      
      await auditAuthEvent({
        eventType: 'LOGIN_SUCCESS',
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
        }
      });
      
      router.push(`/${lang}/dashboard`);

    } catch (e) {
      const authError = e as AuthError;
      debugError("Firebase Login Error:", authError);
      setError(getFirebaseErrorMessage(authError.code));
    } finally {
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
        // A new account was created via the login page.
        // We need to notify the backend to create the associated tenant.
        debugLog('Google Sign-In: New user detected, performing signup audit...');
        const auditResult = await auditAuthEvent({
          eventType: 'SIGNUP_SUCCESS',
          user: {
            uid: result.user.uid,
            email: result.user.email,
            name: result.user.displayName || 'Google User',
            plan: 'free',
          }
        });

        // PER USER REQUEST: Do NOT delete the user on backend failure.
        // Instead, inform them about the partial success.
        if (!auditResult.success) {
          debugError('Google login/signup backend audit failed:', auditResult.message);
          setError(dictionary.errorPartialSignup || 'Your account was created, but the final setup failed. Please contact support.');
          setLoading(false);
          return; // Stop execution, user stays on login page.
        }
        
        debugLog('Google Sign-In: Backend tenant creation successful.');

      } else {
        // This is a returning user. We audit the login event.
        debugLog('Google Sign-In: Existing user detected, performing login audit...');
        const auditResult = await auditAuthEvent({
          eventType: 'LOGIN_SUCCESS',
          user: {
            uid: result.user.uid,
            email: result.user.email,
          }
        });
        
        // If auditing the login fails, we should prevent the user from proceeding
        // as some backend state might be inconsistent.
        if (!auditResult.success) {
            debugError('Google login backend audit failed:', auditResult.message);
            setError(dictionary.errorBackendLoginFailed || 'Could not verify your session with our servers. Please try again.');
            setLoading(false);
            return; // Stop execution.
        }
      }
      
      // If either the new user setup or existing user login audit was successful:
      router.push(`/${lang}/dashboard`);
    } catch (e) {
      const authError = e as AuthError;
      switch (authError.code) {
        case 'auth/popup-closed-by-user':
          // User closed the popup, so we don't show an error.
          break;
        case 'auth/account-exists-with-different-credential':
          setError(dictionary.errorAccountExists);
          break;
        default:
          // This can happen due to misconfiguration (e.g., Authorized domains in Firebase).
          setError(dictionary.errorGoogleSignInFailed);
          debugError("Google Sign-In Error:", authError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold font-headline">{dictionary.loginTitle}</CardTitle>
        <CardDescription>{dictionary.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          
          {error && (
             <p className="text-sm text-destructive mt-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dictionary.loginButton}
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
          {dictionary.signupCta}
          <Link href={`/${lang}/auth/signup`} className="font-medium text-primary hover:underline ml-1">
            {dictionary.signupLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
