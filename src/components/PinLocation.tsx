import { useEffect, useState } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2, LocateFixed } from 'lucide-react';

interface ParcelInfo {
  trackingNumber: string;
  recipientName: string;
  alreadyPinned: boolean;
}

type Status = 'loading' | 'ready' | 'locating' | 'success' | 'error';

/**
 * Public, login-free page opened by a parcel recipient from a WhatsApp link.
 * It captures the device GPS location and posts it to the server, which updates
 * the parcel pin for the rider. Intentionally free of any Firebase imports so
 * it stays a tiny, fast-loading bundle for customers on slow connections.
 */
export function PinLocation({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [info, setInfo] = useState<ParcelInfo | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetch(`/api/parcel/location-info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!active) return;
        if (!r.ok) {
          setError(data?.error || 'Link tidak sah atau telah luput.');
          setStatus('error');
          return;
        }
        setInfo(data as ParcelInfo);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setError('Gagal menyambung. Sila semak sambungan internet anda.');
        setStatus('error');
      });
    return () => { active = false; };
  }, [token]);

  const shareLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Peranti anda tidak menyokong GPS.');
      setStatus('error');
      return;
    }
    setStatus('locating');
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/parcel/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setError(data?.error || 'Gagal menghantar lokasi. Sila cuba lagi.');
            setStatus('error');
            return;
          }
          setStatus('success');
        } catch {
          setError('Gagal menghantar lokasi. Sila cuba lagi.');
          setStatus('error');
        }
      },
      (err) => {
        setStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          setError('Anda perlu BENARKAN akses lokasi untuk berkongsi lokasi rumah anda. Sila cuba lagi dan tekan "Allow / Benarkan".');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Lokasi tidak tersedia. Sila pastikan GPS telefon anda dihidupkan.');
        } else {
          setError('Gagal mendapatkan lokasi. Sila cuba lagi.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 p-7 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <MapPin className="text-white" size={30} />
          </div>
        </div>

        <h1 className="text-xl font-black text-gray-900">RouteKing</h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1 mb-5">
          Kongsi Lokasi Rumah
        </p>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6 text-gray-500">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-sm font-bold">Sedang memuatkan...</p>
          </div>
        )}

        {(status === 'ready' || status === 'locating') && (
          <>
            {info?.recipientName && (
              <p className="text-sm text-gray-700 mb-1">
                Hai <span className="font-black">{info.recipientName}</span>! 👋
              </p>
            )}
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              Rider kami sedang dalam perjalanan menghantar parcel anda
              {info?.trackingNumber ? (
                <span className="font-bold"> [{info.trackingNumber}]</span>
              ) : null}
              .
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Sila tekan butang di bawah & <span className="font-bold">benarkan akses lokasi</span> supaya
              kami dapat lokasi tepat rumah anda. 📍
            </p>

            {info?.alreadyPinned && (
              <div className="mb-4 text-[12px] font-bold text-green-700 bg-green-50 border border-green-100 rounded-xl p-2">
                ✓ Lokasi sudah dikongsi. Anda boleh kongsi semula jika lokasi berubah.
              </div>
            )}

            <button
              onClick={shareLocation}
              disabled={status === 'locating'}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all"
            >
              {status === 'locating' ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Mendapatkan lokasi...
                </>
              ) : (
                <>
                  <LocateFixed size={20} /> Kongsi Lokasi Saya
                </>
              )}
            </button>
            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              Lokasi anda hanya digunakan untuk penghantaran parcel ini sahaja.
            </p>
          </>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="text-green-500" size={56} />
            <h2 className="text-lg font-black text-gray-900">Terima kasih! 🎉</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Lokasi rumah anda telah dihantar kepada rider. Parcel anda akan tiba tidak lama lagi.
              Anda boleh tutup halaman ini.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="text-red-500" size={48} />
            <p className="text-sm font-bold text-red-600 leading-relaxed">{error}</p>
            {info && (
              <button
                onClick={shareLocation}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all"
              >
                <LocateFixed size={20} /> Cuba Lagi
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-300 font-bold mt-6 uppercase tracking-widest">
        Dikuasakan oleh RouteKing
      </p>
    </div>
  );
}
