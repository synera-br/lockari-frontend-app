
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
import { auditAuthEvent, signupUser } from '@/app/actions/auth';
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
    let hasChecked = false;
    
    const checkRedirectResult = async () => {
      if (hasChecked) return;
      hasChecked = true;
      
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('🔍 [DEBUG] Verificando redirect result ao carregar página...');
      }
      
      try {
        const result = await getRedirectResult(auth);
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔍 [DEBUG] Resultado do getRedirectResult:', result);
        }
        
        if (result) {
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('✨ [DEBUG] REDIRECT RESULT ENCONTRADO - PROCESSANDO...');
            console.log('🔍 [DEBUG] Detalhes do redirect result:', {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              metadata: result.user.metadata
            });
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
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.log('✨ [DEBUG] NOVO USUÁRIO VIA REDIRECT - REGISTRANDO...');
            }
            
            // Novo usuário via redirect
            const signupResult = await signupUser({
              uid: result.user.uid,
              email: result.user.email,
              name: result.user.displayName || 'Google User',
              plan: plan,
            });
            
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.log('📞 [DEBUG] RESPOSTA DO BACKEND (REDIRECT):', signupResult);
            }
            
            if (!signupResult.success) {
              if (process.env.NEXT_PUBLIC_MODE === 'develop') {
                console.error('❌ [DEBUG] Falha no signup após redirect - iniciando rollback');
              }
              try {
                await result.user.delete();
                if (process.env.NEXT_PUBLIC_MODE === 'develop') {
                  console.log('🔍 [DEBUG] Rollback após redirect concluído');
                }
              } catch (deleteError) {
                if (process.env.NEXT_PUBLIC_MODE === 'develop') {
                  console.error('❌ [DEBUG] Falha no rollback após redirect:', deleteError);
                }
              }
              setError(signupResult.message || 'Falha ao criar conta.');
              setLoading(false);
              return;
            }
            
            // Send audit event for successful redirect signup
            try {
              await auditAuthEvent({
                eventType: 'SIGNUP_SUCCESS',
                user: {
                  uid: result.user.uid,
                  email: result.user.email,
                  name: result.user.displayName || 'Google User',
                  plan: plan,
                }
              });
            } catch (auditError) {
              // Audit failure should not prevent successful signup
              debugError('Audit event failed after successful redirect signup:', auditError);
            }
          } else {
            if (process.env.NEXT_PUBLIC_MODE === 'develop') {
              console.log('🔄 [DEBUG] USUÁRIO EXISTENTE VIA REDIRECT - FAZENDO LOGIN...');
            }
            
            // Login de usuário existente via redirect
            await auditAuthEvent({
              eventType: 'LOGIN_SUCCESS',
              user: {
                uid: result.user.uid,
                email: result.user.email,
              }
            });
          }
          
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('✅ [DEBUG] REDIRECT PROCESSADO COM SUCESSO - REDIRECIONANDO PARA DASHBOARD');
          }
          
          router.push(`/${lang}/dashboard`);
        } else {
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.log('🔍 [DEBUG] Nenhum redirect result encontrado - processo normal');
          }
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
  }, []);

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
      
      // Step 3: Create tenant and user profile in backend
      debugLog(`User ${userCredential.user.uid} created in Firebase Auth. Creating tenant in backend...`);
      debugTime('Backend Signup Request');
      const signupResult = await signupUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: data.name,
        plan: data.plan
      });
      debugTimeEnd('Backend Signup Request');
      
      // Step 4: Handle backend response. If it fails, throw an error to trigger the catch block for rollback.
      if (!signupResult.success) {
        debugError('Backend signup failed:', signupResult.message);
        throw new Error(signupResult.message || 'Failed to create your account on our servers. Please try again.');
      }
      
      debugLog('Backend signup successful. Sending audit event...');
      
      // Step 5: Send audit event for successful signup
      try {
        await auditAuthEvent({
          eventType: 'SIGNUP_SUCCESS',
          user: {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            name: data.name,
            plan: data.plan
          }
        });
      } catch (auditError) {
        // Audit failure should not prevent successful signup
        debugError('Audit event failed after successful signup:', auditError);
      }
      
      debugLog('Signup process completed. Redirecting to dashboard...');
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
      
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('🔍 [DEBUG] SignInWithPopup completado com sucesso!');
        console.log('🔍 [DEBUG] Usuário autenticado:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.emailVerified,
          photoURL: result.user.photoURL,
          providerData: result.user.providerData,
          metadata: {
            creationTime: result.user.metadata.creationTime,
            lastSignInTime: result.user.metadata.lastSignInTime
          }
        });
      }
      
      const additionalUserInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalUserInfo?.isNewUser;
      
      if (process.env.NEXT_PUBLIC_MODE === 'develop') {
        console.log('🔍 [DEBUG] Informações adicionais do usuário:', {
          isNewUser: isNewUser,
          providerId: additionalUserInfo?.providerId,
          profile: additionalUserInfo?.profile,
          username: additionalUserInfo?.username,
          additionalUserInfo: additionalUserInfo
        });
        
        // Verificar se o usuário realmente foi criado no Firebase Auth
        console.log('🔍 [DEBUG] Verificando se usuário existe no Firebase Auth...');
        console.log('🔍 [DEBUG] Current auth user:', auth.currentUser);
      }
      
      if (isNewUser) {
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('✨ [DEBUG] USUÁRIO IDENTIFICADO COMO NOVO - INICIANDO PROCESSO DE REGISTRO');
          console.log('🔍 [DEBUG] Verificando se usuário foi realmente criado no Firebase Auth...');
          console.log('🔍 [DEBUG] UID do novo usuário:', result.user.uid);
        }
        
        // New user via Google. Create tenant and profile in backend.
        const signupData = {
          uid: result.user.uid,
          email: result.user.email,
          name: result.user.displayName || 'Google User',
          plan: plan,
        };
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔍 [DEBUG] Enviando dados para backend:', signupData);
          console.log('🔍 [DEBUG] URL do backend:', process.env.NEXT_PUBLIC_BACKEND_URL);
        }
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('📞 [DEBUG] CHAMANDO BACKEND PARA REGISTRAR NOVO USUÁRIO...');
        }
        
        const signupResult = await signupUser(signupData);
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('📞 [DEBUG] RESPOSTA DO BACKEND RECEBIDA:', signupResult);
        }

        // If backend tenant creation fails, roll back user creation in Auth.
        if (!signupResult.success) {
          if (process.env.NEXT_PUBLIC_MODE === 'develop') {
            console.error('❌ [DEBUG] Backend signup falhou - iniciando rollback');
          }
          debugError('Google signup backend failed:', signupResult.message);
          
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
          
          setError(signupResult.message || 'Failed to create your account on our servers. Please try again.');
          setLoading(false);
          return;
        }
        
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('✅ [DEBUG] REGISTRO SOCIAL GOOGLE CONCLUÍDO COM SUCESSO!');
          console.log('🔍 [DEBUG] Usuário final no Firebase Auth:', auth.currentUser);
        }
        
        // Send audit event for successful Google signup
        try {
          await auditAuthEvent({
            eventType: 'SIGNUP_SUCCESS',
            user: {
              uid: result.user.uid,
              email: result.user.email,
              name: result.user.displayName || 'Google User',
              plan: plan,
            }
          });
        } catch (auditError) {
          // Audit failure should not prevent successful signup
          debugError('Audit event failed after successful Google signup:', auditError);
        }

      } else {
        if (process.env.NEXT_PUBLIC_MODE === 'develop') {
          console.log('🔄 [DEBUG] USUÁRIO IDENTIFICADO COMO EXISTENTE - PROCESSANDO LOGIN');
          console.log('🔍 [DEBUG] UID do usuário existente:', result.user.uid);
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
          <Button 
            variant="outline" 
            onClick={() => {
              if (process.env.NEXT_PUBLIC_MODE === 'develop') {
                console.log('🔑 [DEBUG] BOTÃO GOOGLE CLICADO - INICIANDO handleGoogleSignIn');
              }
              handleGoogleSignIn();
            }} 
            disabled={loading}
          >
            <GoogleIcon /> Google
          </Button>
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
