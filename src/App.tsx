import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MapPin, Navigation, Trash2, RefreshCw, Package, ArrowRight, Camera, Search, LayoutGrid, List, Map } from 'lucide-react';
import { Parcel } from './types';
import { Scanner } from './components/Scanner';
import { ParcelCard } from './components/ParcelCard';
import { Stats } from './components/Stats';
import { MapPreview } from './components/MapPreview';
import { NavigationMode } from './components/NavigationMode';
import { optimizeRoute } from './lib/optimizer';
import { getCoordinates } from './lib/gemini';
import { cn } from './lib/utils';
import confetti from 'canvas-confetti';

export default function App() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNavigationModeOpen, setIsNavigationModeOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Default start point (Hub)
  const startPoint = { lat: 3.1390, lng: 101.6869 };

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('routeking_parcels');
    if (saved) {
      try {
        setParcels(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load parcels", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('routeking_parcels', JSON.stringify(parcels));
  }, [parcels]);

  const handleScan = async (data: { recipientName?: string; address: string; trackingNumber: string; isCOD?: boolean; codAmount?: number }) => {
    const coords = await getCoordinates(data.address);
    
    const newParcel: Parcel = {
      id: crypto.randomUUID(),
      recipientName: data.recipientName || 'Tiada Nama',
      address: data.address,
      trackingNumber: data.trackingNumber,
      status: 'pending',
      sequenceNumber: parcels.length + 1,
      lat: coords.lat,
      lng: coords.lng,
      scannedAt: Date.now(),
      isCOD: data.isCOD,
      codAmount: data.codAmount
    };

    setParcels(prev => [...prev, newParcel]);
    setIsScannerOpen(false);
    
    // Success feedback
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#10b981', '#f59e0b']
    });
  };

  const handleStatusChange = (id: string, status: Parcel['status']) => {
    setParcels(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    
    if (status === 'delivered') {
      const remaining = parcels.filter(p => p.id !== id && p.status !== 'delivered').length;
      if (remaining === 0) {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6']
        });
      }
    }
  };

  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    
    // Simulate processing time
    setTimeout(() => {
      // Start from a mock current location (Kuala Lumpur center)
      const startPoint = { lat: 3.1390, lng: 101.6869 };
      const pendingParcels = parcels.filter(p => p.status !== 'delivered');
      const deliveredParcels = parcels.filter(p => p.status === 'delivered');
      
      const optimizedPending = optimizeRoute(pendingParcels, startPoint);
      
      // Re-sequence everything: Delivered first (keep their numbers or put at end?)
      // For courier logic, we usually want to see what's next.
      // Let's put delivered at the end and re-number pending from 1.
      const finalRoute = [...optimizedPending, ...deliveredParcels].map((p, i) => ({
        ...p,
        sequenceNumber: i + 1
      }));

      setParcels(finalRoute);
      setIsOptimizing(false);
    }, 1500);
  }, [parcels]);

  const handleStartNavigation = () => {
    setIsNavigationModeOpen(true);
  };

  const clearAll = () => {
    if (window.confirm("Padam semua data parcel?")) {
      setParcels([]);
    }
  };

  const filteredParcels = parcels.filter(p => 
    p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <Navigation size={20} className="fill-current" />
            </div>
            <div>
              <h1 className="font-black text-xl text-gray-900 tracking-tight leading-none">RouteKing</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Courier Edition</p>
            </div>
          </div>
          
          <button 
            onClick={clearAll}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Stats Section */}
        <Stats parcels={parcels} />

        {/* Search & Actions */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Cari alamat atau tracking..."
              className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:border-blue-500 focus:ring-0 transition-all outline-none shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleOptimize}
                disabled={isOptimizing || parcels.length === 0}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-md active:scale-95",
                  isOptimizing 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isOptimizing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Menyusun...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Optimize Route
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  if (viewMode === 'list') setViewMode('grid');
                  else if (viewMode === 'grid') setViewMode('map');
                  else setViewMode('list');
                }}
                className="p-3 bg-white border-2 border-gray-100 rounded-2xl text-gray-500 hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center w-12"
                title="Tukar Paparan"
              >
                {viewMode === 'list' && <LayoutGrid size={20} />}
                {viewMode === 'grid' && <Map size={20} />}
                {viewMode === 'map' && <List size={20} />}
              </button>
            </div>

            {parcels.filter(p => p.status === 'pending').length > 0 && (
              <button
                onClick={handleStartNavigation}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-lg"
              >
                <Navigation size={24} />
                MULA PANDU ARAH ({parcels.filter(p => p.status === 'pending').length} STOP)
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'map' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <MapPreview parcels={filteredParcels} startPoint={startPoint} />
          </div>
        ) : (
          <div className={cn(
            "grid gap-3",
            viewMode === 'grid' ? "grid-cols-2" : "grid-cols-1"
          )}>
            {filteredParcels.length > 0 ? (
              filteredParcels.map((parcel) => (
                <ParcelCard 
                  key={parcel.id} 
                  parcel={parcel} 
                  onStatusChange={handleStatusChange}
                />
              ))
            ) : (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                  <Package size={40} />
                </div>
                <p className="font-bold text-sm">Tiada parcel lagi. Jom scan!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-full shadow-[0_10px_40px_rgba(37,99,235,0.4)] transition-all active:scale-90 group"
        >
          <Camera size={24} className="group-hover:scale-110 transition-transform" />
          <span className="text-lg">SCAN PARCEL</span>
        </button>
      </div>

      {/* Scanner Modal */}
      {isScannerOpen && (
        <Scanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {/* Navigation Mode Overlay */}
      {isNavigationModeOpen && (
        <NavigationMode 
          parcels={parcels}
          onMarkDelivered={(id) => handleStatusChange(id, 'delivered')}
          onClose={() => setIsNavigationModeOpen(false)}
        />
      )}

      {/* Bottom Nav Hint */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-md border-t py-2 px-4 flex justify-center pointer-events-none">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          RouteKing v1.0 • Built for Drivers
        </p>
      </div>
    </div>
  );
}
