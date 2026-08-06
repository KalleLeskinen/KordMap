'use client';
import React, { useEffect, useRef, useState } from 'react';
import { PointData } from '@/types';

interface MapViewerProps {
    currentMap: string;
    activeFloor: string;
    points: PointData[];
    activeFilters: Set<string>;
    mode: 'VIEW' | 'ADD' | 'MOVE';
    mapScale?: number;
    zoomStartDistance?: number;
    onMapClick: (x: number, y: number) => void;
    onPointClick: (point: PointData, x: number, y: number) => void;
    onPointMove: (id: string, x: number, y: number) => void;
}

export default function MapViewer({
    currentMap,
    activeFloor,
    points,
    activeFilters,
    mode,
    mapScale = 1,
    zoomStartDistance = 7,
    onMapClick,
    onPointClick,
    onPointMove
}: MapViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const transformWrapperRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<SVGSVGElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const viewBoxRef = useRef({ x: 0, y: 0, w: 1000, h: 1000 });
    const initialWidthRef = useRef(1000);
    const initializedMapRef = useRef<string | null>(null);
    const [scale, setScale] = useState(1);

    // Fetch the SVG
    useEffect(() => {
        if (!currentMap) return;
        fetch(`/maps/${currentMap}/${currentMap}.svg`)
            .then(res => res.text())
            .then(text => setSvgContent(text))
            .catch(err => console.error("Failed to load map SVG", err));
    }, [currentMap]);

    // Handle Floor Visibility
    useEffect(() => {
        if (!containerRef.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (!svg) return;

        const activeNum = parseInt(activeFloor.replace('floor-', ''));
        const allFloorGroups = Array.from(svg.querySelectorAll('g[id^="floor-"]')) as SVGGElement[];

        allFloorGroups.sort((a, b) => {
            const numA = parseInt(a.id.replace('floor-', '')) || 0;
            const numB = parseInt(b.id.replace('floor-', '')) || 0;
            
            if (numA === activeNum && numB !== activeNum) return 1;
            if (numB === activeNum && numA !== activeNum) return -1;
            
            return numA - numB;
        });

        allFloorGroups.forEach(floorGroup => {
            svg.appendChild(floorGroup); 
            const floorNum = parseInt(floorGroup.id.replace('floor-', ''));

            if (!isNaN(floorNum)) {
                if (floorNum === activeNum) {
                    floorGroup.style.display = '';
                    floorGroup.style.filter = 'none';
                } else if ((floorNum < activeNum && !(activeNum === 1 && floorNum === 0)) || (activeNum < 0 && floorNum === 0)) {
                    floorGroup.style.display = '';
                    floorGroup.style.filter = 'brightness(0.35)';
                } else if (activeNum === 1 && floorNum === 0) {
                    floorGroup.style.display = '';
                    floorGroup.style.filter = 'none';
                } else {
                    floorGroup.style.display = 'none';
                    floorGroup.style.filter = 'none';
                }
            }
        });
    }, [activeFloor, svgContent]);

    // Pan & Zoom Engine
    useEffect(() => {
        const container = containerRef.current;
        const overlaySvg = overlayRef.current;
        const svg = container?.querySelector('svg');
        if (!container || !svg || !overlaySvg) return;

        if (initializedMapRef.current !== currentMap) {
            const vbAttr = svg.getAttribute('viewBox');
            if (vbAttr) {
                const parts = vbAttr.split(/\s+|,/).map(parseFloat).filter(n => !isNaN(n));
                if (parts.length === 4) viewBoxRef.current = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
            } else {
                viewBoxRef.current = { x: 0, y: 0, w: svg.clientWidth || 1000, h: svg.clientHeight || 1000 };
            }
            initialWidthRef.current = viewBoxRef.current.w;
            initializedMapRef.current = currentMap;
        }

        const updateViewBox = () => {
            const vb = viewBoxRef.current;
            const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
            
            svg.setAttribute('viewBox', vbStr);
            overlaySvg.setAttribute('viewBox', vbStr);
            
            const zoomRatio = vb.w / initialWidthRef.current;
            setScale(Math.max(0.5, Math.min(5.0, zoomRatio * zoomStartDistance)));
        };
        updateViewBox();

        let isPanning = false;
        let startPan = { x: 0, y: 0 };
        let mouseDownPos = { x: 0, y: 0 };
        let didDrag = false;
        let currentPanDelta = { x: 0, y: 0 };
        let draggedPointId: string | null = null;
        let draggedPointElement: SVGGElement | null = null;
        let rafId: number | null = null;

        const commitPan = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            if (currentPanDelta.x === 0 && currentPanDelta.y === 0) return;
            
            const clientW = svg.clientWidth;
            const clientH = svg.clientHeight;
            const vb = viewBoxRef.current;
            
            const renderScale = Math.min(clientW / vb.w, clientH / vb.h);

            if (renderScale > 0) {
                viewBoxRef.current.x -= currentPanDelta.x / renderScale;
                viewBoxRef.current.y -= currentPanDelta.y / renderScale;
                updateViewBox();
            }
            
            if (transformWrapperRef.current) {
                transformWrapperRef.current.style.transform = `translate3d(0px, 0px, 0px)`;
            }
            
            startPan.x += currentPanDelta.x;
            startPan.y += currentPanDelta.y;
            currentPanDelta = { x: 0, y: 0 };
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            commitPan();

            const zoomDirection = e.deltaY > 0 ? 1.1 : 0.9;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX; pt.y = e.clientY;
            
            const ctm = svg.getScreenCTM();
            if (!ctm) return;
            const svgP = pt.matrixTransform(ctm.inverse());

            viewBoxRef.current.x = svgP.x - (svgP.x - viewBoxRef.current.x) * zoomDirection;
            viewBoxRef.current.y = svgP.y - (svgP.y - viewBoxRef.current.y) * zoomDirection;
            viewBoxRef.current.w *= zoomDirection;
            viewBoxRef.current.h *= zoomDirection;
            updateViewBox();
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as Element;
            
            mouseDownPos = { x: e.clientX, y: e.clientY };
            didDrag = false;

            if (mode === 'MOVE' && target.closest('.map-point')) {
                draggedPointElement = target.closest('.map-point') as SVGGElement;
                draggedPointId = draggedPointElement.getAttribute('data-id');
                return;
            }

            isPanning = true;
            startPan = { x: e.clientX, y: e.clientY };
            currentPanDelta = { x: 0, y: 0 };
        };

        const handleMouseMove = (e: MouseEvent) => {
            const totalDistance = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
            if (totalDistance > 8) didDrag = true;

            if (draggedPointElement && mode === 'MOVE') {
                const pt = svg.createSVGPoint();
                pt.x = e.clientX; pt.y = e.clientY;
                const ctm = svg.getScreenCTM();
                if (!ctm) return;
                const svgP = pt.matrixTransform(ctm.inverse());
                draggedPointElement.setAttribute('transform', `translate(${svgP.x}, ${svgP.y})`);
                return;
            }

            if (!isPanning) return;
            
            currentPanDelta.x = e.clientX - startPan.x;
            currentPanDelta.y = e.clientY - startPan.y;

            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    if (transformWrapperRef.current) {
                        transformWrapperRef.current.style.transform = `translate3d(${currentPanDelta.x}px, ${currentPanDelta.y}px, 0)`;
                    }
                    rafId = null;
                });
            }
        };

        const handleMouseUp = (e: MouseEvent) => { 
            if (draggedPointId && draggedPointElement && mode === 'MOVE') {
                const pt = svg.createSVGPoint();
                pt.x = e.clientX; pt.y = e.clientY;
                const ctm = svg.getScreenCTM();
                if (ctm) {
                    const svgP = pt.matrixTransform(ctm.inverse());
                    onPointMove(draggedPointId, svgP.x, svgP.y);
                }
            }
            
            commitPan();
            isPanning = false; 
            draggedPointId = null; 
            draggedPointElement = null;
            
            setTimeout(() => {
                if (!isPanning) {
                    didDrag = false;
                }
            }, 50);
        };
        
        const handleClick = (e: MouseEvent) => {
            if (didDrag || (e.target as Element).closest('.map-point')) return;
            
            const pt = svg.createSVGPoint();
            pt.x = e.clientX; pt.y = e.clientY;
            const ctm = svg.getScreenCTM();
            if (!ctm) return;
            const svgP = pt.matrixTransform(ctm.inverse());
            onMapClick(svgP.x, svgP.y);
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('click', handleClick);

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('click', handleClick);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [svgContent, mode, currentMap, onPointMove, onMapClick]);

    const activeNum = parseInt(activeFloor.replace('floor-', ''));
    const adjustedScale = scale * mapScale;

    return (
        <div 
            ref={containerRef} 
            className={`flex-1 relative overflow-hidden flex justify-center items-center bg-[#09090a] ${mode === 'ADD' ? 'cursor-crosshair' : 'cursor-grab'}`}
        >
            {/* Expanded wrapper (-inset-[100%]) forces the browser to pre-rasterize offscreen regions */}
            <div 
                ref={transformWrapperRef} 
                className="absolute -inset-[100%] will-change-transform flex justify-center items-center"
                style={{ backfaceVisibility: 'hidden' }}
            >
                <div dangerouslySetInnerHTML={{ __html: svgContent }} className="w-full h-full absolute inset-0 [&>svg]:w-full [&>svg]:h-full" />
                
                {svgContent && (
                    <svg ref={overlayRef} viewBox={`${viewBoxRef.current.x} ${viewBoxRef.current.y} ${viewBoxRef.current.w} ${viewBoxRef.current.h}`} className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {points.filter(p => !p.iconType || activeFilters.has(p.iconType)).map(pt => {
                            const ptNum = parseInt(pt.floor.replace('floor-', ''));
                            const isActive = ptNum === activeNum;
                            
                            return (
                                <g 
                                    key={pt.id}
                                    className="map-point pointer-events-auto hover:drop-shadow-[0_0_5px_#d18d32] transition-all duration-200 cursor-pointer"
                                    data-id={pt.id}
                                    transform={`translate(${pt.x}, ${pt.y})`}
                                    style={{ opacity: isActive ? 1 : 0.35 }}
                                    onClick={(e) => {
                                        if (mode === 'VIEW') onPointClick(pt, e.clientX, e.clientY);
                                    }}
                                >
                                    {pt.iconType ? (
                                        <image 
                                            href={`/icons/${pt.iconType}.png`} 
                                            x={-(9.6 * adjustedScale) / 2} 
                                            y={-(9.6 * adjustedScale) / 2} 
                                            width={9.6 * adjustedScale} 
                                            height={9.6 * adjustedScale} 
                                        />
                                    ) : (
                                        <circle r={1.5 * adjustedScale} fill="#d18d32" stroke="#09090a" strokeWidth="0.5" />
                                    )}
                                    
                                    {!isActive && (
                                        <text 
                                            fill={ptNum > activeNum ? '#6a945b' : '#9c3434'} 
                                            fontWeight="bold" 
                                            fontSize={5 * adjustedScale}
                                            x={(9.6 * adjustedScale) / 3}
                                            y={-(9.6 * adjustedScale) / 3}
                                        >
                                            {ptNum > activeNum ? '▲' : '▼'}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                )}
            </div>
        </div>
    );
}