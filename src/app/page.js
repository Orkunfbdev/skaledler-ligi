'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/client';
import { isPredictionsLocked, getPredictionStatusLabel } from '../lib/match-lock';
import Link from 'next/link';

const getOSMMatchDayKey = () => {
  const now = new Date();
  const trHour = parseInt(
    new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10
  );
  if (trHour < 18) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [pastMatches, setPastMatches] = useState([]);
  const [fixtureMatches, setFixtureMatches] = useState([]);
  const [fixtureWeek, setFixtureWeek] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [allQuotes, setAllQuotes] = useState([]);
  const [newQuote, setNewQuote] = useState('');
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [leagueSettings, setLeagueSettings] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [activeTab, setActiveTab] = useState('bulten');
  const [couponSubTab, setCouponSubTab] = useState('my');
  const [allBets, setAllBets] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(3);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Müzik State
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.25);

  // Modallar
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedManagerDetail, setSelectedManagerDetail] = useState(null);

  // Auth & Profil
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(14);
  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Öngörü State: Tekli veya Kombine Seçimleri
  const [betInputs, setBetInputs] = useState({});
  const [comboAmount, setComboAmount] = useState(50);

  const currentMatchDayKey = getOSMMatchDayKey();
  const registrationClosed = isRegistrationClosed || registeredCount >= 16 || leaderboard.length >= 16;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            const handleFirstInteraction = () => {
              if (audioRef.current) {
                audioRef.current.play();
                setIsPlaying(true);
              }
              window.removeEventListener('click', handleFirstInteraction);
            };
            window.addEventListener('click', handleFirstInteraction);
          });
      }
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlayMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  useEffect(() => {
    const checkLockStatus = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }));
      setIsLocked(isPredictionsLocked(leagueSettings));
    };

    checkLockStatus();
    const timer = setInterval(checkLockStatus, 1000);
    return () => clearInterval(timer);
  }, [leagueSettings]);

  // Periyodik olarak league_settings'i sorgula (Yönetici açtığında anında yansıması için)
  useEffect(() => {
    const syncSettings = async () => {
      const { data: setts } = await api.from('league_settings').select('*').eq('id', 1).single();
      if (setts) {
        setLeagueSettings(setts);
      }
    };
    const syncTimer = setInterval(syncSettings, 10000);
    return () => clearInterval(syncTimer);
  }, []);

  useEffect(() => {
    api.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null);
      if (data?.userCount !== undefined) {
        setRegisteredCount(data.userCount);
        if (data.userCount >= 16 || data.isRegistrationClosed) {
          setIsRegistrationClosed(true);
          setIsSignUp(false);
        }
      }
      if (data?.session?.user) {
        fetchProfile(data.session.user.id);
        checkIfPostedQuote(data.session.user.id);
      }
    });

    const { data: { subscription } } = api.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkIfPostedQuote(session.user.id);
      }
    });

    fetchData();
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await api.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setEditUsername(data.username || '');
      setEditAvatar(data.avatar_url || '');
    }
  };

  const checkIfPostedQuote = async (userId) => {
    const { data } = await api
      .from('daily_quotes')
      .select('id')
      .eq('user_id', userId)
      .eq('created_at', currentMatchDayKey);
    setHasPostedToday(Boolean(data && data.length > 0));
  };

  const fetchData = async () => {
    let activeW = 3;
    const { data: setts } = await api.from('league_settings').select('*').eq('id', 1).single();
    if (setts) {
      setLeagueSettings(setts);
      if (setts.active_matchday) {
        activeW = Number(setts.active_matchday);
        setCurrentWeek(activeW);
      }
    }

    // Aktif Haftanın Maçları
    const { data: matchesData } = await api
      .from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('matchday', Number(activeW))
      .eq('is_finished', false)
      .order('is_banko', { ascending: false });
    if (matchesData) setMatches(matchesData);

    // Geçmiş Haftaların Tamamlanan Maçları
    const { data: pastMatchesData } = await api
      .from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('is_finished', true)
      .order('matchday', { ascending: false });
    if (pastMatchesData) setPastMatches(pastMatchesData);

    const { data: fixtureData } = await api
      .from('matches')
      .select('id, matchday, home_score, away_score, is_finished, home_team:home_team_id(name, manager_name, logo_url), away_team:away_team_id(name, manager_name, logo_url)')
      .order('matchday', { ascending: true });
    if (fixtureData) setFixtureMatches(fixtureData);

    const { data: leaders } = await api
      .from('profiles')
      .select('*')
      .order('balance', { ascending: false });
    if (leaders) {
      setLeaderboard(leaders);
      setRegisteredCount(leaders.length);
      if (leaders.length >= 16) {
        setIsRegistrationClosed(true);
        setIsSignUp(false);
      }
    }

    const { data: quotesData } = await api
      .from('daily_quotes')
      .select('*, profile:user_id(username, avatar_url, balance)')
      .eq('created_at', currentMatchDayKey)
      .order('created_at', { ascending: false });
    if (quotesData) setAllQuotes(quotesData);

    const { data: betsData } = await api
      .from('bets')
      .select('*, profile:user_id(username, avatar_url), match:match_id(matchday, home_team:home_team_id(*), away_team:away_team_id(*))')
      .order('created_at', { ascending: false });
    if (betsData) setAllBets(betsData);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!registrationClosed && isSignUp) {
      const { error } = await api.auth.signUp({
        email,
        password,
        options: { data: { username, adminCode } }
      });
      if (error) alert(error.message);
      else {
        alert('Menajer kaydınız oluşturuldu!');
        setIsSignUp(false);
        fetchData();
        const { data } = await api.auth.getSession();
        if (data?.userCount !== undefined) {
          setRegisteredCount(data.userCount);
          if (data.userCount >= 16 || data.isRegistrationClosed) {
            setIsRegistrationClosed(true);
          }
        }
      }
    } else {
      const { error } = await api.auth.signInWithPassword({ email, password });
      if (error) alert('Giriş başarısız: ' + error.message);
    }
  };

  const handleFileUpload = async (event) => {
    try {
      setUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: upload, error: uploadError } = await api.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      setEditAvatar(upload.publicUrl);
    } catch (error) {
      alert('Resim yüklenirken hata oluştu: ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile) return;
    const { error } = await api.from('profiles').update({
      username: editUsername.trim(),
      avatar_url: editAvatar.trim()
    }).eq('id', profile.id);

    if (error) alert('Hata: ' + error.message);
    else {
      setIsSettingsOpen(false);
      fetchProfile(profile.id);
      fetchData();
    }
  };

  const claimDailyReward = async () => {
    if (!profile || isDailyClaimed) return;

    const { error } = await api
      .from('profiles')
      .update({
        balance: Number(profile.balance) + 100,
        last_daily_claim: currentMatchDayKey
      })
      .eq('id', profile.id);

    if (!error) {
      fetchProfile(profile.id);
      fetchData();
    }
  };

  const handlePostQuote = async (e) => {
    e.preventDefault();
    if (!newQuote.trim() || hasPostedToday) return;

    const { error } = await api.from('daily_quotes').insert({
      user_id: profile.id,
      quote: newQuote.trim(),
      created_at: currentMatchDayKey
    });

    if (!error) {
      setNewQuote('');
      setHasPostedToday(true);
      fetchData();
    }
  };

  const handleSelectPrediction = (matchId, prediction, odds, matchObj) => {
    if (isLocked && !profile?.is_admin) {
      alert('Günün maçları için öngörüler kapalıdır.');
      return;
    }

    setBetInputs(prev => {
      const cur = prev[matchId];
      if (cur?.prediction === prediction) {
        const copy = { ...prev };
        delete copy[matchId];
        return copy;
      }
      return {
        ...prev,
        [matchId]: {
          prediction,
          odds: Number(odds),
          amount: cur?.amount || 50,
          matchDetails: matchObj
        }
      };
    });
  };

  // Tekli Öngörü Onaylama
  const handleConfirmSingleBet = async (matchId) => {
    if (isLocked && !profile?.is_admin) {
      alert('Günün maçları için öngörüler kapalıdır.');
      return;
    }

    const currentBet = betInputs[matchId];
    if (!currentBet || !currentBet.amount || currentBet.amount <= 0) {
      alert('Lütfen geçerli bir puan miktarı girin.');
      return;
    }

    const cost = Number(currentBet.amount);
    if (cost > profile.balance) {
      alert(`Yetersiz bakiye! Mevcut bakiyeniz: ${profile.balance} P`);
      return;
    }

    const { error } = await api.from('bets').insert({
      user_id: profile.id,
      match_id: matchId,
      prediction: currentBet.prediction,
      bet_amount: cost,
      odds: Number(currentBet.odds),
      status: 'pending',
      bet_type: 'single'
    });

    if (!error) {
      await api.from('profiles').update({ balance: profile.balance - cost }).eq('id', profile.id);
      setBetInputs(prev => {
        const copy = { ...prev };
        delete copy[matchId];
        return copy;
      });
      setShowSuccessModal(true);
      fetchProfile(profile.id);
      fetchData();
    } else {
      alert('Hata oluştu: ' + error.message);
    }
  };

  // Kombine Öngörü Onaylama (Tüm Seçilen Maçları Birleştirme)
  const handleConfirmComboBet = async () => {
    if (isLocked && !profile?.is_admin) {
      alert('Günün maçları için öngörüler kapalıdır.');
      return;
    }

    const selectedKeys = Object.keys(betInputs);
    if (selectedKeys.length < 2) {
      alert('Kombine öngörü için en az 2 maç seçmelisiniz.');
      return;
    }

    const cost = Number(comboAmount);
    if (cost <= 0) {
      alert('Lütfen geçerli bir puan miktarı girin.');
      return;
    }

    if (cost > profile.balance) {
      alert(`Yetersiz bakiye! Mevcut bakiyeniz: ${profile.balance} P`);
      return;
    }

    // Toplam Kombine Oranı (Tüm oranların çarpımı)
    const totalOdds = selectedKeys.reduce((acc, id) => acc * Number(betInputs[id].odds), 1);
    const roundedOdds = Number(totalOdds.toFixed(2));

    const comboMatches = selectedKeys.map(id => ({
      match_id: id,
      prediction: betInputs[id].prediction,
      odds: betInputs[id].odds,
      home: betInputs[id].matchDetails?.home_team?.name,
      away: betInputs[id].matchDetails?.away_team?.name
    }));

    const { error } = await api.from('bets').insert({
      user_id: profile.id,
      prediction: 'KOMBO',
      bet_amount: cost,
      odds: roundedOdds,
      status: 'pending',
      bet_type: 'combo',
      combo_details: comboMatches
    });

    if (!error) {
      await api.from('profiles').update({ balance: profile.balance - cost }).eq('id', profile.id);
      setBetInputs({});
      setShowSuccessModal(true);
      fetchProfile(profile.id);
      fetchData();
    } else {
      alert('Hata oluştu: ' + error.message);
    }
  };

  const isDailyClaimed = profile?.last_daily_claim === currentMatchDayKey;
  const myBets = allBets.filter(b => b.user_id === profile?.id);
  const fixtureWeeks = [...new Set(fixtureMatches.map(m => Number(m.matchday)))].sort((a, b) => a - b);
  const selectedFixtureWeek = fixtureWeeks.includes(Number(fixtureWeek)) ? Number(fixtureWeek) :
    fixtureWeeks.includes(Number(currentWeek)) ? Number(currentWeek) : fixtureWeeks[0];
  const selectedFixtures = fixtureMatches.filter(m => Number(m.matchday) === Number(selectedFixtureWeek));

  // Kombine Oranı Hesabı
  const selectedCount = Object.keys(betInputs).length;
  const comboTotalOdds = selectedCount >= 2 
    ? Object.values(betInputs).reduce((acc, item) => acc * Number(item.odds), 1).toFixed(2) 
    : 0;

  // Menajer İstatistik Hesaplayıcı
  const getManagerStats = (managerId) => {
    const managerBets = allBets.filter(b => b.user_id === managerId);
    const totalBets = managerBets.length;
    const wonBets = managerBets.filter(b => b.status === 'won').length;
    const winRate = totalBets > 0 ? ((wonBets / totalBets) * 100).toFixed(0) : 0;
    return { totalBets, wonBets, winRate };
  };

  const MusicPlayerWidget = () => (
    <div className="bg-[#16181c] border border-[#2f3336] p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-3 shadow-xl max-w-full overflow-hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={togglePlayMusic}
          className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition shadow-lg active:scale-95 flex-shrink-0"
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1"></rect>
              <rect x="14" y="4" width="4" height="16" rx="1"></rect>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"></path>
            </svg>
          )}
        </button>
        <div className="min-w-0">
          <div className="text-[11px] font-black tracking-wider text-white uppercase font-mono flex items-center gap-1.5 truncate">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`}></span>
            SKALEDLER
          </div>
          <span className="text-[9px] text-[#71767b] font-mono block">
            {isPlaying ? 'Çalıyor' : 'Durduruldu'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-[#71767b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-14 sm:w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] font-sans antialiased pb-12">
      <audio ref={audioRef} src="/music.mp3" loop autoPlay />

      {/* Üst Bar */}
      <header className="px-6 py-5 border-b border-[#2f3336] sticky top-0 bg-black/90 backdrop-blur-md z-30 flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white whitespace-nowrap">
            SKALEDLER LİGİ
          </h1>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            {profile?.is_admin && (
              <Link
                href="/admin"
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold transition flex items-center gap-1.5"
              >
                ⚙ YÖNETİCİ PANELİNE GİR
              </Link>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2.5 bg-[#16181c] hover:bg-[#202327] border border-[#2f3336] px-3 py-1.5 rounded-full transition"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold">
                  {profile?.username?.charAt(0)?.toUpperCase() || 'M'}
                </div>
              )}
              <span className="text-xs font-bold text-white">@{profile?.username}</span>
              <span className="text-xs font-mono text-emerald-400 font-bold ml-1">
                {Number(profile?.balance || 0).toFixed(2)} P
              </span>
            </button>

            <button
              onClick={() => api.auth.signOut()}
              className="text-xs font-semibold bg-[#16181c] hover:bg-[#202327] border border-[#2f3336] px-3 py-1.5 rounded-full transition"
            >
              Çıkış
            </button>
          </div>
        ) : (
          <div className="w-56 sm:w-64">
            <MusicPlayerWidget />
          </div>
        )}
      </header>

      {/* Menajer Profil & İstatistik Detay Modalı */}
      {selectedManagerDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16181c] border border-[#2f3336] p-6 rounded-3xl w-full max-w-sm space-y-5 text-center shadow-2xl relative">
            <button
              onClick={() => setSelectedManagerDetail(null)}
              className="absolute top-4 right-4 text-[#71767b] hover:text-white text-lg"
            >
              ✕
            </button>

            <div className="flex flex-col items-center gap-3">
              {selectedManagerDetail.avatar_url ? (
                <img src={selectedManagerDetail.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center text-2xl font-bold text-white border-2 border-[#2f3336]">
                  {selectedManagerDetail.username?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-lg font-black text-white flex items-center justify-center gap-1.5">
                  @{selectedManagerDetail.username}
                  {leaderboard[0]?.id === selectedManagerDetail.id && <span title="Lig Lideri">👑</span>}
                </h3>
                <span className="text-sm font-mono text-emerald-400 font-bold">
                  {Number(selectedManagerDetail.balance).toFixed(2)} Puan
                </span>
              </div>
            </div>

            {/* İstatistik Kartları */}
            {(() => {
              const stats = getManagerStats(selectedManagerDetail.id);
              return (
                <div className="grid grid-cols-3 gap-2 border-t border-[#2f3336] pt-4 font-mono">
                  <div className="bg-black/50 border border-[#2f3336] p-2.5 rounded-xl">
                    <span className="text-[10px] text-[#71767b] block">TOPLAM</span>
                    <strong className="text-sm text-white">{stats.totalBets}</strong>
                  </div>
                  <div className="bg-black/50 border border-[#2f3336] p-2.5 rounded-xl">
                    <span className="text-[10px] text-emerald-400 block">TUTAN</span>
                    <strong className="text-sm text-emerald-400">{stats.wonBets}</strong>
                  </div>
                  <div className="bg-black/50 border border-[#2f3336] p-2.5 rounded-xl">
                    <span className="text-[10px] text-amber-400 block">BAŞARI</span>
                    <strong className="text-sm text-amber-400">%{stats.winRate}</strong>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setSelectedManagerDetail(null)}
              className="w-full bg-white hover:bg-neutral-200 text-black py-2.5 rounded-xl text-xs font-bold font-mono uppercase transition"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Öngörü Başarı Modalı */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16181c] border border-[#2f3336] p-6 rounded-2xl w-full max-w-sm space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Öngörü Kaydedildi!</h3>
              <p className="text-xs text-[#71767b] mt-1">Öngörünüz başarıyla kaydedildi. Öngörüler sekmesinden takip edebilirsiniz.</p>
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-white hover:bg-neutral-200 text-black py-2.5 rounded-xl text-xs font-bold uppercase font-mono transition"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      {/* Profil Düzenleme Modalı */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16181c] border border-[#2f3336] p-6 rounded-2xl w-full max-w-sm space-y-5">
            <h3 className="text-base font-bold text-white">Menajer Ayarları</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-[#71767b] uppercase block mb-1">Menajer Nick'in</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-black border border-[#2f3336] px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-[#71767b] uppercase block">Profil Fotoğrafı</label>
                <div className="flex items-center gap-3">
                  {editAvatar ? (
                    <img src={editAvatar} alt="" className="w-12 h-12 rounded-full object-cover border border-[#2f3336]" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-[#71767b]">
                      Resim Yok
                    </div>
                  )}

                  <label className="cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2">
                    <span>{uploadingAvatar ? 'Yükleniyor...' : '📁 Dosya Seç'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploadingAvatar}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#2f3336]">
                <button
                  type="button"
                  onClick={async () => {
                    await api.auth.signOut();
                    setUser(null);
                    setProfile(null);
                    setIsSettingsOpen(false);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 font-mono transition"
                >
                  🚪 Çıkış Yap
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs border border-[#2f3336] text-[#71767b] hover:text-white"
                  >
                    İptal
                  </button>
                  <button type="submit" className="bg-white text-black px-5 py-2 rounded-xl text-xs font-bold">
                    Kaydet
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GİRİŞ EKRANI */}
      {!user ? (
        <div className="min-h-[82vh] flex items-center justify-center p-4">
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
              <form onSubmit={handleAuth} className="space-y-3.5">
                {!registrationClosed && isSignUp && (
                  <div>
                    <input
                      type="text"
                      placeholder="Menajer Adı (Nick)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-black border border-[#2f3336] px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-white transition"
                      required
                    />
                  </div>
                )}
                <div>
                  <input
                    type="email"
                    placeholder="E-posta"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-[#2f3336] px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-white transition"
                    required
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Şifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-[#2f3336] px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-white transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-white hover:bg-neutral-200 text-black font-black py-3.5 rounded-xl text-xs uppercase font-mono tracking-wider transition shadow-lg mt-2 active:scale-95"
                >
                  {!registrationClosed && isSignUp ? 'Kayıt Ol' : 'Giriş Yap'}
                </button>
              </form>

              {registrationClosed ? (
                <div className="pt-2 text-center flex flex-col items-center gap-1.5">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-mono font-semibold">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span>KAYITLAR KAPANDI ({Math.max(registeredCount, leaderboard.length || 16)}/16)</span>
                  </div>
                  <p className="text-[11px] text-[#71767b] mt-1">16 menajer kontenjanı dolmuştur, yalnızca kayıtlı menajerler giriş yapabilir.</p>
                </div>
              ) : (
                <div className="pt-2 text-center space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-[#71767b] hover:text-white transition"
                  >
                    {isSignUp ? 'Zaten hesabın var mı? ' : 'Hesabın yok mu? '}
                    <strong className="text-white underline">{isSignUp ? 'Giriş Yap' : 'Kayıt Ol'}</strong>
                  </button>
                  <div className="flex items-center justify-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                      <span>Son {Math.max(0, 16 - (registeredCount || leaderboard.length || 14))} Kontenjan ({Math.min(16, registeredCount || leaderboard.length || 14)}/16)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#71767b] text-center max-w-xs mt-3 leading-normal">
              🎮 Bu platform arkadaşlar arası eğlence amaçlı bir tahmin ligidir. Gerçek para yatırma veya çekme kesinlikle yoktur.
            </p>
          </div>
        </div>
      ) : (
        /* LİG EKRANI */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Sol Kolon */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-[#16181c] border border-[#2f3336] p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono uppercase text-[#71767b] tracking-wider block">GÜNÜN MENAJER SÖZÜ</span>
              {hasPostedToday ? (
                <div className="text-xs text-[#71767b] italic py-3 bg-black/40 border border-[#2f3336] rounded-lg text-center">
                  Bugünkü sözünüzü paylaştınız. Saat 18:00 maç saatinden sonra yeni maç günü hakkınız açılacak.
                </div>
              ) : (
                <form onSubmit={handlePostQuote} className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Rakiplere bugünlük mesajını bırak (Günde 1 kez)..."
                    value={newQuote}
                    onChange={(e) => setNewQuote(e.target.value)}
                    maxLength={100}
                    className="w-full bg-black border border-[#2f3336] p-2.5 rounded-lg text-xs text-white focus:outline-none focus:border-white resize-none"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#71767b]">{100 - newQuote.length} karakter</span>
                    <button
                      type="submit"
                      className="bg-white hover:bg-neutral-200 text-black px-4 py-1.5 rounded-lg text-xs font-bold font-mono transition"
                    >
                      PAYLAŞ
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-[#16181c] border border-[#2f3336] rounded-xl p-4 space-y-4">
              <span className="text-[10px] font-mono uppercase text-[#71767b] tracking-wider block">BUGÜNÜN SÖZLERİ & PUANLAR</span>
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {allQuotes.length === 0 ? (
                  <div className="text-xs text-[#71767b] py-6 text-center">Bugünkü maç günü için henüz kimse söz yazmadı.</div>
                ) : (
                  allQuotes.map((q) => (
                    <div key={q.id} className="border-b border-[#2f3336]/60 pb-3 last:border-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {q.profile?.avatar_url ? (
                            <img src={q.profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[9px] font-bold">
                              {q.profile?.username?.charAt(0)?.toUpperCase() || 'M'}
                            </div>
                          )}
                          <span className="text-xs font-bold text-white">@{q.profile?.username}</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-400">
                          {Number(q.profile?.balance || 0).toFixed(0)} P
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 pl-7">"{q.quote}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <MusicPlayerWidget />

          </div>

          {/* Sağ Kolon */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-[#16181c] border border-[#2f3336] p-4 rounded-xl gap-4">
              <div className="flex items-center gap-3 text-xs">
                <div className="bg-black border border-[#2f3336] px-3 py-1 rounded-lg font-mono font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {currentTimeStr || '18:00:00'}
                </div>

                <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] uppercase border font-bold ${isLocked ? 'bg-red-950/50 border-red-800 text-red-400' : 'bg-emerald-950/50 border-emerald-800 text-emerald-400'}`}>
                  {getPredictionStatusLabel(leagueSettings)}
                </span>
              </div>

              {isDailyClaimed ? (
                <button
                  disabled
                  className="w-full sm:w-auto bg-[#16181c] border border-[#2f3336] text-[#71767b] px-4 py-2 rounded-xl text-xs font-bold font-mono cursor-not-allowed opacity-60"
                >
                  ✓ BUGÜNKÜ 100 PUAN ALINDI
                </button>
              ) : (
                <button
                  onClick={claimDailyReward}
                  className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition font-mono"
                >
                  GÜNLÜK 100 PUANI AL
                </button>
              )}
            </div>

            {/* Sekmeler (Geçmiş Haftalar Eklendi) */}
            <div className="flex border-b border-[#2f3336] text-xs font-bold">
              <button
                onClick={() => setActiveTab('bulten')}
                className={`flex-1 py-3 text-center transition border-b-2 ${activeTab === 'bulten' ? 'border-white text-white' : 'border-transparent text-[#71767b] hover:text-white'}`}
              >
                BÜLTEN ({currentWeek}. HAFTA)
              </button>
              <button
                onClick={() => setActiveTab('ongoruler')}
                className={`flex-1 py-3 text-center transition border-b-2 ${activeTab === 'ongoruler' ? 'border-white text-white' : 'border-transparent text-[#71767b] hover:text-white'}`}
              >
                ÖNGÖRÜLER
              </button>
              <button
                onClick={() => setActiveTab('liderlik')}
                className={`flex-1 py-3 text-center transition border-b-2 ${activeTab === 'liderlik' ? 'border-white text-white' : 'border-transparent text-[#71767b] hover:text-white'}`}
              >
                LİG SIRALAMASI
              </button>
              <button
                onClick={() => setActiveTab('gecmis')}
                className={`flex-1 py-3 text-center transition border-b-2 ${activeTab === 'gecmis' ? 'border-white text-white' : 'border-transparent text-[#71767b] hover:text-white'}`}
              >
                GEÇMİŞ HAFTALAR
              </button>
              <button
                onClick={() => setActiveTab('fikstur')}
                className={`flex-1 py-3 text-center transition border-b-2 ${activeTab === 'fikstur' ? 'border-white text-white' : 'border-transparent text-[#71767b] hover:text-white'}`}
              >
                FİKSTÜR
              </button>
            </div>

            {/* Bülten */}
            {activeTab === 'bulten' && (
              <div className="space-y-4">
                {currentWeek > 1 && pastMatches.length > 0 && (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[#71767b] flex items-center gap-1.5">
                      <span>📢</span>
                      <span>
                        <strong className="text-white">{currentWeek - 1}. Hafta</strong> puanları dağıtıldı. Şu an <strong className="text-emerald-400 font-bold">{currentWeek}. Hafta</strong> bülteni açık!
                      </span>
                    </span>
                    <button
                      onClick={() => setActiveTab('gecmis')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition self-end sm:self-auto"
                    >
                      Geçmiş Sonuçlar →
                    </button>
                  </div>
                )}
                {matches.length === 0 ? (
                  <div className="text-center py-16 text-[#71767b] text-xs">
                    {currentWeek}. Hafta için yayında bir maç bulunmuyor.
                  </div>
                ) : (
                  matches.map((m) => {
                    const sel = betInputs[m.id];
                    const is1 = sel?.prediction === '1';
                    const is0 = sel?.prediction === '0';
                    const is2 = sel?.prediction === '2';

                    return (
                      <div key={m.id} className="bg-[#16181c] border border-[#2f3336] p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono text-[#71767b] uppercase">{m.matchday}. HAFTA</span>
                          {m.is_banko && (
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white text-black font-bold">
                              ⭐ GÜNÜN BANKOSU
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 py-1">
                          <div className="flex items-center gap-3 flex-1 justify-end text-right">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">{m.home_team?.name}</div>
                              <div className="text-[11px] text-[#71767b] truncate">@{m.home_team?.manager_name}</div>
                            </div>
                            {m.home_team?.logo_url ? (
                              <img src={m.home_team.logo_url} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-xs flex-shrink-0">⚽</div>
                            )}
                          </div>

                          <span className="px-3 text-xs font-mono text-[#71767b]">VS</span>

                          <div className="flex items-center gap-3 flex-1 justify-start text-left">
                            {m.away_team?.logo_url ? (
                              <img src={m.away_team.logo_url} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-xs flex-shrink-0">⚽</div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">{m.away_team?.name}</div>
                              <div className="text-[11px] text-[#71767b] truncate">@{m.away_team?.manager_name}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSelectPrediction(m.id, '1', m.odds_home, m)}
                            className={`py-2 px-3 rounded-lg border text-xs font-mono flex flex-col items-center transition cursor-pointer ${is1 ? 'bg-white text-black border-white font-bold' : 'bg-black border-[#2f3336] text-[#71767b] hover:border-neutral-400 hover:text-white'}`}
                          >
                            <span className="text-[9px] uppercase">MS 1</span>
                            <span className="text-sm font-bold mt-0.5">{m.odds_home}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectPrediction(m.id, '0', m.odds_draw, m)}
                            className={`py-2 px-3 rounded-lg border text-xs font-mono flex flex-col items-center transition cursor-pointer ${is0 ? 'bg-white text-black border-white font-bold' : 'bg-black border-[#2f3336] text-[#71767b] hover:border-neutral-400 hover:text-white'}`}
                          >
                            <span className="text-[9px] uppercase">MS 0</span>
                            <span className="text-sm font-bold mt-0.5">{m.odds_draw}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectPrediction(m.id, '2', m.odds_away, m)}
                            className={`py-2 px-3 rounded-lg border text-xs font-mono flex flex-col items-center transition cursor-pointer ${is2 ? 'bg-white text-black border-white font-bold' : 'bg-black border-[#2f3336] text-[#71767b] hover:border-neutral-400 hover:text-white'}`}
                          >
                            <span className="text-[9px] uppercase">MS 2</span>
                            <span className="text-sm font-bold mt-0.5">{m.odds_away}</span>
                          </button>
                        </div>

                        {/* Tekli Oynama Alanı */}
                        {sel && (
                          <div className="pt-3 border-t border-[#2f3336] space-y-2 bg-black/40 p-3 rounded-lg">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-[#71767b]">Tekli Öngörü: <strong className="text-white">MS {sel.prediction}</strong> ({sel.odds})</span>
                              <span className="text-emerald-400 font-bold">
                                Kazanç: {(Number(sel.amount || 0) * sel.odds).toFixed(2)} P
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#71767b] font-mono">PUAN:</span>
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={sel.amount}
                                onChange={(e) => setBetInputs(prev => ({
                                  ...prev,
                                  [m.id]: { ...prev[m.id], amount: Number(e.target.value) }
                                }))}
                                className="w-24 bg-black border border-[#2f3336] px-2.5 py-1.5 rounded-lg text-xs font-mono text-white text-center focus:outline-none focus:border-white"
                              />
                              <button
                                onClick={() => handleConfirmSingleBet(m.id)}
                                className="flex-1 bg-white hover:bg-neutral-200 text-black py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition uppercase"
                              >
                                Tekli Öngörüyü Onayla
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* KOMBİNE ÖNGÖRÜ KARTI: En az 2 maç seçildiğinde ekranın altında belirir */}
                {selectedCount >= 2 && !isLocked && (
                  <div className="sticky bottom-4 z-30 bg-[#16181c]/95 backdrop-blur-md border-2 border-emerald-500/40 p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                          🔥 {selectedCount} MAÇLIK KOMBİNE ÖNGÖRÜ
                        </span>
                        <span className="text-xs font-mono text-[#71767b]">Toplam Oran: <strong className="text-white text-sm">{comboTotalOdds}</strong></span>
                      </div>
                      <span className="text-[11px] text-[#71767b] block mt-0.5">
                        Tüm maçlar tutarsa: <strong className="text-emerald-400 font-mono">{(comboAmount * comboTotalOdds).toFixed(2)} Puan</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-mono text-[#71767b]">PUAN:</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={comboAmount}
                        onChange={(e) => setComboAmount(Number(e.target.value))}
                        className="w-20 bg-black border border-[#2f3336] px-2.5 py-2 rounded-xl text-xs font-mono text-white text-center focus:outline-none focus:border-white"
                      />
                      <button
                        onClick={handleConfirmComboBet}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-5 py-2 rounded-xl text-xs uppercase font-mono transition shadow-lg active:scale-95"
                      >
                        Kombineyi Onayla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Öngörüler Sekmesi */}
            {activeTab === 'ongoruler' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCouponSubTab('my')}
                    className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition ${couponSubTab === 'my' ? 'bg-white text-black' : 'bg-[#16181c] text-[#71767b] hover:text-white border border-[#2f3336]'}`}
                  >
                    BENİM ÖNGÖRÜLERİM ({myBets.length})
                  </button>
                  <button
                    onClick={() => setCouponSubTab('all')}
                    className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition ${couponSubTab === 'all' ? 'bg-white text-black' : 'bg-[#16181c] text-[#71767b] hover:text-white border border-[#2f3336]'}`}
                  >
                    TÜM ÖNGÖRÜLER (AFİŞE PANOSU)
                  </button>
                </div>

                {couponSubTab === 'my' && (
                  <div className="space-y-3">
                    {myBets.length === 0 ? (
                      <div className="text-center py-16 text-[#71767b] text-xs">Henüz kaydettiğiniz bir öngörü bulunmuyor.</div>
                    ) : (
                      myBets.map((b) => (
                        <div key={b.id} className="bg-[#16181c] border border-[#2f3336] p-4 rounded-xl flex items-center justify-between text-xs">
                          <div className="space-y-1">
                            {b.bet_type === 'combo' ? (
                              <div>
                                <span className="text-[10px] font-mono text-emerald-400 block font-bold">🔥 KOMBİNE ÖNGÖRÜ ({b.combo_details?.length} MAÇ)</span>
                                <div className="text-xs text-gray-300 space-y-0.5 mt-1">
                                  {b.combo_details?.map((c, i) => (
                                    <div key={i} className="text-[11px] text-[#71767b]">
                                      • {c.home} vs {c.away} (MS {c.prediction} - {c.odds})
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[10px] font-mono text-[#71767b] block">{b.match?.matchday}. HAFTA (TEKLİ)</span>
                                <div className="font-bold text-white text-sm">
                                  {b.match?.home_team?.name} vs {b.match?.away_team?.name}
                                </div>
                                <div className="text-[11px] text-[#71767b]">
                                  Öngörü: <strong className="text-white">MS {b.prediction}</strong> • Oran: <strong className="text-white">{b.odds}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right font-mono space-y-1 flex-shrink-0 ml-4">
                            <div className="text-white font-bold">{b.bet_amount} P Kullanıldı</div>
                            <div className="text-emerald-400 font-bold">
                              Kazanç: {(b.bet_amount * b.odds).toFixed(2)} P
                            </div>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${b.status === 'won' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : b.status === 'lost' ? 'bg-red-950 text-red-400 border border-red-800' : b.status === 'cancelled' ? 'bg-neutral-800 text-[#71767b] border border-neutral-700' : 'bg-yellow-950/50 text-yellow-400 border border-yellow-800/50'}`}>
                              {b.status === 'won' ? 'Tuttu' : b.status === 'lost' ? 'Tutmadı' : b.status === 'cancelled' ? 'İptal Edildi' : 'Bekliyor'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {couponSubTab === 'all' && (
                  <div className="space-y-3">
                    {!isLocked ? (
                      <div className="text-center py-16 text-[#71767b] text-xs bg-[#16181c] border border-[#2f3336] rounded-xl p-6">
                        🔒 Diğer menajerlerin öngörüleri maç saatinde öngörüler kapandıktan sonra burada listelenecektir.
                      </div>
                    ) : allBets.length === 0 ? (
                      <div className="text-center py-16 text-[#71767b] text-xs">Kayıtlı öngörü bulunmuyor.</div>
                    ) : (
                      allBets.map((b) => (
                        <div key={b.id} className="bg-[#16181c] border border-[#2f3336] p-3 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {b.profile?.avatar_url ? (
                              <img src={b.profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[9px] font-bold">
                                {b.profile?.username?.charAt(0)?.toUpperCase() || 'M'}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-white block">@{b.profile?.username}</span>
                              <span className="text-[#71767b] text-[11px]">
                                {b.bet_type === 'combo' ? `Kombine (${b.combo_details?.length} Maç)` : `${b.match?.home_team?.name} vs ${b.match?.away_team?.name}`}
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <span className="block font-bold">Oran: {b.odds}</span>
                            <span className={`text-[10px] uppercase ${b.status === 'won' ? 'text-emerald-400' : b.status === 'lost' ? 'text-red-400' : b.status === 'cancelled' ? 'text-[#71767b]' : 'text-yellow-400'}`}>
                              {b.bet_amount} P • {b.status === 'won' ? 'Tuttu' : b.status === 'lost' ? 'Tutmadı' : 'Bekliyor'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Lig Sıralaması (Tıklanabilir Profil & Taç Eklenmiş) */}
            {activeTab === 'liderlik' && (
              <div className="bg-[#16181c] border border-[#2f3336] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#2f3336] text-[#71767b] font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-3">SIRA</th>
                      <th className="p-3">MENAJER (PROFİL DETAYI İÇİN TIKLA)</th>
                      <th className="p-3 text-right">PUAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2f3336] font-mono">
                    {leaderboard.map((item, index) => (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedManagerDetail(item)}
                        className="hover:bg-white/[0.04] cursor-pointer transition"
                      >
                        <td className="p-3 text-[#71767b]">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </td>
                        <td className="p-3 font-bold text-white font-sans flex items-center gap-2">
                          {item.avatar_url ? (
                            <img src={item.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold">
                              {item.username?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span>@{item.username}</span>
                          {index === 0 && <span title="Lig Lideri">👑</span>}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          {Number(item.balance).toFixed(2)} P
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Geçmiş Haftalar Arşivi */}
            {activeTab === 'gecmis' && (
              <div className="space-y-4">
                {pastMatches.length === 0 ? (
                  <div className="text-center py-16 text-[#71767b] text-xs">
                    Henüz tamamlanmış bir maç veya geçmiş hafta bulunmuyor.
                  </div>
                ) : (
                  pastMatches.map((m) => (
                    <div key={m.id} className="bg-[#16181c] border border-[#2f3336] p-4 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-mono text-[#71767b] uppercase block">{m.matchday}. HAFTA</span>
                        <div className="font-bold text-white flex items-center gap-2 mt-0.5">
                          <span>{m.home_team?.name}</span>
                          <span className="bg-black px-2 py-0.5 rounded text-emerald-400 font-mono font-bold">
                            {m.home_score} - {m.away_score}
                          </span>
                          <span>{m.away_team?.name}</span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-[#71767b] font-mono">
                        Sonuç: <strong className="text-white">{m.home_score > m.away_score ? 'MS 1' : m.home_score === m.away_score ? 'MS 0' : 'MS 2'}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'fikstur' && (
              <div className="space-y-4">
                <div className="bg-[#16181c] border border-[#2f3336] p-4 rounded-xl flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-white">LİG FİKSTÜRÜ</h2>
                  {fixtureWeeks.length > 0 && (
                    <select
                      aria-label="Fikstür haftası"
                      value={selectedFixtureWeek}
                      onChange={e => setFixtureWeek(Number(e.target.value))}
                      className="bg-black border border-[#2f3336] rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {fixtureWeeks.map(week => <option key={week} value={week}>{week}. HAFTA</option>)}
                    </select>
                  )}
                </div>
                {selectedFixtures.length === 0 ? (
                  <div className="text-center py-16 text-[#71767b] text-xs">Fikstür bulunmuyor.</div>
                ) : selectedFixtures.map(m => (
                  <div key={m.id} className="bg-[#16181c] border border-[#2f3336] p-4 rounded-xl flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0 text-right">
                      <div className="font-bold text-white truncate">{m.home_team?.name}</div>
                      <div className="text-[#71767b] truncate">@{m.home_team?.manager_name}</div>
                    </div>
                    {m.home_team?.logo_url && <img src={m.home_team.logo_url} alt="" className="w-7 h-7 object-contain" />}
                    <span className="w-12 text-center font-mono font-bold text-emerald-400">
                      {m.is_finished ? `${m.home_score}-${m.away_score}` : 'VS'}
                    </span>
                    {m.away_team?.logo_url && <img src={m.away_team.logo_url} alt="" className="w-7 h-7 object-contain" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{m.away_team?.name}</div>
                      <div className="text-[#71767b] truncate">@{m.away_team?.manager_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
