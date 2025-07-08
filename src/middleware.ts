
import { NextResponse, type NextRequest } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

export const locales = ['en', 'pt', 'es'] as const;
export const defaultLocale = 'en';

export type Locale = (typeof locales)[number];

function getLocale(request: NextRequest): Locale {
  const negotiatorHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

  const languages = new Negotiator({ headers: negotiatorHeaders }).languages();
  
  try {
    return match(languages, [...locales], defaultLocale) as Locale;
  } catch (e) {
    return defaultLocale;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Redirect if there is no locale
  const locale = getLocale(request);
  
  // Prepend the locale to the path, handling the root path case
  request.nextUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  // e.g. incoming request is /products
  // The new URL is now /en/products
  return Response.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // Skip all internal paths (_next) and API routes (api)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
