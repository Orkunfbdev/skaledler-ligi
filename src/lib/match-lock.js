/**
 * Skaledler Ligi - Öngörü Kilit / Aktiflik Kontrolü
 * 
 * Kural:
 * 1. Yönetici manuel kilitlediyse (predictions_locked === true) -> Kapalı
 * 2. Saat 18:00 öncesi -> Açık
 * 3. Saat 18:00 ve sonrası:
 *    - Eğer yönetici bugünkü saat 18:00'den SONRA "Öngörüleri Aktifleştir" yaptıysa -> Açık
 *    - Aksi takdirde (18:00 kapanışı gerçekleşti ve yeniden açılmadıysa) -> Kapalı
 */

export function isPredictionsLocked(settings) {
  if (!settings) return false;

  // 1. Yönetici manuel kilitlemişse direkt kapalı
  if (settings.predictions_locked === true) {
    return true;
  }

  // 2. Türkiye saatini hesapla (Europe/Istanbul)
  const now = new Date();
  const trHour = parseInt(
    new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10
  );

  // Saat 18:00'den önce öngörüler her zaman açıktır
  if (trHour < 18) {
    return false;
  }

  // Saat 18:00 veya sonrası:
  // Yönetici bugünkü 18:00'den sonra öngörüleri geri aktifleştirdi mi kontrol et
  if (settings.unlocked_at) {
    const unlockedTime = new Date(settings.unlocked_at);
    if (!isNaN(unlockedTime.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Europe/Istanbul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(now);

        const year = parts.find((p) => p.type === 'year')?.value;
        const month = parts.find((p) => p.type === 'month')?.value;
        const day = parts.find((p) => p.type === 'day')?.value;

        if (year && month && day) {
          const todayCutoff = new Date(`${year}-${month}-${day}T18:00:00+03:00`);
          if (unlockedTime.getTime() >= todayCutoff.getTime()) {
            // Bugün 18:00 sonrasında yönetici tarafından geri aktifleştirilmiş!
            return false;
          }
        }
      } catch (err) {
        console.error('Tarih kıyaslama hatası:', err);
      }
    }
  }

  // Bugünkü 18:00 kapanışı gerçekleşti ve sonrasında geri aktifleştirilmedi
  return true;
}

export function getPredictionStatusLabel(settings) {
  const locked = isPredictionsLocked(settings);
  if (!locked) {
    if (settings?.unlocked_at) {
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
        return 'Öngörüler Açık (Yönetici Tarafından Aktifleştirildi)';
      }
    }
    return 'Öngörüler Açık (Saat 18:00\'e Kadar)';
  }

  if (settings?.predictions_locked === true) {
    return 'Öngörüler Kapalı (Yönetici Tarafından Kilitlendi)';
  }
  return 'Öngörüler Kapalı (Saat 18:00 Kapanışı)';
}
