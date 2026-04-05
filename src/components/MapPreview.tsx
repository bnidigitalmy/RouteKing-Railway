import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Parcel } from '../types';
import { Navigation, MapPin } from 'lucide-react';
import { getGoogleMapsLetter } from '../lib/utils';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom numbered icon generator
const createNumberedIcon = (number: number, status: Parcel['status']) => {
  const bgColor = status === 'delivered' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-blue-600';
  const letter = getGoogleMapsLetter(number);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${bgColor} text-white font-bold rounded-full w-10 h-10 flex flex-col items-center justify-center border-2 border-white shadow-md">
            <span class="text-xs leading-none">${number}</span>
            <span class="text-[9px] leading-none opacity-80 font-black">${letter}</span>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

// Start point icon
const startIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="bg-red-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-white shadow-md text-sm">H</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

interface MapPreviewProps {
  parcels: Parcel[];
  startPoint: { lat: number; lng: number };
}

// Component to auto-fit bounds when parcels change
function MapBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, positions]);

  return null;
}

export function MapPreview({ parcels, startPoint }: MapPreviewProps) {
  // Extract coordinates for the polyline (route)
  // We want to connect: Start -> Parcel 1 -> Parcel 2 -> ...
  const routePositions: [number, number][] = [
    [startPoint.lat, startPoint.lng],
    ...parcels
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map(p => [p.lat, p.lng] as [number, number])
  ];

  const allPositions = routePositions;

  const openInGoogleMaps = () => {
    if (parcels.length === 0) return;

    const sortedParcels = [...parcels].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const origin = `${startPoint.lat},${startPoint.lng}`;
    const destination = `${sortedParcels[sortedParcels.length - 1].lat},${sortedParcels[sortedParcels.length - 1].lng}`;
    
    // Waypoints are all parcels except the last one (which is the destination)
    const waypoints = sortedParcels.slice(0, -1)
      .map(p => `${p.lat},${p.lng}`)
      .join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (parcels.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
        <MapPin size={40} className="mb-2 opacity-50" />
        <p className="font-bold text-sm">Tiada lokasi untuk dipaparkan</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-2xl overflow-hidden shadow-sm border-2 border-gray-100 relative z-0">
      <MapContainer 
        center={[startPoint.lat, startPoint.lng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* Use Google Maps tiles if API key is available, otherwise fallback to OSM */}
        {typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' && __GOOGLE_MAPS_API_KEY__ ? (
          <TileLayer
            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
            url={`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${__GOOGLE_MAPS_API_KEY__}`}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        
        <MapBounds positions={allPositions} />

        {/* Start Point Marker */}
        <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}>
          <Popup>
            <div className="font-bold text-sm">Titik Mula (Hub)</div>
          </Popup>
        </Marker>

        {/* Parcel Markers */}
        {parcels.map((parcel) => (
          <Marker 
            key={parcel.id} 
            position={[parcel.lat, parcel.lng]}
            icon={createNumberedIcon(parcel.sequenceNumber, parcel.status)}
          >
            <Popup>
              <div className="p-1">
                <div className="font-bold text-sm mb-1">
                  #{parcel.sequenceNumber} - {parcel.trackingNumber}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {parcel.address}
                </div>
                <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${
                  parcel.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {parcel.status === 'delivered' ? 'Selesai' : 'Menunggu'}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route Line */}
        <Polyline 
          positions={routePositions} 
          color="#3b82f6" 
          weight={4} 
          opacity={0.7} 
          dashArray="10, 10" 
        />
      </MapContainer>
      
      {/* Google Maps Route Button */}
      <button
        onClick={openInGoogleMaps}
        className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 z-[1000] flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-wider hover:bg-white transition-all active:scale-95"
      >
        <Navigation size={14} />
        Buka Laluan (G-Maps)
      </button>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 z-[1000] text-xs font-bold space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Mula (Hub)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Menunggu</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Selesai</span>
        </div>
      </div>
    </div>
  );
}
