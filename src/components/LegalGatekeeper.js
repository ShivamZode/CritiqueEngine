'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, FileText } from 'lucide-react';

export default function LegalGatekeeper({ currentUser, onUpdateUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // 👉 NEW: Dedicated state for returning users
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    if (currentUser === undefined) return; 

    if (currentUser === null) {
      const guestAccepted = localStorage.getItem('critique_guest_legal_accepted');
      if (guestAccepted === 'true') {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
      return;
    }

    if (currentUser && currentUser.hasAcceptedTerms === true) {
      setIsOpen(false); 
    } else if (currentUser && currentUser.hasAcceptedTerms === false) {
      
      // 👉 THE FIX: Fetch the actual DB record to definitively check `isAdult`.
      // This prevents the UI from failing if the `currentUser` prop is missing fields!
      const tgId = currentUser.id || currentUser.telegramId;
      fetch(`/api/users/me?telegramId=${tgId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            // If the database explicitly states they are already an adult, 
            // they are definitively a returning user whose terms reset!
            if (data.user.isAdult === true) {
              setIsReturningUser(true);
              setIsAdult(true); // Pre-check and lock the box
            }
          }
          setIsOpen(true);
        })
        .catch(() => {
          setIsOpen(true); // Fallback to open if network fails
        });
    }
  }, [currentUser]);

  const handleAccept = async () => {
    if (!isAdult || !agreedTerms) return;

    setIsLoading(true);

    if (currentUser) {
      try {
        const tgId = currentUser.id || currentUser.telegramId;
        
        // 👉 Grab the Telegram signature safely
        const tgInitData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData 
          ? window.Telegram.WebApp.initData 
          : '';

        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            // 👉 THE FIX: Attach the ID card to the headers!
            'x-telegram-init-data': tgInitData
          },
          body: JSON.stringify({ 
            telegramId: tgId, 
            hasAcceptedTerms: true,
            isAdult: true 
          })
        });
        
        if (res.ok) {
          if (onUpdateUser) onUpdateUser({ ...currentUser, hasAcceptedTerms: true, isAdult: true });
          setIsOpen(false);
        } else {
          // If it still fails, it'll at least tell you why now!
          alert("Failed to save preferences. Please try again.");
        }
      } catch (err) {
        console.error(err);
        alert("Network error.");
      }
    } else {
      localStorage.setItem('critique_guest_legal_accepted', 'true');
      setIsOpen(false);
    }

    setIsLoading(false);
  };

  const handleDecline = () => {
    window.location.href = "https://google.com";
  };

  if (!isOpen) return null;

  const isDisabled = !isAdult || !agreedTerms || isLoading;

  return (
    <>
      <style>{`
        @keyframes gatekeeperBg { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gatekeeperCard { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      {/* Background Overlay */}
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'gatekeeperBg 0.3s ease-out',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Modal Card */}
        <div style={{
          backgroundColor: '#09090b',
          border: '1px solid rgba(39, 39, 42, 0.8)',
          borderRadius: '24px',
          width: '100%', maxWidth: '360px',
          padding: '24px',
          display: 'flex', flexDirection: 'column', gap: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          position: 'relative', overflow: 'hidden',
          animation: 'gatekeeperCard 0.3s ease-out'
        }}>
          
          {/* Subtle background glow */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '75%', height: '100px', backgroundColor: isReturningUser ? 'rgba(234, 179, 8, 0.1)' : 'rgba(37, 99, 235, 0.1)',
            filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0
          }}></div>

          {/* Header */}
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
            <div style={{
              width: '52px', height: '52px', background: isReturningUser ? 'linear-gradient(to bottom right, #ca8a04, #eab308)' : 'linear-gradient(to bottom right, #2563eb, #4f46e5)',
              borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', margin: '0 auto 16px auto', boxShadow: isReturningUser ? '0 0 25px rgba(234,179,8,0.4)' : '0 0 25px rgba(37,99,235,0.4)',
              border: isReturningUser ? '1px solid rgba(250, 204, 21, 0.2)' : '1px solid rgba(96, 165, 250, 0.2)'
            }}>
              {isReturningUser ? <FileText size={28} color="#ffffff" /> : <Shield size={28} color="#ffffff" />}
            </div>
            
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              {isReturningUser ? 'Terms Updated' : 'Welcome to Critique Engine'}
            </h2>
            <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: '1.5', margin: 0, padding: '0 8px' }}>
              {isReturningUser 
                ? "The Terms and Privacy Policy have been updated. Please review and accept them to continue using the app." 
                : "Before entering, please verify your age and review the community guidelines to keep this space constructive."}
            </p>
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 10 }}>
            
            {/* Checkbox 1: 18+ */}
            <div 
              onClick={() => setIsAdult(!isAdult)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '16px',
                border: isAdult ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #27272a',
                backgroundColor: isAdult ? 'rgba(30, 58, 138, 0.2)' : 'rgba(24, 24, 27, 0.5)',
                cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s',
                opacity: isReturningUser ? 0.6 : 1, pointerEvents: isReturningUser ? 'none' : 'auto' // Lock if returning!
              }}
              onMouseOver={(e) => { if(!isAdult) e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.6)'; }}
              onMouseOut={(e) => { if(!isAdult) e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.5)'; }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                border: isAdult ? 'none' : '2px solid #52525b',
                backgroundColor: isAdult ? '#2563eb' : '#09090b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px', opacity: isAdult ? 1 : 0, transition: 'opacity 0.2s' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: isAdult ? '#ffffff' : '#a1a1aa', transition: 'color 0.2s' }}>
                I confirm that I am 18 years of age or older.
              </span>
            </div>

            {/* Checkbox 2: T&C */}
            <div 
              onClick={() => setAgreedTerms(!agreedTerms)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '16px',
                border: agreedTerms ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #27272a',
                backgroundColor: agreedTerms ? 'rgba(30, 58, 138, 0.2)' : 'rgba(24, 24, 27, 0.5)',
                cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { if(!agreedTerms) e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.6)'; }}
              onMouseOut={(e) => { if(!agreedTerms) e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.5)'; }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                border: agreedTerms ? 'none' : '2px solid #52525b',
                backgroundColor: agreedTerms ? '#2563eb' : '#09090b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px', opacity: agreedTerms ? 1 : 0, transition: 'opacity 0.2s' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: agreedTerms ? '#ffffff' : '#a1a1aa', transition: 'color 0.2s', lineHeight: '1.4' }}>
                I agree to the <Link href="/terms" target="_blank" onClick={(e) => e.stopPropagation()} style={{ color: '#60a5fa', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.textDecoration='underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration='none'}>Terms</Link> and <Link href="/privacy" target="_blank" onClick={(e) => e.stopPropagation()} style={{ color: '#60a5fa', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.textDecoration='underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration='none'}>Privacy Policy</Link>.
              </span>
            </div>

          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 10 }}>
            <button 
              onClick={handleAccept} 
              disabled={isDisabled}
              style={{
                width: '100%', padding: '14px',
                background: isDisabled ? '#27272a' : 'linear-gradient(to right, #2563eb, #4f46e5)',
                color: isDisabled ? '#71717a' : '#ffffff',
                fontWeight: 900, borderRadius: '16px',
                textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px',
                border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
                boxShadow: isDisabled ? 'none' : '0 0 20px rgba(37,99,235,0.3)',
                transition: 'all 0.2s'
              }}
            >
              {isLoading ? 'Entering App...' : 'Enter App'}
            </button>
            
            <button 
              onClick={handleDecline} 
              style={{
                fontSize: '11px', fontWeight: 'bold', color: '#71717a',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '8px 16px', borderRadius: '10px', margin: '0 auto', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#e4e4e7'; e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.4)'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              I do not agree (Exit)
            </button>
          </div>

        </div>
      </div>
    </>
  );
}