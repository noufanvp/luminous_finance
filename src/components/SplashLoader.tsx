import React, { useState, useEffect } from 'react';

export const SplashLoader: React.FC = () => {
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    'Verifying secure credentials...',
    'Synchronizing financial accounts...',
    'Calibrating real-time pacing engine...',
    'Launching your dashboard...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 900);
    return () => clearInterval(interval);
  }, [statuses.length]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020d18] text-white overflow-hidden select-none">
      {/* Dynamic Aurora Ambient Glow Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#00a656]/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#006397]/30 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#38bdf8]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Decorative Grid Mesh */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        {/* Holographic Glowing Emblem */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Outer Orbital Ring 1 */}
          <div className="absolute w-28 h-28 rounded-full border border-dashed border-[#38bdf8]/40 animate-spin" style={{ animationDuration: '8s' }} />
          
          {/* Outer Orbital Ring 2 (Counter-spin) */}
          <div className="absolute w-36 h-36 rounded-full border border-[#00a656]/20 border-t-[#00a656]/80 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />

          {/* Glowing Aura Center */}
          <div className="absolute w-20 h-20 bg-gradient-to-tr from-[#006397] to-[#00a656] rounded-2xl blur-lg opacity-60 animate-pulse" />

          {/* Central Glassmorphism Icon Badge */}
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-b from-white/15 to-white/5 border border-white/25 backdrop-blur-xl shadow-2xl flex items-center justify-center overflow-hidden">
            {/* Shimmer light sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            
            {/* SVG Luminous Emblem (Crisp vector graphics - guaranteed no missing fonts) */}
            <svg
              className="w-10 h-10 text-[#5cb8fd] drop-shadow-[0_0_12px_rgba(92,184,253,0.6)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
        </div>

        {/* Brand Typography */}
        <div className="space-y-1 mb-6">
          <div className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00a656] animate-ping" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-white via-[#d2e4fb] to-[#9eceff] bg-clip-text text-transparent">
              Luminous
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#006397]/40 border border-[#38bdf8]/30 text-[#9eceff] tracking-widest">
              v2.0
            </span>
          </div>
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#9eceff]/60">
            Intelligent Wealth Engine
          </p>
        </div>

        {/* High-Tech Glowing Progress Bar */}
        <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden relative mb-4 border border-white/10">
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#00a656] via-[#38bdf8] to-[#9eceff] rounded-full shadow-[0_0_12px_#38bdf8] animate-[loaderProgress_2.5s_ease-in-out_infinite]"
          />
        </div>

        {/* Dynamic Status Text */}
        <div className="h-6 flex items-center justify-center">
          <p
            key={statusIndex}
            className="text-xs font-medium text-[#c4c6cd] transition-all duration-300 animate-[fadeInUp_0.4s_ease-out]"
          >
            {statuses[statusIndex]}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loaderProgress {
          0% {
            left: 0%;
            width: 0%;
          }
          50% {
            left: 20%;
            width: 70%;
          }
          100% {
            left: 100%;
            width: 0%;
          }
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
