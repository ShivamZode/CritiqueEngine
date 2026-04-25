'use client';

import { useEffect, useState, useRef } from 'react';
import CritiqueEngine from '@/components/CritiqueEngine'; 
import Portfolio from '@/components/Portfolio';
import Feed from '@/components/Feed';
import Upload from '@/components/Upload';
import LoginModal from '@/components/LoginModal'; 
import AdminPanel from '@/components/AdminPanel'; 
import CompetitionBoard from '@/components/CompetitionBoard';
import { decodeDataImageToShapes } from '@/utils/codec';
import GlobalBanAlert from '@/components/GlobalBanAlert';
import LegalGatekeeper from '@/components/LegalGatekeeper';
import ArtDetail from '@/components/ArtDetail';
import CritiqueDetail from '@/components/CritiqueDetail';

export default function Home() {
  const [route, setRoute] = useState('loading_init');
  const [currentUser, setCurrentUser] = useState(undefined); 
  const [portfolioId, setPortfolioId] = useState(null);
  
  const [competitionTag, setCompetitionTag] = useState(null); 
  const [activeUploadContext, setActiveUploadContext] = useState(null); 
  
  const [showEngine, setShowEngine] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [engineConfig, setEngineConfig] = useState({ mode: 'editor', payload: null, saveMode: 'critique', meta: {} });
  const [sharedItem, setSharedItem] = useState(null);
  const [layerStack, setLayerStack] = useState([]);
  const hasRouted = useRef(false);

  const engineOpenRef = useRef(false);
  const isBurningTrapRef = useRef(false);
  const exitEngineRef = useRef(null);

  const [globalUserStats, setGlobalUserStats] = useState({ following: [], savedArtsList: [], savedCritsList: [] });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); 

  // 👉 NEW: Global Competition State
  const [globalCompetition, setGlobalCompetition] = useState(null);

  // 👉 NEW: Fetch the banner ONCE when the app first loads
  useEffect(() => {
    fetch('/api/competition?current=true')
      .then(res => res.json())
      .then(data => {
         if (data.success && data.competition) {
           setGlobalCompetition(data.competition);
         }
      })
      .catch(console.error);
  }, []);

  // ==========================================
  // 1. AUTHENTICATION
  // ==========================================
  useEffect(() => {
    async function authenticate() {
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
      
      if (tg?.initDataUnsafe?.user) {
        tg.ready();
        const user = tg.initDataUnsafe.user;
        const uId = user.id.toString();
        
        // 1. Set temporary state so the app loads instantly
        setCurrentUser({
          id: uId,
          username: user.username || `user_${uId.slice(-5)}`,
          firstName: user.first_name || 'Artist'
        });

        // 2. Fetch the REAL database profile in the background
        fetch('/api/users/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: uId,
            username: user.username,
            firstName: user.first_name,
            photoUrl: user.photo_url 
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser({
              id: data.user.telegramId,
              username: data.user.username,
              firstName: data.user.firstName,
              isAdmin: data.user.isAdmin === true,
              hasAcceptedTerms: data.user.hasAcceptedTerms === true
            });
          }
        })
        .catch(console.error);
        return;
      }

      // If outside Telegram (Web Browser)
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
          setCurrentUser(data.user);
          return;
        }
      } catch (err) {
        console.error("Auth check failed", err);
      }

      setCurrentUser(null);
    }
    authenticate();
  }, []);

  // ==========================================
  // 2. HELPER FUNCTIONS
  // ==========================================
  const pushLayer = async (layerType, layerData) => {
    const layerId = Date.now();
    
    // 1. Instantly open the layer with the data we have for zero-latency UI
    setLayerStack(prev => [...prev, { type: layerType, data: layerData, id: layerId }]);
    window.history.pushState({ isStackLayer: true }, '');

    // 2. Silently fetch the absolute latest database version in the background
    if ((layerType === 'art' || layerType === 'critique') && layerData && layerData._id) {
      try {
        // Adding _t=Date.now() forces Next.js to bypass any hidden caching
        const res = await fetch(`/api/resolve?id=${layerData._id}&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.item) {
            // 3. Surgically inject the freshest likes, views, and comments into the active layer!
            setLayerStack(prev => prev.map(l => 
              l.id === layerId 
                ? { ...l, data: { ...l.data, likes: data.item.likes, comments: data.item.comments, views: data.item.views } } 
                : l
            ));
          }
        }
      } catch (e) {
        console.error("Failed to freshen layer data", e);
      }
    }
  };

  const jumpToFeed = () => {
    const depth = layerStack.length;
    if (depth > 0) {
      setLayerStack([]); 
      setRoute('feed');  
      window.history.go(-depth); 
    }
  };

  const handleRequireLogin = () => {
    setIsLoginModalOpen(true);
  };

  const handleEngineExit = () => {
    // 1. Lower shields and set the burn flag
    isBurningTrapRef.current = true;
    engineOpenRef.current = false;
    setShowEngine(false);

    // 2. Manually burn the trap state we pushed earlier so it doesn't leave garbage in their history
    window.history.back();

    // 3. Keep your existing saveMode routing!
    if (engineConfig.saveMode === 'predefine') {
      if (layerStack.length > 0 && layerStack[layerStack.length - 1].type === 'upload') {
        window.history.back(); 
      } else if (route === 'upload') {
        setActiveUploadContext(null);
        setPortfolioId(null); 
        setRoute('portfolio');
      }

      setTimeout(() => {
        window.dispatchEvent(new Event('artwork_added'));
        window.dispatchEvent(new Event('refresh_portfolio'));
      }, 100);
    }
  };

  // Keep the ref updated with the latest version of the exit function on every render
  useEffect(() => {
    exitEngineRef.current = handleEngineExit;
  });

  // 👉 THE FIX: Push the initial trap when the engine opens
  useEffect(() => {
    engineOpenRef.current = showEngine;
    if (showEngine) {
      window.history.pushState({ engineTrap: true }, '');
    }
  }, [showEngine]);

  const handleArtRouting = async (url, mode, artObj = null) => {
    if (!currentUser && mode !== 'viewer' && mode !== 'viewer_raw') {
      setIsLoginModalOpen(true);
      return;
    }

    const metaData = artObj ? {
      artworkId: artObj._id,
      title: artObj.title,
      caption: artObj.caption,
      categories: artObj.categories
    } : {};

    if (mode === 'editor') {
      setEngineConfig({ mode: 'editor', payload: { bgUrl: url, shapes: [] }, saveMode: 'critique', meta: metaData });
      setShowEngine(true); 
    } 
    else if (mode === 'viewer_raw') {
      setEngineConfig({ mode: 'viewer', payload: { bgUrl: url, shapes: [] }, saveMode: 'critique', meta: metaData });
      setShowEngine(true);
    }
    else if (mode === 'editor_decode' || mode === 'viewer') {
      setIsDecoding(true); 
      try {
        const img = new window.Image();
        img.crossOrigin = 'Anonymous'; 
        const extractedPayload = await new Promise((resolve, reject) => {
          img.onload = () => { try { resolve(decodeDataImageToShapes(img)); } catch (e) { reject(e); } };
          img.onerror = () => reject(new Error("Failed to load encoded image"));
          img.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
        });

        const targetMode = mode === 'editor_decode' ? 'editor' : 'viewer';
        setEngineConfig({ mode: targetMode, payload: extractedPayload, saveMode: 'critique', meta: metaData });
        setShowEngine(true); 
      } catch (err) {
        alert("Failed to load critique data. The image might be corrupted.");
      } finally {
        setIsDecoding(false); 
      }
    }
  };

  // ==========================================
  // 3. THE UNIFIED OMNI-CATCHER
  // ==========================================
  useEffect(() => {
    if (currentUser === undefined) return;

    if (hasRouted.current) return; 
    hasRouted.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const tg = window.Telegram?.WebApp;
    const tgStartParam = tg?.initDataUnsafe?.start_param || urlParams.get('startapp'); 

    let targetProfileId = urlParams.get('profile') || urlParams.get('user');
    let targetArtId = urlParams.get('post') || urlParams.get('art') || urlParams.get('view');
    let targetCritiqueId = urlParams.get('critique') || urlParams.get('crit');
    let targetCommentId = urlParams.get('comment');
    
    let isDirectEdit = false; 

    if (tgStartParam) {
      // --- A. NON-DATABASE ROUTES ---
      if (tgStartParam === 'upload') { setRoute('upload'); return; }
      if (tgStartParam === 'portfolio') { setRoute('portfolio'); return; }
      if (tgStartParam === 'feed') { setRoute('feed'); return; }
      
      if (tgStartParam.startsWith('comp_')) {
        setCompetitionTag(tgStartParam.replace('comp_', ''));
        setRoute('competition');
        return;
      }

      // --- B. DATABASE ID ROUTES ---
      if (tgStartParam.startsWith('user_') || tgStartParam.startsWith('profile_')) {
        targetProfileId = tgStartParam.split('_')[1];
      }
      else if (tgStartParam.startsWith('post_') || tgStartParam.startsWith('art_') || tgStartParam.startsWith('view_')) {
        const parts = tgStartParam.replace(/^(post|art|view)_/, '').split('_c_');
        targetArtId = parts[0];
        if (parts[1]) targetCommentId = parts[1];
      }
      else if (tgStartParam.startsWith('crit_')) {
        const parts = tgStartParam.replace('crit_', '').split('_c_');
        targetCritiqueId = parts[0];
        if (parts[1]) targetCommentId = parts[1];
      }
      else if (tgStartParam.startsWith('edit_')) {
        targetArtId = tgStartParam.split('_')[1];
        isDirectEdit = true; 
      }
    }

    // --- C. EXECUTE FETCHING ---
    if (targetProfileId || targetArtId || targetCritiqueId) {
      setTimeout(async () => {
        setRoute('feed'); 

        if (targetProfileId) {
          pushLayer('portfolio', targetProfileId);
        } else if (targetArtId || targetCritiqueId) {
          const fetchId = targetArtId || targetCritiqueId;
          try {
            if (!fetchId || fetchId === 'undefined' || fetchId === 'null') return;
            const res = await fetch(`/api/resolve?id=${fetchId}&_t=${Date.now()}`);
            if (!res.ok) return;
            const text = await res.text();
            if (!text) return;
            const data = JSON.parse(text);
            
            if (data.success) {
              if (data.type === 'artwork') {
                if (isDirectEdit) {
                  const editMode = data.item.isPredefined ? 'editor_decode' : 'editor';
                  const targetUrl = data.item.isPredefined ? data.item.encodedImageUrl : data.item.imageUrl;
                  handleArtRouting(targetUrl, editMode, data.item); 
                } else {
                  pushLayer('art', { ...data.item, targetCommentId });
                }
              }
              else if (data.type === 'critique') {
                pushLayer('critique', { ...data.item, targetCommentId });
              }
            }
          } catch (e) {
            console.error("Failed to load linked item");
          }
        }
        if (window.location.search) window.history.replaceState(null, '', '/');
      }, 150); 
    } 
    // --- D. FALLBACK ROUTE ---
    else if (!tgStartParam && route === 'loading_init') {
      setRoute('home');
    }
  }, [currentUser]);

  // ==========================================
  // 4. TELEGRAM UI & HISTORY MANAGEMENT
  // ==========================================
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.enableClosingConfirmation();
      tg.expand();
      try {
        tg.setHeaderColor('#09090b'); 
        tg.setBackgroundColor('#09090b');
      } catch (e) {
        console.warn('Could not set header color');
      }
      const handleTgBack = () => window.history.back(); 
      tg.BackButton.onClick(handleTgBack);
      return () => tg.BackButton.offClick(handleTgBack);
    }
  }, []);
  
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      // 👉 THE FIX: Added showEngine to the visible condition!
      if (showEngine || layerStack.length > 0 || route !== 'feed') tg.BackButton.show();
      else tg.BackButton.hide();
    }
  }, [showEngine, layerStack.length, route]);

  useEffect(() => {
    const handlePopState = (e) => {
      // 1. Did we intentionally trigger this pop to clean up the history?
      if (isBurningTrapRef.current) {
        isBurningTrapRef.current = false;
        return; 
      }

      // 2. Did the user press the hardware back button while the engine is open?
      if (engineOpenRef.current) {
        // Instantly push the trap state right back in
        window.history.pushState({ engineTrap: true }, '');
        
        // 👉 THE FIX: Yell at the Critique Engine to open its warning modal!
        window.dispatchEvent(new Event('hardware_back_pressed'));
        return; 
      }

      // 3. Normal layer popping for the rest of the app
      setLayerStack(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!currentUser) return; 
    fetch(`/api/users/me?telegramId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGlobalUserStats({ 
            following: data.user.following || [], 
            savedArtsList: data.user.savedArts || [],
            savedCritsList: data.user.savedCrits || [] 
          });
        }
      }).catch(console.error);
  }, [currentUser]);

  // ==========================================
  // 5. RENDER LOGIC
  // ==========================================
  if (route === 'loading_init' || currentUser === undefined) {
    return (
      <>
        <style>{`@keyframes pageSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'pageSpin 1s linear infinite' }}></div>
            <p style={{ color: '#a1a1aa', fontSize: '13px', fontWeight: 'bold', margin: 0, letterSpacing: '0.5px' }}>INITIALIZING...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`@keyframes pageSpin { to { transform: rotate(360deg); } }`}</style>
      
      <div style={{ display: showEngine ? 'none' : 'block', width: '100%' }}>
        {/* BASE ROUTES */}
        {route === 'upload' && (
          currentUser ? (
            <Upload 
              competitionTag={activeUploadContext} 
              onBack={() => { 
                setActiveUploadContext(null);
                setPortfolioId(null); 
                setRoute('portfolio'); 
              }} 
              onDirectSuccess={() => { 
                setActiveUploadContext(null);
                setPortfolioId(null); 
                setRoute('portfolio'); 
              }} 
              onPredefine={(rawUrl, metaData) => { 
                setEngineConfig({ mode: 'editor', payload: { bgUrl: rawUrl, shapes: [] }, saveMode: 'predefine', meta: metaData }); 
                setShowEngine(true);
              }}
              currentUser={currentUser}
            />
          ) : (
            <div style={{ minHeight: '100vh', backgroundColor: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
               <button 
                 onClick={() => setIsLoginModalOpen(true)} 
                 style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '14px 24px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px', transition: 'background-color 0.2s', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}
               >
                 Log in to Upload
               </button>
            </div>
          )
        )}

        {route === 'portfolio' && (
          <Portfolio 
            telegramId={portfolioId || currentUser?.id}
            globalCompetition={globalCompetition} 
            onBack={() => { setRoute('feed'); setPortfolioId(null); }} 
            onPushLayer={pushLayer}
            onUpload={() => pushLayer('upload')}
            currentUser={currentUser} 
            onRequireLogin={handleRequireLogin} 
          />
        )}

        {route === 'feed' && (
          <Feed 
            globalCompetition={globalCompetition}
            onBack={() => setRoute('home')} 
            onPushLayer={pushLayer}
            sharedItem={sharedItem}
            currentUser={currentUser} 
            onRequireLogin={handleRequireLogin} 
          />
        )}
        
        {route === 'competition' && competitionTag && (
          <CompetitionBoard 
            competitionTag={competitionTag}
            onBack={() => setRoute('portfolio')}
            onArtClick={handleArtRouting}
            onArtistClick={(tId) => pushLayer('portfolio', tId)}
            currentUser={currentUser}
            onUpload={(tag) => {
               setActiveUploadContext(tag);
               setRoute('upload');
            }}
            onRequireLogin={handleRequireLogin}
          />
        )}

        {route === 'home' && (
          <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#ffffff', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>Art For Critique</h1>
              <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0 }}>Welcome to the central hub.</p>
            </div>

            <button 
              onClick={() => {
                if (!currentUser) return setIsLoginModalOpen(true);
                setPortfolioId(null); setRoute('portfolio');
              }} 
              style={{ width: '100%', maxWidth: '320px', backgroundColor: '#9333ea', color: '#ffffff', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px', transition: 'background-color 0.2s', boxShadow: '0 4px 15px rgba(147,51,234,0.3)' }}
            >
              My Profile
            </button>
            
            <button 
              onClick={() => setRoute('feed')} 
              style={{ width: '100%', maxWidth: '320px', backgroundColor: '#2563eb', color: '#ffffff', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px', transition: 'background-color 0.2s', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}
            >
              Explore Feed
            </button>

            {currentUser?.isAdmin && (
              <button 
                onClick={() => setRoute('admin')} 
                style={{ width: '100%', maxWidth: '320px', marginTop: '16px', backgroundColor: 'rgba(127, 29, 29, 0.4)', border: '1px solid #ef4444', color: '#ffffff', padding: '14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', transition: 'background-color 0.2s', boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)' }}
              >
                <span>👑</span> Open God Mode
              </button>
            )}
          </div>
        )}

        {route === 'admin' && (
          <AdminPanel 
            currentUser={currentUser} 
            onBack={() => setRoute('home')} 
            onArtistClick={(tId) => pushLayer('portfolio', tId)}
          />
        )}
      </div>

      {/* 👉 THE MAGIC STACK RENDERER */}
      {layerStack.map((layer, index) => {
        const dynamicZIndex = 99000 + (index * 10); 

        return (
          <div key={layer.id} style={{ position: 'fixed', inset: 0, zIndex: dynamicZIndex, backgroundColor: '#09090b', overflowY: 'auto' }}>
            
            {layer.type === 'portfolio' && (
              <Portfolio 
                telegramId={layer.data} 
                isOverlay={true}
                globalCompetition={globalCompetition}
                onBack={() => window.history.back()} 
                onPushLayer={pushLayer} 
                onGoToFeed={jumpToFeed}
                onUpload={() => pushLayer('upload')}
                currentUser={currentUser} 
                onRequireLogin={handleRequireLogin} 
              />
            )}

            {layer.type === 'upload' && (
              <Upload 
                onBack={() => window.history.back()} 
                onDirectSuccess={() => window.history.back()}
                onPredefine={(rawUrl, metaData) => {
                  setEngineConfig({ mode: 'editor', payload: { bgUrl: rawUrl, shapes: [] }, saveMode: 'predefine', meta: metaData }); 
                  setShowEngine(true);
                }}
                currentUser={currentUser} 
              />
            )}

            {layer.type === 'art' && (
              <ArtDetail 
                art={layer.data} 
                onClose={() => window.history.back()} 
                onArtClick={handleArtRouting} 
                onArtistClick={(id) => pushLayer('portfolio', id)} 
                onCategoryClick={() => window.history.back()} 
                currentUser={currentUser} 
                userStats={globalUserStats} 
                setUserStats={setGlobalUserStats}
                targetCommentId={layer.data.targetCommentId} 
                autoOpenComments={!!layer.data.targetCommentId}
                onUpdateArt={(updatedArt) => {
                  setLayerStack(prev => prev.map(l => l.id === layer.id ? { ...l, data: updatedArt } : l));
                }}
                onRequireLogin={handleRequireLogin} 
                onCritiqueClick={(critique) => { 
                  const enrichedCritique = { ...critique, originalArtObject: layer.data, originalTitle: layer.data.title, originalImageUrl: layer.data.imageUrl, originalArtistUsername: layer.data.firstName || layer.data.username, originalArtistId: layer.data.telegramId }; 
                  pushLayer('critique', enrichedCritique); 
                }} 
              />
            )}

            {layer.type === 'critique' && (
              <CritiqueDetail 
                crit={layer.data} 
                onClose={() => window.history.back()} 
                onPlay={handleArtRouting} 
                onArtistClick={(id) => pushLayer('portfolio', id)} 
                onOpenOriginalArt={(artObj) => pushLayer('art', artObj)} 
                currentUser={currentUser} 
                userStats={globalUserStats} 
                setUserStats={setGlobalUserStats}
                targetCommentId={layer.data.targetCommentId} 
                autoOpenComments={!!layer.data.targetCommentId}
                onUpdateCritique={(updatedCrit) => {
                  setLayerStack(prev => prev.map(l => l.id === layer.id ? { ...l, data: updatedCrit } : l));
                }}
                onRequireLogin={handleRequireLogin}
              />
            )}

            {layer.type === 'competition' && (
              <CompetitionBoard 
                competitionTag={layer.data} 
                onBack={() => window.history.back()} 
                onArtClick={handleArtRouting}
                onArtistClick={(id) => pushLayer('portfolio', id)}
                currentUser={currentUser}
                onUpload={() => {
                  window.history.back();
                  setActiveUploadContext(layer.data);
                  setRoute('upload'); 
                }}
                onRequireLogin={handleRequireLogin}
              />
            )}
          </div>
        );
      })}

      {isDecoding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backgroundColor: '#18181b', padding: '24px 32px', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #27272a' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(34, 197, 94, 0.2)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'pageSpin 1s linear infinite' }}></div>
            <p style={{ color: '#d4d4d8', fontSize: '13px', fontWeight: 'bold', margin: 0, letterSpacing: '0.5px' }}>Decoding Critique...</p>
          </div>
        </div>
      )}

      {showEngine && engineConfig.payload && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: '#09090b' }}>
          <CritiqueEngine 
            initialShapes={engineConfig.payload} 
            appMode={engineConfig.mode} 
            saveMode={engineConfig.saveMode}
            meta={engineConfig.meta} 
            onExit={handleEngineExit} 
            currentUser={currentUser}
          />
        </div>
      )}

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginModalOpen(false);
        }}
      />

      <GlobalBanAlert />

      <LegalGatekeeper 
        currentUser={currentUser} 
        onUpdateUser={(updatedUser) => setCurrentUser(updatedUser)} 
      />
    </>
  );
}