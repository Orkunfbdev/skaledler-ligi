import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { currentUser, hashPassword } from '../../../../lib/local-auth';

export const dynamic = 'force-dynamic';

async function revertMatch(matchId) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new Error('Maç bulunamadı.');

    // 1. Bu maça ait tekli öngörüleri geri al
    const singleBets = await tx.bet.findMany({
      where: { match_id: matchId },
    });

    for (const bet of singleBets) {
      if (bet.status === 'won') {
        const wonAmount = Number(bet.bet_amount) * Number(bet.odds);
        await tx.profile.update({
          where: { id: bet.user_id },
          data: { balance: { decrement: wonAmount } },
        });
      }
      if (bet.status === 'won' || bet.status === 'lost') {
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'pending' },
        });
      }
    }

    // 2. Bu maçı içeren kombine öngörüleri geri al
    const comboBets = await tx.bet.findMany({
      where: { bet_type: 'combo' },
    });

    for (const bet of comboBets) {
      const legs = Array.isArray(bet.combo_details) ? bet.combo_details : [];
      const hasMatch = legs.some((leg) => leg.match_id === matchId);
      if (hasMatch) {
        if (bet.status === 'won') {
          const wonAmount = Number(bet.bet_amount) * Number(bet.odds);
          await tx.profile.update({
            where: { id: bet.user_id },
            data: { balance: { decrement: wonAmount } },
          });
        }
        if (bet.status === 'won' || bet.status === 'lost') {
          await tx.bet.update({
            where: { id: bet.id },
            data: { status: 'pending' },
          });
        }
      }
    }

    // 3. Maçı sıfırla
    await tx.match.update({
      where: { id: matchId },
      data: {
        home_score: null,
        away_score: null,
        is_finished: false,
        settled: false,
      },
    });

    // 4. Eğer aktif hafta bu maçtan sonraya geçmişse geri çek
    const settings = await tx.leagueSettings.findUnique({ where: { id: 1 } });
    if (settings && settings.active_matchday > match.matchday) {
      await tx.leagueSettings.update({
        where: { id: 1 },
        data: { active_matchday: match.matchday },
      });
    }

    return true;
  });
}

async function cancelBetAndRefund(betId) {
  return prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({
      where: { id: betId },
    });
    if (!bet) throw new Error('Öngörü bulunamadı.');
    if (bet.status === 'cancelled') throw new Error('Bu öngörü zaten iptal edilmiş.');

    const betAmount = Number(bet.bet_amount);
    const odds = Number(bet.odds);

    if (bet.status === 'pending' || bet.status === 'lost') {
      // Bekleyen veya kaybetmiş kupon: yatırılan puanı menajere iade et
      await tx.profile.update({
        where: { id: bet.user_id },
        data: { balance: { increment: betAmount } },
      });
    } else if (bet.status === 'won') {
      // Kazanmış kupon: net kazancı geri al (kazanç = betAmount * odds, yatırılan puan geri verilir)
      const wonTotal = betAmount * odds;
      const netProfit = wonTotal - betAmount;
      if (netProfit > 0) {
        await tx.profile.update({
          where: { id: bet.user_id },
          data: { balance: { decrement: netProfit } },
        });
      }
    }

    await tx.bet.update({
      where: { id: bet.id },
      data: { status: 'cancelled' },
    });

    return true;
  });
}

async function cancelMatchAndRefund(matchId) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Maç bulunamadı.');

    const singleBets = await tx.bet.findMany({ where: { match_id: matchId } });
    for (const bet of singleBets) {
      if (bet.status !== 'cancelled') {
        const betAmount = Number(bet.bet_amount);
        if (bet.status === 'won') {
          const wonTotal = betAmount * Number(bet.odds);
          const netProfit = wonTotal - betAmount;
          if (netProfit > 0) {
            await tx.profile.update({
              where: { id: bet.user_id },
              data: { balance: { decrement: netProfit } },
            });
          }
        } else {
          await tx.profile.update({
            where: { id: bet.user_id },
            data: { balance: { increment: betAmount } },
          });
        }
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'cancelled' },
        });
      }
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        home_score: null,
        away_score: null,
        is_finished: false,
        settled: false,
      },
    });

    return true;
  });
}

export async function POST(request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user?.profile?.is_admin) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 });

  const { name, parameters } = await request.json();

  try {
    if (name === 'admin_settle_match') {
      const id = String(parameters?.p_match_id || '');
      const home = parameters?.p_home_score;
      const away = parameters?.p_away_score;
      if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
        return NextResponse.json({ error: 'Geçersiz maç veya skor.' }, { status: 400 });
      }
      const rows = await prisma.$queryRaw`select app_private.settle_match(${id}::uuid, ${home}::integer, ${away}::integer) as settled`;
      return NextResponse.json({ data: rows[0].settled });
    }

    if (name === 'admin_revert_match') {
      const id = String(parameters?.p_match_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Geçersiz maç ID.' }, { status: 400 });
      const result = await revertMatch(id);
      return NextResponse.json({ data: result });
    }

    if (name === 'admin_cancel_bet') {
      const id = String(parameters?.p_bet_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Geçersiz öngörü ID.' }, { status: 400 });
      const result = await cancelBetAndRefund(id);
      return NextResponse.json({ data: result });
    }

    if (name === 'admin_cancel_match_and_refund') {
      const id = String(parameters?.p_match_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Geçersiz maç ID.' }, { status: 400 });
      const result = await cancelMatchAndRefund(id);
      return NextResponse.json({ data: result });
    }

    if (name === 'admin_set_admin_role') {
      const profileId = String(parameters?.p_profile_id || '');
      const isAdmin = Boolean(parameters?.p_is_admin);
      if (!/^[0-9a-f-]{36}$/i.test(profileId)) return NextResponse.json({ error: 'Geçersiz profil ID.' }, { status: 400 });
      await prisma.profile.update({
        where: { id: profileId },
        data: { is_admin: isAdmin },
      });
      return NextResponse.json({ data: true });
    }

    if (name === 'admin_create_admin_user') {
      const email = String(parameters?.email || '').trim().toLowerCase();
      const password = String(parameters?.password || '');
      const username = String(parameters?.username || '').trim();
      if (!email.includes('@') || password.length < 8 || username.length < 3) {
        return NextResponse.json({ error: 'Geçerli e-posta, en az 8 karakter şifre ve en az 3 karakter kullanıcı adı girin.' }, { status: 400 });
      }
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return NextResponse.json({ error: 'Bu e-posta zaten kayıtlı.' }, { status: 409 });
      const existingProfile = await prisma.profile.findUnique({ where: { username } });
      if (existingProfile) return NextResponse.json({ error: 'Bu kullanıcı adı zaten alınmış.' }, { status: 409 });

      await prisma.user.create({
        data: {
          email,
          password_hash: hashPassword(password),
          profile: {
            create: {
              username,
              is_admin: true,
              balance: 1000,
            },
          },
        },
      });
      return NextResponse.json({ data: true });
    }

    return NextResponse.json({ error: 'Unknown function' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
