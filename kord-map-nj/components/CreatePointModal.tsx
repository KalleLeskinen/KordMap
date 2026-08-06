'use client';
import React, { useState, useEffect } from 'react';
import { PointData } from '@/types';

interface CreateModalProps {
    isOpen: boolean;
    pendingCoords: { x: number; y: number } | null;
    activeFloor: string;
    availableIcons: string[];
    editPoint?: PointData | null; // Determines if we are editing an existing point
    onClose: () => void;
    onSave: (point: PointData) => void;
    editorPassword: string;
    isLocalMode: boolean;
}

export default function CreatePointModal({ isOpen, pendingCoords, activeFloor, availableIcons, editPoint, onClose, onSave, editorPassword, isLocalMode }: CreateModalProps) {
    const [selectedIcon, setSelectedIcon] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [details, setDetails] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Initialize state when modal opens (handles both New and Edit modes)
    useEffect(() => {
        if (isOpen) {
            if (editPoint) {
                setSelectedIcon(editPoint.iconType);
                setDetails(editPoint.details || '');
                setImageFile(null); // Reset pending uploads
            } else {
                setSelectedIcon(availableIcons[0] || '');
                setDetails('');
                setImageFile(null);
            }
        }
    }, [isOpen, editPoint, availableIcons]);

    if (!isOpen || !pendingCoords) return null;

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    
                    // Adjusted to 1400px max width
                    if (width > 1400) {
                        height = Math.round((height * 1400) / width);
                        width = 1400;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Adjusted to 90% quality (0.9)
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleSave = async () => {
        // If editing, preserve the old image URL unless they attach a new file
        let imageUrl = editPoint ? editPoint.image : null;

        if (imageFile) {
            setIsUploading(true);
            try {
                if (isLocalMode || !editorPassword) {
                    imageUrl = await convertToBase64(imageFile);
                } else {
                    const response = await fetch(`/api/upload?filename=${Date.now()}-${imageFile.name}&pass=${encodeURIComponent(editorPassword)}`, {
                        method: 'POST',
                        body: imageFile,
                    });

                    if (response.ok) {
                        const blob = await response.json();
                        imageUrl = blob.url ?? await convertToBase64(imageFile);
                    } else {
                        console.warn('Remote upload failed, falling back to local image encoding');
                        imageUrl = await convertToBase64(imageFile);
                    }
                }
            } catch (error) {
                console.error('Upload error:', error);
                imageUrl = await convertToBase64(imageFile);
            } finally {
                setIsUploading(false);
            }
        }

        onSave({
            // If editing, preserve the ID and original floor, otherwise create new
            id: editPoint ? editPoint.id : Date.now().toString(),
            floor: editPoint ? editPoint.floor : (activeFloor === 'floor-0' ? 'floor-1' : activeFloor),
            x: pendingCoords.x,
            y: pendingCoords.y,
            iconType: selectedIcon,
            details: details.trim(),
            image: imageUrl 
        });
        
        setDropdownOpen(false);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/85 z-[100] flex justify-center items-center backdrop-blur-sm select-none"
            onClick={() => {
                if (isUploading) return;
                setDropdownOpen(false);
                onClose();
            }}
        >
            <div 
                className="bg-[#121315] p-[25px] rounded-[4px] border border-[#282a2e] min-w-[320px] shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="mt-0 text-[#d18d32] uppercase tracking-[1px] text-[1.1rem] border-b border-[#282a2e] pb-[10px]">
                    {editPoint ? 'Edit Document' : 'Mark New Document'}
                </h3>
                
                <p className="text-[0.85rem] text-[#72757a] mb-[5px] uppercase tracking-[1px] mt-4">Document Type:</p>
                
                <div className="relative bg-[#191b1d] border border-[#282a2e] rounded-[2px] mb-[15px] z-20">
                    <div 
                        className="flex items-center gap-[10px] p-[10px] cursor-pointer text-[0.9rem] text-[#c4c5c7]"
                        onClick={() => !isUploading && setDropdownOpen(!dropdownOpen)}
                    >
                        {selectedIcon && (
                            <img src={`/icons/${selectedIcon}.png`} alt={selectedIcon} className="w-[24px] h-[24px] object-contain" />
                        )}
                        <span>{selectedIcon || 'Loading Icons...'}</span>
                    </div>

                    {dropdownOpen && (
                        <div className="absolute top-full left-[-1px] right-[-1px] bg-[#121315] border border-[#282a2e] border-t-0 max-h-[200px] overflow-y-auto">
                            {availableIcons.map(icon => (
                                <div 
                                    key={icon}
                                    className="flex items-center gap-[10px] p-[10px] cursor-pointer text-[0.9rem] text-[#c4c5c7] hover:bg-[#232528] hover:text-[#d18d32] transition-colors"
                                    onClick={() => { setSelectedIcon(icon); setDropdownOpen(false); }}
                                >
                                    <img src={`/icons/${icon}.png`} alt={icon} className="w-[24px] h-[24px] object-contain" />
                                    <span>{icon}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-[0.85rem] text-[#72757a] mb-[5px] uppercase tracking-[1px]">Details (Optional):</p>
                <textarea 
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    disabled={isUploading}
                    className="w-full bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] p-[10px] mb-[15px] min-h-[80px] resize-y focus:outline-none focus:border-[#d18d32] disabled:opacity-50"
                />

                <p className="text-[0.85rem] text-[#72757a] mb-[5px] uppercase tracking-[1px]">Attach Image Reference:</p>
                
                <label className={`block w-full cursor-pointer bg-[#191b1d] border border-[#282a2e] text-[#c4c5c7] p-[10px] rounded-[2px] mb-[15px] transition-colors text-center font-bold text-[0.85rem] uppercase tracking-[1px] ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#232528]'}`}>
                    {imageFile ? imageFile.name : (editPoint?.image ? 'Replace Image...' : 'Select Image...')}
                    <input 
                        type="file" 
                        accept="image/*" 
                        disabled={isUploading}
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        className="hidden"
                    />
                </label>

                <div className="flex justify-end gap-[10px] mt-[20px]">
                    <button 
                        onClick={() => { setDropdownOpen(false); onClose(); }} 
                        disabled={isUploading}
                        className="px-[16px] py-[8px] bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#232528] disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isUploading}
                        className="px-[16px] py-[8px] bg-[#d18d32] text-black border border-[#d18d32] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#e59f3d] disabled:opacity-50"
                    >
                        {isUploading ? 'Uploading...' : 'Save Marker'}
                    </button>
                </div>
            </div>
        </div>
    );
}