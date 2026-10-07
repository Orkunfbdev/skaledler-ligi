'use client';
import { useState, useEffect } from 'react';
import { api } from '../../lib/client';
import Link from 'next/link';

export default function AdminPage() {
  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [profilesList, setProfilesList] = useState([]);
  const [matchday, setMatchday] = useState(3);
  const [activeMatchday, setActiveMatchday] = useState(3);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [matches, setMatches] = useState([]);
  const [activeBets, setActiveBets] = useState([]);
  const [quotesList, setQuotesList] = useState([]);

  // Yönetici Girişi State
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Şık Bildirim Modalı State
  const [modalMsg, setModalMsg] = useState('');
  const [modalType, setModalType] = useState('info'); // 'info' | 'confirm'
  const [confirmAction, setConfirmAction] = useState(null);

  const showNotice = (msg) => {
    setModalMsg(msg);
    setModalType('info');
  };

  const showConfirm = (msg, action) => {
    setModalMsg(msg);
    setModalType('confirm');
    setConfirmAction(() => action);
  };

  // Takım Ekleme
  const [newTeamName, setNewTeamName] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newInitialVal, setNewInitialVal] = useState(200);

  // Takım Düzenleme
  const [editingTeam, setEditingTeam] = useState(null);

  // Puan Yönetimi
  const [selectedUserForPoint, setSelectedUserForPoint] = useState('');
  const [pointDelta, setPointDelta] = useState('');

  // Yönetici Yetki Yönetimi & Yeni Yönetici State
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminSearchFilter, setAdminSearchFilter] = useState('');

  // Skor State
  const [scores, setScores] = useState({});

  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      const { data: { session } } = await api.auth.getSession();
      if (session?.user) {
        const { data: userProfile } = await api.from('profiles').select('*').eq('id', session.user.id).single();
        if (userProfile?.is_admin) {
          setProfile(userProfile);
        }
      }
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    if (profile?.is_admin) {
      fetchTeams();
      fetchProfiles();
      fetchLeagueSettings();
      fetchMatches();
      fetchBets();
      fetchQuotes();
    }
  }, [profile, matchday]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmittingLogin(true);
    try {
      const { data, error } = await api.auth.signInWithPassword({
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
      });
      if (error) {
        setLoginError(error.message || 'Giriş başarısız.');
        return;
      }
      const loggedUser = data?.user || data;
      if (loggedUser?.id) {
        const { data: userProfile } = await api.from('profiles').select('*').eq('id', loggedUser.id).single();
        if (userProfile?.is_admin) {
          setProfile(userProfile);
          showNotice(`Hoş geldiniz, @${userProfile.username}! Yönetici paneli açıldı.`);
        } else {
          setLoginError('Bu hesabın yönetici yetkisi bulunmuyor.');
        }
      }
    } catch (err) {
      setLoginError(err.message || 'Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleAdminSignOut = async () => {
    await api.auth.signOut();
    setProfile(null);
    setAdminPassword('');
  };

  const fetchLeagueSettings = async () => {
    const { data } = await api.from('league_settings').select('*').eq('id', 1).single();
    if (data?.active_matchday) {
      const activeW = Number(data.active_matchday);
      setActiveMatchday(activeW);
      setMatchday(activeW);
      fetchMatches(activeW);
    }
  };

  const fetchTeams = async () => {
    const { data } = await api.from('teams').select('*').order('squad_value', { ascending: false });
    if (data) setTeams(data);
  };

  const fetchProfiles = async () => {
    const { data } = await api.from('profiles').select('*').order('username');
    if (data) setProfilesList(data);
  };

  const fetchMatches = async (overrideWeek) => {
    const weekToFetch = overrideWeek !== undefined ? Number(overrideWeek) : Number(matchday || activeMatchday || 3);
    const { data } = await api
      .from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('matchday', weekToFetch);
    if (data) setMatches(data);
  };

  const fetchBets = async () => {
    const { data } = await api
      .from('bets')
      .select('*, profile:user_id(username), match:match_id(matchday, home_team:home_team_id(name), away_team:away_team_id(name))')
      .order('created_at', { ascending: false });
    if (data) setActiveBets(data);
  };

  const fetchQuotes = async () => {
    const { data } = await api
      .from('daily_quotes')
      .select('*, profile:user_id(username)')
      .order('created_at', { ascending: false });
    if (data) setQuotesList(data);
  };

  const handleDeleteQuote = (quoteId) => {
    showConfirm('Bu sözü silmek istiyor musunuz? Menajere söz yazma hakkı geri verilecektir.', async () => {
      await api.from('daily_quotes').delete().eq('id', quoteId);
      showNotice('Söz silindi ve menajerin hakkı iade edildi.');
      fetchQuotes();
    });
  };

  const handleSetActiveMatchday = async (week) => {
    const target = Number(week);
    if (!target || target < 1) return;
    const res = await api.from('league_settings').upsert({ id: 1, active_matchday: target });
    if (res?.error) {
      showNotice('Hata: ' + res.error.message);
      return;
    }
    setActiveMatchday(target);
    setMatchday(target);
    showNotice(`📢 ${target}. Hafta bültene başarıyla yayınlandı!`);
    fetchMatches(target);
  };

  const handleAdvanceToNextMatchday = async (currentW) => {
    const cur = Number(currentW);
    const nextW = cur + 1;
    showConfirm(`${cur}. haftanın puanları dağıtıldı olarak işaretlenecek ve ${nextW}. hafta bültene açılacak. Devam edilsin mi?`, async () => {
      const res = await api.from('league_settings').upsert({ id: 1, active_matchday: nextW });
      if (res?.error) {
        showNotice('Hata: ' + res.error.message);
        return;
      }
      setActiveMatchday(nextW);
      setMatchday(nextW);
      showNotice(`✅ ${cur}. Hafta puanları dağıtıldı ve tamamlandı!\n📢 ${nextW}. Hafta bülteni başarıyla yayına açıldı.`);
      fetchMatches(nextW);
    });
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    await api.from('teams').insert({
      name: newTeamName.trim(),
      manager_name: newManagerName.trim() || 'Boşta',
      logo_url: newLogoUrl.trim() || null,
      squad_value: Number(newInitialVal) || 100
    });

    setNewTeamName('');
    setNewManagerName('');
    setNewLogoUrl('');
    fetchTeams();
    showNotice('Takım başarıyla lige eklendi.');
  };

  const handleFastValUpdate = async (teamId, val) => {
    if (!val) return;
    await api.from('teams').update({ squad_value: Number(val) }).eq('id', teamId);
    fetchTeams();
  };

  const handleSaveTeamEdit = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;

    await api.from('teams').update({
      name: editingTeam.name.trim(),
      manager_name: editingTeam.manager_name.trim(),
      logo_url: editingTeam.logo_url?.trim() || null,
      squad_value: Number(editingTeam.squad_value)
    }).eq('id', editingTeam.id);

    setEditingTeam(null);
    fetchTeams();
    fetchMatches();
    showNotice('Takım bilgileri güncellendi.');
  };

  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    if (!selectedUserForPoint || !pointDelta) return;

    const targetUser = profilesList.find(p => p.id === selectedUserForPoint);
    if (!targetUser) return;

    const delta = Number(pointDelta);
    if (isNaN(delta) || delta === 0) {
      showNotice('Lütfen geçerli bir puan miktarı girin.');
      return;
    }

    const newBalance = Number(targetUser.balance) + delta;
    if (newBalance < 0) {
      showConfirm(`@${targetUser.username} menajerinin bakiyesi eksiye düşecektir (${newBalance.toFixed(2)} P). Yine de devam edilsin mi?`, async () => {
        await applyPointAdjust(targetUser, delta, newBalance);
      });
      return;
    }
    await applyPointAdjust(targetUser, delta, newBalance);
  };

  const applyPointAdjust = async (targetUser, delta, newBalance) => {
    const { error } = await api.from('profiles').update({ balance: newBalance }).eq('id', targetUser.id);
    if (!error) {
      showNotice(`@${targetUser.username} bakiyesi güncellendi!\n${delta > 0 ? `+${delta} P Eklendi` : `${delta} P Geri Alındı / Düşüldü`}\nYeni Bakiye: ${newBalance.toFixed(2)} P`);
      setPointDelta('');
      fetchProfiles();
    }
  };

  const handleToggleAdminRole = (targetProfile) => {
    const willBeAdmin = !targetProfile.is_admin;
    const actionText = willBeAdmin ? 'Yönetici (Admin) yapmak' : 'Yönetici yetkisini kaldırmak';
    showConfirm(`@${targetProfile.username} adlı menajeri ${actionText} istediğinize emin misiniz?`, async () => {
      try {
        const { error } = await api.rpc('admin_set_admin_role', {
          p_profile_id: targetProfile.id,
          p_is_admin: willBeAdmin,
        });
        if (error) {
          showNotice(`İşlem başarısız: ${error.message || error}`);
        } else {
          showNotice(`@${targetProfile.username} menajerinin yetkisi güncellendi:\n${willBeAdmin ? '🛡️ Yönetici Yapıldı! Ana sayfada "⚙ YÖNETİCİ PANELİNE GİR" butonu açıldı.' : 'Yönetici yetkisi kaldırıldı.'}`);
          fetchProfiles();
        }
      } catch (err) {
        showNotice(`Hata: ${err.message}`);
      }
    });
  };

  const handleCreateNewAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminPassword || !newAdminUsername.trim()) return;
    setIsCreatingAdmin(true);
    try {
      const { error } = await api.rpc('admin_create_admin_user', {
        email: newAdminEmail.trim().toLowerCase(),
        password: newAdminPassword,
        username: newAdminUsername.trim(),
      });
      if (error) {
        showNotice(`Yönetici oluşturulamadı: ${error.message || error}`);
      } else {
        showNotice(`🎉 Yeni yönetici @${newAdminUsername.trim()} başarıyla oluşturuldu!\nArtık bu kullanıcı yönetici paneline veya ana sayfaya giriş yapabilir.`);
        setNewAdminEmail('');
        setNewAdminPassword('');
        setNewAdminUsername('');
        fetchProfiles();
      }
    } catch (err) {
      showNotice(`Hata: ${err.message}`);
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleCancelBet = (bet) => {
    if (bet.status === 'cancelled') return;
    const desc = bet.status === 'won'
      ? `⚠️ @${bet.profile?.username} menajerinin KAZANAN öngörüsü iptal edilsin mi?\n\nKazanılan net puan profilden geri alınacak, ana kupon tutarı (${bet.bet_amount} P) iade edilecektir.`
      : bet.status === 'lost'
      ? `⚠️ @${bet.profile?.username} menajerinin KAYBEDEN öngörüsü iptal edilsin mi?\n\nYatırdığı ${bet.bet_amount} puan menajerin hesabına eksiksiz iade edilecektir.`
      : `@${bet.profile?.username} menajerine ait ${bet.bet_amount} puanlık öngörü iptal edilip puanı iade edilsin mi?`;

    showConfirm(desc, async () => {
      const { data, error } = await api.rpc('admin_cancel_bet', { p_bet_id: bet.id });
      if (error) {
        showNotice('Hata: ' + error.message);
        return;
      }
      showNotice('✅ Öngörü iptal edildi ve menajerin puanı başarıyla güncellendi/iade edildi.');
      fetchBets();
      fetchProfiles();
    });
  };

  const handleRevertMatch = (match) => {
    showConfirm(
      `⚠️ DİKKAT: "${match.home_team?.name} vs ${match.away_team?.name}" maçının dağıtılan TÜM PUANLARI menajerlerden geri alınacaktır!\n\n• Kazanan kuponların kazançları profillerden düşülecektir.\n• Kuponlar tekrar 'bekliyor' (pending) durumuna alınacaktır.\n• Maç tekrar oynanmamış hale getirilecektir.\n\nOnaylıyor musunuz?`,
      async () => {
        const { data, error } = await api.rpc('admin_revert_match', { p_match_id: match.id });
        if (error) {
          showNotice('Hata: ' + error.message);
          return;
        }
        showNotice('✅ Dağıtılan tüm puanlar başarıyla geri alındı, öngörüler sıfırlandı ve maç bültene döndürüldü.');
        fetchMatches();
        fetchBets();
        fetchProfiles();
        fetchLeagueSettings();
      }
    );
  };

  const handleCancelMatchAndRefund = (match) => {
    showConfirm(
      `🛑 "${match.home_team?.name} vs ${match.away_team?.name}" maçı iptal edilsin mi?\n\nBu maça öngörü yapan tüm menajerlere yatırdıkları puanlar eksiksiz iade edilecek ve maç sıfırlanacaktır.`,
      async () => {
        const { data, error } = await api.rpc('admin_cancel_match_and_refund', { p_match_id: match.id });
        if (error) {
          showNotice('Hata: ' + error.message);
          return;
        }
        showNotice('✅ Maç iptal edildi ve tüm menajerlere puanları iade edildi.');
        fetchMatches();
        fetchBets();
        fetchProfiles();
      }
    );
  };

  const calculateOdds = (homeVal, awayVal) => {
    const adjustedHome = homeVal * 1.15;
    const total = adjustedHome + awayVal;
    let pHome = adjustedHome / total;
    let pAway = awayVal / total;
    let pDraw = 0.26;
    const factor = 1 - pDraw;
    pHome = pHome * factor;
    pAway = pAway * factor;

    const oHome = Math.max(1.15, (0.90 / pHome)).toFixed(2);
    const oDraw = Math.max(2.40, (0.90 / pDraw)).toFixed(2);
    const oAway = Math.max(1.20, (0.90 / pAway)).toFixed(2);
    return { oHome, oDraw, oAway };
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
      showNotice('Lütfen iki farklı takım seçin.');
      return;
    }

    const tHome = teams.find(t => t.id === homeTeam);
    const tAway = teams.find(t => t.id === awayTeam);
    const { oHome, oDraw, oAway } = calculateOdds(tHome.squad_value, tAway.squad_value);

    await api.from('matches').insert({
      matchday: Number(matchday),
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      odds_home: oHome,
      odds_draw: oDraw,
      odds_away: oAway,
      is_banko: false
    });

    setHomeTeam('');
    setAwayTeam('');
    fetchMatches();
    showNotice('Maç fikstüre eklendi.');
  };

  const handleResetMatch = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (match) {
      handleRevertMatch(match);
    }
  };

  const handleDeleteMatch = (matchId) => {
    showConfirm('Bu maçı fikstürden tamamen silmek istiyor musunuz?', async () => {
      await api.from('matches').delete().eq('id', matchId);
      showNotice('Maç silindi.');
      fetchMatches();
    });
  };

  const toggleBanko = async (id, currentStatus) => {
    await api.from('matches').update({ is_banko: !currentStatus }).eq('id', id);
    fetchMatches();
  };

  const handleSettleMatch = async (match) => {
    const score = scores[match.id];
    if (!score || score.home === undefined || score.away === undefined) {
      showNotice('Lütfen iki takımın da skorunu girin!');
      return;
    }

    const h = Number(score.home);
    const a = Number(score.away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      showNotice('Geçerli skor girin.');
      return;
    }
    const { data: settled, error } = await api.rpc('admin_settle_match', {
      p_match_id: match.id, p_home_score: h, p_away_score: a,
    });
    if (error) {
      showNotice(error.message);
      return;
    }
    if (!settled) {
      showNotice('Bu maçın puanları daha önce dağıtılmış.');
      return;
    }
    const { data: settings } = await api.from('league_settings').select('*').eq('id', 1).single();
    if (settings?.active_matchday > match.matchday) {
      setActiveMatchday(settings.active_matchday);
      showNotice(`${match.matchday}. Hafta maçları bitti!\n${settings.active_matchday}. Hafta bültene yayınlandı.`);
    } else showNotice('Skor kaydedildi ve puanlar dağıtıldı!');

    fetchMatches();
    fetchBets();
    fetchProfiles();
  };

  const usedTeamIdsInMatchday = matches.reduce((acc, m) => {
    if (m.home_team_id) acc.push(m.home_team_id);
    if (m.away_team_id) acc.push(m.away_team_id);
    return acc;
  }, []);

  const availableHomeTeams = teams.filter(t => !usedTeamIdsInMatchday.includes(t.id));
  const availableAwayTeams = teams.filter(t => !usedTeamIdsInMatchday.includes(t.id) && t.id !== homeTeam);

  const filteredProfiles = profilesList.filter((p) =>
    adminSearchFilter ? p.username?.toLowerCase().includes(adminSearchFilter.toLowerCase()) : true
  );

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-xs font-mono text-[#71767b]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          Yönetici oturumu kontrol ediliyor...
        </div>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="relative group cursor-pointer z-10 transition-transform duration-300 ease-out hover:scale-105 active:scale-95">
            <div className="absolute -inset-6 bg-emerald-500/25 rounded-full blur-3xl group-hover:bg-emerald-400/40 transition-all duration-500"></div>
            <img
              src="/favicon.ico"
              onError={(e) => {
                if (!e.target.src.includes('icon.png')) e.target.src = '/icon.png';
              }}
              alt="Skaledler Maskot"
              className="relative w-56 h-56 sm:w-64 sm:h-64 object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)]"
            />
          </div>

          <div className="w-full bg-[#16181c]/90 backdrop-blur-md border border-[#2f3336] p-7 pt-9 rounded-3xl shadow-2xl space-y-4 -mt-10 relative z-20">
            {loginError && (
              <div className="p-3 bg-red-950/50 border border-red-800 text-red-400 text-xs rounded-xl text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-3.5">
              <div>
                <input
                  type="email"
                  placeholder="E-posta"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-black border border-[#2f3336] px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-white transition"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Şifre"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-black border border-[#2f3336] px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-white transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full bg-white hover:bg-neutral-200 text-black font-black py-3.5 rounded-xl text-xs uppercase font-mono tracking-wider transition shadow-lg mt-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmittingLogin ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href="/"
                className="text-xs text-[#71767b] hover:text-white transition"
              >
                Hesabın yok mu? <strong className="text-white underline">Kayıt Ol</strong>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto pb-20">
      {/* Şık Bildirim Modalı */}
      {modalMsg && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16181c] border border-[#2f3336] p-6 rounded-2xl w-full max-w-sm space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto text-xl font-bold">
              ℹ️
            </div>
            <p className="text-sm font-semibold text-white whitespace-pre-line">{modalMsg}</p>
            <div className="flex gap-2">
              {modalType === 'confirm' ? (
                <>
                  <button
                    onClick={() => setModalMsg('')}
                    className="flex-1 px-4 py-2 rounded-xl text-xs border border-[#2f3336] text-[#71767b] hover:text-white"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction) confirmAction();
                      setModalMsg('');
                    }}
                    className="flex-1 bg-white text-black py-2 rounded-xl text-xs font-bold font-mono"
                  >
                    Onayla
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setModalMsg('')}
                  className="w-full bg-white text-black py-2 rounded-xl text-xs font-bold font-mono"
                >
                  Tamam
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Üst Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#2f3336] pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-[#71767b]">SKALEDLER LİGİ YÖNETİMİ</span>
            <span className="text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
              🛡️ @{profile.username}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">YÖNETİM PANELİ</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-xl text-xs font-bold font-mono transition"
          >
            ← ANA SAYFAYA DÖN
          </Link>
          <button
            onClick={handleAdminSignOut}
            className="bg-[#16181c] hover:bg-neutral-800 border border-[#2f3336] text-[#71767b] hover:text-white px-3 py-2 rounded-xl text-xs font-mono transition"
            title="Oturumu Kapat"
          >
            ÇIKIŞ YAP
          </button>
        </div>
      </div>

      {/* Günün Sözleri Yönetimi */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">💬 Menajer Sözleri Yönetimi</h2>
        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
          {quotesList.length === 0 ? (
            <p className="text-xs text-[#71767b]">Şu an yayında söz bulunmuyor.</p>
          ) : (
            quotesList.map((q) => (
              <div key={q.id} className="border border-[#2f3336] p-2.5 rounded-lg flex items-center justify-between text-xs bg-black/40">
                <div className="space-y-0.5">
                  <span className="font-bold text-white">@{q.profile?.username}</span>
                  <p className="text-gray-300 italic">"{q.quote}"</p>
                </div>
                <button
                  onClick={() => handleDeleteQuote(q.id)}
                  className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 px-2.5 py-1 rounded text-[11px] font-mono"
                >
                  Sözü Sil (Hakkı İade Et)
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ana Sayfa Hafta Kontrolü */}
      <div className="bg-emerald-950/20 border border-emerald-500/30 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white font-mono uppercase">📢 Bülten Yayındaki Hafta</h2>
            <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
              Canlıda {activeMatchday}. Hafta Yayında
            </span>
          </div>
          <p className="text-xs text-[#71767b] mt-1 font-mono">
            Yayındaki Hafta: <strong className="text-emerald-400 font-mono text-sm">{activeMatchday}. Hafta</strong> (Menajerler şu an bu haftaya öngörü yapıyor)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleAdvanceToNextMatchday(activeMatchday)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition shadow-lg flex items-center gap-1.5 active:scale-95"
            title="Önceki haftanın puanlarını dağıtılmış sayar ve sonraki haftayı bültene açar"
          >
            ⏩ {activeMatchday}. Hafta Dağıtıldı, {Number(activeMatchday) + 1}. Haftaya Geç
          </button>

          <div className="flex items-center gap-1.5 bg-black border border-[#2f3336] p-1 rounded-xl">
            <span className="text-[11px] text-[#71767b] font-mono px-1.5">Hafta:</span>
            <input
              type="number"
              defaultValue={activeMatchday}
              key={activeMatchday}
              id="publishWeekInput"
              className="w-14 bg-transparent text-xs text-white text-center font-bold font-mono focus:outline-none"
            />
            <button
              onClick={() => {
                const val = document.getElementById('publishWeekInput').value;
                handleSetActiveMatchday(val);
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition"
            >
              Ayarla
            </button>
          </div>
        </div>
      </div>

      {/* Öngörü İptal & İade */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">🛑 Öngörü İptal & Puan İade Et</h2>
        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
          {activeBets.length === 0 ? (
            <p className="text-xs text-[#71767b]">Kayıtlı öngörü bulunmuyor.</p>
          ) : (
            activeBets.map((b) => (
              <div key={b.id} className="border border-[#2f3336] p-2.5 rounded-lg flex items-center justify-between text-xs bg-black/40">
                <div>
                  <span className="font-bold text-white">@{b.profile?.username}</span>
                  <span className="text-[#71767b] ml-2">
                    {b.match?.matchday}. Hafta: {b.match?.home_team?.name} vs {b.match?.away_team?.name} (MS {b.prediction})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-emerald-400 font-bold">{b.bet_amount} P</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-800 text-[#71767b]">
                    {b.status}
                  </span>
                  {b.status !== 'cancelled' && (
                    <button
                      onClick={() => handleCancelBet(b)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                        b.status === 'won'
                          ? 'bg-amber-950/60 hover:bg-amber-900 border-amber-800 text-amber-300'
                          : b.status === 'lost'
                          ? 'bg-blue-950/60 hover:bg-blue-900 border-blue-800 text-blue-300'
                          : 'bg-red-950/60 hover:bg-red-900 border-red-800 text-red-300'
                      }`}
                      title="Bu öngörüyü iptal et ve puanı iade et"
                    >
                      {b.status === 'won'
                        ? 'İptal & Kazancı Geri Al'
                        : b.status === 'lost'
                        ? 'İptal & Kaybı İade Et'
                        : 'İptal & İade Et'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Puan Ekle / Çıkar */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">💰 Menajer Puanı Ekle / Geri Al (Düş)</h2>
          <p className="text-[11px] text-[#71767b] mt-0.5 font-mono">
            Puan eklemek için pozitif (örn: <strong className="text-emerald-400">100</strong>), yanlış dağıtılan puanı geri almak için eksi (örn: <strong className="text-red-400">-100</strong>) yazın.
          </p>
        </div>
        <form onSubmit={handleAdjustPoints} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={selectedUserForPoint}
            onChange={(e) => setSelectedUserForPoint(e.target.value)}
            className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white"
            required
          >
            <option value="">Menajer Seç...</option>
            {profilesList.map(p => (
              <option key={p.id} value={p.id}>@{p.username} (Mevcut: {Number(p.balance).toFixed(2)} P)</option>
            ))}
          </select>

          <input
            type="number"
            step="any"
            placeholder="Puan (+100 veya -50)"
            value={pointDelta}
            onChange={(e) => setPointDelta(e.target.value)}
            className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white font-mono"
            required
          />

          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs font-mono transition">
            Puanı Uygula
          </button>
        </form>
      </div>

      {/* Yönetici (Admin) Yetki Yönetimi */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span>🛡️</span> Menajer Yönetici (Admin) Yetkileri & Yeni Yönetici Ekle
            </h2>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-bold">
              {profilesList.filter(p => p.is_admin).length} Yönetici Aktif
            </span>
          </div>
          <p className="text-[11px] text-[#71767b] mt-1 font-mono">
            Kayıt olan menajerlere buradan tek tıkla yönetici yetkisi verebilirsiniz. Yönetici yapılan kullanıcıların ana sayfasında sağ üst kısımda <strong className="text-white">"⚙ YÖNETİCİ PANELİNE GİR"</strong> butonu açılır.
          </p>
        </div>

        {/* 1. Yeni Yönetici Oluşturma Formu */}
        <div className="bg-black/50 border border-[#2f3336] p-4 rounded-xl space-y-3">
          <span className="text-[10px] text-white font-mono uppercase tracking-wider block font-bold">
            ➕ Yeni Yönetici Hesabı Oluştur
          </span>
          <form onSubmit={handleCreateNewAdmin} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="email"
              placeholder="E-posta (örn: admin2@gmail.com)"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
              required
            />
            <input
              type="text"
              placeholder="Menajer Adı (örn: admin2)"
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
              className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
              required
            />
            <input
              type="password"
              placeholder="Şifre (en az 8 karakter)"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
              required
            />
            <button
              type="submit"
              disabled={isCreatingAdmin}
              className="bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg text-xs font-mono transition"
            >
              {isCreatingAdmin ? 'Oluşturuluyor...' : '🛡️ Yeni Yönetici Kaydet'}
            </button>
          </form>
        </div>

        {/* 2. Kayıtlı Menajerler Listesi ve Yetki Verme */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] text-white font-mono uppercase tracking-wider font-bold">
              Kayıtlı Menajerler ({profilesList.length})
            </span>
            <input
              type="text"
              placeholder="Menajer ara..."
              value={adminSearchFilter}
              onChange={(e) => setAdminSearchFilter(e.target.value)}
              className="bg-black border border-[#2f3336] px-3 py-1.5 rounded-lg text-xs text-white placeholder-neutral-500 font-mono w-full sm:w-56 focus:outline-none focus:border-white"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {filteredProfiles.length === 0 ? (
              <p className="text-xs text-[#71767b] py-2">Eşleşen menajer bulunamadı.</p>
            ) : (
              filteredProfiles.map((p) => {
                const isCurrentSelf = p.id === profile.id;
                return (
                  <div
                    key={p.id}
                    className={`border p-3 rounded-lg flex items-center justify-between gap-3 text-xs transition ${
                      p.is_admin
                        ? 'border-emerald-900/60 bg-emerald-950/20'
                        : 'border-[#2f3336] bg-black/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-[#2f3336] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {p.username?.charAt(0)?.toUpperCase() || 'M'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate">@{p.username}</span>
                          {p.is_admin ? (
                            <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              🛡️ Yönetici
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[#71767b] bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
                              Menajer
                            </span>
                          )}
                          {isCurrentSelf && (
                            <span className="text-[10px] font-mono text-neutral-400 italic">
                              (Siz)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-[#71767b]">
                          Bakiye: <span className="text-emerald-400 font-bold">{Number(p.balance || 0).toFixed(2)} P</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isCurrentSelf ? (
                        <span className="text-[10px] font-mono text-[#71767b] px-2 py-1">Aktif Oturum</span>
                      ) : p.is_admin ? (
                        <button
                          onClick={() => handleToggleAdminRole(p)}
                          className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 px-3 py-1.5 rounded-lg text-[11px] font-mono transition"
                          title="Yöneticilik yetkisini geri al"
                        >
                          Yetkiyi Kaldır
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleAdminRole(p)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition flex items-center gap-1"
                          title="Bu kullanıcıyı yönetici yap"
                        >
                          🛡️ Yönetici Yap
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Takım Düzenleme Modalı */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16181c] border border-[#2f3336] p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="text-sm font-bold text-white uppercase font-mono">Takım Bilgilerini Düzenle</h3>
            <form onSubmit={handleSaveTeamEdit} className="space-y-3">
              <div>
                <label className="text-[10px] text-[#71767b] uppercase font-mono block mb-1">Takım Adı</label>
                <input
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  className="w-full bg-black border border-[#2f3336] px-3 py-2 rounded-lg text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-[#71767b] uppercase font-mono block mb-1">Menajer Nick'i</label>
                <input
                  type="text"
                  value={editingTeam.manager_name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, manager_name: e.target.value })}
                  className="w-full bg-black border border-[#2f3336] px-3 py-2 rounded-lg text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-[#71767b] uppercase font-mono block mb-1">Logo URL</label>
                <input
                  type="url"
                  value={editingTeam.logo_url || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, logo_url: e.target.value })}
                  className="w-full bg-black border border-[#2f3336] px-3 py-2 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#71767b] uppercase font-mono block mb-1">Kadro Değeri (M€)</label>
                <input
                  type="number"
                  value={editingTeam.squad_value}
                  onChange={(e) => setEditingTeam({ ...editingTeam, squad_value: e.target.value })}
                  className="w-full bg-black border border-[#2f3336] px-3 py-2 rounded-lg text-xs text-white font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-[#2f3336] text-[#71767b] hover:text-white"
                >
                  Vazgeç
                </button>
                <button type="submit" className="bg-white text-black px-4 py-1.5 rounded-lg text-xs font-bold font-mono">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Takım Ekleme */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">1. Lige Takım Ekle</h2>
        <form onSubmit={handleAddTeam} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Takım Adı"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white"
            required
          />
          <input
            type="text"
            placeholder="Menajer Nick'i"
            value={newManagerName}
            onChange={(e) => setNewManagerName(e.target.value)}
            className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white"
            required
          />
          <input
            type="url"
            placeholder="Logo Linki"
            value={newLogoUrl}
            onChange={(e) => setNewLogoUrl(e.target.value)}
            className="bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Değer (M€)"
              value={newInitialVal}
              onChange={(e) => setNewInitialVal(e.target.value)}
              className="w-24 bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white text-center font-mono"
            />
            <button type="submit" className="flex-1 bg-white hover:bg-neutral-200 text-black font-bold py-2.5 rounded-lg text-xs transition">
              Ekle
            </button>
          </div>
        </form>
      </div>

      {/* 2. Kadro Değerleri */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">2. Takımlar ve Kadro Değerleri</h2>
            <span className="text-[10px] text-emerald-400 font-mono">En Yüksekten En Düşüğe Sıralı</span>
          </div>
          <span className="text-[11px] text-[#71767b]">Değeri yazıp <strong>Enter</strong>'a bas.</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {teams.map((t) => (
            <div key={t.id} className="bg-black border border-[#2f3336] p-3 rounded-lg flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-[10px] flex-shrink-0">⚽</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate text-white">{t.name}</div>
                    <div className="text-[10px] text-[#71767b] truncate">@{t.manager_name}</div>
                  </div>
                </div>
                <button
                  onClick={() => setEditingTeam(t)}
                  className="text-xs text-[#71767b] hover:text-white p-1"
                  title="Düzenle"
                >
                  ✏️
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-[#2f3336]/50 pt-2">
                <span className="text-[10px] text-[#71767b] font-mono">KADRO:</span>
                <input
                  type="number"
                  defaultValue={t.squad_value}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFastValUpdate(t.id, e.target.value);
                      e.target.blur();
                    }
                  }}
                  className="w-20 bg-[#16181c] border border-[#2f3336] focus:border-white text-center p-1 rounded text-xs font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Fikstür Girişi */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">3. Fikstüre Maç Ekle</h2>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-[#71767b]">Düzenlenen Hafta:</span>
            <input
              type="number"
              value={matchday}
              onChange={(e) => setMatchday(Number(e.target.value))}
              className="w-16 bg-black border border-[#2f3336] p-1.5 rounded text-xs text-white text-center font-bold"
            />
          </div>
        </div>

        <form onSubmit={handleAddMatch} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-[#71767b] uppercase font-mono block mb-1">Ev Sahibi Takım</label>
            <select
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              className="w-full bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white focus:outline-none focus:border-white"
              required
            >
              <option value="">Ev Sahibi Seç...</option>
              {availableHomeTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name} (@{t.manager_name}) — {t.squad_value}M€</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[#71767b] uppercase font-mono block mb-1">Deplasman Takımı</label>
            <select
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              className="w-full bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white focus:outline-none focus:border-white"
              required
            >
              <option value="">Deplasman Seç...</option>
              {availableAwayTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name} (@{t.manager_name}) — {t.squad_value}M€</option>
              ))}
            </select>
          </div>

          <button type="submit" className="sm:col-span-2 bg-white hover:bg-neutral-200 text-black py-2.5 rounded-lg text-xs font-bold uppercase font-mono transition">
            Maçı {matchday}. Haftaya Kaydet
          </button>
        </form>
      </div>

      {/* 4. Skor Girişi ve Puan Dağıtımı */}
      <div className="bg-[#16181c] p-5 rounded-xl border border-[#2f3336] space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#2f3336]/60 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              {matchday}. Hafta Skorları & Puan Dağıtımı
            </h2>
            {matchday === activeMatchday && (
              <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                📢 Yayındaki Hafta
              </span>
            )}
            {matches.length > 0 && matches.every(m => m.is_finished) && (
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                ✓ Tüm Puanlar Dağıtıldı
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const prev = Math.max(1, Number(matchday) - 1);
                setMatchday(prev);
                fetchMatches(prev);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-black border border-[#2f3336] text-[#71767b] hover:text-white text-xs font-mono transition"
              title="Önceki Hafta"
            >
              ◀ Önceki
            </button>

            <div className="flex items-center gap-1.5 bg-black border border-[#2f3336] px-2 py-1 rounded-lg">
              <span className="text-[11px] font-mono text-[#71767b]">Hafta:</span>
              <select
                aria-label="Skor girilecek hafta"
                value={matchday}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  setMatchday(w);
                  fetchMatches(w);
                }}
                className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 37 }, (_, i) => i + 2).map((w) => (
                  <option key={w} value={w} className="bg-[#16181c] text-white">
                    {w}. Hafta {w === activeMatchday ? '(Yayında)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = Number(matchday) + 1;
                setMatchday(next);
                fetchMatches(next);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-black border border-[#2f3336] text-[#71767b] hover:text-white text-xs font-mono transition"
              title="Sonraki Hafta"
            >
              Sonraki ▶
            </button>
          </div>
        </div>

        {matches.length > 0 && matches.every(m => m.is_finished) && (
          <div className="bg-emerald-950/40 border border-emerald-500/50 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎉</span>
              <div>
                <div className="text-xs font-bold text-white font-mono">
                  {matchday}. HAFTANIN TÜM PUANLARI DAĞITILDI!
                </div>
                <div className="text-[11px] text-emerald-400 font-mono">
                  Bu haftanın tüm maçları tamamlandı. {Number(matchday) + 1}. haftayı bültene açıp menajerlerin öngörüsüne sunabilirsiniz.
                </div>
              </div>
            </div>
            <button
              onClick={() => handleAdvanceToNextMatchday(matchday)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-xs font-bold font-mono transition shadow-lg flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              ⏩ {matchday}. Hafta Dağıtıldı → {Number(matchday) + 1}. Haftaya Geç & Bülteni Aç
            </button>
          </div>
        )}
        
        {matches.length === 0 ? (
          <p className="text-xs text-[#71767b]">Bu haftaya ait maç bulunmuyor.</p>
        ) : (
          matches.map(m => (
            <div key={m.id} className="border border-[#2f3336] p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {m.home_team?.logo_url && <img src={m.home_team.logo_url} alt="" className="w-5 h-5 object-contain" />}
                <span className="font-bold text-white">{m.home_team?.name}</span>
                <span className="text-[#71767b]">vs</span>
                <span className="font-bold text-white">{m.away_team?.name}</span>
                {m.away_team?.logo_url && <img src={m.away_team.logo_url} alt="" className="w-5 h-5 object-contain" />}
              </div>

              {m.is_finished ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-emerald-400 font-mono font-bold">Tamamlandı ({m.home_score} - {m.away_score})</span>
                  <button
                    onClick={() => handleRevertMatch(m)}
                    className="bg-yellow-950/60 hover:bg-yellow-900 border border-yellow-800 text-yellow-300 px-2.5 py-1.5 rounded text-[11px] font-mono font-bold transition flex items-center gap-1"
                    title="Bu maçın dağıtılan puanlarını menajerlerden geri alır ve maçı tekrar skor girilebilir hale getirir"
                  >
                    🔄 Puanları Geri Al & Sıfırla
                  </button>
                  <button
                    onClick={() => handleCancelMatchAndRefund(m)}
                    className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 px-2 py-1.5 rounded text-[10px] font-mono transition"
                    title="Maçı iptal eder ve tüm kuponları iade eder"
                  >
                    🛑 Maçı İptal & İade Et
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Ev"
                    className="w-12 bg-black border border-[#2f3336] p-1.5 rounded text-center text-white font-mono"
                    onChange={(e) => setScores(prev => ({
                      ...prev,
                      [m.id]: { ...prev[m.id], home: e.target.value }
                    }))}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="Dep"
                    className="w-12 bg-black border border-[#2f3336] p-1.5 rounded text-center text-white font-mono"
                    onChange={(e) => setScores(prev => ({
                      ...prev,
                      [m.id]: { ...prev[m.id], away: e.target.value }
                    }))}
                  />
                  <button
                    onClick={() => handleSettleMatch(m)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded font-bold font-mono text-[11px]"
                  >
                    Puan Dağıt
                  </button>
                  <button
                    onClick={() => toggleBanko(m.id, m.is_banko)}
                    className={`px-2 py-1.5 rounded text-[10px] font-mono border ${m.is_banko ? 'bg-amber-500/20 text-amber-300 border-amber-500' : 'bg-black text-[#71767b] border-[#2f3336]'}`}
                  >
                    {m.is_banko ? '⭐ Banko' : 'Banko Yap'}
                  </button>
                  <button
                    onClick={() => handleDeleteMatch(m.id)}
                    className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-400 px-2.5 py-1.5 rounded text-[11px] font-mono"
                    title="Maçı Sil"
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
