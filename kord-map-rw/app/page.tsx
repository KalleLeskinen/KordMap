'use client';

import { useEffect, useState } from 'react';
import { Map, ArrowRight } from 'lucide-react';

// 🚀 REPLACE THIS WITH YOUR NEW HETZNER DOMAIN
const NEW_URL = "https://kordmap.wiki"; 

export default function VercelRedirect() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Automatically redirect after 5 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = NEW_URL;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="flex h-screen w-full bg-[#121212] flex-col items-center justify-center text-white p-6">
      <div className="bg-[#1a1a1a] border border-[#333] p-10 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#e68c3a] opacity-10 blur-[100px] pointer-events-none" />

        <Map size={56} className="text-[#e68c3a] mb-6 animate-pulse" />
        
        <h1 className="text-3xl font-bold tracking-widest uppercase text-white mb-4">
          Kord Map has moved!
        </h1>
        
        <p className="text-gray-400 mb-8 leading-relaxed">
          I've changed the host for the service along with a new domain, Thanks for your patience!
        </p>

        <a 
          href={NEW_URL}
          className="flex items-center gap-3 bg-[#e68c3a] hover:bg-[#cf7d34] text-black font-bold py-3 px-8 rounded-lg transition-all hover:scale-105 shadow-[0_0_20px_rgba(230,140,58,0.3)] mb-6"
        >
          Go to New Site <ArrowRight size={18} />
        </a>

        <p className="text-xs text-gray-500 font-medium">
          Redirecting automatically in <span className="text-[#e68c3a]">{countdown}</span> seconds...
        </p>
      </div>
    </main>
  );
}