import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(): string {
  return nanoid(32);
}

export function verifySessionToken(token: string): boolean {
  // Simple validation - in production, use JWT or store in Redis
  return token.length >= 32;
}


