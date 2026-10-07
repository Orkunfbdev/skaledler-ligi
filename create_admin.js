require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('node:crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const prisma = new PrismaClient();

async function run() {
  const email = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  let user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password_hash: hashPassword(password),
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
    console.log('Created admin user:', user.email);
  } else {
    await prisma.user.update({
      where: { email },
      data: {
        password_hash: hashPassword(password),
      },
    });
    await prisma.profile.update({
      where: { id: user.id },
      data: { is_admin: true },
    });
    console.log('Updated existing admin user:', user.email);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
