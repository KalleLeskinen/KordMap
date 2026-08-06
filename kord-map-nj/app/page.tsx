'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import MapViewer from '@/components/MapViewer';
import CreatePointModal from '@/components/CreatePointModal';
import PointViewer from '@/components/PointViewer';
import AuthModal from '@/components/AuthModal';
import MapSettingsModal from '@/components/MapSettingsModal';
import { PointData, MapScaleValue } from '@/types';

const persistMapData = async (map: string, kind: 'mapdata' | 'points' | 'images', payload: unknown, pass: string) => {
    const response = await fetch(`/api/maps?map=${encodeURIComponent(map)}&kind=${kind}&pass=${encodeURIComponent(pass)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Failed to save ${kind}`);
    }
};

const normalizeMapScale = (value: MapScaleValue | null | undefined) => {
    if (Array.isArray(value)) {
        const [baseValue, zoomValue] = value;
        return {
            multiplier: Number(baseValue ?? 1),
            zoomDistance: Number(zoomValue ?? 7)
        };
    }

    const numericValue = typeof value === 'number' ? value : Number(value ?? 1);
    return {
        multiplier: Number.isFinite(numericValue) ? numericValue : 1,
        zoomDistance: Number.isFinite(numericValue) ? numericValue : 7
    };
};

const normalizeLoadedPointImages = (points: PointData[], loadedImages: Record<string, string> = {}) => {
    const nextImages = { ...loadedImages };
    const nextPoints = points.map((point) => {
        const resolvedImageId = point.imageId ?? (point.image ? point.id : null) ?? (point.image ? `img-${point.id}` : null);

        if (point.image && resolvedImageId) {
            nextImages[resolvedImageId] = point.image;
        }

        const resolvedImage = point.image
            ? point.image
            : (resolvedImageId ? nextImages[resolvedImageId] ?? null : null);

        return {
            ...point,
            imageId: resolvedImageId,
            image: resolvedImage ?? null
        };
    });

    return { points: nextPoints, images: nextImages };
};

export default function App() {
    const [isSelectingMap, setIsSelectingMap] = useState(true);
    const [currentMap, setCurrentMap] = useState('');
    const [activeFloor, setActiveFloor] = useState('floor-1');
    const [mode, setMode] = useState<'VIEW' | 'ADD' | 'MOVE'>('VIEW');
    
    // Auth State
    const [editorPassword, setEditorPassword] = useState('');
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    
    // Map Config State
    const [availableFloors, setAvailableFloors] = useState<string[]>([]);
    const [availableIcons, setAvailableIcons] = useState<string[]>([]);
    const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
    const [mapScale, setMapScale] = useState<number>(1);
    const [zoomStartDistance, setZoomStartDistance] = useState<number>(7);
    
    // Point Data State
    const [points, setPoints] = useState<PointData[]>([]);
    const [images, setImages] = useState<Record<string, string>>({});
    
    // Modal & Tooltip State
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [pendingCoords, setPendingCoords] = useState<{x: number, y: number} | null>(null);
    const [viewedPoint, setViewedPoint] = useState<PointData | null>(null);
    const [viewedPosition, setViewedPosition] = useState<{x: number, y: number} | null>(null);
    const [editingPoint, setEditingPoint] = useState<PointData | null>(null);
    const initialLoadRef = useRef(true);
    const pointsSaveTimeoutRef = useRef<number | null>(null);

    const saveMapSettings = async (newFloors: string[], newIcons: string[], newMapScale: number, newZoomStartDistance: number) => {
        if (!editorPassword || !currentMap) return;

        try {
            const mapDataPayload = {
                floors: newFloors,
                icons: newIcons,
                mapScale: [newMapScale, newZoomStartDistance]
            };

            await persistMapData(currentMap, 'mapdata', mapDataPayload, editorPassword);
        } catch (err) {
            console.error('Failed to save map settings', err);
            alert('Map settings could not be saved to storage.');
        }
    };

    const savePoints = async (nextPoints: PointData[]) => {
        if (!editorPassword || !currentMap) return;

        try {
            const pointsForSave = nextPoints.map(({ image, ...rest }) => ({
                ...rest,
                imageId: rest.imageId ?? (image ? rest.id : null)
            }));

            const nextImages: Record<string, string> = Object.fromEntries(
                nextPoints
                    .filter((point) => point.image && (point.imageId || point.id))
                    .map((point) => [(point.imageId ?? point.id), point.image as string])
            );

            await persistMapData(currentMap, 'points', { points: pointsForSave }, editorPassword);
            await persistMapData(currentMap, 'images', { images: nextImages }, editorPassword);
            setImages(nextImages);
        } catch (err) {
            console.error('Failed to save map points', err);
            alert('Map points could not be saved to storage.');
        }
    };

    // Initial Load
    useEffect(() => {
        const savedPass = localStorage.getItem('editor_pass');
        if (savedPass) setEditorPassword(savedPass);

        if (!currentMap) return;
        const loadMapData = async () => {
            try {
                const configRes = await fetch(`/api/maps?map=${encodeURIComponent(currentMap)}&kind=mapdata`);
                if (configRes.ok) {
                    const parsedData = await configRes.json();
                    const icons = parsedData.icons || [];
                    const parsedScale = normalizeMapScale(parsedData.mapScale);
                    setAvailableIcons(icons);
                    setAvailableFloors(parsedData.floors || ['0', '1']);
                    setMapScale(parsedScale.multiplier);
                    setZoomStartDistance(parsedScale.zoomDistance);
                    setActiveFilters(new Set(icons));
                }

                const imagesRes = await fetch(`/api/maps?map=${encodeURIComponent(currentMap)}&kind=images`);
                let loadedImages: Record<string, string> = {};
                if (imagesRes.ok) {
                    const parsedImages = await imagesRes.json();
                    loadedImages = parsedImages.images || {};
                }

                const pointsRes = await fetch(`/api/maps?map=${encodeURIComponent(currentMap)}&kind=points`);
                if (pointsRes.ok) {
                    const parsedPoints = await pointsRes.json();
                    const { points: normalizedPoints, images: normalizedImages } = normalizeLoadedPointImages(parsedPoints.points || [], loadedImages);
                    setPoints(normalizedPoints);
                    setImages(normalizedImages);
                } else {
                    setPoints([]);
                    setImages({});
                }
                initialLoadRef.current = false;
            } catch (err) {
                console.error("Error loading map data", err);
                initialLoadRef.current = false;
            }
        };
        loadMapData();
    }, [currentMap]);

    useEffect(() => {
        if (initialLoadRef.current || !editorPassword || !currentMap) return;

        if (pointsSaveTimeoutRef.current !== null) {
            window.clearTimeout(pointsSaveTimeoutRef.current);
        }

        pointsSaveTimeoutRef.current = window.setTimeout(() => {
            void savePoints(points);
            pointsSaveTimeoutRef.current = null;
        }, 400);

        return () => {
            if (pointsSaveTimeoutRef.current !== null) {
                window.clearTimeout(pointsSaveTimeoutRef.current);
                pointsSaveTimeoutRef.current = null;
            }
        };
    }, [points, editorPassword, currentMap]);

    // Auth Handlers
    const handleLogin = async (pass: string) => {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });
        if (res.ok) {
            setEditorPassword(pass);
            localStorage.setItem('editor_pass', pass);
            return true;
        }
        return false;
    };

    const handleLogout = () => {
        setEditorPassword('');
        localStorage.removeItem('editor_pass');
        setMode('VIEW');
        setCreateModalOpen(false);
        setEditingPoint(null);
        setSettingsModalOpen(false);
    };

    // Filter Handlers
    const toggleFilter = (icon: string) => {
        const newFilters = new Set(activeFilters);
        if (newFilters.has(icon)) newFilters.delete(icon);
        else newFilters.add(icon);
        setActiveFilters(newFilters);
    };

    const handleExport = () => {
        if (points.length === 0) return alert("No document to export!");
        const dataStr = JSON.stringify({ map: currentMap, mapScale: [mapScale, zoomStartDistance], points }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentMap}-points.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.map && parsed.map !== currentMap) {
                    if (!confirm(`Warning: document data is tagged for '${parsed.map}', but current Map is '${currentMap}'. Load anyway?`)) return;
                }
                const { points: normalizedPoints, images: normalizedImages } = normalizeLoadedPointImages(parsed.points || []);
                setPoints(normalizedPoints);
                setImages(normalizedImages);
                if (parsed.mapScale) {
                    const parsedScale = normalizeMapScale(parsed.mapScale);
                    setMapScale(parsedScale.multiplier);
                    setZoomStartDistance(parsedScale.zoomDistance);
                }
            } catch (err) {
                alert("Data corruption detected. File invalid.");
            }
        };
        reader.readAsText(file);
        e.target.value = ""; 
    };

    return (
        <div className="flex h-screen bg-[#09090a] text-[#c4c5c7] overflow-hidden select-none">
            {isSelectingMap && (
                <div className="fixed inset-0 bg-[#121315] flex flex-col items-center justify-center z-[200]">
                    <h1 className="text-[#d18d32] font-normal tracking-[2px] uppercase mb-5 text-[2rem]">Select Map</h1>
                    <div className="flex gap-5 mt-5">
                        {['customs', 'factory'].map(mapName => (
                            <div 
                                key={mapName}
                                onClick={() => {
                                    setCurrentMap(mapName);
                                    setIsSelectingMap(false);
                                    setPoints([]); 
                                    setActiveFloor('floor-1'); 
                                }}
                                className="bg-[#191b1d] p-[30px_50px] rounded-[4px] text-[1.25rem] font-bold cursor-pointer transition-all duration-200 border border-[#282a2e] uppercase tracking-[1px] text-[#72757a] hover:bg-[#232528] hover:border-[#d18d32] hover:text-[#d18d32] hover:-translate-y-[3px] shadow-[0_5px_15px_rgba(0,0,0,0.5)]"
                            >
                                {mapName}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Sidebar 
                currentMap={currentMap}
                activeFloor={activeFloor}
                setActiveFloor={(f) => { setActiveFloor(f); setViewedPoint(null); }}
                mode={mode}
                setMode={(m) => { setMode(m); setViewedPoint(null); }}
                availableFloors={availableFloors}
                availableIcons={availableIcons}
                activeFilters={activeFilters}
                toggleFilter={toggleFilter}
                isAuthenticated={!!editorPassword}
                onLoginClick={() => setAuthModalOpen(true)}
                onLogoutClick={handleLogout}
                onExport={handleExport}
                onLoad={handleLoad}
                onChangeMap={() => setIsSelectingMap(true)}
                onOpenSettings={() => setSettingsModalOpen(true)}
            />
            
            <MapViewer 
                currentMap={currentMap}
                activeFloor={activeFloor}
                points={points}
                activeFilters={activeFilters}
                mode={mode}
                mapScale={mapScale}
                zoomStartDistance={zoomStartDistance}
                onMapClick={(x, y) => {
                    if (mode === 'ADD' && !!editorPassword) {
                        setEditingPoint(null);
                        setPendingCoords({ x, y });
                        setCreateModalOpen(true);
                    } else if (mode === 'VIEW') {
                        setViewedPoint(null);
                    }
                }}
                onPointClick={(pt, x, y) => {
                    if (pt.floor !== activeFloor) {
                        setActiveFloor(pt.floor);
                    }
                    setViewedPoint(pt);
                    setViewedPosition({ x, y });
                }}
                onPointMove={(id, x, y) => {
                    if (!!editorPassword) {
                        setPoints(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
                    }
                }}
            />

            <CreatePointModal 
                isOpen={createModalOpen}
                pendingCoords={pendingCoords}
                activeFloor={activeFloor}
                availableIcons={availableIcons}
                editPoint={editingPoint}
                editorPassword={editorPassword}
                onClose={() => {
                    setCreateModalOpen(false);
                    setEditingPoint(null);
                }}
                onSave={(newPoint) => {
                    const nextPoints = editingPoint
                        ? points.map(p => p.id === newPoint.id ? newPoint : p)
                        : [...points, newPoint];

                    setPoints(nextPoints);
                    setCreateModalOpen(false);
                    setEditingPoint(null);
                }}
            />

            <PointViewer 
                point={viewedPoint}
                position={viewedPosition}
                isAuthenticated={!!editorPassword}
                onClose={() => setViewedPoint(null)}
                onDelete={(id) => {
                    setPoints(prev => {
                        const nextPoints = prev.filter(p => p.id !== id);
                        void savePoints(nextPoints);
                        return nextPoints;
                    });
                    setViewedPoint(null);
                }}
                onEdit={() => {
                    setEditingPoint(viewedPoint);
                    setPendingCoords({ x: viewedPoint!.x, y: viewedPoint!.y });
                    setCreateModalOpen(true);
                    setViewedPoint(null); 
                }}
            />

            <AuthModal 
                isOpen={authModalOpen} 
                onClose={() => setAuthModalOpen(false)} 
                onLogin={handleLogin} 
            />

            <MapSettingsModal
                isOpen={settingsModalOpen}
                initialFloors={availableFloors}
                initialIcons={availableIcons}
                initialMapScale={mapScale}
                initialZoomStartDistance={zoomStartDistance}
                onClose={() => setSettingsModalOpen(false)}
                onSave={async (newFloors, newIcons, newMapScale, newZoomStartDistance) => {
                    setAvailableFloors(newFloors);
                    setAvailableIcons(newIcons);
                    setMapScale(newMapScale);
                    setZoomStartDistance(newZoomStartDistance);
                    
                    const updatedFilters = new Set(activeFilters);
                    newIcons.forEach(icon => updatedFilters.add(icon));
                    Array.from(updatedFilters).forEach(icon => {
                        if (!newIcons.includes(icon)) updatedFilters.delete(icon);
                    });
                    setActiveFilters(updatedFilters);

                    await saveMapSettings(newFloors, newIcons, newMapScale, newZoomStartDistance);
                }}
            />
        </div>
    );
}