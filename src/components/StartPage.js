'use client';
import React, { useState } from 'react';

export default function StartPage({ onStartNew, onLoadUrl, loadingError }) {
  const [url, setUrl] = useState('');

  return (
    <div className="fixed inset-0 w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-white p-4 z-50">
      <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-8 text-center drop-shadow-lg">
        Critique Engine
      </h1>
      
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
        <button onClick={onStartNew} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-lg transition-transform hover:scale-105 shadow-lg">
          ✨ Create New Project
        </button>
        
        <div className="flex items-center gap-4">
          <div className="h-px bg-zinc-700 flex-1"></div>
          <span className="text-zinc-500 font-bold text-sm uppercase">OR</span>
          <div className="h-px bg-zinc-700 flex-1"></div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-400">Load Encoded Data Image</label>
          <div className="flex gap-2">
            <input 
              type="text" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://i.ibb.co/...png" 
              className="flex-1 bg-zinc-900 border border-zinc-600 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
            />
            <button onClick={() => onLoadUrl(url)} className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 rounded-lg transition shadow">
              Load
            </button>
          </div>
          {loadingError && <p className="text-xs text-red-400 font-bold mt-1">{loadingError}</p>}
        </div>
      </div>
    </div>
  );
}