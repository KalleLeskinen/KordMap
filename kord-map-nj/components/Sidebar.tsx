import React, { useRef } from 'react';

interface SidebarProps {
    currentMap: string;
    activeFloor: string;
    setActiveFloor: (floor: string) => void;
    mode: 'VIEW' | 'ADD' | 'MOVE';
    setMode: (mode: 'VIEW' | 'ADD' | 'MOVE') => void;
    availableFloors: string[];
    availableIcons: string[];
    activeFilters: Set<string>;
    toggleFilter: (icon: string) => void;
    isAuthenticated: boolean;
    onLoginClick: () => void;
    onLogoutClick: () => void;
    onExport: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onChangeMap: () => void;
    onOpenSettings: () => void;
}

export default function Sidebar({
    currentMap,
    activeFloor,
    setActiveFloor,
    mode,
    setMode,
    availableFloors,
    availableIcons,
    activeFilters,
    toggleFilter,
    isAuthenticated,
    onLoginClick,
    onLogoutClick,
    onExport,
    onLoad,
    onChangeMap,
    onOpenSettings
}: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <nav className="w-[280px] bg-[#121315] flex flex-col z-10 border-r border-[#282a2e]">
            {/* Header */}
            <div className="p-5 border-b border-[#282a2e] text-center flex flex-col gap-2">
                <div className="text-[1.1rem] font-bold text-[#d18d32] uppercase tracking-[2px]">
                    {currentMap ? `${currentMap} map` : 'Map'}
                </div>
                <button 
                    onClick={onChangeMap}
                    className="text-[0.75rem] text-[#72757a] hover:text-[#c4c5c7] uppercase tracking-[1px] font-bold transition-colors cursor-pointer bg-transparent border-none"
                >
                    CHANGE MAP
                </button>
            </div>

            {/* Controls & Modes */}
            <div className="p-[15px] border-b border-[#282a2e] flex flex-col gap-[10px]">
                {isAuthenticated && (
                    <button
                        onClick={onOpenSettings}
                        className="w-full p-[10px] mb-[5px] bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.85rem] tracking-[1px] transition-colors duration-200 hover:bg-[#232528] hover:text-[#d18d32] hover:border-[#d18d32]"
                    >
                        Map Settings
                    </button>
                )}

                {isAuthenticated ? (
                    (['VIEW', 'ADD', 'MOVE'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`w-full p-[10px] rounded-[2px] font-bold uppercase text-[0.85rem] tracking-[1px] transition-colors duration-200 border ${
                                mode === m
                                    ? 'bg-[rgba(209,141,50,0.15)] border-[#d18d32] text-[#d18d32]'
                                    : 'bg-[#191b1d] text-[#72757a] border-[#282a2e] hover:bg-[#232528] hover:text-[#c4c5c7]'
                            }`}
                        >
                            {m === 'VIEW' ? 'View Points' : m === 'ADD' ? 'Mark Points' : 'Move Points'}
                        </button>
                    ))
                ) : (
                    <button className="w-full p-[10px] rounded-[2px] font-bold uppercase text-[0.85rem] tracking-[1px] bg-[rgba(209,141,50,0.15)] border border-[#d18d32] text-[#d18d32] cursor-default">
                        Viewing Mode
                    </button>
                )}

                {isAuthenticated && (
                    <div className="flex gap-[10px] mt-[10px]">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 p-[10px] border border-[#282a2e] rounded-[2px] font-bold text-[0.8rem] uppercase transition-colors duration-200 bg-[#191b1d] text-[#c4c5c7] hover:bg-[#232528]"
                        >
                            Load
                        </button>
                        <button
                            onClick={onExport}
                            className="flex-1 p-[10px] border border-[#3c5438] rounded-[2px] font-bold text-[0.8rem] uppercase transition-colors duration-200 bg-[#3c5438] text-white hover:bg-[#4a6645]"
                        >
                            Export
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".json"
                            className="hidden"
                            onChange={onLoad}
                        />
                    </div>
                )}
            </div>

            {/* Legend / Filters */}
            {availableIcons.length > 0 && (
                <div className="border-b border-[#282a2e] flex flex-col max-h-[35vh]">
                    <div className="p-[8px_15px] text-[0.75rem] font-bold text-[#72757a] uppercase tracking-[1px] bg-black border-b border-[#282a2e]">
                        Document Filters
                    </div>
                    <div className="p-[10px_15px] flex flex-col gap-[10px] overflow-y-auto">
                        {availableIcons.map((icon) => (
                            <label key={icon} className="flex items-center gap-[8px] text-[#c4c5c7] text-[0.85rem] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={activeFilters.has(icon)}
                                    onChange={() => toggleFilter(icon)}
                                    className="accent-[#d18d32] cursor-pointer m-0 w-[14px] h-[14px] bg-[#191b1d] border border-[#282a2e]"
                                />
                                <img
                                    src={`/icons/${icon}.png`}
                                    alt={icon}
                                    className="w-[16px] h-[16px] object-contain"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                <span>{icon}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Menu Items (Floors) */}
            <div className="flex flex-col overflow-y-auto flex-1 py-[10px]">
                {availableFloors.map((floor) => {
                    const floorId = `floor-${floor}`;
                    return (
                        <button
                            key={floorId}
                            onClick={() => setActiveFloor(floorId)}
                            className={`bg-transparent py-[12px] px-[20px] text-left text-[0.9rem] cursor-pointer font-bold transition-colors duration-200 tracking-[1px] border-l-[3px] ${
                                activeFloor === floorId
                                    ? 'bg-black text-[#d18d32] border-[#d18d32]'
                                    : 'text-[#72757a] border-transparent hover:bg-[#232528] hover:text-[#c4c5c7]'
                            }`}
                        >
                            FLOOR {floor}
                        </button>
                    );
                })}
            </div>

            {/* Sidebar Footer */}
            <div className="p-[15px] text-[0.75rem] text-[#72757a] text-center border-t border-[#282a2e] bg-[#09090a]">
                You can contribute to this project on <a href="https://github.com/KalleLeskinen/KordMap" target="_blank" rel="noopener noreferrer" className="text-[#d18d32] no-underline font-bold transition-colors duration-200 hover:text-[#e59f3d] hover:underline">Github</a><br />
                <br />
                Document locations by users on <a href="https://discord.com/invite/AmuWBRMnVQ" target="_blank" rel="noopener noreferrer" className="text-[#d18d32] no-underline font-bold transition-colors duration-200 hover:text-[#e59f3d] hover:underline">VeryBadSCAV</a>&apos;s Discord server<br />
                <br />
                Map SVGs by <a href="https://github.com/the-hideout/tarkov-dev-svg-maps/" target="_blank" rel="noopener noreferrer" className="text-[#d18d32] no-underline font-bold transition-colors duration-200 hover:text-[#e59f3d] hover:underline">Shebuka</a><br />
                Licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-[#d18d32] no-underline font-bold transition-colors duration-200 hover:text-[#e59f3d] hover:underline">CC BY-NC-SA 4.0</a>
                
                <div className="mt-[15px] pt-[15px] border-t border-[#282a2e]">
                    {isAuthenticated ? (
                        <button 
                            onClick={onLogoutClick}
                            className="w-full p-[8px] bg-[#191b1d] text-[#72757a] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.75rem] hover:bg-[#232528] hover:text-[#c4c5c7] transition-colors"
                        >
                            Logout
                        </button>
                    ) : (
                        <button 
                            onClick={onLoginClick}
                            className="w-full p-[8px] bg-[#191b1d] text-[#72757a] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.75rem] hover:bg-[#232528] hover:text-[#d18d32] transition-colors"
                        >
                            Editor Login
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}