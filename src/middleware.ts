import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Root → meal
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/meal', request.url));
  }

  // 旧ルート → すべてマイページ(/profile)へ。カレンダー/統計/体重はマイページ内タブ。
  // ※ 完全一致のみ（/data/food_composition.json 等の public 配下アセットを巻き込まない）。
  if (pathname === '/weight') {
    return NextResponse.redirect(new URL('/profile?tab=weight', request.url));
  }
  if (pathname === '/calendar' || pathname === '/data') {
    return NextResponse.redirect(new URL('/profile', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
};
