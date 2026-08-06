'use client';
import React, { useState } from 'react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (password: string) => Promise<boolean>;
    onLocalLogin: () => void;
}

export default function AuthModal({ isOpen, onClose, onLogin, onLocalLogin }: AuthModalProps) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        const success = await onLogin(password);
        if (success) {
            setPassword('');
            setShowPassword(false);
            onClose();
        } else {
            setError('Incorrect password');
        }
        
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/85 z-[300] flex justify-center items-center backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#121315] p-[25px] rounded-[4px] border border-[#282a2e] min-w-[300px] shadow-[0_10px_30px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
                <h3 className="mt-0 text-[#d18d32] uppercase tracking-[1px] text-[1.1rem] border-b border-[#282a2e] pb-[10px]">Editor Login</h3>
                
                <form onSubmit={handleSubmit} className="mt-[15px]">
                    <p className="text-[0.85rem] text-[#72757a] mb-[5px] uppercase tracking-[1px]">Password:</p>
                    
                    <div className="relative mb-[10px]">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] p-[10px] pr-[60px] focus:outline-none focus:border-[#d18d32]"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#72757a] hover:text-[#d18d32] font-bold text-[0.7rem] uppercase tracking-[1px]"
                        >
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    
                    {error && <p className="text-[#9c3434] text-[0.8rem] mb-[15px] font-bold">{error}</p>}
                    
                    <div className="flex flex-col gap-[10px] mt-[20px]">
                        <div className="flex justify-between gap-[10px]">
                            <button type="button" onClick={onClose} className="px-[16px] py-[8px] bg-[#191b1d] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#232528]">Cancel</button>
                            <button type="submit" disabled={isLoading} className="px-[16px] py-[8px] bg-[#d18d32] text-black border border-[#d18d32] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#e59f3d] disabled:opacity-50">
                                {isLoading ? 'Verifying...' : 'Login'}
                            </button>
                        </div>
                        <button type="button" onClick={onLocalLogin} className="w-full px-[16px] py-[8px] bg-[#232528] text-[#c4c5c7] border border-[#282a2e] rounded-[2px] font-bold uppercase text-[0.8rem] hover:bg-[#2e3438]">
                            Use Local Editor
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}