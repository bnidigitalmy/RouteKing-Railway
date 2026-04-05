import React, { useState, useRef } from 'react';
import { Parcel, UserProfile } from '../types';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { X, Map as MapIcon, Navigation, CheckCircle, Package, Banknote, MessageSquare, Phone, Camera, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { getGoogleMapsLetter } from '../lib/utils';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom numbered icon generator for the current stop
const createCurrentStopIcon = (number: number) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="bg-blue-600 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center border-4 border-white shadow-xl text-lg animate-bounce">${number}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 17, { animate: true });
  return null;
}

interface NavigationModeProps {
  parcels: Parcel[];
  profile?: UserProfile | null;
  onMarkDelivered: (id: string, podPhotoUrl?: string) => void;
  onClose: () => void;
}

export function NavigationMode({ parcels, profile, onMarkDelivered, onClose }: NavigationModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCapturingPOD, setIsCapturingPOD] = useState(false);
  const [isUploadingPOD, setIsUploadingPOD] = useState(false);
  const [podPhoto, setPodPhoto] = useState<string | null>(null);
  const podInputRef = useRef<HTMLInputElement>(null);
  
  // Only navigate through parcels that were pending when we started
  const [route] = useState(() => 
    parcels.filter(p => p.status === 'pending').sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  );

  if (route.length === 0 || currentIndex >= route.length) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-4 animate-in zoom-in duration-300">
        <div className="w-32 h-32 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <CheckCircle size={64} />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-2">Semua Selesai!</h2>
        <p className="text-gray-500 text-center mb-8 max-w-xs">Kerja yang bagus. Semua parcel untuk laluan ini telah berjaya dihantar.</p>
        <button 
          onClick={onClose} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl w-full max-w-xs shadow-lg transition-all active:scale-95"
        >
          Kembali ke Senarai
        </button>
      </div>
    );
  }

  const currentParcel = route[currentIndex];

  const handleDelivered = () => {
    onMarkDelivered(currentParcel.id, podPhoto || undefined);
    setPodPhoto(null);
    setCurrentIndex(prev => prev + 1);
  };

  const handlePODCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPOD(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      // In a real app, we would upload to Firebase Storage
      // For now, we'll just store the base64 string (not ideal for large images but works for demo)
      setPodPhoto(base64);
      setIsUploadingPOD(false);
    };
    reader.readAsDataURL(file);
  };

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentParcel.lat},${currentParcel.lng}`, '_blank');
  };

  const openWaze = () => {
    window.open(`https://waze.com/ul?ll=${currentParcel.lat},${currentParcel.lng}&navigate=yes`, '_blank');
  };

  const makeCall = () => {
    if (!currentParcel.recipientPhone) return;
    window.location.href = `tel:${currentParcel.recipientPhone}`;
  };

  const sendWhatsApp = () => {
    if (!currentParcel.recipientPhone) return;
    
    let phone = currentParcel.recipientPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '6' + phone;
    } else if (!phone.startsWith('60')) {
      phone = '60' + phone;
    }

    const riderInfo = profile?.riderName ? `${profile.riderName} (${profile.courierCompany || 'SPX'})` : 'rider Shopee Express (SPX)';
    
    let codText = '';
    if (currentParcel.isCOD && currentParcel.codAmount) {
      codText = ` Sila sediakan wang tunai RM${currentParcel.codAmount.toFixed(2)} untuk bayaran COD ya.`;
    }

    const message = encodeURIComponent(`Hai, saya ${riderInfo}. Parcel anda (${currentParcel.trackingNumber}) akan sampai dalam 10 minit!${codText} Sila sedia ya. Terima kasih.`);
    const url = `https://wa.me/${phone}?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col animate-in slide-in-from-bottom-full duration-300">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b flex items-center justify-between shadow-sm z-10">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Stop {currentIndex + 1} / {route.length}</p>
          <h2 className="text-xl font-black text-gray-900 leading-none">
            #{currentParcel.sequenceNumber} ({getGoogleMapsLetter(currentParcel.sequenceNumber)}) - {currentParcel.trackingNumber}
          </h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative z-0">
        <MapContainer 
          center={[currentParcel.lat, currentParcel.lng]} 
          zoom={17} 
          style={{ height: '100%', width: '100%' }} 
          zoomControl={false}
        >
          {typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' && __GOOGLE_MAPS_API_KEY__ ? (
            <TileLayer
              attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
              url={`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${__GOOGLE_MAPS_API_KEY__}`}
            />
          ) : (
            <TileLayer 
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            />
          )}
          <MapUpdater center={[currentParcel.lat, currentParcel.lng]} />
          <Marker 
            position={[currentParcel.lat, currentParcel.lng]} 
            icon={createCurrentStopIcon(currentParcel.sequenceNumber)}
          />
        </MapContainer>
        
        {/* Address Overlay */}
        <div className="absolute bottom-6 left-4 right-4 z-[1000] flex flex-col gap-2">
          {currentParcel.isCOD && (
            <div className="bg-orange-500 text-white p-4 rounded-2xl shadow-xl border-2 border-orange-400 flex items-center justify-between animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 font-bold">
                <Banknote size={24} />
                <span>KUTIPAN COD</span>
              </div>
              <div className="text-2xl font-black">
                RM {currentParcel.codAmount?.toFixed(2)}
              </div>
            </div>
          )}
          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-blue-600 bg-blue-50 p-2 rounded-lg">
                <Package size={20} />
              </div>
              <div>
                {currentParcel.recipientName && currentParcel.recipientName !== 'Tiada Nama' && (
                  <p className="font-black text-gray-900 text-base mb-0.5">{currentParcel.recipientName}</p>
                )}
                <p className="font-medium text-gray-600 text-sm leading-relaxed">{currentParcel.address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white p-4 border-t shadow-[0_-10px_40px_rgba(0,0,0,0.05)] space-y-3 pb-8 z-10">
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={openGoogleMaps} 
            className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 active:scale-95 transition-all"
          >
            <MapIcon size={18} /> Google Maps
          </button>
          <button 
            onClick={openWaze} 
            className="flex items-center justify-center gap-2 py-3 px-4 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold rounded-xl border border-cyan-200 active:scale-95 transition-all"
          >
            <Navigation size={18} /> Waze
          </button>
        </div>

        {currentParcel.recipientPhone && (
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={makeCall} 
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3 rounded-xl border border-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Phone size={20} /> CALL
            </button>
            <button 
              onClick={sendWhatsApp} 
              className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-3 rounded-xl border border-green-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare size={20} /> WHATSAPP
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {podPhoto ? (
            <div className="relative w-full h-24 rounded-xl overflow-hidden border-2 border-green-500 animate-in zoom-in">
              <img src={podPhoto} alt="POD" className="w-full h-full object-cover" />
              <button 
                onClick={() => setPodPhoto(null)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-lg"
              >
                <X size={14} />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-green-500 text-white text-[10px] font-bold text-center py-0.5">
                GAMBAR POD SEDIA
              </div>
            </div>
          ) : (
            <button 
              onClick={() => podInputRef.current?.click()}
              disabled={isUploadingPOD}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl border-2 border-dashed border-gray-300 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isUploadingPOD ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
              AMBIL GAMBAR POD (OPSYENAL)
            </button>
          )}

          <button 
            onClick={handleDelivered} 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-[0_8px_30px_rgba(22,163,74,0.3)] active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
          >
            <CheckCircle size={24} />
            TANDAKAN SELESAI
          </button>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={podInputRef}
          onChange={handlePODCapture}
        />
      </div>
    </div>
  );
}
