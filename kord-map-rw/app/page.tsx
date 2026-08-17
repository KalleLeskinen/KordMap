'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Redirect after 10 seconds
    const redirectTimer = setTimeout(() => {
      window.location.href = 'https://kordmap.wiki';
    }, 10000);

    // Update the visual countdown every second
    const intervalTimer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(redirectTimer);
      clearInterval(intervalTimer);
    };
  }, []);

  return (
    <main className="flex h-screen w-full items-center justify-center bg-[#121212] text-white">
      <div className="text-center p-8 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold mb-4 text-white uppercase tracking-widest">kordmap Has Moved to kordmap.wiki</h1>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          kordmap has moved to a new server and a custom domain.
        </p>
        
        <div className="mb-6">
          <p className="text-xl font-bold text-[#e68c3a] animate-pulse">
            Redirecting in {countdown}s...
          </p>
        </div>

        <a 
          href="https://kordmap.wiki" 
          className="block w-full bg-[#e68c3a] text-black font-bold py-3 px-6 rounded hover:bg-[#cf7d34] transition-colors"
        >
          Click here to go there now
        </a>
      </div>
    </main>
  );
}