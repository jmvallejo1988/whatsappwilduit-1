import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

const APP_PASSWORD = process.env.APP_PASSWORD || 'wilduit2024';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password !== APP_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const token = await createToken();

  const response = NextResponse.json({ success: true });
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}
