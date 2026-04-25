'use client';

import React, { useState } from 'react';
import { Megaphone, Bot, User, FileText, Globe, Lock, PartyPopper } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProcedure, setShowProcedure] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes modalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideLeft { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'modalFade 0.2s ease-out',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div 
          style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #27272a',
            borderRadius: '16px',
            width: '100%', maxWidth: '340px',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            maxHeight: '90vh',
            animation: 'modalScale 0.2s ease-out'
          }}
        >
          
          {/* Modal Header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '16px',
            borderBottom: '1px solid #27272a', backgroundColor: '#0a0a0a', flexShrink: 0
          }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              {showProcedure ? (
                <button 
                  onClick={() => setShowProcedure(false)}
                  style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', transition: 'color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              ) : (
                <div style={{ width: '26px', height: '26px' }}></div>
              )}
            </div>

            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#f4f4f5', textAlign: 'center', whiteSpace: 'nowrap' }}>
              {showProcedure ? "Web Access Setup" : (
                <>Join the <span style={{ color: '#60a5fa' }}>Community</span></>
              )}
            </h2>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={onClose} 
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', transition: 'color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Body: Scrollable Container */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            
            {/* LOGIN VIEW */}
            {!showProcedure && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                    Log in to <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>share your artwork</span>, give and receive <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>honest feedback</span>, and connect with other creators.
                  </p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Username Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#71717a' }}>Username</label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '10px', overflow: 'hidden' }}>
                      <span style={{ paddingLeft: '12px', paddingRight: '4px', fontWeight: 'bold', color: '#71717a', fontSize: '14px' }}>@</span>
                      <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your_username" 
                        style={{ width: '100%', backgroundColor: 'transparent', border: 'none', color: '#ffffff', padding: '10px 12px 10px 0', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>
                  
                  {/* Password Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#71717a' }}>Web Password</label>
                    <input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '10px', color: '#ffffff', padding: '10px 12px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button 
                    type="submit"
                    disabled={loading || !username || !password}
                    style={{
                      width: '100%', padding: '12px', marginTop: '4px',
                      backgroundColor: (loading || !username || !password) ? '#1e1e20' : '#1d3b7a',
                      border: (loading || !username || !password) ? '1px solid #27272a' : '1px solid rgba(44, 82, 163, 0.5)',
                      color: (loading || !username || !password) ? '#71717a' : '#dbeafe',
                      borderRadius: '10px', fontSize: '13px', fontWeight: 'bold',
                      cursor: (loading || !username || !password) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { if(!loading && username && password) e.currentTarget.style.backgroundColor = '#254a99'; }}
                    onMouseOut={(e) => { if(!loading && username && password) e.currentTarget.style.backgroundColor = '#1d3b7a'; }}
                  >
                    {loading ? 'Authenticating...' : 'Log In'}
                  </button>
                </form>

                {/* Create Account Link */}
                <div style={{ marginTop: '4px', paddingTop: '20px', borderTop: '1px solid rgba(39, 39, 42, 0.5)', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#71717a', marginBottom: '12px', letterSpacing: '0.5px' }}>Don't have an account?</p>
                  <button 
                    onClick={(e) => { e.preventDefault(); setShowProcedure(true); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      backgroundColor: '#1a1a1a', border: '1px solid #27272a', color: '#ffffff',
                      padding: '10px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold',
                      cursor: 'pointer', transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#60a5fa' }}>
                      <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                    </svg>
                    <span>Join instantly via Telegram</span>
                  </button>
                </div>
              </div>
            )}

            {/* PROCEDURE VIEW */}
            {showProcedure && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'slideLeft 0.3s ease-out' }}>
                
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ fontSize: '13px', color: '#dbeafe', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                    <span style={{ color: '#fa7a60', fontWeight: 'bold' }}>Zero Setup Required!</span> Access the full app instantly inside Telegram without an account. 
                  </p>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                    Prefer using your <span style={{ color: '#60a5fa' }}>standard web browser</span>? Follow these steps to get your Web Credentials.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { icon: <Megaphone size={16} />, text: "Join our official Telegram group." },
                    { icon: <Bot size={16} />, text: <>Send <code style={{ backgroundColor: '#27272a', color: '#d4d4d8', padding: '2px 4px', borderRadius: '4px', fontSize: '11px' }}>/menu</code> in the chat.</> },
                    { icon: <User size={16} />, text: "Tap the 'My Profile' inline button." },
                    { icon: <FileText size={16} />, text: <>Note your unique <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>@username</span>.</> },
                    { icon: <Globe size={16} />, text: <>Tap <span style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'bottom' }}><Globe size={14} /> 'Enable Web Access'</span>.</> },
                    { icon: <Lock size={16} />, text: "Set a secure password." },
                    { icon: <PartyPopper size={16} />, text: <>Come back here and <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>log in</span>!</> }
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', backgroundColor: '#121212', border: '1px solid rgba(39, 39, 42, 0.5)', borderRadius: '10px' }}>
                      
                      {/* Step Number Badge */}
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#18181b', border: '1px solid #3f3f46', color: '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>
                        {i + 1}
                      </div>

                      {/* Icon & Text Container */}
                      <p style={{ fontSize: '13px', color: '#d4d4d8', margin: 0, lineHeight: '1.5', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ color: '#60a5fa', display: 'inline-flex', marginTop: '1px', flexShrink: 0 }}>
                          {step.icon}
                        </span>
                        <span style={{ flex: 1 }}>{step.text}</span>
                      </p>
                      
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid rgba(39, 39, 42, 0.5)' }}>
                  <a 
                    href="https://t.me/ArtGroupChat1" // Update with your actual group link
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', boxSizing: 'border-box',
                      backgroundColor: '#2481cc', color: '#ffffff', textDecoration: 'none',
                      padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold',
                      boxShadow: '0 0 15px rgba(36,129,204,0.2)', transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d6bb0'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2481cc'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                    </svg>
                    Continue to Telegram
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}