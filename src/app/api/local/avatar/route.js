import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { currentUser } from '../../../../lib/local-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('user');
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) return new Response(null, { status: 400 });
  const avatar = await prisma.avatar.findUnique({ where: { profile_id: id } });
  if (!avatar) return new Response(null, { status: 404 });
  return new Response(avatar.data, {
    headers: { 'content-type': avatar.mime, 'cache-control': 'public, max-age=60' },
  });
}

export async function POST(request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!file || file.size > 2_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'PNG, JPG veya WebP dosyası seçin (en fazla 2 MB).' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.avatar.upsert({
    where: { profile_id: user.id },
    create: { profile_id: user.id, data: bytes, mime: file.type },
    update: { data: bytes, mime: file.type },
  });
  return NextResponse.json({ publicUrl: `/api/local/avatar?user=${user.id}&v=${Date.now()}` });
}
