import { jwtVerify, SignJWT } from 'jose';

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'default-secret-please-change-in-production'
  );

export async function createToken(): Promise<string> {
  return new SignJWT({ authorized: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
