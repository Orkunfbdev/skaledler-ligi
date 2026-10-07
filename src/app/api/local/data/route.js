import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { currentUser } from '../../../../lib/local-auth';

export const dynamic = 'force-dynamic';

const MODELS = {
  teams: 'team', matches: 'match', bets: 'bet', profiles: 'profile',
  league_settings: 'leagueSettings', daily_quotes: 'dailyQuote', transfers: 'transfer', standings: 'standing',
};
const FIELDS = {
  teams: ['id', 'name', 'squad_value', 'manager_name', 'logo_url'],
  matches: ['id', 'matchday', 'home_team_id', 'away_team_id', 'is_finished', 'is_banko', 'settled'],
  bets: ['id', 'user_id', 'match_id', 'status', 'bet_type'],
  profiles: ['id', 'username', 'balance', 'is_admin'],
  league_settings: ['id', 'active_matchday'],
  daily_quotes: ['id', 'user_id', 'created_at'],
  transfers: ['id', 'fingerprint', 'transfer_date', 'matchday'],
  standings: ['team_id', 'rank', 'points'],
};
const INCLUDES = {
  matches: { home_team: true, away_team: true },
  bets: { profile: true, match: { include: { home_team: true, away_team: true } } },
  daily_quotes: { profile: true },
  standings: { team: true },
};

const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });
const data = (value) => NextResponse.json({ data: value });
const number = (value) => Number(value);

const INT_FIELDS = ['matchday', 'home_score', 'away_score', 'rank', 'points', 'active_matchday'];

function whereFor(table, filters = []) {
  const where = {};
  for (const [field, value] of filters) {
    if (!FIELDS[table]?.includes(field)) throw new Error(`Unsupported filter: ${field}`);
    if ((INT_FIELDS.includes(field) || (field === 'id' && table === 'league_settings')) && value !== null && value !== undefined && !isNaN(Number(value))) {
      where[field] = Number(value);
    } else if (value === 'true' || value === 'false') {
      where[field] = value === 'true';
    } else {
      where[field] = value;
    }
  }
  return where;
}

export async function POST(request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
    return fail('Invalid origin', 403);
  }
  try {
    const { table, operation, filters, sort, one, value } = await request.json();
    if (!MODELS[table]) return fail('Unknown table');
    const user = await currentUser(request);
    const admin = Boolean(user?.profile?.is_admin);
    const model = prisma[MODELS[table]];
    const where = whereFor(table, filters);

    if (operation === 'select') {
      if (sort && !FIELDS[table].includes(sort[0]) && !['created_at', 'squad_value', 'matchday'].includes(sort[0])) {
        return fail('Unsupported sort');
      }
      const options = { where, ...(INCLUDES[table] ? { include: INCLUDES[table] } : {}) };
      if (sort) options.orderBy = { [sort[0]]: sort[1] ? 'asc' : 'desc' };
      return data(one ? await model.findFirst(options) : await model.findMany(options));
    }
    if (!user) return fail('Giriş gerekli.', 401);

    if (table === 'bets' && operation === 'insert') {
      if (!admin) {
        const now = new Date();
        const trHour = parseInt(
          new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            hour: 'numeric',
            hour12: false,
          }).format(now),
          10
        );
        if (trHour >= 18) {
          return fail('Günün maçları için öngörüler saat 18:00 itibarıyla kapanmıştır.');
        }
      }
      if (value.user_id !== user.id || !['single', 'combo'].includes(value.bet_type)
          || !Number.isFinite(number(value.bet_amount)) || number(value.bet_amount) <= 0) return fail('Geçersiz öngörü.');
      const amount = number(value.bet_amount);
      const bet = await prisma.$transaction(async (tx) => {
        const profile = await tx.profile.findUnique({ where: { id: user.id } });
        if (!profile || number(profile.balance) < amount) throw new Error('Yetersiz puan.');
        if (value.bet_type === 'single') {
          const match = await tx.match.findUnique({ where: { id: value.match_id } });
          if (!match || match.is_finished || match.settled) throw new Error('Maç öngörüye kapalı.');
          if (!['1', '0', '2'].includes(value.prediction)) throw new Error('Geçersiz seçim.');
          const offered = { '1': match.odds_home, '0': match.odds_draw, '2': match.odds_away }[value.prediction];
          if (Math.abs(number(offered) - number(value.odds)) > 0.001) throw new Error('Puan çarpanı değişmiş; sayfayı yenileyin.');
        } else {
          if (!Array.isArray(value.combo_details) || value.combo_details.length < 2) throw new Error('Çoklu öngörü için iki maç gerekli.');
          const ids = value.combo_details.map((leg) => leg.match_id);
          if (new Set(ids).size !== ids.length) throw new Error('Aynı maç iki kez seçilemez.');
          const matches = await tx.match.findMany({ where: { id: { in: ids } } });
          if (matches.length !== ids.length || matches.some((m) => m.is_finished || m.settled)) throw new Error('Maç öngörüye kapalı.');
          const offered = value.combo_details.reduce((acc, leg) => {
            const match = matches.find((m) => m.id === leg.match_id);
            const odds = { '1': match.odds_home, '0': match.odds_draw, '2': match.odds_away }[leg.prediction];
            if (!odds || Math.abs(number(odds) - number(leg.odds)) > 0.001) throw new Error('Puan çarpanı değişmiş; sayfayı yenileyin.');
            return acc * number(odds);
          }, 1);
          if (Math.abs(number(value.odds) - Number(offered.toFixed(2))) > 0.001) throw new Error('Çoklu öngörü çarpanı geçersiz.');
        }
        const debit = await tx.profile.updateMany({ where: { id: user.id, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
        if (debit.count !== 1) throw new Error('Yetersiz puan.');
        return tx.bet.create({ data: {
          user_id: user.id, match_id: value.bet_type === 'single' ? value.match_id : null,
          prediction: value.bet_type === 'single' ? value.prediction : 'KOMBO',
          bet_amount: amount, odds: value.odds, status: 'pending', bet_type: value.bet_type,
          combo_details: value.bet_type === 'combo' ? value.combo_details : undefined,
        } });
      });
      return data(bet);
    }

    if (table === 'profiles' && operation === 'update') {
      if (!admin && where.id !== user.id) return fail('Yetki yok.', 403);
      if (!admin && 'balance' in value) {
        const profile = await prisma.profile.findUnique({ where: { id: user.id } });
        const today = String(value.last_daily_claim || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || profile.last_daily_claim === today
            || number(value.balance) !== number(profile.balance) + 100) return fail('Günlük puan geçersiz.');
        await prisma.profile.update({ where: { id: user.id }, data: { balance: { increment: 100 }, last_daily_claim: today } });
        return data(null);
      }
      const allowed = admin ? ['balance', 'username', 'avatar_url', 'last_daily_claim', 'is_admin'] : ['username', 'avatar_url'];
      const changes = Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
      await model.updateMany({ where, data: changes });
      return data(null);
    }

    if (table === 'daily_quotes' && operation === 'insert') {
      if (value.user_id !== user.id || !String(value.quote || '').trim() || String(value.quote).length > 100) return fail('Geçersiz söz.');
      return data(await model.create({ data: { user_id: user.id, quote: value.quote.trim(), created_at: value.created_at } }));
    }
    if (!admin) return fail('Yönetici yetkisi gerekli.', 403);

    if (table === 'league_settings' && (operation === 'upsert' || operation === 'update')) {
      const targetMd = number(value?.active_matchday);
      return data(await model.upsert({ where: { id: 1 }, create: { id: 1, active_matchday: targetMd }, update: { active_matchday: targetMd } }));
    }
    if (table === 'bets' && operation === 'update' && value.status === 'cancelled') {
      await prisma.$transaction(async (tx) => {
        const bet = await tx.bet.findFirst({ where });
        if (!bet || bet.status !== 'pending') throw new Error('Yalnızca sonucu beklenen öngörü iptal edilebilir.');
        await tx.bet.update({ where: { id: bet.id }, data: { status: 'cancelled' } });
        await tx.profile.update({ where: { id: bet.user_id }, data: { balance: { increment: bet.bet_amount } } });
      });
      return data(null);
    }
    if (table === 'matches' && ['update', 'delete'].includes(operation)) {
      const existing = await model.findFirst({ where });
      if (existing?.settled) return fail('İşlenmiş maç değiştirilemez.');
      if (operation === 'update' && ['odds_home', 'odds_draw', 'odds_away'].some((key) => key in value)) {
        if (existing?.is_finished || ['odds_home', 'odds_draw', 'odds_away'].some((key) =>
          key in value && (!Number.isFinite(number(value[key])) || number(value[key]) < 1.01 || number(value[key]) > 100))) {
          return fail('Maçın puan çarpanı değiştirilemez.');
        }
      }
    }
    if (operation === 'insert') return data(await model.create({ data: value }));
    if (operation === 'update') { await model.updateMany({ where, data: value }); return data(null); }
    if (operation === 'delete') { await model.deleteMany({ where }); return data(null); }
    return fail('Unsupported operation');
  } catch (error) {
    return fail(error.code === 'P2002' ? 'Bu kayıt zaten mevcut.' : error.message);
  }
}
