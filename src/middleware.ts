import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Root → meal
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/meal', request.url));
  }

  // Retired routes → data with correct tab
  if (pathname.startsWith('/weight')) {
    return NextResponse.redirect(new URL('/data?tab=weight', request.url));
  }
  if (pathname.startsWith('/calendar')) {
    return NextResponse.redirect(new URL('/data?tab=calendar', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
};
