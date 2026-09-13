'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import SettingsModal from '@/components/SettingsModal';
import Lightbox from '@/components/modals/Lightbox';
import { getMarkers, getPendingMarkers, approveMarker, deleteMarker, getAllApprovedMarkerStats, getAllPendingMarkerStats, verifyEditorPassword } from '@/app/actions/markers';
import { Map as MapIcon, ListFilter, AlertTriangle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const MapWrapper = dynamic(() => import('@/components/MapWrapper'), { ssr: false });
const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false });

export type MapSettings = { zoomStep: number; hardwareAcceleration: boolean; iconScale: number; };
export type Floor = { id: string; name: string; };

function ConnectionLinesOverlay({ hoveredFilter }: { hoveredFilter: string | null }) {
  const [lines, setLines] = useState<{x1: number, y1: number, x2: number, y2: number, isGhost: boolean}[]>([]);

  useEffect(() => {
    if (!hoveredFilter) { setLines([]); return; }
    let animationFrameId: number;
    
    const updateLines = () => {
      const filterEl = document.getElementById(`filter-${hoveredFilter}`);
      const sidebarEl = document.getElementById('kord-sidebar');
      if (!filterEl || !sidebarEl) return;

      const sidebarRect = sidebarEl.getBoundingClientRect();
      const filterIconEl = filterEl.querySelector('img');
      const startRect = (filterIconEl || filterEl).getBoundingClientRect();
      
      const startX = sidebarRect.right;
      const startY = startRect.top + startRect.height / 2;

      const markerEls = document.querySelectorAll(`.marker-type-${hoveredFilter}`);
      const newLines = Array.from(markerEls).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          x1: startX, y1: startY, x2: rect.left + rect.width / 2, y2: rect.top + rect.height / 2,
          isGhost: el.classList.contains('is-ghost')
        };
      });
      setLines(newLines);
      animationFrameId = requestAnimationFrame(updateLines);
    };
    updateLines();
    return () => cancelAnimationFrame(animationFrameId);
  }, [hoveredFilter]);

  if (!hoveredFilter || lines.length === 0) return null;

  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none z-[1500]">
      {lines.map((line, i) => {
        const elbowX = line.x1 + 22; 
        return (
          <path 
            key={i} d={`M ${line.x1} ${line.y1} L ${elbowX} ${line.y1} L ${line.x2} ${line.y2}`} 
            fill="none" stroke="#ef4444" strokeWidth={line.isGhost ? "1.5" : "2"} 
            strokeOpacity={line.isGhost ? "0.25" : "0.9"} strokeDasharray={line.isGhost ? "6,6" : "none"} strokeLinejoin="round" 
          />
        );
      })}
    </svg>
  );
}

export default function Home() {
  const [mapsData, setMapsData] = useState<Record<string, { map_url: string; cover_url?: string; map_name?: string }>>({});
  const [globalDocTypes, setGlobalDocTypes] = useState<Record<string, any>>({});
  const [globalStats, setGlobalStats] = useState<{ mapName: string, type: string }[]>([]);
  const [globalPendingStats, setGlobalPendingStats] = useState<{ mapName: string, id: string }[]>([]);
  const [titleFilters, setTitleFilters] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<{ id: string; displayName: string; url: string } | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [editorPassword, setEditorPassword] = useState<string>('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [markers, setMarkers] = useState<any[]>([]);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [localPendingIds, setLocalPendingIds] = useState<string[]>([]);
  
  const [markerTypes, setMarkerTypes] = useState<Record<string, string[]>>({});
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [flyToMarker, setFlyToMarker] = useState<any | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [currentFloorId, setCurrentFloorId] = useState<string | null>(null);
  const [settings, setSettings] = useState<MapSettings>({ zoomStep: 1, hardwareAcceleration: true, iconScale: 1 });
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null); 

  useEffect(() => {
    fetch('/maps.json').then(r => r.json()).then(setMapsData).catch(e => console.error(e));
    fetch('/documents.json').then(r => r.json()).then(setGlobalDocTypes).catch(e => console.error(e));
    getAllApprovedMarkerStats().then(setGlobalStats).catch(e => console.error(e));

    const saved = localStorage.getItem('kordSettings');
    if (saved) setSettings(JSON.parse(saved));
    const savedAuth = sessionStorage.getItem('kordAuth');
    if (savedAuth) setEditorPassword(savedAuth);
    
    const savedLockout = localStorage.getItem('kordLoginLockout');
    if (savedLockout) {
      const end = parseInt(savedLockout, 10);
      if (Date.now() < end) setLockoutTime(end);
      else localStorage.removeItem('kordLoginLockout');
    }
  }, []);

  useEffect(() => {
    if (!lockoutTime) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutTime(null);
        setLoginAttempts(0);
        localStorage.removeItem('kordLoginLockout');
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  useEffect(() => {
    if (editorPassword) {
      getAllPendingMarkerStats(editorPassword).then(setGlobalPendingStats).catch(console.error);
    } else {
      setGlobalPendingStats([]);
    }
  }, [editorPassword]);

  useEffect(() => {
    if (selectedMap) {
      setMarkers([]); setPendingQueue([]); setFloors([]); setCurrentFloorId(null); setMarkerTypes({}); setActiveFilters([]);
      const savedPending = JSON.parse(localStorage.getItem('kordPendingMarkers') || '[]');
      setLocalPendingIds(savedPending);

      getMarkers(selectedMap.id, savedPending).then((fetchedMarkers) => {
        const stillPending = savedPending.filter((id: string) => {
          const m = fetchedMarkers.find((x: any) => x.id === id);
          return m && !m.approved;
        });
        if (stillPending.length !== savedPending.length) {
          localStorage.setItem('kordPendingMarkers', JSON.stringify(stillPending));
          setLocalPendingIds(stillPending);
        }
        setMarkers(fetchedMarkers);
      });
      
      if (globalDocTypes[selectedMap.id]) {
        setMarkerTypes(globalDocTypes[selectedMap.id]);
        setActiveFilters(Object.values(globalDocTypes[selectedMap.id]).flat().map((t: any) => t.toLowerCase().replace(/\s+/g, '-')));
      }
    } else {
      setTitleFilters([]);
    }
  }, [selectedMap, globalDocTypes]);

  const handleLoginSubmit = async () => {
    if (lockoutTime || isVerifying || !editorPassword) return;
    setIsVerifying(true);
    
    const isValid = await verifyEditorPassword(editorPassword);
    setIsVerifying(false);

    if (isValid) {
      sessionStorage.setItem('kordAuth', editorPassword);
      setLoginAttempts(0);
      setIsLoginOpen(false);
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      if (newAttempts >= 5) {
        const unlockTime = Date.now() + 60000;
        setLockoutTime(unlockTime);
        localStorage.setItem('kordLoginLockout', unlockTime.toString());
      } else {
        alert(`Incorrect password. ${5 - newAttempts} attempts remaining.`);
      }
      setEditorPassword('');
    }
  };

  const addLocalPendingId = (id: string) => {
    setLocalPendingIds(prev => {
      const next = [...prev, id];
      localStorage.setItem('kordPendingMarkers', JSON.stringify(next));
      return next;
    });
  };

  const saveSettings = (s: MapSettings) => { setSettings(s); localStorage.setItem('kordSettings', JSON.stringify(s)); };
  const handleLogout = () => { sessionStorage.removeItem('kordAuth'); setEditorPassword(''); setIsApprovalsOpen(false); };

  const loadApprovals = async () => {
    if (!selectedMap) return;
    const res = await getPendingMarkers(editorPassword, selectedMap.id);
    if (res.markers) { setPendingQueue(res.markers); setIsApprovalsOpen(true); } 
    else { alert("Invalid Editor Password"); handleLogout(); }
  };

  const handleFloorsLoaded = useCallback((loadedFloors: Floor[]) => {
    setFloors(loadedFloors);
    setCurrentFloorId((prev) => {
      if (loadedFloors.length > 0 && !prev) {
        const first = loadedFloors.find(f => f.name.toLowerCase().includes('first floor'));
        return first ? first.id : loadedFloors[0].id;
      }
      return prev;
    });
  }, []);

  const formatDate = (dateStr: string, showTime: boolean) => {
    const d = new Date(dateStr);
    return showTime ? d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString();
  };

  const changelog = [
    ...markers.filter(m => m.approved).map(m => ({ ...m, status: 'approved' })),
    ...(editorPassword ? pendingQueue.map(m => ({ ...m, status: m.isDeletion ? 'pending-delete' : m.originalId ? 'pending-edit' : 'pending-new' })) : [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const LoginModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center">
      <div className="bg-[#1a1a1a] border border-[#333] p-6 rounded-lg w-80 shadow-2xl">
        <h2 className="font-bold mb-4">Editor Login</h2>
        <input 
          type="password" placeholder="Password..." value={editorPassword}
          disabled={!!lockoutTime || isVerifying}
          className="w-full bg-[#2a2a2a] p-2 rounded border border-[#444] mb-4 outline-none focus:border-[#e68c3a] disabled:opacity-50"
          onChange={(e) => setEditorPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLoginSubmit(); }}
        />
        <div className="flex gap-2">
          <button onClick={() => { setIsLoginOpen(false); setEditorPassword(''); }} className="flex-1 bg-[#333] p-2 rounded text-sm hover:bg-[#444]">Cancel</button>
          <button 
            onClick={handleLoginSubmit} 
            disabled={!!lockoutTime || isVerifying}
            className="flex-1 bg-[#e68c3a] text-black font-bold p-2 rounded text-sm hover:bg-[#cf7d34] disabled:opacity-50 disabled:bg-gray-600 transition-colors"
          >
            {isVerifying ? 'Checking...' : lockoutTime ? `Locked (${lockoutRemaining}s)` : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!selectedMap) {
    let allTypesRaw: string[] = [];
    Object.values(globalDocTypes).forEach((mapObj: any) => {
      Object.values(mapObj).forEach((types: any) => allTypesRaw.push(...types));
    });
    const uniqueTypes = Array.from(new Set(allTypesRaw)).map(t => ({
      id: t.toLowerCase().replace(/\s+/g, '-'), name: t
    }));

    return (
      <main className="flex h-[100dvh] w-full bg-[#121212] overflow-hidden text-white relative">
        <div id="kord-sidebar" className="w-80 bg-[#1a1a1a] border-r border-[#333] flex flex-col shadow-2xl z-10 shrink-0">
          <div className="p-8 border-b border-[#333] text-center">
            <MapIcon size={48} className="text-[#e68c3a] mx-auto mb-4" />
            <h1 className="text-3xl font-bold tracking-widest uppercase text-white">Kord Map</h1>
            <p className="text-sm text-gray-500 mt-2">Select a location to begin</p>
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ListFilter size={14} /> Required Documents
            </h3>
            <div className="space-y-1">
              {uniqueTypes.map(type => {
                const count = globalStats.filter(m => m.type === type.id).length;
                if (count === 0) return null; 
                const isActive = titleFilters.includes(type.id);
                return (
                  <div key={type.id} onClick={() => setTitleFilters(prev => isActive ? prev.filter(f => f !== type.id) : [...prev, type.id])} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all duration-150 ${isActive ? 'bg-[#2a2a2a] border-r-2 border-[#e68c3a] opacity-100' : 'hover:bg-[#222] border-r-2 border-transparent opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <img src={`/icons/${type.id}.png`} className="w-6 h-6 object-contain filter drop-shadow-md" alt="icon" />
                      <span className={`text-sm font-medium ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>{type.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#333] text-gray-300' : 'bg-[#1a1a1a] text-gray-600'}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-5 border-t border-[#333] flex flex-col gap-2">
            {editorPassword ? (
              <button onClick={handleLogout} className="w-full bg-[#7a2c2c] text-white font-bold py-2 rounded text-xs hover:bg-[#8f3636] transition-colors">Editor Logout</button>
            ) : (
              <button onClick={() => setIsLoginOpen(true)} className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors">Editor Login</button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col relative h-full overflow-y-auto bg-[#0a0a0a]">
          <div className="p-6 md:p-10 flex flex-col items-center min-h-full w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl w-full my-auto pt-10 pb-16">
              {Object.entries(mapsData).map(([id, data]) => {
                const mapStats = globalStats.filter(m => m.mapName === id);
                const pendingCount = globalPendingStats.filter(m => m.mapName === id).length;
                const mapTypeCounts = mapStats.reduce((acc, curr) => { acc[curr.type] = (acc[curr.type] || 0) + 1; return acc; }, {} as Record<string, number>);
                const hasRequiredFilters = titleFilters.length === 0 || titleFilters.every(f => mapTypeCounts[f] > 0);
                const displayName = data.map_name || id;

                return (
                  <div key={id} className="flex flex-col items-center w-full">
                    <button onClick={() => setSelectedMap({ id, displayName, url: data.map_url })} className={`relative overflow-hidden group rounded-xl border-2 transition-all duration-500 flex flex-col items-center justify-center min-h-[250px] w-full ${hasRequiredFilters ? 'border-[#333] hover:border-[#e68c3a] hover:scale-105 shadow-2xl opacity-100' : 'border-[#222] opacity-30 grayscale scale-95 pointer-events-none'}`}>
                      {data.cover_url ? <div className="absolute inset-0 bg-cover bg-center blur-[8px] group-hover:blur-[2px] transition-all duration-700 scale-110 group-hover:scale-100" style={{ backgroundImage: `url(${data.cover_url})` }} /> : <div className="absolute inset-0 bg-[#1a1a1a]" />}
                      <div className="absolute inset-0 bg-black/70 group-hover:bg-black/50 transition-all duration-500" />
                      <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-4 w-full px-2 sm:px-4">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-wider text-white group-hover:text-[#e68c3a] transition-colors drop-shadow-lg text-center w-full break-words leading-tight px-1">{displayName}</h2>
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-bold text-gray-300 bg-black/60 px-3 py-2 sm:px-4 sm:py-3 rounded-lg border border-[#444] backdrop-blur-sm w-full max-w-[95%]">
                          {Object.entries(mapTypeCounts).length > 0 ? (
                            Object.entries(mapTypeCounts).map(([typeId, count], i, arr) => (
                              <span key={typeId} className="flex items-center gap-2 whitespace-nowrap my-1">
                                <img src={`/icons/${typeId}.png`} className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 object-contain filter drop-shadow-md" alt="icon" />
                                <span className="text-white text-base sm:text-lg md:text-xl">{count}</span>
                                {i < arr.length - 1 && <span className="mx-2 sm:mx-3 text-gray-600">|</span>}
                              </span>
                            ))
                          ) : <span className="text-gray-500 py-1">No markers placed</span>}
                        </div>
                      </div>
                    </button>
                    {editorPassword && pendingCount > 0 && <div className="mt-4 bg-blue-600/90 border border-blue-400 text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg animate-pulse">{pendingCount} Pending Approval{pendingCount > 1 ? 's' : ''}</div>}
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-6 border-t border-[#222] text-xs text-gray-500 text-center flex flex-wrap gap-6 justify-center w-full max-w-4xl">
              <p>You can contribute to this project on <a href="https://github.com/KalleLeskinen/KordMap" target="_blank" rel="noopener noreferrer" className="text-[#e68c3a] hover:text-[#cf7d34] transition-colors font-semibold">GitHub</a></p>
              <p>Locations provided by users on VeryBadScav&apos;s <a href="https://discord.com/invite/AmuWBRMnVQ" target="_blank" rel="noopener noreferrer" className="text-[#e68c3a] hover:text-[#cf7d34] transition-colors font-semibold">Discord</a></p>
              <p>Maps by <a href="https://github.com/the-hideout/tarkov-dev-svg-maps" target="_blank" rel="noopener noreferrer" className="text-[#e68c3a] hover:text-[#cf7d34] transition-colors font-semibold">Shebuka</a></p>
              <p><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-[#e68c3a] hover:text-[#cf7d34] transition-colors font-semibold">CC BY-NC-SA 4.0</a></p>
              <p className="mt-1 text-[#666] font-mono w-full">v{process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev'}</p>
            </div>
          </div>
        </div>
        {isLoginOpen && <LoginModal />}
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] w-full bg-[#121212] overflow-hidden text-white relative">
      <ConnectionLinesOverlay hoveredFilter={isSidebarVisible ? hoveredFilter : null} />
      <div className={isSidebarVisible ? 'flex shrink-0' : 'hidden'}>
        <Sidebar
        mapName={selectedMap.displayName} onClearMap={() => setSelectedMap(null)}
        mode={mode} setMode={setMode} floors={floors} currentFloorId={currentFloorId} setCurrentFloorId={setCurrentFloorId}
        openSettings={() => setIsSettingsOpen(true)} openLogin={() => setIsLoginOpen(true)} 
        openApprovals={loadApprovals} openChangelog={() => setIsChangelogOpen(true)}
        onLogout={handleLogout} isLoggedIn={!!editorPassword}
        markerTypes={markerTypes} activeFilters={activeFilters} setActiveFilters={setActiveFilters}
        setHoveredFilter={setHoveredFilter} hoveredFilter={hoveredFilter} markers={markers}
        />
      </div>
      <div className="flex-1 min-w-0 relative">
        <button
          type="button"
          onClick={() => { setHoveredFilter(null); setIsSidebarVisible(visible => !visible); }}
          aria-label={isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          aria-controls="kord-sidebar"
          aria-expanded={isSidebarVisible}
          title={isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          className="absolute top-4 left-4 z-[1001] flex items-center justify-center w-9 h-9 rounded-lg border border-[#444] bg-[#1a1a1a] text-gray-300 shadow-xl hover:bg-[#333] hover:text-white focus-visible:outline-2 focus-visible:outline-[#e68c3a]"
        >
          {isSidebarVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <MapWrapper 
          mapName={selectedMap.id} mapUrl={selectedMap.url}
          mode={mode} settings={settings} currentFloorId={currentFloorId} setCurrentFloorId={setCurrentFloorId}
          onFloorsLoaded={handleFloorsLoaded} editorPassword={editorPassword}
          markers={markers} setMarkers={setMarkers} markerTypes={markerTypes} activeFilters={activeFilters}
          flyToMarker={flyToMarker} setFlyToMarker={setFlyToMarker} addLocalPendingId={addLocalPendingId}
        />
      </div>

      {isSettingsOpen && <SettingsModal mapName={selectedMap.id} settings={settings} saveSettings={saveSettings} close={() => setIsSettingsOpen(false)} editorPassword={editorPassword} />}
      {isLoginOpen && <LoginModal />}

      {isChangelogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] p-6 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Changelog</h2>
              <button onClick={() => setIsChangelogOpen(false)} className="text-gray-400 hover:text-white">Close</button>
            </div>
            <div className="overflow-y-auto space-y-3 flex-1 pr-2">
              {changelog.map(m => (
                <div key={m.id} className="bg-[#2a2a2a] p-3 rounded flex justify-between items-center border border-[#333]">
                  <div className="flex items-center gap-3">
                    <img src={`/icons/${m.type}.png`} alt="icon" className="w-8 h-8 object-contain" />
                    <div>
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        {m.title}
                        {m.status !== 'approved' && <span className={`px-1.5 py-0.5 rounded text-[10px] text-white font-bold tracking-wider ${m.status === 'pending-edit' ? 'bg-blue-600' : 'bg-green-600'}`}>{m.status === 'pending-edit' ? 'PENDING EDIT' : 'PENDING NEW'}</span>}
                      </h3>
                      <p className="text-xs text-gray-400">{m.type.replace(/-/g, ' ')} • {formatDate(m.createdAt, !!editorPassword)}{m.submitter && ` • By ${m.submitter}`}</p>
                    </div>
                  </div>
                  <button onClick={() => { setCurrentFloorId(m.floorId); setFlyToMarker(m); setIsChangelogOpen(false); }} className="bg-[#444] hover:bg-[#555] px-3 py-1.5 rounded text-xs font-bold transition-colors">Show on Map</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isApprovalsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] p-6 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Approval Queue ({pendingQueue.length})</h2>
              <button onClick={() => setIsApprovalsOpen(false)} className="text-gray-400 hover:text-white">Close</button>
            </div>
            <div className="overflow-y-auto space-y-3 flex-1 pr-2">
              {pendingQueue.map(m => {
                const orig = m.originalId ? markers.find(x => x.id === m.originalId) : null;
                const isExternalImage = m.imageUrl && m.imageUrl.startsWith('http') && !m.imageUrl.includes('vercel-storage.com');

                return (
                  <div key={m.id} className="bg-[#2a2a2a] p-3 rounded flex flex-col border border-[#333]">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        {m.imageUrl ? (
                          <img src={m.imageUrl} alt="thumb" loading="lazy" className="w-12 h-12 rounded object-cover border border-[#444] cursor-zoom-in hover:opacity-80" onClick={() => setEnlargedImage(m.imageUrl)} />
                        ) : <div className="w-12 h-12 rounded bg-[#1f1f1f] border border-[#444] flex items-center justify-center text-xs text-gray-600">No Img</div>}
                        <div>
                          <h3 className="font-bold text-[#e68c3a] uppercase text-xs flex items-center gap-2">
                            {m.type.replace(/-/g, ' ')}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] text-white font-bold tracking-wider ${m.isDeletion ? 'bg-red-600' : m.originalId ? 'bg-blue-600' : 'bg-green-600'}`}>{m.isDeletion ? 'DELETION' : m.originalId ? 'EDIT' : 'NEW'}</span>
                          </h3>
                          <p className="font-bold text-sm text-white">{m.title}</p>
                          {m.submitter && <p className="text-xs text-gray-400">By: {m.submitter}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setCurrentFloorId(m.floorId); setFlyToMarker(m); setIsApprovalsOpen(false); }} className="bg-[#444] hover:bg-[#555] px-3 py-1.5 rounded text-xs font-bold text-white transition-colors">Show on Map</button>
                        <button onClick={async () => {
                          await approveMarker(m.id, editorPassword);
                          setPendingQueue(q => q.filter(x => x.id !== m.id));
                          getMarkers(selectedMap.id).then(setMarkers); 
                        }} className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-xs font-bold text-white transition-colors">Approve</button>
                        <button onClick={async () => {
                          await deleteMarker(m.id, editorPassword);
                          setPendingQueue(q => q.filter(x => x.id !== m.id));
                        }} className="bg-[#7a2c2c] hover:bg-[#8f3636] px-3 py-1.5 rounded text-xs font-bold text-white transition-colors">Reject</button>
                      </div>
                    </div>
                    
                    {isExternalImage && (
                      <div className="mt-3 p-2 bg-[#1f1f1f] rounded border border-yellow-600/50 flex flex-col gap-1">
                        <span className="text-yellow-500 text-xs font-bold flex items-center gap-1"><AlertTriangle size={12} /> External Image Source</span>
                        <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline truncate">{m.imageUrl}</a>
                        <span className="text-[9px] text-gray-500">Will be automatically downloaded and secured upon approval.</span>
                      </div>
                    )}

                    {m.isDeletion ? (
                      <div className="mt-3 p-2 bg-[#1f1f1f] rounded border border-red-900/50 text-xs space-y-1">
                        <p className="text-red-400 font-bold">User requested to permanently delete this marker.</p>
                        {m.deletionReason && <p className="text-gray-300 italic bg-black/40 p-2 rounded mt-2 border border-red-900/30">&quot;{m.deletionReason}&quot;</p>}
                      </div>
                    ) : orig && (
                      <div className="mt-3 p-2 bg-[#1f1f1f] rounded border border-[#333] text-xs space-y-1">
                        <p className="text-gray-400 font-bold mb-1">Proposed Changes:</p>
                        {orig.title !== m.title && <p>Location: <span className="line-through text-gray-500">{orig.title}</span> <span className="text-green-400">➔ {m.title}</span></p>}
                        {orig.type !== m.type && <p>Type: <span className="line-through text-gray-500">{orig.type}</span> <span className="text-green-400">➔ {m.type}</span></p>}
                        {orig.description !== m.description && <p>Desc: <span className="line-through text-gray-500">{orig.description || 'None'}</span> <span className="text-green-400">➔ {m.description || 'None'}</span></p>}
                        {orig.imageUrl !== m.imageUrl && <p className="text-blue-400">Image changed</p>}
                        
                        {(orig.lat !== m.lat || orig.lng !== m.lng || orig.floorId !== m.floorId) && (
                          <div className="mt-3 mb-1">
                            <p className="text-[#e68c3a] font-bold mb-2">Position changed (Preview):</p>
                            <div className="w-full h-48 rounded border border-[#444] relative overflow-hidden">
                              <MiniMap marker={m} originalMarker={orig} mapUrl={selectedMap.url} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {enlargedImage && <Lightbox src={enlargedImage} onClose={() => setEnlargedImage(null)} />}
    </main>
  );
}
