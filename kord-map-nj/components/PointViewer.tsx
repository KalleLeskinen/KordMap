'use client';
import React, { useState } from 'react';
import { PointData } from '@/types';

interface PointViewerProps {
    point: PointData | null;
    position: { x: number; y: number } | null;
    isAuthenticated: boolean;
    onClose: () => void;
    onDelete: (id: string) => void;
    onEdit: () => void;
}

export default function PointViewer({ point, position, isAuthenticated, onClose, onDelete, onEdit }: PointViewerProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false);

    if (!point || !position) return null;

    const handleDelete = () => {
        if (confirm("Confirm deletion of document marker?")) {
            onDelete(point.id);
            onClose();
        }
    };

    return (
        <>
            <div 
                className="absolute bg-[#121315] border border-[#282a2e] p-[12px] rounded-[4px] shadow-[0_4px_20px_rgba(0,0,0,0.8)] z-50 w-[220px] pointer-events-auto"
                style={{ left: position.x + 15, top: position.y - 20 }}
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute -top-[10px] -right-[10px] bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-full w-[24px] h-[24px] flex items-center justify-center font-bold cursor-pointer hover:bg-[#232528] hover:text-[#d18d32]"
                >
                    ×
                </button>

                <div className="text-[0.8rem] text-[#d18d32] mb-[10px] font-bold border-b border-[#282a2e] pb-[8px] uppercase tracking-[1px]">
                    {point.iconType || "Document Details"}
                </div>

                {point.details && (
                    <div className="text-[0.85rem] text-[#c4c5c7] mb-[12px] leading-tight whitespace-pre-wrap break-words">
                        {point.details}
                    </div>
                )}

                {point.image ? (
                    <img 
                        src={point.image} 
                        alt="Reference" 
                        className="w-full cursor-zoom-in rounded-[2px] object-cover border border-[#282a2e]"
                        onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    />
                ) : (
                    <div className="border border-dashed border-[#282a2e] bg-[#09090a] p-[20px] text-center text-[#72757a] text-[0.8rem] rounded-[2px] uppercase">
                        No visual reference
                    </div>
                )}

                {isAuthenticated && (
                    <div className="flex gap-[10px] mt-[12px] pt-[12px] border-t border-[#282a2e]">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="flex-1 bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] p-[6px_12px] rounded-[2px] cursor-pointer text-[0.75rem] font-bold uppercase tracking-[1px] hover:bg-[#232528]"
                        >
                            Edit
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            className="flex-1 bg-[#6b2b2b] text-white border border-[#401a1a] p-[6px_12px] rounded-[2px] cursor-pointer text-[0.75rem] font-bold uppercase tracking-[1px] hover:bg-[#823535]"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {lightboxOpen && point.image && (
                <div 
                    className="fixed inset-0 bg-black/95 z-[150] flex justify-center items-center cursor-zoom-out"
                    onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
                >
                    <img 
                        src={point.image} 
                        alt="Expanded View" 
                        className="max-w-[90%] max-h-[90%] rounded-[4px] shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-[#282a2e]"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}