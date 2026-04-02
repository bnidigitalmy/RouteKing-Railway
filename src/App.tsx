import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MapPin, Navigation, Trash2, RefreshCw, Package, ArrowRight, Camera, Search, LayoutGrid, List, Map, Filter, Folder, MoreVertical } from 'lucide-react';
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
  const [navigationFolder, setNavigationFolder] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'delivered'>('all');
  const [filterCOD, setFilterCOD] = useState<boolean>(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Folder States
  const [folders, setFolders] = useState<string[]>([]);
  const [movingParcelId, setMovingParcelId] = useState<string | null>(null);
  
  // Modal States
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  // Default start point (Hub)
  const startPoint = { lat: 3.1390, lng: 101.6869 };

  // Load from localStorage
  useEffect(() => {
    const savedParcels = localStorage.getItem('routeking_parcels');
    if (savedParcels) {
      try { setParcels(JSON.parse(savedParcels)); } catch (e) { console.error(e); }
    }
    
    const savedFolders = localStorage.getItem('routeking_folders');
    if (savedFolders) {
      try { setFolders(JSON.parse(savedFolders)); } catch (e) { console.error(e); }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('routeking_parcels', JSON.stringify(parcels));
  }, [parcels]);

  useEffect(() => {
    localStorage.setItem('routeking_folders', JSON.stringify(folders));
  }, [folders]);

  const handleScan = async (data: { recipientName?: string; address: string; trackingNumber: string; isCOD?: boolean; codAmount?: number; groupTag?: string }) => {
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
      codAmount: data.codAmount,
      groupTag: data.groupTag
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

  const handleOptimize = useCallback(async (targetFolder?: string) => {
    setIsOptimizing(true);
    
    try {
      // Start from a mock current location (Kuala Lumpur center)
      const startPoint = { lat: 3.1390, lng: 101.6869 };
      
      if (typeof targetFolder === 'string') {
        // Optimize specific folder only
        const folderPending = parcels.filter(p => p.status !== 'delivered' && (p.folder || 'Tiada Folder') === targetFolder);
        
        if (folderPending.length > 0) {
          const optimizedFolderPending = await optimizeRoute(folderPending, startPoint);
          // Keep existing sequence numbers but reassign them based on new optimized order
          const seqNumbers = folderPending.map(p => p.sequenceNumber).sort((a, b) => a - b);
          
          const newParcels = [...parcels];
          optimizedFolderPending.forEach((p, i) => {
            const index = newParcels.findIndex(np => np.id === p.id);
            if (index !== -1) {
              newParcels[index] = { ...p, sequenceNumber: seqNumbers[i] };
            }
          });
          setParcels(newParcels);
        }
      } else {
        // Global optimize
        const pendingParcels = parcels.filter(p => p.status !== 'delivered');
        const deliveredParcels = parcels.filter(p => p.status === 'delivered');
        
        const optimizedPending = await optimizeRoute(pendingParcels, startPoint);
        
        const finalRoute = [...optimizedPending, ...deliveredParcels].map((p, i) => ({
          ...p,
          sequenceNumber: i + 1
        }));

        setParcels(finalRoute);
      }
    } catch (error) {
      console.error("Optimization failed:", error);
    } finally {
      setIsOptimizing(false);
    }
  }, [parcels]);

  const handleStartNavigation = (folder?: string) => {
    setNavigationFolder(folder || null);
    setIsNavigationModeOpen(true);
  };

  const confirmClearAll = () => {
    setIsClearAllModalOpen(true);
  };

  const executeClearAll = () => {
    setParcels([]);
    setIsClearAllModalOpen(false);
  };

  const openCreateFolderModal = () => {
    setNewFolderName('');
    setIsCreateFolderModalOpen(true);
  };

  const submitCreateFolder = () => {
    if (newFolderName && newFolderName.trim() !== '') {
      const trimmedName = newFolderName.trim();
      if (!folders.includes(trimmedName)) {
        setFolders([...folders, trimmedName]);
      }
    }
    setIsCreateFolderModalOpen(false);
  };

  const confirmDeleteFolder = (folderName: string) => {
    setFolderToDelete(folderName);
  };

  const executeDeleteFolder = () => {
    if (folderToDelete) {
      setFolders(folders.filter(f => f !== folderToDelete));
      setParcels(prev => prev.map(p => p.folder === folderToDelete ? { ...p, folder: undefined } : p));
      setFolderToDelete(null);
    }
  };

  // Get unique groups for filter dropdown
  const uniqueGroups = Array.from(new Set(parcels.map(p => p.groupTag).filter(Boolean))) as string[];

  // Apply filters
  const filteredParcels = parcels.filter(p => {
    // Search query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      p.address.toLowerCase().includes(searchLower) ||
      p.trackingNumber.toLowerCase().includes(searchLower) ||
      (p.recipientName && p.recipientName.toLowerCase().includes(searchLower)) ||
      (p.groupTag && p.groupTag.toLowerCase().includes(searchLower));

    // Status filter
    const matchesStatus = filterStatus === 'all' ? true : p.status === filterStatus;
    
    // COD filter
    const matchesCOD = filterCOD ? p.isCOD === true : true;
    
    // Group filter
    const matchesGroup = filterGroup === 'all' ? true : p.groupTag === filterGroup;

    return matchesSearch && matchesStatus && matchesCOD && matchesGroup;
  });

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
            onClick={confirmClearAll}
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Cari nama, tracking, tag..."
                className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:border-blue-500 focus:ring-0 transition-all outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 border-2 rounded-2xl transition-all shadow-sm flex items-center justify-center w-12",
                showFilters || filterStatus !== 'all' || filterCOD || filterGroup !== 'all'
                  ? "bg-blue-50 border-blue-200 text-blue-600" 
                  : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
              )}
            >
              <Filter size={20} />
            </button>
          </div>

          {/* Expandable Filters Panel */}
          {showFilters && (
            <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Status Parcel</label>
                <div className="flex gap-2">
                  {(['all', 'pending', 'delivered'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                        filterStatus === status 
                          ? "bg-blue-600 text-white shadow-md" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {status === 'all' ? 'Semua' : status === 'pending' ? 'Belum Hantar' : 'Selesai'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Jenis Parcel</label>
                <button
                  onClick={() => setFilterCOD(!filterCOD)}
                  className={cn(
                    "w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                    filterCOD 
                      ? "bg-orange-500 text-white shadow-md" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  COD Sahaja
                </button>
              </div>

              {uniqueGroups.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Folder size={12} /> Tag Kawasan
                  </label>
                  <select
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-lg py-2 px-3 text-sm font-bold text-gray-700 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Semua Kawasan</option>
                    {uniqueGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleOptimize()}
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
                    Susun Semua (Global)
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
                onClick={() => handleStartNavigation()}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-lg"
              >
                <Navigation size={24} />
                MULA SEMUA (GLOBAL) ({parcels.filter(p => p.status === 'pending').length} STOP)
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
          <div className="space-y-6">
            <div className="flex items-center justify-between mt-2">
              <h2 className="font-bold text-gray-800">Senarai Parcel</h2>
              <button 
                onClick={openCreateFolderModal} 
                className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={16} /> Tambah Folder
              </button>
            </div>

            {['Tiada Folder', ...folders].map(folder => {
              const folderParcels = filteredParcels
                .filter(p => (p.folder || 'Tiada Folder') === folder)
                .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
              
              if (folder === 'Tiada Folder' && folderParcels.length === 0 && folders.length > 0) return null;

              return (
                <div 
                  key={folder}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const parcelId = e.dataTransfer.getData('text/plain');
                    if (parcelId) {
                      setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, folder: folder === 'Tiada Folder' ? undefined : folder } : p));
                    }
                  }}
                  className={cn(
                    "rounded-2xl p-3 border-2 transition-colors",
                    folder === 'Tiada Folder' ? "bg-transparent border-transparent p-0" : "bg-gray-100/50 border-dashed border-gray-200"
                  )}
                >
                  <div className={cn("flex items-center justify-between mb-3 px-2", folder === 'Tiada Folder' && folderParcels.length === 0 && "hidden")}>
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                      {folder === 'Tiada Folder' ? <Package size={18} className="text-gray-400" /> : <Folder size={18} className="text-blue-500" />}
                      {folder}
                      <span className="bg-gray-200 text-gray-600 text-xs py-0.5 px-2 rounded-full">{folderParcels.length}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleStartNavigation(folder)} 
                        disabled={folderParcels.filter(p => p.status !== 'delivered').length === 0}
                        className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Navigation size={14} />
                        Mula
                      </button>
                      <button 
                        onClick={() => handleOptimize(folder)} 
                        disabled={isOptimizing || folderParcels.filter(p => p.status !== 'delivered').length === 0}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isOptimizing ? "animate-spin" : ""} />
                        Susun
                      </button>
                      {folder !== 'Tiada Folder' && (
                        <button onClick={() => confirmDeleteFolder(folder)} className="text-red-400 hover:text-red-600 p-1 ml-1">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className={cn(
                    "grid gap-3",
                    viewMode === 'grid' ? "grid-cols-2" : "grid-cols-1"
                  )}>
                    {folderParcels.map(parcel => (
                      <ParcelCard 
                        key={parcel.id} 
                        parcel={parcel} 
                        onStatusChange={handleStatusChange}
                        onMoveClick={() => setMovingParcelId(parcel.id)}
                      />
                    ))}
                    {folderParcels.length === 0 && folder !== 'Tiada Folder' && (
                      <div className="col-span-full text-center py-6 text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200 rounded-xl">
                        Tarik parcel ke sini atau guna menu 3-titik
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {filteredParcels.length === 0 && folders.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                  <Package size={40} />
                </div>
                <p className="font-bold text-sm">Tiada parcel dijumpai.</p>
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
          parcels={navigationFolder ? parcels.filter(p => (p.folder || 'Tiada Folder') === navigationFolder) : parcels}
          onMarkDelivered={(id) => handleStatusChange(id, 'delivered')}
          onClose={() => setIsNavigationModeOpen(false)}
        />
      )}

      {/* Move to Folder Modal */}
      {movingParcelId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 shadow-2xl">
            <h3 className="font-bold text-lg mb-4 text-gray-800">Pindah ke Folder</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => {
                  setParcels(prev => prev.map(p => p.id === movingParcelId ? { ...p, folder: undefined } : p));
                  setMovingParcelId(null);
                }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-100 font-medium text-gray-700 flex items-center gap-3 transition-colors"
              >
                <Folder size={18} className="text-gray-400" /> Tiada Folder
              </button>
              {folders.map(f => (
                <button
                  key={f}
                  onClick={() => {
                    setParcels(prev => prev.map(p => p.id === movingParcelId ? { ...p, folder: f } : p));
                    setMovingParcelId(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 text-blue-700 font-bold flex items-center gap-3 transition-colors"
                >
                  <Folder size={18} className="text-blue-500" /> {f}
                </button>
              ))}
              {folders.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Sila cipta folder baru terlebih dahulu.</p>
              )}
            </div>
            <button 
              onClick={() => setMovingParcelId(null)} 
              className="mt-6 w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Custom Modals */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
            <h3 className="font-bold text-lg mb-4 text-gray-800">Tambah Folder Baru</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Cth: Taman Melati, Guni A"
              className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-blue-500 focus:ring-0 outline-none mb-6"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submitCreateFolder()}
            />
            <div className="flex gap-3">
              <button onClick={() => setIsCreateFolderModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
              <button onClick={submitCreateFolder} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {folderToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
            <h3 className="font-bold text-lg mb-2 text-gray-800">Padam Folder?</h3>
            <p className="text-gray-600 text-sm mb-6">Adakah anda pasti mahu memadam folder "{folderToDelete}"? Parcel di dalam akan dikembalikan ke "Tiada Folder".</p>
            <div className="flex gap-3">
              <button onClick={() => setFolderToDelete(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
              <button onClick={executeDeleteFolder} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">Padam</button>
            </div>
          </div>
        </div>
      )}

      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-in zoom-in-95 shadow-2xl">
            <h3 className="font-bold text-lg mb-2 text-gray-800">Padam Semua Data?</h3>
            <p className="text-gray-600 text-sm mb-6">Adakah anda pasti mahu memadam semua data parcel? Tindakan ini tidak boleh diundur.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsClearAllModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Batal</button>
              <button onClick={executeClearAll} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">Padam Semua</button>
            </div>
          </div>
        </div>
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
