'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DOMPurify from 'dompurify';
import { MapSettings, Floor } from '@/app/page';
import { createMarker, updateMarker, deleteMarker, uploadImage, suggestDeleteMarker } from '@/app/actions/markers';
import { Plus, Minus, Sun, AlertTriangle } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export const NATIVE_SIZE = 8192;
export const bounds: L.LatLngBoundsExpression = [[-NATIVE_SIZE, 0], [0, NATIVE_SIZE]];

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX_WIDTH = width > height ? 1920 : 1080;
        const MAX_HEIGHT = width > height ? 1080 : 1920;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        while (dataUrl.length > 1000000 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/webp', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
  });
};

function PopupImage({ src, onClick }: { src: string; onClick: () => void }) {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <div className="relative w-full h-32 bg-[#0a0a0a] border border-[#333] rounded overflow-hidden mt-1 cursor-zoom-in group" onClick={onClick}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] animate-pulse">
          <svg className="w-6 h-6 text-gray-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
      )}
      <img src={src} loading="lazy" alt="Location" onLoad={() => setIsLoaded(true)} className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`} />
    </div>
  );
}

function LayeredSvgOverlay({ url, hardwareAcceleration, currentFloorId, onFloorsLoaded, setAllFloors, brightness }: any) {
  const map = useMap();
  const svgRef = useRef<SVGElement | null>(null);
  const floorsRef = useRef<Floor[]>([]);

  useEffect(() => {
    let isMounted = true;
    let svgLayer: L.SVGOverlay | null = null;
    fetch(url).then((res) => res.text()).then((rawSvgText) => {
        if (!isMounted) return;

        const cleanSvgText = DOMPurify.sanitize(rawSvgText, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ['script'], 
          FORBID_ATTR: ['onmouseover', 'onload', 'onerror']
        });

        const parser = new DOMParser();
        const doc = parser.parseFromString(cleanSvgText, "image/svg+xml");
        const svgElement = doc.documentElement as unknown as SVGElement;

        if (!svgElement.getAttribute("xmlns")) svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (!svgElement.getAttribute("viewBox")) svgElement.setAttribute("viewBox", `0 0 8192 8192`);
        svgElement.setAttribute("shape-rendering", "optimizeSpeed");
        svgElement.style.pointerEvents = 'none';
        
        let groups = Array.from(svgElement.children).filter(el => el.tagName.toLowerCase() === 'g');
        if (groups.length === 1) {
          const innerGroups = Array.from(groups[0].children).filter(el => el.tagName.toLowerCase() === 'g');
          if (innerGroups.length > 0) groups = innerGroups;
        }

        const extractedFloors: Floor[] = groups.map((g, index) => {
          const rawId = g.getAttribute('id') || `Layer_${index}`;
          const name = rawId.replace(/_x20_/g, ' ').replace(/_/g, ' ');
          return { id: rawId, name };
        });

        floorsRef.current = extractedFloors;
        svgRef.current = svgElement;
        setAllFloors(extractedFloors); 

        svgLayer = L.svgOverlay(svgElement, bounds, { interactive: false });
        svgLayer.addTo(map);

        const uiFloors = extractedFloors.filter(f => f.name.toLowerCase().trim() !== 'ground level');
        onFloorsLoaded(uiFloors);
      });
    return () => { isMounted = false; if (svgLayer) map.removeLayer(svgLayer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url]);

  useEffect(() => {
    if (!svgRef.current) return;
    svgRef.current.style.willChange = hardwareAcceleration ? 'transform' : 'auto';
  }, [hardwareAcceleration]);

  useEffect(() => {
    if (!svgRef.current) return;
    svgRef.current.style.filter = `brightness(${brightness}%)`;
  }, [brightness]);

  useEffect(() => {
    if (!svgRef.current || !currentFloorId || floorsRef.current.length === 0) return;
    const floors = floorsRef.current;
    const currentIndex = floors.findIndex(f => f.id === currentFloorId);
    if (currentIndex === -1) return;

    const isFirstFloorSelected = floors[currentIndex].name.toLowerCase().includes('first floor');

    floors.forEach((floor, index) => {
      const gNode = svgRef.current!.querySelector(`g[id="${CSS.escape(floor.id)}"]`) as SVGGElement;
      if (!gNode) return;
      
      gNode.style.display = 'block'; 
      gNode.style.transition = 'opacity 0.4s ease-in-out, filter 0.4s ease-in-out, visibility 0.4s ease-in-out';

      if (floor.name.toLowerCase().trim() === 'ground level' && isFirstFloorSelected) {
        gNode.style.visibility = 'visible'; gNode.style.opacity = '1'; gNode.style.filter = 'none'; return; 
      }
      
      if (index > currentIndex) { 
        gNode.style.visibility = 'hidden'; gNode.style.opacity = '0'; gNode.style.filter = 'none';
      } else if (index === currentIndex) { 
        gNode.style.visibility = 'visible'; gNode.style.opacity = '1'; gNode.style.filter = 'none'; 
      } else if (index < currentIndex) { 
        gNode.style.visibility = 'visible'; gNode.style.opacity = '0.35'; gNode.style.filter = 'brightness(0.25) grayscale(0.6)'; 
      }
    });
  }, [currentFloorId]);
  return null;
}

function MapSettingsController({ settings }: { settings: MapSettings }) {
  const map = useMap();
  useEffect(() => {
    map.options.zoomDelta = settings.zoomStep;
    map.options.zoomSnap = settings.zoomStep;
    map.options.wheelPxPerZoomLevel = 60 / settings.zoomStep;
  }, [map, settings.zoomStep]);
  return null;
}

function MapResizeController() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function FlyToController({ flyToMarker, setFlyToMarker }: any) {
  const map = useMap();
  useEffect(() => {
    if (flyToMarker) {
      map.flyTo([flyToMarker.lat, flyToMarker.lng], 1, { duration: 0.5 });
      setFlyToMarker(null);
    }
  }, [flyToMarker, map, setFlyToMarker]);
  return null;
}

function MapCustomControls({ brightness, setBrightness }: { brightness: number, setBrightness: (v: number) => void }) {
  const map = useMap();
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  const handleBrightnessClick = () => {
    if (isOpen) { setIsOpen(false); setBrightness(100); } 
    else { setIsOpen(true); setBrightness(50); }
  };

  return (
    <div ref={controlRef} className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <div className="flex flex-col bg-[#1a1a1a] rounded-lg border border-[#333] shadow-xl overflow-hidden">
        <button title="Zoom In" onClick={() => map.zoomIn()} className="p-2 hover:bg-[#333] text-white border-b border-[#333] transition-colors"><Plus size={18}/></button>
        <button title="Zoom Out" onClick={() => map.zoomOut()} className="p-2 hover:bg-[#333] text-white transition-colors"><Minus size={18}/></button>
      </div>
      
      <div className="relative flex flex-col bg-[#1a1a1a] rounded-lg border border-[#333] shadow-xl">
        <button title="Map Brightness" onClick={handleBrightnessClick} className={`p-2 transition-colors ${isOpen ? 'bg-[#333] text-[#e68c3a]' : 'hover:bg-[#333] text-white'}`}>
          <Sun size={18}/>
        </button>
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl flex flex-col items-center gap-4">
            <span className="text-xs text-gray-400 font-bold">{brightness}%</span>
            <div className="h-24 w-6 flex items-center justify-center">
              <input type="range" min="10" max="100" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-24 h-1 bg-[#444] rounded appearance-none outline-none accent-[#e68c3a] -rotate-90 origin-center cursor-pointer" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MapProps { 
  mapName: string; mapUrl: string; mode: 'view' | 'edit'; settings: MapSettings; 
  currentFloorId: string | null; setCurrentFloorId: (id: string) => void; 
  onFloorsLoaded: (floors: Floor[]) => void; editorPassword?: string;
  markers: any[]; setMarkers: any; markerTypes: Record<string, string[]>; activeFilters: string[];
  flyToMarker: any; setFlyToMarker: any; addLocalPendingId: (id: string) => void;
}

export default function Map({ 
  mapName, mapUrl, mode, settings, currentFloorId, setCurrentFloorId, onFloorsLoaded, editorPassword,
  markers, setMarkers, markerTypes, activeFilters, flyToMarker, setFlyToMarker, addLocalPendingId
}: MapProps) {
  
  const [allFloors, setAllFloors] = useState<Floor[]>([]);
  const [pendingMarker, setPendingMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [isRelocating, setIsRelocating] = useState(false);
  
  const [formData, setFormData] = useState({ title: '', description: '', type: '', imageUrl: '', submitter: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);

  const [deletingMarkerId, setDeletingMarkerId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const [autoOpenMarkerId, setAutoOpenMarkerId] = useState<string | null>(null);

  useEffect(() => { if (mode === 'view') handleCloseModal(); }, [mode]);

  useEffect(() => {
    if (!allFloors.length || currentFloorId) return;
    const firstFloor = allFloors.find(f => f.name.toLowerCase().includes('first floor'));
    const firstFloorId = firstFloor ? firstFloor.id : allFloors[0].id;
    setCurrentFloorId(firstFloorId);
  }, [allFloors, currentFloorId, setCurrentFloorId]);

  useEffect(() => {
    const checkCooldown = () => {
      if (editorPassword) { setCooldownRemaining(0); return; }
      const lastSub = localStorage.getItem('kordLastSubmission');
      if (lastSub) {
        const diff = Math.ceil((parseInt(lastSub, 10) + 25000 - Date.now()) / 1000);
        if (diff > 0) setCooldownRemaining(diff);
        else setCooldownRemaining(0);
      }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [editorPassword]);

  const handleCloseModal = () => {
    setPendingMarker(null); setEditingMarkerId(null); setIsRelocating(false);
    setDeletingMarkerId(null); setDeleteReason("");
    setFormData({ title: '', description: '', type: '', imageUrl: '', submitter: '' });
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (mode === 'view') {
          const firstFloor = allFloors.find(f => f.name.toLowerCase().includes('first floor'));
          const firstFloorId = firstFloor ? firstFloor.id : (allFloors.length > 0 ? allFloors[0].id : null);
          if (firstFloorId && currentFloorId !== firstFloorId) setCurrentFloorId(firstFloorId);
          return;
        }

        if (mode === 'edit' && currentFloorId) {
          setPendingMarker({ lat: e.latlng.lat, lng: e.latlng.lng });
          setIsRelocating(false);
        }
      },
    });
    return null;
  };

  const handleEditClick = (marker: any) => {
    setEditingMarkerId(marker.id);
    setPendingMarker({ lat: marker.lat, lng: marker.lng });
    setFormData({ 
      title: marker.title, 
      description: marker.description || '', 
      type: marker.type, 
      imageUrl: marker.imageUrl || '', 
      submitter: '' // 🚀 Cleared out so the new editor can enter their name
    });
  };

  const handleDeleteClick = async (id: string) => {
    if (!editorPassword) {
      setDeletingMarkerId(id);
      return;
    }
    
    if (!confirm("Are you sure you want to delete this marker?")) return;
    const res = await deleteMarker(id, editorPassword);
    if (res.success) {
      setMarkers((prev: any[]) => prev.filter((m: any) => m.id !== id));
    } else {
      alert((res as any).error || "Failed to delete marker.");
    }
  };

  const submitDeletionSuggestion = async () => {
    if (!deletingMarkerId) return;
    setIsSubmitting(true);
    const res = await suggestDeleteMarker(deletingMarkerId, deleteReason);
    setIsSubmitting(false);
    
    if (res.success) {
      alert("Deletion suggestion submitted for approval.");
      setDeletingMarkerId(null);
      setDeleteReason("");
    } else {
      alert((res as any).error || "Error submitting deletion suggestion.");
    }
  };

  const handleSaveMarker = async () => {
    if (!pendingMarker || !currentFloorId || !formData.title.trim() || !formData.type) return;

    if (!editorPassword) {
      const lastSub = localStorage.getItem('kordLastSubmission');
      if (lastSub && Date.now() - parseInt(lastSub, 10) < 25000) {
        alert("Please wait a moment before submitting another marker.");
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      let finalImageUrl = formData.imageUrl;

      if (finalImageUrl.startsWith('data:image')) {
        setIsProcessingImage(true);
        const uploadedUrl = await uploadImage(finalImageUrl);
        setIsProcessingImage(false);
        
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          alert("Failed to upload image. You may be rate-limited, or storage is misconfigured.");
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        title: formData.title, description: formData.description, type: formData.type, 
        imageUrl: finalImageUrl, submitter: formData.submitter,
        lat: pendingMarker.lat, lng: pendingMarker.lng, floorId: currentFloorId, mapName: mapName,
      };

      let result;
      if (editingMarkerId) {
        result = await updateMarker(editingMarkerId, payload, editorPassword);
      } else {
        result = await createMarker(payload, editorPassword);
      }

      if (result?.success && result.marker) {
        if (!result.autoApproved && typeof addLocalPendingId === 'function') {
          addLocalPendingId(result.marker.id);
        }

        if (editingMarkerId && result.autoApproved) {
          setMarkers((prev: any[]) => prev.map((m: any) => m.id === editingMarkerId ? result.marker : m));
        } else {
          setMarkers((prev: any[]) => [result.marker, ...prev]);
        }

        if (!editorPassword) {
          localStorage.setItem('kordLastSubmission', Date.now().toString());
          setCooldownRemaining(25);
        }
        
        setSubmitSuccess(true);
        setTimeout(() => { setSubmitSuccess(false); handleCloseModal(); }, 1000);
      } else {
        alert(result?.error || "Error saving marker to database.");
      }
    } catch (err) {
      console.error("Fatal error during save:", err);
      alert("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setIsProcessingImage(true);
      const compressedWebP = await compressImage(file);
      setFormData({ ...formData, imageUrl: compressedWebP });
      setIsProcessingImage(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setIsProcessingImage(true);
      const compressedWebP = await compressImage(file);
      setFormData({ ...formData, imageUrl: compressedWebP });
      setIsProcessingImage(false);
    }
  };

  const getCustomIcon = (typeId: string, isGhost: boolean, direction: 'up' | 'down' | null) => {
    const scale = settings.iconScale || 1;
    const size = 32 * scale;
    let ghostStyles = ''; let arrowHtml = '';
    if (isGhost) {
      ghostStyles = `opacity: 0.3; filter: grayscale(0.5);`; 
      const arrowColor = direction === 'up' ? '#22c55e' : '#ef4444';
      const arrowChar = direction === 'up' ? '▲' : '▼';
      arrowHtml = `<div style="position: absolute; top: -${4 * scale}px; right: -${4 * scale}px; width: ${14 * scale}px; height: ${14 * scale}px; background: rgba(0,0,0,0.8); border-radius: 50%; border: 1px solid #444; color: ${arrowColor}; display: flex; align-items: center; justify-content: center; z-index: 10; font-size: ${9 * scale}px; font-weight: bold; line-height: 1;">${arrowChar}</div>`;
    }
    return L.divIcon({
      html: `<div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; ${ghostStyles}"><img src="/icons/${typeId}.png" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(1px 1px 0px white) drop-shadow(-1px 1px 0px white) drop-shadow(1px -1px 0px white) drop-shadow(-1px -1px 0px white) drop-shadow(0px 3px 6px rgba(0,0,0,0.6));" />${arrowHtml}</div>`,
      className: `bg-transparent border-none marker-type-${typeId} ${isGhost ? 'is-ghost' : ''}`, 
      iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2)],
    });
  };

  const pendingEdits = markers.filter(m => !m.approved && m.originalId && !m.isDeletion);
  const hiddenOriginalIds = new Set(pendingEdits.map(m => m.originalId));
  const visibleMarkers = markers.filter(m => !hiddenOriginalIds.has(m.id) && !m.isDeletion);

  return (
    <div className="relative w-full h-full">
      <MapContainer crs={L.CRS.Simple} bounds={bounds} maxZoom={3} minZoom={-5} zoomControl={false} style={{ height: '100%', width: '100%', backgroundColor: '#121212' }}>
        <MapResizeController />
        <MapSettingsController settings={settings} />
        <FlyToController flyToMarker={flyToMarker} setFlyToMarker={setFlyToMarker} />
        <MapCustomControls brightness={brightness} setBrightness={setBrightness} />

        <LayeredSvgOverlay url={mapUrl} hardwareAcceleration={settings.hardwareAcceleration} currentFloorId={currentFloorId} onFloorsLoaded={onFloorsLoaded} setAllFloors={setAllFloors} brightness={brightness} />
        <MapClickHandler />

        {visibleMarkers
          .filter((marker) => activeFilters.includes(marker.type))
          .filter((marker) => marker.id !== editingMarkerId)
          .map((marker) => {
            const currentIndex = allFloors.findIndex(f => f.id === currentFloorId);
            const markerIndex = allFloors.findIndex(f => f.id === marker.floorId);
            const isGhost = currentIndex !== -1 && markerIndex !== -1 && currentIndex !== markerIndex;
            let direction: 'up' | 'down' | null = null;
            if (isGhost) direction = markerIndex > currentIndex ? 'up' : 'down';

            return (
              <Marker 
                key={`${marker.id}-scale-${settings.iconScale}`} 
                position={[marker.lat, marker.lng]} 
                icon={getCustomIcon(marker.type, isGhost, direction)}
                zIndexOffset={isGhost ? -1000 : 0}
                eventHandlers={isGhost ? { 
                  click: () => {
                    setCurrentFloorId(marker.floorId);
                    setAutoOpenMarkerId(marker.id);
                  } 
                } : undefined}
                ref={(ref) => {
                  if (ref && autoOpenMarkerId === marker.id && !isGhost) {
                    setTimeout(() => {
                      ref.openPopup();
                      setAutoOpenMarkerId(null);
                    }, 50);
                  }
                }}
              >
                {!isGhost && (
                  <Popup>
                    <div className="flex flex-col w-full bg-[#161616] text-white select-none">
                      <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <img src={`/icons/${marker.type}.png`} alt="icon" className="w-5 h-5 object-contain" />
                          <h3 className="font-bold text-[13px] uppercase tracking-wider text-[#e68c3a] flex items-center gap-2">
                            {marker.type.replace(/-/g, ' ')}
                            {!marker.approved && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white font-bold tracking-wider">PENDING APPROVAL</span>
                            )}
                          </h3>
                        </div>
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        <p className="text-sm text-gray-200 leading-snug font-bold">
                          {marker.title}
                        </p>
                        
                        <div className="flex flex-col border-t border-[#333] pt-2 mt-1 gap-1">
                           <p className="text-[10px] text-gray-400 font-medium">
                             {marker.submitter ? `Added by ${marker.submitter} on ` : `Added on `}
                             <span className="text-gray-500">{new Date(marker.createdAt).toLocaleDateString()}</span>
                           </p>
                           {marker.lastEditor && new Date(marker.updatedAt).getTime() - new Date(marker.createdAt).getTime() > 1000 && (
                             <p className="text-[10px] text-gray-400 font-medium">
                               Edited by {marker.lastEditor} on <span className="text-gray-500">{new Date(marker.updatedAt).toLocaleDateString()}</span>
                             </p>
                           )}
                        </div>

                        {marker.imageUrl && (
                          <PopupImage src={marker.imageUrl} onClick={() => setEnlargedImage(marker.imageUrl)} />
                        )}
                        
                        {mode === 'edit' && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEditClick(marker); }} className="flex-1 bg-[#222] border border-[#333] hover:bg-[#333] py-2 rounded text-[11px] font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors">Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteClick(marker.id); }} className="flex-1 bg-[#7a2c2c] hover:bg-[#8f3636] py-2 rounded text-[11px] font-bold uppercase tracking-wider text-white transition-colors">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            );
        })}
        {pendingMarker && <Marker position={[pendingMarker.lat, pendingMarker.lng]} zIndexOffset={2000} />}
      </MapContainer>

      {(pendingMarker && isRelocating) && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 px-6 py-3 rounded-full shadow-2xl text-white font-bold animate-pulse pointer-events-none">
          Click anywhere on the map to set new location
        </div>
      )}

      {(pendingMarker && !isRelocating) && (
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-[#1a1a1a] p-5 rounded-lg border border-[#333] shadow-2xl w-80 text-white transition-all overflow-visible"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-50 pointer-events-none">
              <span className="font-bold text-blue-400 text-lg">Drop image to add</span>
            </div>
          )}

          {submitSuccess ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-green-400">Success!</h3>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{editingMarkerId ? 'Edit Marker' : 'Place New Marker'}</h3>
                {editingMarkerId && (
                  <button onClick={() => setIsRelocating(true)} className="text-xs bg-[#222] border border-[#444] hover:bg-[#333] px-2 py-1 rounded">Move Marker</button>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-xs text-gray-400 uppercase font-bold">Category / Type</label>
                  <div className={`w-full bg-[#2a2a2a] border ${!formData.type ? 'border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'border-[#444] hover:border-[#e68c3a]'} rounded p-2 text-sm mt-1 cursor-pointer flex items-center justify-between transition-all`} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <div className="flex items-center gap-2">
                      {formData.type ? (
                        <>
                          <img src={`/icons/${formData.type}.png`} alt="icon" className="w-5 h-5 object-contain" />
                          <span className="capitalize">{formData.type.replace(/-/g, ' ')}</span>
                        </>
                      ) : <span className="text-red-400 font-medium">Select marker type...</span>}
                    </div>
                    {!formData.type && <AlertTriangle size={16} className="text-red-500" />}
                  </div>
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-[#2a2a2a] border border-[#444] rounded shadow-xl max-h-48 overflow-y-auto z-[2010]">
                      {Object.entries(markerTypes).map(([category, types]) => (
                        <div key={category}>
                          <div className="px-2 py-1 text-xs font-bold text-gray-500 bg-[#222]">{category}</div>
                          {types.map(type => {
                            const typeId = type.toLowerCase().replace(/\s+/g, '-');
                            return (
                              <div key={typeId} className="flex items-center gap-2 p-2 hover:bg-[#333] cursor-pointer text-sm" onClick={() => { setFormData({...formData, type: typeId}); setIsDropdownOpen(false); }}>
                                <img src={`/icons/${typeId}.png`} alt={type} className="w-5 h-5 object-contain" />
                                <span>{type}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold">Location</label>
                  <div className="relative mt-1">
                    <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={`w-full bg-[#2a2a2a] border ${!formData.title.trim() ? 'border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'border-[#444] focus:border-[#e68c3a]'} rounded p-2 text-sm outline-none pr-8 transition-all`} placeholder="e.g. Castle barracks" />
                    {!formData.title.trim() && <AlertTriangle size={16} className="text-red-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold">
                    {editingMarkerId ? 'Editor Name (Optional)' : 'Submitter Name (Optional)'}
                  </label>
                  <input type="text" value={formData.submitter} onChange={(e) => setFormData({...formData, submitter: e.target.value})} className="w-full bg-[#2a2a2a] border border-[#444] rounded p-2 text-sm mt-1 outline-none focus:border-[#e68c3a]" placeholder="Your name..." />
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold flex justify-between">
                    <span>Image</span>
                    <span className="text-gray-600 font-normal">URL, Drop, or Select</span>
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input type="text" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="flex-1 bg-[#2a2a2a] border border-[#444] rounded p-2 text-sm outline-none focus:border-[#e68c3a]" placeholder="https://..." />
                    <input type="file" id="file-upload" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <label htmlFor="file-upload" className="bg-[#333] hover:bg-[#444] border border-[#444] px-3 rounded flex items-center justify-center cursor-pointer text-xs font-bold transition-colors">FILE</label>
                  </div>
                  {isProcessingImage ? (
                     <div className="mt-2 text-[10px] text-blue-400 font-bold text-right animate-pulse">Processing...</div>
                  ) : formData.imageUrl && formData.imageUrl.startsWith('data:image') ? (
                     <div className="mt-2 text-[10px] text-green-500 font-bold text-right">✓ Image Attached</div>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={handleCloseModal} className="flex-1 bg-[#333] hover:bg-[#444] py-2 rounded text-sm transition-colors">Cancel</button>
                <button 
                  onClick={handleSaveMarker} disabled={isSubmitting || isProcessingImage || !formData.title.trim() || !formData.type || cooldownRemaining > 0}
                  className="flex-1 bg-[#e68c3a] hover:bg-[#cf7d34] disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded text-sm transition-colors font-medium shadow text-black"
                >
                  {isSubmitting ? 'Saving...' : isProcessingImage ? 'Compressing...' : cooldownRemaining > 0 ? `Wait (${cooldownRemaining}s)` : (editorPassword ? 'Publish' : 'Submit')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 🚀 DELETION REASON MODAL */}
      {deletingMarkerId && (
        <div className="fixed inset-0 z-[3000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#333] p-5 rounded-lg w-80 shadow-2xl text-white">
            <h3 className="font-bold text-lg text-red-500 mb-2">Suggest Deletion</h3>
            <p className="text-xs text-gray-400 mb-4">Please provide a reason for removing this marker from the map.</p>
            <textarea
              value={deleteReason} 
              onChange={e => setDeleteReason(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded p-2 text-sm h-24 resize-none outline-none focus:border-red-500 mb-4"
              placeholder="e.g. This loot spawn was removed in the latest patch..."
            />
            <div className="flex gap-2">
              <button 
                onClick={() => { setDeletingMarkerId(null); setDeleteReason(""); }} 
                className="flex-1 bg-[#333] hover:bg-[#444] py-2 rounded text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={submitDeletionSuggestion} 
                disabled={isSubmitting || !deleteReason.trim()} 
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded text-sm transition-colors font-medium shadow-lg"
              >
                {isSubmitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {enlargedImage && (
        <div className="fixed inset-0 z-[4000] bg-black/90 flex items-center justify-center p-8 cursor-zoom-out backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} className="max-w-full max-h-full object-contain rounded shadow-2xl" alt="Enlarged Location" />
        </div>
      )}
    </div>
  );
}
