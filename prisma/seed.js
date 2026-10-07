const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

const { randomBytes, scryptSync } = require('node:crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

async function main() {
  for (const item of read('seed-teams.json')) {
    await prisma.team.upsert({
      where: { name: item.name },
      create: { name: item.name, squad_value: item.squad_value, manager_name: item.manager_name, logo_url: item.logo_url },
      update: { logo_url: item.logo_url },
    });
  }
  await prisma.leagueSettings.upsert({ where: { id: 1 }, create: { id: 1, active_matchday: 3 }, update: {} });

  const adminEmail = 'admin@gmail.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: hashPassword('admin123'),
        profile: {
          create: {
            username: 'admin',
            is_admin: true,
            balance: 1000,
          },
        },
      },
    });
  } else {
    await prisma.profile.updateMany({
      where: { id: existingAdmin.id },
      data: { is_admin: true },
    });
  }

  console.log('Takımlar, 3. hafta ayarı ve admin hazır.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
