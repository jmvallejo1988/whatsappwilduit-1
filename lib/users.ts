import { createHash } from 'crypto'
import redis from './redis'

export type UserRole = 'admin' | 'user'

export interface AppUser {
  email: string
  passwordHash: string
  role: UserRole
  createdAt: string
}

const SALT = 'wilduit-wa-salt-2024'
const USERS_SET = 'app:users'

function hashPassword(password: string): string {
  return createHash('sha256').update(password + SALT).digest('hex')
}

export async function createUser(email: string, password: string, role: UserRole = 'user'): Promise<void> {
  const key = email.toLowerCase().trim()
  const user: AppUser = {
    email: key,
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  }
  await redis.set(`user:${key}`, JSON.stringify(user))
  await redis.sadd(USERS_SET, key)
}

export async function validateUser(email: string, password: string): Promise<AppUser | null> {
  const key = email.toLowerCase().trim()
  const data = await redis.get(`user:${key}`) as string | null
  if (!data) return null
  const user: AppUser = JSON.parse(data)
  if (user.passwordHash !== hashPassword(password)) return null
  return user
}

export async function listUsers(): Promise<AppUser[]> {
  const emails = await redis.smembers(USERS_SET) as string[]
  if (!emails.length) return []
  const users: AppUser[] = []
  for (const email of emails) {
    const data = await redis.get(`user:${email}`) as string | null
    if (data) users.push(JSON.parse(data))
  }
  return users.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function deleteUser(email: string): Promise<void> {
  const key = email.toLowerCase().trim()
  await redis.del(`user:${key}`)
  await redis.srem(USERS_SET, key)
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const key = email.toLowerCase().trim()
  const data = await redis.get(`user:${key}`) as string | null
  if (!data) return null
  return JSON.parse(data)
}

export async function ensureAdminExists(): Promise<void> {
  const adminEmail = (process.env.ADMIN_EMAIL || 'jonathan.vallejo.german@gmail.com').toLowerCase().trim()
  const existing = await redis.get(`user:${adminEmail}`)
  if (!existing) {
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.APP_PASSWORD || 'wilduit2024'
    await createUser(adminEmail, adminPassword, 'admin')
  }
}
