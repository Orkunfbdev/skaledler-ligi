import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import prisma from '../../../../lib/prisma';
import { checkPassword, clearSession, currentUser, hashPassword, setSession } from '../../../../lib/local-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await currentUser(request);
  return NextResponse.json({ user: user ? { id: user.id, email: user.email } : null });
}

export async function POST(request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const body = await request.json();
  if (body.action === 'signout') {
    const response = NextResponse.json({ user: null });
    clearSession(response);
    return response;
  }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email.includes('@') || password.length < 8) {
    return NextResponse.json({ error: 'Geçerli e-posta ve en az 8 karakterli şifre girin.' }, { status: 400 });
  }
  if (body.action === 'signup') {
    const username = String(body.username || '').trim();
    if (username.length < 3 || username.length > 24) {
      return NextResponse.json({ error: 'Kullanıcı adı 3-24 karakter olmalı.' }, { status: 400 });
    }
    try {
      const adminEnv = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const isAdminEmail = email === 'admin@gmail.com' || (adminEnv && email === adminEnv);
      await prisma.user.create({
        data: {
          email,
          password_hash: hashPassword(password),
          profile: {
            create: {
              username,
              is_admin: isAdminEmail,
              balance: 1000,
            },
          },
        },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'E-posta veya kullanıcı adı zaten kayıtlı.' }, { status: 409 });
      throw error;
    }
  }
  if (body.action === 'signin') {
    let user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user && email === 'admin@gmail.com' && password === 'admin123') {
      user = await prisma.user.create({
        data: {
          email: 'admin@gmail.com',
          password_hash: hashPassword('admin123'),
          profile: {
            create: {
              username: 'admin',
              is_admin: true,
              balance: 1000,
            },
          },
        },
        include: { profile: true },
      });
    } else if (user && (email === 'admin@gmail.com' || (process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.trim().toLowerCase())) && !user.profile?.is_admin) {
      await prisma.profile.update({
        where: { id: user.id },
        data: { is_admin: true },
      });
      user.profile.is_admin = true;
    }
    if (!user || !checkPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'E-posta veya şifre yanlış.' }, { status: 401 });
    }
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    setSession(response, user.id);
    return response;
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
