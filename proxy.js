import { auth } from '@/lib/auth';

export default auth((req) => {
  if (!req.auth) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', req.url);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-\\d+x\\d+\\.png).*)'],
};
