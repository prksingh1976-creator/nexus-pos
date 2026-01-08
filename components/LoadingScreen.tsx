import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 font-sans transition-colors duration-300">
      <div className="w-[72px] h-[72px] bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-blue-500/30 mb-8 animate-[pulse_2s_infinite]">
        N
      </div>
      <div className="w-32 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
        <div className="absolute top-0 left-0 bottom-0 w-1/2 bg-blue-500 rounded-full animate-[shimmer_1.5s_infinite_linear]" 
             style={{ animationName: 'slideProgress' }}
        ></div>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">Starting Nexus...</p>
      
      <style>{`
        @keyframes slideProgress {
          0% { left: -50%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
};