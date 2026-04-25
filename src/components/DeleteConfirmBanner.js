'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DeleteConfirmBanner({ isOpen, onClose, onConfirm, itemName = "item", isDeleting = false }) {
  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes bannerSlideDown {
          from { transform: translateY(-120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      
      {/* Container floats at the top, perfectly avoiding the sticky navbar */}
      <div style={{
        position: 'fixed',
        top: 'calc(80px + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))',
        left: '16px',
        right: '16px',
        zIndex: 999999,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none' // Lets users still click outside if they miss the box
      }}>
        
        {/* The Banner */}
        <div style={{
          backgroundColor: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '16px',
          padding: '16px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px rgba(239,68,68,0.15)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'bannerSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertTriangle size={20} color="#ef4444" />
            </div>
            <div>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 900, color: '#f87171', letterSpacing: '-0.5px' }}>
                Delete {itemName}?
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa', lineHeight: '1.4' }}>
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={onClose}
              disabled={isDeleting}
              style={{ flex: 1, padding: '10px', backgroundColor: '#27272a', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: isDeleting ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#3f3f46'; }}
              onMouseOut={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#27272a'; }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              style={{ flex: 1, padding: '10px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: isDeleting ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onMouseOver={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#dc2626'; }}
              onMouseOut={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#ef4444'; }}
            >
              {isDeleting ? (
                <>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                  Deleting...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}