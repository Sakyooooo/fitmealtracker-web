import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Root → meal
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/meal', request.url));
  }

  // Retired routes → data
  if (pathname.startsWith('/weight') || pathname.startsWith('/calendar')) {
    return NextResponse.redirect(new URL('/data', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
};
