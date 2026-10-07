const { PrismaClient } = require('@prisma/client');
const fixtures = require('./osm-fixtures.json');

const prisma = new PrismaClient();

function odds(home, away) {
  const adjustedHome = home * 1.15;
  const total = adjustedHome + away;
  return {
    odds_home: Math.max(1.15, 0.90 / (adjustedHome / total * 0.74)).toFixed(2),
    odds_draw: Math.max(2.40, 0.90 / 0.26).toFixed(2),
    odds_away: Math.max(1.20, 0.90 / (away / total * 0.74)).toFixed(2),
  };
}

async function main() {
  const teams = new Map((await prisma.team.findMany()).map(team => [team.name, team]));
  const weeks = new Map();
  const rows = fixtures.map(({ week, home, away }) => {
    const homeTeam = teams.get(home);
    const awayTeam = teams.get(away);
    if (!homeTeam || !awayTeam || home === away) throw new Error(`Unknown fixture: ${home} - ${away}`);
    const used = weeks.get(week) || new Set();
    if (used.has(home) || used.has(away)) throw new Error(`Duplicate team in week ${week}`);
    used.add(home); used.add(away); weeks.set(week, used);
    return {
      matchday: week, home_team_id: homeTeam.id, away_team_id: awayTeam.id,
      ...odds(Number(homeTeam.squad_value), Number(awayTeam.squad_value)),
    };
  });
  if (weeks.size !== 36 || [...weeks.values()].some(used => used.size !== 20)) {
    throw new Error('Fixture snapshot must contain 36 complete league rounds.');
  }
  const result = await prisma.match.createMany({ data: rows, skipDuplicates: true });
  console.log(`${result.count} yeni fikstür maçı eklendi.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
