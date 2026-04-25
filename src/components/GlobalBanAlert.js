'use client';
import React, { useEffect, useState } from 'react';
import { OctagonX, ChevronDown, ChevronUp } from 'lucide-react';

export default function GlobalBanAlert() {
  const [isOpen, setIsOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState(null);
  const [contextInfo, setContextInfo] = useState(null);

  useEffect(() => {
    const handleBan = (e) => {
      const detail = e.detail || '';
      
      // Check if it's our new structured ban payload
      if (typeof detail === 'string' && detail.startsWith('BANNED_PAYLOAD|')) {
        try {
          const parsed = JSON.parse(detail.replace('BANNED_PAYLOAD|', ''));
          setMessage(parsed.message || "Your account has been restricted.");
          setReason(parsed.reason);
          setContextInfo(parsed.context);
        } catch (err) {
          setMessage("Your account has been restricted.");
          setReason(null);
          setContextInfo(null);
        }
      } else {
        // Fallback for standard error strings
        setMessage(detail);
        setReason(null);
        setContextInfo(null);
      }
      
      setShowMore(false);
      setIsOpen(true);
    };

    window.addEventListener('show_ban_alert', handleBan);
    return () => window.removeEventListener('show_ban_alert', handleBan);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes alertFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes alertScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', animation: 'alertFade 0.2s ease-out',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{
          backgroundColor: '#09090b', border: '1px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '24px', width: '100%', maxWidth: '340px',
          padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', boxShadow: '0 20px 60px rgba(239,68,68,0.15)',
          animation: 'alertScale 0.2s ease-out', maxHeight: '90vh', overflowY: 'auto'
        }}>
          
          <div style={{
            width: '64px', height: '64px', backgroundColor: 'rgba(127, 29, 29, 0.3)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', marginBottom: '16px', border: '2px solid rgba(239, 68, 68, 0.3)'
          }}>
            <OctagonX size={32} color="#ef4444" />
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Action Blocked
          </h2>
          
          <p style={{ fontSize: '13px', color: '#d4d4d8', margin: '0 0 20px 0', lineHeight: '1.5', fontWeight: 500 }}>
            {message}
          </p>

          {/* 👉 Expanded Info Section */}
          {(reason || contextInfo) && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <button 
                onClick={() => setShowMore(!showMore)}
                style={{ display: 'inline-flex', background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                {showMore ? (
                  <><span>Hide Details</span> <ChevronUp size={14} /></>
                ) : (
                  <><span>More Info</span> <ChevronDown size={14} /></>
                )}
              </button>
              
              {showMore && (
                <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'alertFade 0.2s ease-out' }}>
                  {reason && (
                    <div>
                      <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Reason</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#ffffff', fontWeight: 'bold' }}>{reason}</p>
                    </div>
                  )}
                  {contextInfo && (
                    <div>
                      <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Context</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#d4d4d8', whiteSpace: 'pre-wrap', fontStyle: 'italic', paddingLeft: '8px', borderLeft: '2px solid #3f3f46' }}>{contextInfo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <button 
            onClick={() => setIsOpen(false)} 
            style={{
              width: '100%', padding: '14px', backgroundColor: '#27272a',
              color: '#ffffff', fontWeight: 'bold', borderRadius: '12px',
              fontSize: '13px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
          >
            Understood
          </button>

        </div>
      </div>
    </>
  );
}