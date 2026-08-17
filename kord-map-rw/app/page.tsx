export default function Home() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-[#121212] text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Kord Map has moved!</h1>
        <p className="text-gray-400 mb-6">You are being redirected to kordmap.wiki...</p>
        <a 
          href="https://kordmap.wiki" 
          className="bg-[#e68c3a] text-black font-bold py-2 px-6 rounded hover:bg-[#cf7d34] transition-colors"
        >
          Click here if not redirected
        </a>
      </div>
    </main>
  );
}