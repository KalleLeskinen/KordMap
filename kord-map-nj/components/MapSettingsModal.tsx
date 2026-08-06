'use client';
import React, { useState, useEffect } from 'react';

interface MapSettingsModalProps {
    isOpen: boolean;
    initialFloors: string[];
    initialIcons: string[];
    initialMapScale: number;
    onClose: () => void;
    onSave: (floors: string[], icons: string[], mapScale: number) => void;
}

export default function MapSettingsModal({ isOpen, initialFloors, initialIcons, initialMapScale, onClose, onSave }: MapSettingsModalProps) {
    const [floors, setFloors] = useState<string[]>([]);
    const [icons, setIcons] = useState<string[]>([]);
    const [mapScale, setMapScale] = useState<number>(1);
    
    const [newFloor, setNewFloor] = useState('');
    const [newIcon, setNewIcon] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFloors([...initialFloors]);
            setIcons([...initialIcons]);
            setMapScale(initialMapScale);
            setNewFloor('');
            setNewIcon('');
        }
    }, [isOpen, initialFloors, initialIcons, initialMapScale]);

    if (!isOpen) return null;

    const handleAddFloor = (e: React.FormEvent) => {
        e.preventDefault();
        const f = newFloor.trim();
        if (f && !floors.includes(f)) {
            setFloors([...floors, f]);
            setNewFloor('');
        }
    };

    const handleAddIcon = (e: React.FormEvent) => {
        e.preventDefault();
        const i = newIcon.trim();
        if (i && !icons.includes(i)) {
            setIcons([...icons, i]);
            setNewIcon('');
        }
    };

    const handleSave = () => {
        onSave(floors, icons, mapScale);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/85 z-[300] flex justify-center items-center backdrop-blur-sm select-none" onClick={onClose}>
            <div className="bg-[#121315] p-[25px] rounded-[4px] border border-[#282a2e] min-w-[380px] shadow-[0_10px_30px_rgba(0,0,0,0.8)] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="mt-0 text-[#d18d32] uppercase tracking-[1px] text-[1.1rem] border-b border-[#282a2e] pb-[10px]">Map Configuration</h3>
                
                <div className="overflow-y-auto flex-1 my-[15px] pr-[5px]">
                    
                    {/* General Settings */}
                    <div className="mb-[25px]">
                        <p className="text-[0.85rem] text-[#72757a] mb-[10px] uppercase tracking-[1px] font-bold">General Settings</p>
                        <div className="flex items-center gap-[10px] bg-[#191b1d] border border-[#282a2e] rounded-[2px] p-[8px_12px]">
                            <label className="text-[#c4c5c7] text-[0.9rem] flex-1">Map Scale Multiplier:</label>
                            <input 
                                type="number"
                                step="0.1"
                                value={mapScale}
                                onChange={(e) => setMapScale(parseFloat(e.target.value) || 1)}
                                className="w-[80px] bg-[#121315] text-[#d18d32] font-bold border border-[#282a2e] rounded-[2px] p-[4px_8px] text-right focus:outline-none focus:border-[#d18d32]"
                            />
                        </div>
                    </div>

                    {/* Floors Section */}
                    <div className="mb-[25px]">
                        <p className="text-[0.85rem] text-[#72757a] mb-[10px] uppercase tracking-[1px] font-bold">Manage Floors</p>
                        <div className="flex flex-col gap-[8px] mb-[10px]">
                            {floors.map(floor => (
                                <div key={floor} className="flex justify-between items-center bg-[#191b1d] border border-[#282a2e] rounded-[2px] p-[8px_12px]">
                                    <span className="text-[#c4c5c7] text-[0.9rem]">Floor {floor}</span>
                                    <button onClick={() => setFloors(floors.filter(f => f !== floor))} className="text-[#9c3434] hover:text-[#ff4a4a] font-bold text-[1rem]">×</button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddFloor} className="flex gap-[10px]">
                            <input 
                                type="text" 
                                value={newFloor} 
                                onChange={(e) => setNewFloor(e.target.value)} 
                                placeholder="e.g. 2 or -1" 
                                className="flex-1 bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] p-[8px] text-[0.85rem] focus:outline-none focus:border-[#d18d32]"
                            />
                            <button type="submit" className="bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] px-[12px] font-bold text-[0.8rem] uppercase hover:bg-[#232528] hover:text-[#d18d32]">+</button>
                        </form>
                    </div>

                    {/* Icons Section */}
                    <div>
                        <p className="text-[0.85rem] text-[#72757a] mb-[10px] uppercase tracking-[1px] font-bold">Manage Icons</p>
                        <div className="flex flex-col gap-[8px] mb-[10px]">
                            {icons.map(icon => (
                                <div key={icon} className="flex justify-between items-center bg-[#191b1d] border border-[#282a2e] rounded-[2px] p-[8px_12px]">
                                    <div className="flex items-center gap-[10px]">
                                        <img src={`/icons/${icon}.png`} alt={icon} className="w-[16px] h-[16px] object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                        <span className="text-[#c4c5c7] text-[0.9rem]">{icon}</span>
                                    </div>
                                    <button onClick={() => setIcons(icons.filter(i => i !== icon))} className="text-[#9c3434] hover:text-[#ff4a4a] font-bold text-[1rem]">×</button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddIcon} className="flex gap-[10px]">
                            <input 
                                type="text" 
                                value={newIcon} 
                                onChange={(e) => setNewIcon(e.target.value)} 
                                placeholder="e.g. keycard" 
                                className="flex-1 bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] p-[8px] text-[0.85rem] focus:outline-none focus:border-[#d18d32]"
                            />
                            <button type="submit" className="bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] px-[12px] font-bold text-[0.8rem] uppercase hover:bg-[#232528] hover:text-[#d18d32]">+</button>
                        </form>
                    </div>
                </div>

                <div className="flex justify-end gap-[10px] pt-[15px] border-t border-[#282a2e]">
                    <button onClick={onClose} className="px-[16px] py-[8px] bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#232528]">Cancel</button>
                    <button onClick={handleSave} className="px-[16px] py-[8px] bg-[#d18d32] text-black border border-[#d18d32] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#e59f3d]">Apply Settings</button>
                </div>
            </div>
        </div>
    );
}