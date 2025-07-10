
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, updateProfile, type AuthError, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, getAdditionalUserInfo, type UserCredential } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/firebase/config';
import { auditAuthEvent } from '@/app/actions/auth';
import type { Locale } from '@/middleware';
import { Github, Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { debugLog, debugError, debugTime, debugTimeEnd } from '@/lib/debug';

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
  
  // Verificar se houve um redirect result ao carregar a página
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('🔍 [DEBUG] Redirect result encontrado:', result);
          }
          
          setLoading(true);
          const additionalUserInfo = getAdditionalUserInfo(result);
          const isNewUser = additionalUserInfo?.isNewUser;
          
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('🔍 [DEBUG] Processando resultado do redirect:', {
              uid: result.user.uid,
              email: result.user.email,
              isNewUser: isNewUser
            });
          }
          
          if (isNewUser) {
            // Novo usuário via redirect
            const auditResult = await auditAuthEvent({
              eventType: 'SIGNUP_SUCCESS',
              user: {
                uid: result.user.uid,
                email: result.user.email,
                name: result.user.displayName || 'Google User',
                plan: plan,
              }
            });
            
            if (!auditResult.success) {
              if (process.env.NEXT_PUBLIC_MODE === 'develop') {
                console.error('❌ [DEBUG] Falha no audit após redirect');
              }
              try {
                await result.user.delete();
              } catch (deleteError) {
                if (process.env.NEXT_PUBLIC_MODE === 'develop') {
                  console.error('❌ [DEBUG] Falha no rollback após redirect:', deleteError);
                }
              }
              setError(auditResult.message || 'Falha ao criar conta.');
              setLoading(false);
              return;
            }
          } else {
            // Login de usuário existente via redirect
            await auditAuthEvent({
              eventType: 'LOGIN_SUCCESS',
              user: {
                uid: result.user.uid,
                email: result.user.email,
              }
            });
          }
          
          router.push(`/${lang}/dashboard`);
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.error('❌ [DEBUG] Erro ao processar redirect result:', error);
        }
        setError('Erro ao processar login. Tente novamente.');
        setLoading(false);
      }
    };
    
    checkRedirectResult();
  }, [lang, plan, router]);

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
    let userCredential: UserCredential | undefined;

    try {
      // Step 1: Create user in Firebase Auth
      userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      // Step 2: Update user profile with name
      await updateProfile(userCredential.user, { displayName: data.name });
      
      // Step 3: Notify backend to create tenant and user profile in Firestore.
      // The frontend is no longer responsible for writing to Firestore.
      debugLog(`User ${userCredential.user.uid} created in Firebase Auth. Notifying backend...`);
      debugTime('Backend Audit Request');
      const auditResult = await auditAuthEvent({
        eventType: 'SIGNUP_SUCCESS',
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: data.name,
          plan: data.plan
        }
      });
      debugTimeEnd('Backend Audit Request');
      
      // Step 4: Handle backend response. If it fails, throw an error to trigger the catch block for rollback.
      if (!auditResult.success) {
        debugError('Backend audit failed:', auditResult.message);
        throw new Error(auditResult.message || 'Failed to create your account on our servers. Please try again.');
      }
      
      debugLog('Backend processing successful. Redirecting to dashboard...');
      router.push(`/${lang}/dashboard`);

    } catch (e: any) {
      // This block catches errors from Firebase Auth OR our custom thrown error from the audit.
      
      // First, perform rollback if a user was successfully created in Auth before the error.
      if (userCredential) {
        debugError('An error occurred after user creation in Auth. Rolling back...');
        try {
          await userCredential.user.delete();
          debugLog('Firebase user rolled back successfully.');
        } catch (deleteError) {
          debugError("CRITICAL: Failed to roll back user creation after backend failure:", deleteError);
        }
      }

      // Determine the error message to display
      let errorMessage: string;
      if (e instanceof Error && (e.message.includes('Failed to create') || e.message.includes('timed out'))) {
        // This is our custom error from a failed backend call.
        errorMessage = e.message;
      } else {
        // This is likely a Firebase Auth error
        const authError = e as AuthError;
        debugError("Firebase/Auth Error:", authError);
        errorMessage = getFirebaseErrorMessage(authError.code);
      }
      
      setError(errorMessage);
    } finally {
        setLoading(false); // Ensure loading is stopped on any failure path.
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    if (process.env.NEXT_PUBLIC_MODE === 'develop') {
      console.log('🔍 [DEBUG] Iniciando login social Google');
    }
    
    const provider = new GoogleAuthProvider();
    // Configurações mais específicas para evitar problemas de popup
    provider.setCustomParameters({ 
      prompt: 'select_account',
      access_type: 'offline',
      include_granted_scopes: 'true'
    });
    
    // Adicionar escopos específicos
    provider.addScope('email');
    provider.addScope('profile');
    
    try {
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('🔍 [DEBUG] Configurando popup Google OAuth com configurações aprimoradas');
        console.log('🔍 [DEBUG] Domínio atual:', window.location.origin);
        console.log('🔍 [DEBUG] User agent:', navigator.userAgent);
      }
      
      // Tentar com configurações específicas para evitar o erro de popup
      const result = await signInWithPopup(auth, provider);
      const additionalUserInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalUserInfo?.isNewUser;
      
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('🔍 [DEBUG] Resultado do login Google:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          isNewUser: isNewUser,
          additionalUserInfo: additionalUserInfo,
          creationTime: result.user.metadata.creationTime,
          lastSignInTime: result.user.metadata.lastSignInTime
        });
      }
      
      if (isNewUser) {
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔍 [DEBUG] Usuário identificado como NOVO - iniciando processo de registro');
        }
        
        // New user via Google. Notify backend to create tenant and profile.
        const auditData = {
          eventType: 'SIGNUP_SUCCESS' as const,
          user: {
            uid: result.user.uid,
            email: result.user.email,
            name: result.user.displayName || 'Google User',
            plan: plan,
          }
        };
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔍 [DEBUG] Enviando dados para backend:', auditData);
          console.log('🔍 [DEBUG] URL do backend:', process.env.NEXT_PUBLIC_BACKEND_URL);
        }
        
        const auditResult = await auditAuthEvent(auditData);
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔍 [DEBUG] Resposta do backend:', auditResult);
        }

        // If backend tenant creation fails, roll back user creation in Auth.
        if (!auditResult.success) {
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.error('❌ [DEBUG] Backend audit falhou - iniciando rollback');
          }
          debugError('Google signup backend audit failed:', auditResult.message);
          
          try {
            await result.user.delete();
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.log('🔍 [DEBUG] Usuário Google removido com sucesso (rollback)');
            }
            debugLog('Google user rolled back successfully.');
          } catch (deleteError) {
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.error('❌ [DEBUG] Falha no rollback do usuário Google:', deleteError);
            }
            debugError("Failed to roll back Google user creation:", deleteError);
          }
          
          setError(auditResult.message || 'Failed to create your account on our servers. Please try again.');
          setLoading(false);
          return;
        }
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('✅ [DEBUG] Registro social Google concluído com sucesso');
        }

      } else {
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔍 [DEBUG] Usuário identificado como EXISTENTE - processando login');
        }
        
        // This is a login, not a signup. Just audit the login event.
        await auditAuthEvent({
          eventType: 'LOGIN_SUCCESS',
          user: {
            uid: result.user.uid,
            email: result.user.email,
          }
        });
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('✅ [DEBUG] Login social Google concluído com sucesso');
        }
      }
      
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('🔍 [DEBUG] Redirecionando para dashboard');
      }
      
      router.push(`/${lang}/dashboard`);
    } catch (e) {
      const authError = e as AuthError;
      
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.error('❌ [DEBUG] Erro no login Google:', {
          code: authError.code,
          message: authError.message,
          error: authError
        });
      }
      
      switch (authError.code) {
        case 'auth/popup-closed-by-user':
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('🔍 [DEBUG] Erro de popup - tentando redirect como fallback');
          }
          // Tentar com redirect como fallback
          try {
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.log('🔍 [DEBUG] Iniciando login com redirect');
            }
            // Preservar o estado antes do redirect
            sessionStorage.setItem('google-auth-attempt', 'true');
            await signInWithRedirect(auth, provider);
            // O redirect vai recarregar a página, então não precisamos fazer mais nada aqui
            return;
          } catch (redirectError) {
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.error('❌ [DEBUG] Falha no redirect também:', redirectError);
            }
            setError('Não foi possível conectar com o Google. Tente novamente.');
          }
          break;
        case 'auth/account-exists-with-different-credential':
          setError(dictionary.errorAccountExists);
          break;
        case 'auth/cancelled-popup-request':
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('🔍 [DEBUG] Popup cancelado - sem ação necessária');
          }
          break;
        case 'auth/popup-blocked':
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('🔍 [DEBUG] Popup bloqueado - tentando redirect');
          }
          // Tentar com redirect quando popup for bloqueado
          try {
            await signInWithRedirect(auth, provider);
            return;
          } catch (redirectError) {
            setError('Popup foi bloqueado. Por favor, permita popups para este site ou recarregue a página.');
          }
          break;
        case 'auth/unauthorized-domain':
          setError('Domínio não autorizado. Entre em contato com o suporte.');
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.error('❌ [DEBUG] Domínio não autorizado no Firebase Console');
          }
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
