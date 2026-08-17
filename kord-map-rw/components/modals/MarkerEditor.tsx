'use client';

import { useState, useEffect } from 'react';
import { compressImage } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { createMarker, updateMarker, uploadImage } from '@/app/actions/markers';

interface MarkerEditorProps {
  mapName: string;
  currentFloorId: string | null;
  editorPassword?: string;
  markerTypes: Record<string, string[]>;
  markers: any[];
  setMarkers: any;
  pendingMarker: { lat: number; lng: number } | null;
  setPendingMarker: (val: any) => void;
  editingMarkerId: string | null;
  setEditingMarkerId: (val: string | null) => void;
  isRelocating: boolean;
  setIsRelocating: (val: boolean) => void;
  addLocalPendingId: (id: string) => void;
}

export default function MarkerEditor({ 
  mapName, currentFloorId, editorPassword, markerTypes, 
  pendingMarker, setPendingMarker, editingMarkerId, setEditingMarkerId, 
  isRelocating, setIsRelocating, markers, setMarkers, addLocalPendingId 
}: MarkerEditorProps) {
  
  const [formData, setFormData] = useState({ title: '', description: '', type: '', imageUrl: '', submitter: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (editingMarkerId) {
      const m = markers.find((x: any) => x.id === editingMarkerId);
      if (m) setFormData({ title: m.title, description: m.description || '', type: m.type, imageUrl: m.imageUrl || '', submitter: m.submitter || '' });
    } else {
      setFormData({ title: '', description: '', type: '', imageUrl: '', submitter: '' });
    }
  }, [editingMarkerId, markers]);

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
        // 🚀 FIX: Pass the editorPassword here so admins don't get blocked!
        const uploadedUrl = await uploadImage(finalImageUrl, editorPassword);
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
        imageUrl: finalImageUrl, submitter: formData.submitter.trim() || 'anon',
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
        setTimeout(() => { 
          setSubmitSuccess(false); 
          handleCloseModal(); 
        }, 1000);
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
  
  if (!pendingMarker) return null;

  if (isRelocating) {
    return <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 px-6 py-3 rounded-full shadow-2xl text-white font-bold animate-pulse pointer-events-none">Click anywhere on the map to set new location</div>;
  }

  return (
    <div 
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-[#1a1a1a] p-5 rounded-lg border border-[#333] shadow-2xl w-80 text-white transition-all overflow-visible"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-50 pointer-events-none"><span className="font-bold text-blue-400 text-lg">Drop image to add</span></div>}
      {submitSuccess ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4"><svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
          <h3 className="text-xl font-bold text-green-400">Success!</h3>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">{editingMarkerId ? 'Edit Marker' : 'Place New Marker'}</h3>
            {editingMarkerId && <button onClick={() => setIsRelocating(true)} className="text-xs bg-[#222] border border-[#444] hover:bg-[#333] px-2 py-1 rounded">Move Marker</button>}
          </div>

              <div className="space-y-4">
                
                {/* 🚀 Category / Type Input (With Warning Outline) */}
                <div className="relative">
                  <label className="text-xs text-gray-400 uppercase font-bold flex justify-between">
                    Category / Type
                  </label>
                  <div 
                    // Automatically glows red and shows triangle if left blank
                    className={`w-full bg-[#2a2a2a] border ${!formData.type ? 'border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'border-[#444] hover:border-[#e68c3a]'} rounded p-2 text-sm mt-1 cursor-pointer flex items-center justify-between transition-all`} 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
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

                {/* 🚀 Location Input (With Warning Outline) */}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold">Location</label>
                  <div className="relative mt-1">
                    <input 
                      type="text" 
                      value={formData.title} 
                      onChange={(e) => setFormData({...formData, title: e.target.value})} 
                      className={`w-full bg-[#2a2a2a] border ${!formData.title.trim() ? 'border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'border-[#444] focus:border-[#e68c3a]'} rounded p-2 text-sm outline-none pr-8 transition-all`} 
                      placeholder="e.g. Castle barracks" 
                    />
                    {!formData.title.trim() && <AlertTriangle size={16} className="text-red-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold">Submitter Name (Optional)</label>
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
            <button onClick={handleSaveMarker} disabled={isSubmitting || isProcessingImage || !formData.title.trim() || !formData.type || cooldownRemaining > 0} className="flex-1 bg-[#e68c3a] hover:bg-[#cf7d34] disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded text-sm transition-colors font-medium shadow text-black">
              {isSubmitting ? 'Saving...' : isProcessingImage ? 'Compressing...' : cooldownRemaining > 0 ? `Wait (${cooldownRemaining}s)` : (editorPassword ? 'Publish' : 'Submit')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}