'use client';

import React, { useEffect, useState } from 'react';
import { Bell, X, Send, Inbox, Palette, PenTool, MessageCircle, Heart, Users } from 'lucide-react';

// 👉 NEW: Dynamic Styling Dictionary
const getNotificationStyle = (type) => {
  switch(type) {
    case 'new_post': 
      return { icon: <Palette size={16} color="#a855f7" />, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)' }; // Purple
    case 'critique': 
      return { icon: <PenTool size={16} color="#4ade80" />, color: '#4ade80', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' }; // Green
    case 'comment':
    case 'reply': 
      return { icon: <MessageCircle size={16} color="#3b82f6" />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' }; // Blue
    case 'like': 
      return { icon: <Heart size={16} color="#ef4444" fill="#ef4444" />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' }; // Red
    case 'follow': 
      return { icon: <Users size={16} color="#f97316" />, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)' }; // Orange
    default: 
      return { icon: <Bell size={16} color="#a1a1aa" />, color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.1)', border: 'rgba(161, 161, 170, 0.3)' }; // Gray
  }
};

export default function Notifications({ isOpen, onClose, currentUser, onNotificationClick }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 👉 NEW: State for the Telegram Bot Promo Banner
  const [showPromo, setShowPromo] = useState(false);

  // Check if they already dismissed the banner
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('hide_tg_promo');
      if (!isDismissed) {
        setShowPromo(true);
      }
    }
  }, []);

  const handleDismissPromo = () => {
    setShowPromo(false);
    localStorage.setItem('hide_tg_promo', 'true');
  };

  useEffect(() => {
    if (!isOpen) return;

    async function fetchNotifications() {
      setLoading(true);
      try {
        const res = await fetch(`/api/notifications?telegramId=${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications);
          if (data.unreadCount > 0) {
            await fetch('/api/notifications', { 
              method: 'PATCH', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telegramId: currentUser.id }) 
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Backdrop Overlay */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          zIndex: 999999, display: 'flex', justifyContent: 'flex-end', fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Sliding Drawer */}
        <div 
          onClick={(e) => e.stopPropagation()} 
          style={{
            width: '100%', maxWidth: '340px', backgroundColor: '#09090b', borderLeft: '1px solid #27272a',
            height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.8)',
            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid #27272a', backgroundColor: 'rgba(24, 24, 27, 0.5)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="#ffffff" /> Notifications
            </h2>
            <button 
              onClick={onClose} 
              style={{ background: 'transparent', border: 'none', color: '#71717a', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', padding: '4px', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
            >
              <X size={20} />
            </button>
          </div>

          {/* List Container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 👉 THE NEW PROMO BANNER */}
            {showPromo && (
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <Send size={24} color="#60a5fa" style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))' }} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#e4e4e7', lineHeight: '1.5' }}>
                    <strong style={{ color: '#60a5fa', fontSize: '14px', display: 'block', marginBottom: '2px' }}>Get Instant DMs!</strong>
                    Want real-time updates? Start our bot 
                    <a href="https://t.me/CaptionGiverbot" target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', textDecoration: 'none', fontWeight: 'bold', margin: '0 4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '6px' }}>
                      @CaptionGiverbot
                    </a> 
                    with this account to receive your notifications directly in Telegram.
                  </p>
                  <button 
                    onClick={handleDismissPromo} 
                    style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid #3f3f46', color: '#a1a1aa', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', marginTop: '4px', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = '#27272a'; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Got it, dismiss
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid rgba(37, 99, 235, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'fadeSpin 1s linear infinite' }}></div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', gap: '8px' }}>
                <Inbox size={48} color="#71717a" />
                <p style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 'bold', margin: 0 }}>No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.isRead;
                const style = getNotificationStyle(notif.type); 

                return (
                  <div 
                    key={notif._id} 
                    onClick={() => onNotificationClick(notif)}
                    style={{
                      padding: '12px 16px', borderRadius: '12px',
                      backgroundColor: isUnread ? style.bg : '#121212', 
                      border: isUnread ? `1px solid ${style.border}` : '1px solid #27272a', 
                      cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: '12px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = style.color;
                      e.currentTarget.style.backgroundColor = isUnread ? style.bg : '#18181b';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = isUnread ? style.border : '#27272a';
                      e.currentTarget.style.backgroundColor = isUnread ? style.bg : '#121212';
                    }}
                  >
                    {/* Themed Icon Badge */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', 
                      backgroundColor: style.bg, border: `1px solid ${style.border}`, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0
                    }}>
                      {style.icon}
                    </div>
                    
                    {/* Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: '#e4e4e7', margin: 0, lineHeight: '1.4', wordBreak: 'break-word' }}>
                        <span style={{ fontWeight: 'bold', color: style.color }}>@{notif.senderUsername}</span> {notif.message}
                      </p>
                      <span style={{ fontSize: '10px', color: '#71717a', fontWeight: 'bold', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}