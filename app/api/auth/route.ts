import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { validateUser, ensureAdminExists } from '@/lib/users'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'wilduit-jwt-secret-please-change-in-production'
)

async function createToken(email: string, role: string): Promise<string> {
  return await new SignJWT({ email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(JWT_SECRET)
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    await ensureAdminExists()

    const user = await validateUser(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const token = await createToken(user.email, user.role)
    const response = NextResponse.json({ success: true, role: user.role })
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Auth error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('auth-token')
  return response
}
