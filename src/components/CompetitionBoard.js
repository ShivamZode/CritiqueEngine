'use client';

import React, { useEffect, useState } from 'react';
import ArtDetail from './ArtDetail';
import CritiqueDetail from './CritiqueDetail';
import { 
  Hourglass, Trophy, Palette, BookOpen, CheckCircle, Upload, Inbox,
  ArrowLeft, Eye, Target, Heart, MessageCircle, X, Image as ImageIcon,
  Download, FileText
} from 'lucide-react';

const CountdownTimer = ({ startTime, endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      if (now < start) { setStatus('starts'); formatDiff(start - now); } 
      else if (now >= start && now <= end) { setStatus('ends'); formatDiff(end - now); } 
      else { setStatus('ended'); }
    };

    const formatDiff = (diff) => {
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`); else setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [startTime, endTime]);

  if (status === 'ended') return <span style={{ display: 'inline-flex', alignItems: 'center', color: '#ef4444', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '6px 12px', borderRadius: '999px', backgroundColor: 'rgba(239, 68, 68, 0.15)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Event Closed</span>;
  if (status === 'starts') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#60a5fa', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '6px 12px', borderRadius: '999px', backgroundColor: 'rgba(59, 130, 246, 0.15)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}><Hourglass size={14} /> Starts in: {timeLeft}</span>;
  
  // 👉 THE FIX: Added inline-flex, alignItems, and gap to make the Hourglass sit perfectly next to the text!
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fde047', fontWeight: 'bold', border: '1px solid rgba(253, 224, 71, 0.5)', padding: '6px 12px', borderRadius: '999px', backgroundColor: 'rgba(253, 224, 71, 0.15)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}><Hourglass size={14} /> Ends in: {timeLeft}</span>;
};

export default function CompetitionBoard({ competitionTag, onBack, onArtClick, onArtistClick, currentUser, onUpload, onRequireLogin }) {
  const [artworks, setArtworks] = useState([]);
  const [compDetails, setCompDetails] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [columnCount, setColumnCount] = useState(2);

  const [selectedArt, setSelectedArt] = useState(null);
  const [selectedCritique, setSelectedCritique] = useState(null);
  
  const [showResults, setShowResults] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // 👉 NEW: Lock background scrolling when overlay is active
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  useEffect(() => {
    async function fetchCompetition() {
      setLoading(true);
      try {
        const res = await fetch(`/api/competition?tag=${competitionTag}`);
        const data = await res.json();
        if (data.success) {
          setArtworks(data.artworks);
          setCompDetails(data.competition); 
        }
      } catch (err) {} finally { setLoading(false); }
    }
    if (competitionTag) fetchCompetition();
  }, [competitionTag]);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1600) setColumnCount(6); 
      else if (window.innerWidth >= 1280) setColumnCount(5); 
      else if (window.innerWidth >= 1024) setColumnCount(4); 
      else if (window.innerWidth >= 768) setColumnCount(3); 
      else setColumnCount(2); 
    };
    updateColumns(); window.addEventListener('resize', updateColumns); return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // 👉 THE FIX: Wrap child views in fixed overlays so they stack properly
  if (selectedCritique) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99995, overflowY: 'auto', backgroundColor: '#09090b' }}>
        <CritiqueDetail crit={selectedCritique} onClose={() => setSelectedCritique(null)} onPlay={onArtClick} onArtistClick={(id) => { if(onArtistClick) onArtistClick(id); setSelectedCritique(null); }} onOpenOriginalArt={(artObj) => { setSelectedCritique(null); setSelectedArt(artObj); }} currentUser={currentUser} onUpdateCritique={(updatedCrit) => { setSelectedCritique(updatedCrit); }} onRequireLogin={onRequireLogin || (() => alert('Please log in'))} />
      </div>
    );
  }

  if (selectedArt) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99995, overflowY: 'auto', backgroundColor: '#09090b' }}>
        <ArtDetail art={selectedArt} onClose={() => setSelectedArt(null)} onArtClick={onArtClick} onArtistClick={(id) => { if(onArtistClick) onArtistClick(id); setSelectedArt(null); }} onCategoryClick={() => onBack()} currentUser={currentUser} userStats={{ following: [], savedArtsList: [] }} setUserStats={() => {}} onUpdateArt={(updatedArt) => { setArtworks(prev => prev.map(a => a._id === updatedArt._id ? updatedArt : a)); setSelectedArt(updatedArt); }} onRequireLogin={onRequireLogin || (() => alert('Please log in'))} onCritiqueClick={(critique) => { const enrichedCritique = { ...critique, originalArtObject: selectedArt, originalTitle: selectedArt.title, originalImageUrl: selectedArt.imageUrl, originalArtistUsername: selectedArt.firstName || selectedArt.username, originalArtistId: selectedArt.telegramId }; setSelectedCritique(enrichedCritique); }} />
      </div>
    );
  }

  const columns = Array.from({ length: columnCount }, () => []);
  artworks.forEach((art, index) => columns[index % columnCount].push(art));

  return (
    <>
      <style>{`
        @keyframes compFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes compZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes compSpin { to { transform: rotate(360deg); } }
        
        .comp-card { transition: transform 0.2s ease, filter 0.2s ease; }
        .comp-card:hover { transform: scale(1.02); filter: brightness(1.1); }
        
        .result-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .result-card:hover { transform: translateY(-4px); }
      `}</style>
      
      {/* 👉 THE FIX: Changed from minHeight to position: fixed to create the overlay! */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99990, backgroundColor: '#09090b', color: '#ffffff', paddingBottom: '60px', overflowY: 'auto', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', animation: 'compFadeIn 0.2s ease-out' }}>
        
        {/* Sticky Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(9, 9, 11, 0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid #27272a', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          
          <button 
            onClick={onBack} 
            style={{ padding: '8px 16px', backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', fontWeight: 'bold', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'background-color 0.2s', flexShrink: 0 }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
          >
            <X size={16} /> Close Event
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '2px solid #3f3f46', paddingLeft: '16px', minWidth: 0 }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}><Trophy size={16} color="#eab308" style={{ flexShrink: 0 }} /></span>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {compDetails ? compDetails.name : 'Event'}
            </h2>
          </div>

        </div>

        {/* Header Block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 16px', borderBottom: '1px solid #27272a', backgroundImage: 'radial-gradient(ellipse at top, rgba(234, 179, 8, 0.1) 0%, transparent 70%)' }}>
          <span style={{ fontSize: '48px', marginBottom: '16px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}><Palette size={48} /></span>
          <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            {showResults ? 'Official Results' : 'Event Gallery'}
          </h2>

          {/* 👉 NEW: Dynamic Neon Difficulty Badge + Translation Subtitle */}
          {compDetails && compDetails.difficulty && (() => {
            let color = '#c084fc', bg = 'rgba(168, 85, 247, 0.15)', border = 'rgba(168, 85, 247, 0.5)', translation = 'Unbeatable'; 
            if (compDetails.difficulty.includes('Breeze')) { color = '#4ade80'; bg = 'rgba(34, 197, 94, 0.15)'; border = 'rgba(34, 197, 94, 0.5)'; translation = 'Easy'; }
            else if (compDetails.difficulty.includes('Hustle')) { color = '#fde047'; bg = 'rgba(253, 224, 71, 0.15)'; border = 'rgba(253, 224, 71, 0.5)'; translation = 'Intermediate'; }
            else if (compDetails.difficulty.includes('Crucible')) { color = '#f87171'; bg = 'rgba(239, 68, 68, 0.15)'; border = 'rgba(239, 68, 68, 0.5)'; translation = 'Hard'; }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ padding: '6px 16px', backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '999px', color: color, fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: `0 4px 15px ${bg}` }}>
                   Level: {compDetails.difficulty}
                </div>
                <span style={{ color: color, fontSize: '10px', fontWeight: 'bold', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
                  ({translation} Difficulty)
                </span>
              </div>
            );
          })()}
          
          {!showResults && <p style={{ color: '#a1a1aa', fontSize: '14px', maxWidth: '480px', margin: '0 0 24px 0', lineHeight: '1.5' }}>Viewing all entries. Click any artwork to leave a critique or drop a like!</p>}

          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
             {compDetails && <CountdownTimer startTime={compDetails.startTime} endTime={compDetails.endTime} />}
             
             <button 
               onClick={() => setShowRulesModal(true)} 
               style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '8px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
               onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.2)'; e.currentTarget.style.color = '#93c5fd'; }}
               onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; e.currentTarget.style.color = '#60a5fa'; }}
             >
               <BookOpen size={16} /> View Task & Rules
             </button>
          </div>

          {compDetails && (() => {
            const now = new Date().getTime();
            const start = new Date(compDetails.startTime).getTime();
            const end = new Date(compDetails.endTime).getTime();
            const isLive = compDetails.isActive && now >= start && now <= end;
            const isEnded = !compDetails.isActive || now > end;

            const hasSubmitted = currentUser ? artworks.some(art => String(art.telegramId) === String(currentUser.id)) : false;

            if (isLive) {
              if (hasSubmitted) {
                return (
                  <div style={{ padding: '14px 28px', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '999px', color: '#4ade80', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(34,197,94,0.2)' }}>
                    <CheckCircle size={18} /> Entry Submitted
                  </div>
                );
              }
              return (
                <button 
                  onClick={() => onUpload(competitionTag)} 
                  // 👉 THE FIX: Added display: 'inline-flex', alignItems: 'center', and gap: '8px'
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 36px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '999px', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 20px rgba(37,99,235,0.4)', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Upload size={18} /> Submit Your Entry
                </button>
              );
            }
            
            if (isEnded && !compDetails.resultsDeclared) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', backgroundColor: 'rgba(88, 28, 135, 0.2)', border: '1px solid rgba(168, 85, 247, 0.5)', borderRadius: '16px', maxWidth: '360px', width: '100%', boxShadow: '0 10px 30px rgba(88, 28, 135, 0.2)' }}>
                  <Hourglass size={36} color="#c084fc" style={{ marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#c084fc', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Judging in Progress</h3>
                  <p style={{ fontSize: '14px', color: '#e9d5ff', margin: 0, lineHeight: '1.5', textAlign: 'center' }}>The results will be declared soon right here!</p>
                </div>
              );
            }

            if (compDetails.resultsDeclared && !showResults) {
              return (
                <button 
                  onClick={() => setShowResults(true)} 
                  style={{ padding: '16px 36px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '2px solid rgba(234, 179, 8, 0.5)', borderRadius: '999px', fontWeight: 900, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(234, 179, 8, 0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(234, 179, 8, 0.25)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(234, 179, 8, 0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Trophy size={20} /> View Official Results
                </button>
              );
            }

            return null; 
          })()}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '4px solid rgba(234, 179, 8, 0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'compSpin 1s linear infinite' }}></div>
          </div>
        ) : artworks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: '48px', marginBottom: '16px' }}><Inbox size={48} color="#71717a" style={{ marginBottom: '16px' }} /></span>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>No entries yet!</h3>
            <p style={{ color: '#a1a1aa', fontSize: '14px', margin: 0 }}>Be the first to submit an artwork for this event.</p>
          </div>
        ) : showResults ? (
          
          <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px 20px', boxSizing: 'border-box' }}>
            <button 
              onClick={() => setShowResults(false)} 
              style={{ alignSelf: 'flex-start', background: 'rgba(39, 39, 42, 0.5)', border: '1px solid #3f3f46', color: '#d4d4d8', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#3f3f46'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.5)'; e.currentTarget.style.color = '#d4d4d8'; }}
            >
              <ArrowLeft size={14} /> Back to Gallery
            </button>
            
            {artworks.filter(a => a.rank).sort((a,b) => a.rank - b.rank).map(art => {
              let borderColor = '#27272a';
              let bgColor = '#121212';
              let rankColor = '#a1a1aa';
              let shadow = '0 10px 25px -5px rgba(0,0,0,0.5)';

              if (art.rank === 1) { borderColor = 'rgba(234, 179, 8, 0.5)'; bgColor = 'rgba(234, 179, 8, 0.1)'; rankColor = '#eab308'; shadow = '0 10px 30px rgba(234, 179, 8, 0.15)'; } 
              else if (art.rank === 2) { borderColor = 'rgba(148, 163, 184, 0.4)'; bgColor = 'rgba(148, 163, 184, 0.1)'; rankColor = '#cbd5e1'; } 
              else if (art.rank === 3) { borderColor = 'rgba(180, 83, 9, 0.4)'; bgColor = 'rgba(180, 83, 9, 0.1)'; rankColor = '#d97706'; }

              return (
                <div key={art._id} className="result-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', borderRadius: '20px', backgroundColor: bgColor, border: `1px solid ${borderColor}`, boxShadow: shadow, boxSizing: 'border-box', width: '100%', animation: 'compFadeIn 0.3s ease-out' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '50px', flexShrink: 0 }}>
                    {art.rank === 1 && <span style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', marginBottom: '4px' }}>🥇</span>}
                    {art.rank === 2 && <span style={{ fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', marginBottom: '4px' }}>🥈</span>}
                    {art.rank === 3 && <span style={{ fontSize: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', marginBottom: '4px' }}>🥉</span>}
                    <div style={{ fontSize: art.rank <= 3 ? '24px' : '20px', fontWeight: 900, color: rankColor, lineHeight: '1' }}>#{art.rank}</div>
                  </div>

                  <div onClick={() => setSelectedArt(art)} style={{ width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: '1px solid #3f3f46', backgroundColor: '#09090b', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    <img src={art.thumbnailUrl || art.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'} alt="Entry" />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontWeight: 900, color: '#ffffff', fontSize: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.5px' }}>{art.title || 'Untitled'}</h3>
                    
                    <div onClick={() => { if(onArtistClick) onArtistClick(art.telegramId); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: 'max-content', maxWidth: '100%', backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {art.artistPhotoUrl ? (
                        <img src={art.artistPhotoUrl} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#ffffff', flexShrink: 0 }}>
                          {art.firstName ? art.firstName.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <span style={{ fontSize: '13px', color: '#d4d4d8', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{art.username}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                      {art.adminCritique ? (
                        <button 
                          onClick={() => onArtClick(art.adminCritique.critiqueImageUrl, 'viewer', art)} 
                          style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.25)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.15)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; }}
                        >
                          <Eye size={14} /> Judge's Feedback
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#71717a', border: '1px solid #3f3f46', backgroundColor: '#18181b', padding: '6px 12px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold' }}>No Feedback Yet</span>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        ) : (
          <div style={{ display: 'flex', width: '100%', maxWidth: '1600px', gap: '16px', padding: '32px 2vw', margin: '0 auto', boxSizing: 'border-box'}}>
            {columns.map((columnArtworks, colIndex) => (
              <div key={colIndex} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1 1 0%', minWidth: 0 }}>
                {columnArtworks.map((art) => {
                  const isLiked = currentUser ? (art.likes || []).some(id => String(id) === String(currentUser.id)) : false;

                  return (
                    <div key={art._id} onClick={() => setSelectedArt(art)} className="comp-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', width: '100%', minWidth: 0, position: 'relative' }}>
                      <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#121212', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', border: '1px solid #27272a' }}>
                        <img src={art.thumbnailUrl || art.imageUrl} alt="Entry" loading="lazy" style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }} />
                        {art.isPredefined && <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#9333ea', color: '#ffffff', fontSize: '10px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Target size={12} /> Guided</div>}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 6px', gap: '6px', width: '100%', minWidth: 0 }}>
                        <span style={{ display: 'block', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 900, fontSize: '15px', color: '#ffffff', letterSpacing: '-0.5px' }}>
                          {art.title || 'Untitled'}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 0 }}>
                          <div onClick={(e) => { e.stopPropagation(); if (onArtistClick) onArtistClick(art.telegramId); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 0%', minWidth: 0, overflow: 'hidden', backgroundColor: 'rgba(24, 24, 27, 0.5)', padding: '4px 10px 4px 4px', borderRadius: '999px', border: '1px solid #27272a' }}>
                            {art.artistPhotoUrl ? (
                              <img src={art.artistPhotoUrl} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#ffffff', flexShrink: 0 }}>
                                {art.firstName ? art.firstName.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>
                              {art.firstName || 'Artist'}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, paddingLeft: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isLiked ? '#ef4444' : '#71717a' }}>
                              <Heart size={14} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} /> 
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{art.likes?.length || 0}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#71717a' }}>
                              <MessageCircle size={14} /> 
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{art.comments?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Rules & Task Modal */}
        {showRulesModal && compDetails && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'compFadeIn 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)', animation: 'compZoomIn 0.2s ease-out' }}>
              
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090b', flexShrink: 0 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={20} color="#60a5fa" /> Task & Rules
                </h2>
                <button 
                  onClick={() => setShowRulesModal(false)} 
                  style={{ background: 'transparent', border: 'none', color: '#71717a', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s', padding: '4px' }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                >
                 <X size={20} />
                </button>
              </div>

              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {compDetails.referenceImageUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#121212', padding: '20px', borderRadius: '16px', border: '1px solid #27272a' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}><ImageIcon size={16} /></span> Reference Image Task
                    </h3>
                    
                    <div style={{ backgroundColor: '#09090b', borderRadius: '12px', padding: '8px', border: '1px solid #3f3f46' }}>
                      <img src={compDetails.referenceImageUrl} alt="Task Reference" style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '400px' }} />
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                      <a 
                        href={compDetails.referenceImageUrl} 
                        download={`Task_${compDetails.name}.jpg`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ flex: 1, minWidth: '140px', backgroundColor: '#27272a', color: '#ffffff', border: '1px solid #3f3f46', textAlign: 'center', padding: '14px', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none', fontSize: '13px', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                      >
                        <Download size={16} /> Download
                      </a>
                      <button 
                        onClick={() => {
                          setShowRulesModal(false);
                          onArtClick(compDetails.referenceImageUrl, 'viewer_raw', { title: `${compDetails.name} Reference` });
                        }} 
                        style={{ flex: 1, minWidth: '140px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                      >
                        <Eye size={16} /> Inspect Image
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 8px' }}>
                   <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <FileText size={16} /> Guidelines
                   </h3>
                   <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', padding: '20px', borderRadius: '16px', border: '1px solid #27272a' }}>
                     <p style={{ color: '#d4d4d8', fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>
                       {compDetails.rules || "No specific rules provided for this event. Do your best and have fun!"}
                     </p>
                   </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}