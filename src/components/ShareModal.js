'use client';

import React, { useState } from 'react';
import { Share2, X, Send, Copy, Check, Globe } from 'lucide-react';

export default function ShareModal({ isOpen, onClose, title, tgLink, webLink, shareText }) {
  const [copyStatus, setCopyStatus] = useState(''); // 'tg' or 'web'
  const [tgShared, setTgShared] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async (url, type) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyStatus(type);
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      console.error("Copy failed", err);
      alert("Failed to copy. Please select the link and copy manually.");
    }
  };

  const handleTgForward = () => {
    const forwardUrl = `https://t.me/share/url?url=${encodeURIComponent(tgLink)}&text=${encodeURIComponent(shareText || '')}`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(forwardUrl);
    } else {
      window.open(forwardUrl, '_blank');
    }
    
    // Provide immediate visual feedback since we can't track the native app's success
    setTgShared(true);
    setTimeout(() => setTgShared(false), 3000);
  };

  return (
    <>
      <style>{`
        @keyframes shareFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shareScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', animation: 'shareFade 0.2s ease-out',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
        onClick={onClose} // Clicking the background closes it
      >
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
          style={{
            backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px',
            width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', overflow: 'hidden',
            animation: 'shareScale 0.2s ease-out'
          }}
        >
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #27272a', backgroundColor: '#0a0a0a' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={20} color="#ffffff" /> Share {title}
            </h2>
            <button 
              onClick={onClose} 
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px', fontSize: '16px', fontWeight: 'bold', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Telegram Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Telegram Mini App</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleTgForward}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', backgroundColor: tgShared ? 'rgba(37, 99, 235, 0.2)' : '#385ca9', color: tgShared ? '#60a5fa' : '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: tgShared ? '1px solid rgba(59, 130, 246, 0.4)' : 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px', boxShadow: tgShared ? 'none' : '0 4px 15px rgba(37, 99, 235, 0.3)' }}
                >
                  {tgShared ? <Check size={18} /> : <Send size={18} />}
                  <span>{tgShared ? 'Opened Share Sheet' : 'Forward in App'}</span>
                </button>
                <button 
                  onClick={() => handleCopy(tgLink, 'tg')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', backgroundColor: copyStatus === 'tg' ? 'rgba(34, 197, 94, 0.15)' : '#27272a', color: copyStatus === 'tg' ? '#4ade80' : '#ffffff', border: copyStatus === 'tg' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #3f3f46', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                  title="Copy Telegram Link"
                >
                  {copyStatus === 'tg' ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* Global Web Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Global Web Link</span>
              <button 
                onClick={() => handleCopy(webLink, 'web')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', backgroundColor: copyStatus === 'web' ? 'rgba(34, 197, 94, 0.15)' : '#18181b', color: copyStatus === 'web' ? '#4ade80' : '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: copyStatus === 'web' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #3f3f46', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px' }}
              >
                {copyStatus === 'web' ? <Check size={18} /> : <Globe size={18} />}
                <span>{copyStatus === 'web' ? 'Web Link Copied!' : 'Copy Global Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}