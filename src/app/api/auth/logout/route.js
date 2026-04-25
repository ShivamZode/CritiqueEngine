import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  // Destroy the cookie
  res.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
  return res;
}