import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import fs from 'fs';
import path from 'path';
import { randomBytes, scryptSync } from 'node:crypto';

export const dynamic = 'force-dynamic';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export async function GET(request) {
  try {
    const envKeys = Object.keys(process.env).filter(k => !k.startsWith('npm_') && k !== 'PATH');
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
    if (!dbUrl) {
      return NextResponse.json({
        ok: false,
        error: 'Veritabanı adresi (DATABASE_URL veya Neon) bulunamadı.',
        availableEnvKeys: envKeys,
      }, { status: 500 });
    }

    const teamsPath = path.join(process.cwd(), 'prisma', 'seed-teams.json');
    const fixturesPath = path.join(process.cwd(), 'prisma', 'osm-fixtures.json');

    const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));
    const fixturesData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
    for (const item of teamsData) {
      await prisma.team.upsert({
        where: { name: item.name },
        create: { name: item.name, squad_value: item.squad_value, manager_name: item.manager_name, logo_url: item.logo_url },
        update: { logo_url: item.logo_url, squad_value: item.squad_value, manager_name: item.manager_name },
      });
    }

    // 2. League settings
    await prisma.leagueSettings.upsert({
      where: { id: 1 },
      create: { id: 1, active_matchday: 3 },
      update: {},
    });

    // 3. Admin user
    const adminEmail = 'admin@gmail.com';
    let admin = await prisma.user.findUnique({ where: { email: adminEmail }, include: { profile: true } });
    if (!admin) {
      admin = await prisma.user.create({
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
        include: { profile: true },
      });
    } else if (!admin.profile?.is_admin) {
      await prisma.profile.update({
        where: { id: admin.id },
        data: { is_admin: true },
      });
    }

    // 4. Seed fixtures
    const allTeams = await prisma.team.findMany();
    const teamMap = new Map(allTeams.map(t => [t.name, t]));

    function odds(home, away) {
      const adjustedHome = home * 1.15;
      const total = adjustedHome + away;
      return {
        odds_home: Math.max(1.15, 0.90 / (adjustedHome / total * 0.74)).toFixed(2),
        odds_draw: Math.max(2.40, 0.90 / 0.26).toFixed(2),
        odds_away: Math.max(1.20, 0.90 / (away / total * 0.74)).toFixed(2),
      };
    }

    const rows = fixturesData.map(({ week, home, away }) => {
      const homeTeam = teamMap.get(home);
      const awayTeam = teamMap.get(away);
      if (!homeTeam || !awayTeam) return null;
      return {
        matchday: week,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        ...odds(Number(homeTeam.squad_value), Number(awayTeam.squad_value)),
      };
    }).filter(Boolean);

    await prisma.match.createMany({ data: rows, skipDuplicates: true });

    return NextResponse.json({
      ok: true,
      message: 'Veritabanı tabloları, takımlar, admin hesabı ve fikstür başarıyla kuruldu!',
      teams: allTeams.length,
      fixtures: rows.length,
    });
  } catch (error) {
    console.error('Init-db error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
