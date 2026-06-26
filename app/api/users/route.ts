import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createUser, listUsers, deleteUser, getUserByEmail } from '@/lib/users'

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'wilduit-jwt-secret-please-change-in-production'
  )

async function getAuthPayload(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return null
    try {
          const { payload } = await jwtVerify(token, JWT_SECRET)
          return payload as { email: string; role: string }
        } catch {
          return null
        }
  }

// GET /api/users — list all users (admin only)
export async function GET(request: NextRequest) {
    const auth = await getAuthPayload(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const users = await listUsers()
    return NextResponse.json({
          users: users.map(u => ({ email: u.email, role: u.role, createdAt: u.createdAt }))
        })
  }

// POST /api/users — create user (admin only)
export async function POST(request: NextRequest) {
    const auth = await getAuthPayload(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, password, role } = await request.json()
    if (!email || !password) {
          return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
        }

    const existing = await getUserByEmail(email)
    if (existing) {
          return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 })
        }

    await createUser(email, password, role || 'user')
    return NextResponse.json({ success: true })
  }

// DELETE /api/users — delete user (admin only)
export async function DELETE(request: NextRequest) {
    const auth = await getAuthPayload(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    if (email === auth.email) {
          return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
        }

    await deleteUser(email)
    return NextResponse.json({ success: true })
  }
