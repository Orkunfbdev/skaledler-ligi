import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import prisma from './prisma';

const COOKIE = 'skaledler_local_session';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET || process.env.LOCAL_AUTH_SECRET || 'skaledler_production_auth_secret_key_super_safe_32_chars';
  return value;
}

function signature(body) {
  return createHmac('sha256', secret()).update(body).digest('hex');
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function setSession(response, userId) {
  const body = `${userId}.${Date.now()}.${randomBytes(12).toString('hex')}`;
  response.cookies.set(COOKIE, `${body}.${signature(body)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: WEEK / 1000,
  });
}

export function clearSession(response) {
  response.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function currentUser(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const body = parts.slice(0, 3).join('.');
  const actual = Buffer.from(parts[3], 'hex');
  const expected = Buffer.from(signature(body), 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const issued = Number(parts[1]);
  if (!Number.isFinite(issued) || issued > Date.now() || Date.now() - issued > WEEK) return null;
  return prisma.user.findUnique({ where: { id: parts[0] }, include: { profile: true } });
}

export async function isAdmin(request) {
  const user = await currentUser(request);
  return Boolean(user?.profile?.is_admin);
}
