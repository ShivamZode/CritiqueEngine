'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReportModal from './ReportModal';
import { 
  ArrowLeft, User, Settings, Image as ImageIcon, ChevronRight, X, 
  Search, ChevronDown, Sparkles, Flame, Users, Tag, Heart, MessageCircle, 
  Flag, MoreHorizontal, AlertTriangle, Target 
} from 'lucide-react';

const PAGE_LIMIT = 20;

const formatCount = (num) => {
  if (!num) return "0";
  return Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(num);
};

// 👉 UPGRADED: Added onPushLayer to props!
export default function Feed({ onBack, onPushLayer, currentUser, onRequireLogin, globalCompetition }) {
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const fetchCooldown = useRef(false);
  const observerTarget = useRef(null);
  const scrollPosRef = useRef(0);

  // 👉 Feed Scroll Memory (Kept intact!)
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('feed_scroll_pos');
    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
      }, 50);
    } else {
      window.scrollTo(0, 0);
    }

    const handleScroll = () => { scrollPosRef.current = window.scrollY; };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      sessionStorage.setItem('feed_scroll_pos', scrollPosRef.current);
    };
  }, []);
  
  const [columnCount, setColumnCount] = useState(2);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedArtist, setSelectedArtist] = useState('');
  const [sortMode, setSortMode] = useState('newest'); 

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFollowingOnly, setShowFollowingOnly] = useState(false);

  const [categories, setCategories] = useState([]);
  const [artists, setArtists] = useState([]);
  
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categorySearchText, setCategorySearchText] = useState('');
  const [showArtistMenu, setShowArtistMenu] = useState(false);
  const [artistSearchText, setArtistSearchText] = useState('');

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [blurNsfw, setBlurNsfw] = useState(true); 
  const [unblurredArts, setUnblurredArts] = useState(new Set()); 
  const [nsfwWarningArt, setNsfwWarningArt] = useState(null); 
  
  const [showSafetyDisableWarning, setShowSafetyDisableWarning] = useState(false); 

  const [userStats, setUserStats] = useState({ following: [], savedArtsList: [] });

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [reportingItem, setReportingItem] = useState(null);
  
  const [currentComp, setCurrentComp] = useState(null);
  const [hideCompBanner, setHideCompBanner] = useState(false);

  // 👉 CLEANED UP: Only locks scroll for internal Feed modals (Report/NSFW)
  useEffect(() => {
    if (isReportModalOpen || nsfwWarningArt || showSafetyDisableWarning) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isReportModalOpen, nsfwWarningArt, showSafetyDisableWarning]);

  // useEffect(() => {
  //   fetch('/api/competition?current=true')
  //     .then(res => res.json())
  //     .then(data => {
  //        if (data.success && data.competition) {
  //          setCurrentComp(data.competition);
  //        }
  //     }).catch(console.error);
  // }, []);

  // 👉 THE FIX: Consume the Global State & Check Local Storage
  useEffect(() => {
    if (globalCompetition) {
      // Check the user's phone memory to see if they already clicked 'X'
      const isDismissedLocally = localStorage.getItem(`dismissed_comp_${globalCompetition._id}`);
      
      if (!isDismissedLocally) {
        setCurrentComp(globalCompetition);
        setHideCompBanner(false);
      }
    }
  }, [globalCompetition]);

  // const handleDismissComp = async () => {
  //   setHideCompBanner(true); 
  //   if (currentComp?.resultsDeclared && currentUser) {
  //     try {
  //       await fetch('/api/competition', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ action: 'dismiss', telegramId: currentUser.id, compId: currentComp._id })
  //       });
  //     } catch (e) { console.error(e); }
  //   }
  // };

  // 👉 THE FIX: LocalStorage Shield (Zero Database Calls!)
  const handleDismissComp = () => {
    setHideCompBanner(true); 
    
    // Only permanently hide it if it's in Stage 3 (Results Declared)
    if (currentComp?.resultsDeclared) {
      localStorage.setItem(`dismissed_comp_${currentComp._id}`, 'true');
    }
    
    // Notice how there is no 'fetch' call here anymore! We just saved you a database write!
  };

  let compStatus = null;
  let compBadge = null;
  let compActionText = "";
  const [timeLeftStr, setTimeLeftStr] = useState('');

  if (currentComp && !hideCompBanner) {
    const now = new Date();
    const start = new Date(currentComp.startTime);
    const end = new Date(currentComp.endTime);
    
     
    if (currentComp.resultsDeclared) {
      compStatus = 'finished';
      compBadge = { text: 'RESULTS', color: '#fde047', bg: 'rgba(234, 179, 8, 0.3)', glow: 'rgba(234, 179, 8, 0.4)' };
      compActionText = `Official winners declared! Tap to see the ranking.`;
    } else if (currentComp.isActive) {
      if (now > end) {
        compStatus = 'evaluating';
        compBadge = { text: 'JUDGING', color: '#c084fc', bg: 'rgba(126, 34, 206, 0.3)', glow: 'rgba(126, 34, 206, 0.4)' };
        compActionText = `Evaluating entries. Drop likes to vote!`;
      } else if (now >= start && now <= end) {
        compStatus = 'live';
        compBadge = { text: 'LIVE NOW', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.3)', glow: 'rgba(34, 197, 94, 0.5)' };
        compActionText = `Submit your art or vote before the deadline!`;
      }
    }
    
  }

  useEffect(() => {
    if (!compStatus || compStatus === 'finished' || compStatus === 'evaluating') return;

    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(currentComp.endTime).getTime();
      const start = new Date(currentComp.startTime).getTime();
      
      let diff = end - now;
      let preText = "⏳ Ends in:";

      if (now < start) {
        diff = start - now;
        preText = "🚀 Starts in:";
      } else if (diff < 0) {
        setTimeLeftStr("⏱️ Event Closed");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      
      let timeStr = "";
      if (d > 0) timeStr = `${d}d ${h}h ${m}m`;
      else if (h > 0) timeStr = `${h}h ${m}m ${s}s`;
      else timeStr = `${m}m ${s}s`;

      setTimeLeftStr(`${preText} ${timeStr}`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [compStatus, currentComp]);

  useEffect(() => {
    if (!currentUser) return; 
    fetch(`/api/users/me?telegramId=${currentUser.id}`).then(res => res.json()).then(data => {
      if (data.success) {
        setUserStats({ 
          following: data.user.following || [], 
          savedArtsList: data.user.savedArts || [],
          savedCritsList: data.user.savedCrits || [] 
        });
      }
    }).catch(console.error);
  }, [currentUser]); 

  useEffect(() => {
    fetch('/api/artists').then(res => res.json()).then(data => { if (data.success) setArtists(data.artists); });
  }, []);

  useEffect(() => {
    const h = setTimeout(() => {
      fetch(`/api/categories?q=${encodeURIComponent(categorySearchText)}&_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => { if (data.success) setCategories(data.categories); });
    }, 300); 
    return () => clearTimeout(h);
  }, [categorySearchText]);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(h);
  }, [searchQuery]);

  // 👉 THE MAGIC PASTE DETECTOR
  useEffect(() => {
    const detectAndRouteLink = async () => {
      // 1. Only run if there's actually a decent chunk of text in the search bar
      if (!searchQuery || searchQuery.length < 15) return;

      // 2. DOMAIN-AGNOSTIC CHECK: Works for localhost, IP addresses, custom domains, and Telegram!
      if (searchQuery.includes('http') || searchQuery.includes('t.me/')) {
        
        // 3. Extract the ID. This regex catches startapp=post_{ID}, startapp=crit_{ID}, ?post={ID}, etc.
        const match = searchQuery.match(/(?:post_|crit_|user_|post=|critique=|profile=)([a-zA-Z0-9]+)/);
        
        if (match && match[1]) {
          const targetId = match[1];
          
          // Clear the search bar instantly so it doesn't try to query the database with a giant URL
          setSearchQuery('');
          
          // 4a. If it's a user profile, we can push the layer instantly without hitting the database!
          if (searchQuery.includes('user_') || searchQuery.includes('profile=')) {
            return onPushLayer('portfolio', targetId);
          }

          // 4b. If it's Art or a Critique, use your existing Resolve API to fetch the object
          try {
            const res = await fetch(`/api/resolve?id=${targetId}`);
            const data = await res.json();
            
            if (data.success) {
              if (data.type === 'artwork') onPushLayer('art', data.item);
              else if (data.type === 'critique') onPushLayer('critique', data.item);
            } else {
              alert("Oops! Looks like that link is broken or the item was deleted.");
            }
          } catch (err) {
            console.error("Failed to resolve pasted link", err);
          }
        }
      }
    };

    detectAndRouteLink();
  }, [searchQuery, onPushLayer]);

  useEffect(() => {
    async function fetchInitialFeed() {
      setLoading(true);
      setPage(1); 
      setHasMore(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (selectedCategory) params.append('category', selectedCategory);
        if (selectedArtist) params.append('artist', selectedArtist);
        params.append('sort', sortMode); 
        
        if (showFollowingOnly && currentUser) {
          params.append('followingOnly', 'true');
          params.append('telegramId', currentUser.id);
        }

        params.append('page', 1);
        params.append('limit', PAGE_LIMIT);

        const res = await fetch(`/api/feed?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setArtworks(data.artworks);
          setHasMore(data.hasMore);
        }
      } catch (err) { setError("Network error."); } finally { setLoading(false); }
    }
    fetchInitialFeed();
  }, [debouncedSearch, selectedCategory, selectedArtist, sortMode, showFollowingOnly, refreshTrigger]);

  const loadMoreArtworks = useCallback(async () => {
    if (isFetchingMore || !hasMore || fetchCooldown.current) return;
    
    setIsFetchingMore(true);
    fetchCooldown.current = true; 
    const nextPage = page + 1;
    
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedArtist) params.append('artist', selectedArtist);
      params.append('sort', sortMode); 
      
      if (showFollowingOnly && currentUser) {
        params.append('followingOnly', 'true');
        params.append('telegramId', currentUser.id);
      }

      params.append('page', nextPage);
      params.append('limit', PAGE_LIMIT);

      const res = await fetch(`/api/feed?${params.toString()}`);
      if (!res.ok) throw new Error("HTTP error");
      const data = await res.json();
      
      if (data.success) {
        setArtworks(prev => {
          const existingIds = new Set(prev.map(a => a._id));
          const newArts = data.artworks.filter(a => !existingIds.has(a._id));
          if (newArts.length === 0) setHasMore(false);
          return [...prev, ...newArts];
        });
        setHasMore(data.hasMore);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (err) { 
      console.error("Failed to load more");
      setHasMore(false);
    } finally { 
      setIsFetchingMore(false); 
      setTimeout(() => { fetchCooldown.current = false; }, 1000);
    }
  }, [page, hasMore, isFetchingMore, debouncedSearch, selectedCategory, selectedArtist, sortMode, showFollowingOnly]); 

  // 👉 THE FINAL FIX: INSTANT DELETION SYNC FOR THE FEED
  // ==========================================
  useEffect(() => {
    const handleArtworkDeleted = (e) => {
      const deletedId = e.detail;
      console.log(`Surgically removing deleted item ${deletedId} from the Feed...`);
      
      // Wipe the deleted item from the Feed grid instantly!
      setArtworks(prev => prev.filter(a => a._id !== deletedId));
    };

    window.addEventListener('artwork_deleted', handleArtworkDeleted);
    return () => window.removeEventListener('artwork_deleted', handleArtworkDeleted);
  }, []);

  // 👉 CLEANED UP: No longer checks for selectedArt / selectedCritique
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isFetchingMore) {
          loadMoreArtworks();
        }
      },
      { threshold: 0.1, rootMargin: '400px' } 
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [loadMoreArtworks, hasMore, loading, isFetchingMore]);

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

  const handleToggleSafetyMode = () => {
    if (blurNsfw) {
      setShowSettingsMenu(false);
      setShowSafetyDisableWarning(true);
    } else {
      setBlurNsfw(true);
    }
  };

  const filteredArtists = artists.filter(a => (a.username || '').toLowerCase().includes(artistSearchText.toLowerCase()) || (a.firstName || '').toLowerCase().includes(artistSearchText.toLowerCase()));

  const columns = Array.from({ length: columnCount }, () => []);
  artworks.forEach((art, index) => columns[index % columnCount].push(art));

  return (
    <>
      <style>{`
        .feed-card-hover { transition: transform 0.2s ease, filter 0.2s ease; }
        .feed-card-hover:hover { transform: scale(1.02); filter: brightness(1.1); }
        @keyframes feedSpin { to { transform: rotate(360deg); } }
        @keyframes feedFadeScale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .feed-menu-item { transition: background-color 0.1s; }
        .feed-menu-item:hover { background-color: rgba(63, 63, 70, 0.5); }

        @keyframes bannerPulse {
          0% { box-shadow: 0 0 10px ${compBadge?.glow || 'transparent'}; border-color: ${compBadge?.glow || 'transparent'}; }
          50% { box-shadow: 0 0 25px ${compBadge?.glow || 'transparent'}, inset 0 0 10px ${compBadge?.glow || 'transparent'}; border-color: ${compBadge?.color || 'transparent'}; }
          100% { box-shadow: 0 0 10px ${compBadge?.glow || 'transparent'}; border-color: ${compBadge?.glow || 'transparent'}; }
        }
        @keyframes imageShine {
          0% { filter: brightness(1) sepia(0); transform: scale(1) rotate(0deg); }
          50% { filter: brightness(1.3) sepia(0.2) drop-shadow(0 0 10px ${compBadge?.color || 'white'}); transform: scale(1.05) rotate(2deg); }
          100% { filter: brightness(1) sepia(0); transform: scale(1) rotate(0deg); }
        }

        .nav-refresh-btn { background: transparent; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; }
        .nav-refresh-btn:disabled { cursor: not-allowed; }
        .nav-refresh-svg { transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s; color: #a1a1aa; }
        
        .nav-refresh-btn:hover .nav-refresh-svg:not(.spinning) { transform: rotate(90deg) scale(1.1); color: #ffffff; }
        .nav-refresh-btn:active .nav-refresh-svg:not(.spinning) { transform: rotate(360deg) scale(0.8); transition: transform 0.1s; }
        
        .spinning { animation: feedSpin 0.8s linear infinite; color: #60a5fa !important; }
      `}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#ffffff', paddingBottom: '60px', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        
        {/* Invisible Overlay to catch clicks outside dropdowns */}
        {(showSortMenu || showCategoryMenu || showArtistMenu || showSettingsMenu) && (
           <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => { setShowSortMenu(false); setShowCategoryMenu(false); setShowArtistMenu(false); setShowSettingsMenu(false); }}></div>
        )}

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(9, 9, 11, 0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid #27272a', paddingTop: 'calc(12px + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* LEFT */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '22px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Go Back">
              <ArrowLeft size={24} />
            </button>
          </div>
          
          {/* CENTER */}
          <h1 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px', margin: 0, flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
            Explore Hub
          </h1>
          
          {/* RIGHT */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', flex: 1 }}>
            
            <button 
              onClick={() => {
                if (!currentUser) return onRequireLogin();
                onPushLayer('portfolio', currentUser.id);
              }}
              style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: 0, transition: 'transform 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="My Profile"
            >
              <User size={22} />
            </button>

            <button 
              className="nav-refresh-btn"
              onClick={() => {
                sessionStorage.removeItem('feed_scroll_pos');
                window.scrollTo({ top: 0, behavior: 'smooth' }); 
                setRefreshTrigger(prev => prev + 1); 
              }}
              disabled={loading}
              title="Refresh Feed"
            >
              <svg 
                className={`nav-refresh-svg ${loading ? 'spinning' : ''}`}
                style={{ width: '20px', height: '20px' }} 
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>

            {/* Back to the dedicated Settings button! */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowSortMenu(false); setShowCategoryMenu(false); setShowArtistMenu(false); }} 
                style={{ background: 'transparent', border: 'none', color: showSettingsMenu ? '#ffffff' : '#a1a1aa', fontSize: '20px', cursor: 'pointer', transition: 'color 0.2s', padding: 0, display: 'flex', alignItems: 'center' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={(e) => { if (!showSettingsMenu) e.currentTarget.style.color = '#a1a1aa'; }}
              >
                <Settings size={22} />
              </button>

              {showSettingsMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: '220px', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', zIndex: 50, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', animation: 'feedFadeScale 0.1s ease-out', transformOrigin: 'top right' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #27272a', backgroundColor: '#09090b' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px' }}>Safety Settings</span>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleToggleSafetyMode}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff', marginBottom: '2px' }}>Blur Mature Content</span>
                      <span style={{ fontSize: '10px', color: '#a1a1aa' }}>Hide NSFW artwork.</span>
                    </div>
                    <div style={{ width: '36px', height: '20px', backgroundColor: blurNsfw ? '#3b82f6' : '#3f3f46', borderRadius: '10px', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: '2px', left: blurNsfw ? '18px' : '2px', width: '16px', height: '16px', backgroundColor: '#ffffff', borderRadius: '50%', transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* Top Controls Container */}
        <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 2vw', position: 'relative', zIndex: (activeMenuId !== null || isReportModalOpen || nsfwWarningArt !== null || showSafetyDisableWarning) ? 0 : 40, boxSizing: 'border-box' }}>
            
            {/* 👉 UPDATED: Uses onPushLayer */}
            {compStatus && (
              <div style={{ backgroundColor: '#121212', border: `2px solid ${compBadge.bg}`, borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', animation: 'bannerPulse 3s infinite ease-in-out', boxSizing: 'border-box', marginBottom: '16px' }}>
                <div 
                  onClick={() => onPushLayer('competition', currentComp.hashtag)}
                  style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}
                >
                  <div style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: '1px solid #27272a', backgroundColor: '#09090b', boxShadow: `0 0 10px ${compBadge.bg}` }}>
                    {currentComp.referenceImageUrl ? (
                        <img src={currentComp.referenceImageUrl} draggable="false" onContextMenu={(e) => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'imageShine 4s infinite linear' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}><ImageIcon size={28} /></div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 900, padding: '3px 8px', borderRadius: '6px', backgroundColor: compBadge.bg, color: compBadge.color, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${compBadge.color}` }}>
                            {compBadge.text}
                        </span>
                        <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 'bold', fontFamily: 'monospace' }}>#{currentComp.hashtag}</span>
                    </div>
                    
                    <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentComp.name}
                    </h3>
                    
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: timeLeftStr.includes('Ends') ? '#fde047' : '#d4d4d8' }}>
                        {timeLeftStr || compActionText}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button 
                      onClick={handleDismissComp} 
                      className="portfolio-hover"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '12px', cursor: 'pointer', padding: '6px', borderRadius: '50%', transition: 'all 0.2s', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                    <X size={16} />
                    </button>
                    <div onClick={() => onPushLayer('competition', currentComp.hashtag)} style={{ fontSize: '20px', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(0)'}><ChevronRight size={24} /></div>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '14px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <span style={{ color: '#a1a1aa', fontSize: '14px' }}><Search size={16} /></span>
              </div>
              <input 
                type="text" 
                placeholder="Search by title or caption..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                style={{ width: '100%', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '12px', padding: '12px 16px 12px 40px', fontSize: '13px', color: '#ffffff', outline: 'none', fontWeight: 'bold', boxSizing: 'border-box', transition: 'border-color 0.2s' }} 
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
              />
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', position: 'relative' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>Filters:</span>
              
              <button 
                onClick={() => { setShowSortMenu(!showSortMenu); setShowCategoryMenu(false); setShowArtistMenu(false); setShowSettingsMenu(false); }} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: showSortMenu ? '1px solid #71717a' : '1px solid #3f3f46', backgroundColor: showSortMenu ? '#3f3f46' : '#27272a', color: showSortMenu ? '#ffffff' : '#d4d4d8', transition: 'all 0.2s' }}
              >
                {sortMode === 'newest' ? <Sparkles size={14} /> : <Flame size={14} />} 
                <span>{sortMode === 'newest' ? 'Newest' : 'Popular'}</span>
                <ChevronDown size={14} />
              </button>

              {currentUser && (
                 <button 
                   onClick={() => { setShowFollowingOnly(!showFollowingOnly); setShowSortMenu(false); setShowCategoryMenu(false); setShowArtistMenu(false); setShowSettingsMenu(false); }} 
                   style={{
                     display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                     backgroundColor: showFollowingOnly ? 'rgba(34, 197, 94, 0.15)' : '#27272a',
                     color: showFollowingOnly ? '#4ade80' : '#d4d4d8',
                     border: showFollowingOnly ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid #3f3f46',
                     boxShadow: showFollowingOnly ? '0 0 10px rgba(34, 197, 94, 0.2)' : 'none'
                   }}
                   onMouseOver={(e) => { if (!showFollowingOnly) e.currentTarget.style.backgroundColor = '#3f3f46'; }}
                   onMouseOut={(e) => { if (!showFollowingOnly) e.currentTarget.style.backgroundColor = '#27272a'; }}
                 >
                   <Users size={14} /> <span>Following</span> {showFollowingOnly && <X size={12} />}
                 </button>
              )}

              {selectedCategory && (
                <button 
                  onClick={() => setSelectedCategory('')} 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(37, 99, 235, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.3)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.2)'}
                >
                  <Tag size={14} /> <span>Cat: {selectedCategory}</span> <X size={12} />
                </button>
              )}
              
              {selectedArtist && (
                <button 
                  onClick={() => setSelectedArtist('')} 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(147, 51, 234, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.5)', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.3)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)'}
                >
                  <User size={14} /> <span>Artist: {selectedArtist}</span> <X size={12} />
                </button>
              )}
              
              {!selectedCategory && (
                <button 
                  onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowSortMenu(false); setShowArtistMenu(false); setShowSettingsMenu(false); }} 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: showCategoryMenu ? '1px solid #71717a' : '1px solid #3f3f46', backgroundColor: showCategoryMenu ? '#3f3f46' : '#27272a', color: showCategoryMenu ? '#ffffff' : '#d4d4d8', transition: 'all 0.2s' }}
                >
                  <Tag size={14} /> <span>Category</span> <ChevronDown size={14} />
                </button>
              )}

              {!selectedArtist && (
                <button 
                  onClick={() => { setShowArtistMenu(!showArtistMenu); setShowCategoryMenu(false); setShowSortMenu(false); setShowSettingsMenu(false); }} 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: showArtistMenu ? '1px solid #71717a' : '1px solid #3f3f46', backgroundColor: showArtistMenu ? '#3f3f46' : '#27272a', color: showArtistMenu ? '#ffffff' : '#d4d4d8', transition: 'all 0.2s' }}
                >
                  <User size={14} /> <span>Artist</span> <ChevronDown size={14} />
                </button>
              )}

              {showSortMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '160px', maxWidth: 'calc(100vw - 32px)', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', zIndex: 50, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', animation: 'feedFadeScale 0.1s ease-out', transformOrigin: 'top left' }}>
                  <div className="feed-menu-item" onClick={() => { setSortMode('newest'); setShowSortMenu(false); }} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #27272a', fontWeight: 'bold', color: sortMode === 'newest' ? '#60a5fa' : '#e4e4e7', fontSize: '13px' }}><Sparkles size = {14}/> Newest</div>
                  <div className="feed-menu-item" onClick={() => { setSortMode('popular'); setShowSortMenu(false); }} style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 'bold', color: sortMode === 'popular' ? '#ef4444' : '#e4e4e7', fontSize: '13px' }}><Flame size = {14}/> Popular</div>
                </div>
              )}

              {showCategoryMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '240px', maxWidth: 'calc(100vw - 32px)', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', zIndex: 50, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', animation: 'feedFadeScale 0.1s ease-out', transformOrigin: 'top left' }}>
                  <input type="text" placeholder="Search categories..." value={categorySearchText} onChange={(e) => setCategorySearchText(e.target.value)} style={{ width: '100%', backgroundColor: '#09090b', border: 'none', borderBottom: '1px solid #27272a', padding: '12px', fontSize: '13px', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }} autoFocus />
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {categories.map(cat => (
                      <div key={cat._id} className="feed-menu-item" onClick={() => { setSelectedCategory(cat.name); setShowCategoryMenu(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', cursor: 'pointer', borderBottom: '1px solid #27272a' }}>
                        <span style={{ fontWeight: 'bold', color: '#e4e4e7', fontSize: '13px' }}>{cat.name}</span>
                        <span style={{ fontSize: '9px', backgroundColor: '#09090b', color: '#71717a', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{cat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showArtistMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '240px', maxWidth: 'calc(100vw - 32px)', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', zIndex: 50, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', animation: 'feedFadeScale 0.1s ease-out', transformOrigin: 'top left' }}>
                  <input type="text" placeholder="Search artists..." value={artistSearchText} onChange={(e) => setArtistSearchText(e.target.value)} style={{ width: '100%', backgroundColor: '#09090b', border: 'none', borderBottom: '1px solid #27272a', padding: '12px', fontSize: '13px', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }} autoFocus />
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredArtists.map((artist, idx) => (
                      <div key={idx} className="feed-menu-item" onClick={() => { setSelectedArtist(artist.username); setShowArtistMenu(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', cursor: 'pointer', borderBottom: '1px solid #27272a' }}>
                        <span style={{ fontWeight: 'bold', color: '#e4e4e7', fontSize: '13px' }}>{artist.firstName || artist.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Grid Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <div style={{ width: '24px', height: '24px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'feedSpin 1s linear infinite' }}></div>
          </div>
        ) : (
          <div style={{ display: 'flex', width: '100%', maxWidth: '1600px', gap: '16px', padding: '0 2vw', paddingBottom: '32px', margin: '0 auto', boxSizing: 'border-box'}}>
            {columns.map((columnArtworks, colIndex) => (
              <div key={colIndex} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '1 1 0%', minWidth: 0 }}>
                {columnArtworks.map((art) => {
                  const isLiked = currentUser ? (art.likes || []).some(id => String(id) === String(currentUser.id)) : false;
                  
                  const isBlurred = art.isAdult && blurNsfw && !unblurredArts.has(art._id);
                  
                  return (
                    <div 
                      key={art._id} 
                      onClick={() => { 
                        // 👉 UPDATED: Triggers the new Stack Push instead of local state!
                        if (isBlurred) {
                          setNsfwWarningArt(art); 
                        } else {
                          onPushLayer('art', art); 
                        }
                      }} 
                      className="feed-card-hover"
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', width: '100%', minWidth: 0, position: 'relative' }}
                    >
                      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#121212', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <img 
                          src={art.thumbnailUrl || art.imageUrl} 
                          alt={`Art`} 
                          loading="lazy" 
                          draggable="false"
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ 
                            width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'cover', display: 'block',
                            pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                            filter: isBlurred ? 'blur(16px) brightness(0.7)' : 'none',
                            transform: isBlurred ? 'scale(1.1)' : 'scale(1)',
                            transition: 'filter 0.3s ease, transform 0.3s ease'
                          }} 
                        />
                        
                        {isBlurred && (
                           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', zIndex: 5 }}>
                             <span style={{fontSize: '20px'}}>🔞</span>
                             <span style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.2)' }}>Tap to View</span>
                           </div>
                        )}
                        
                        {art.isPredefined && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#9333ea', color: '#ffffff', fontSize: '9px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Target size={10} /> Guided
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 4px', gap: '4px', width: '100%', minWidth: 0 }}>
                        <span style={{ display: 'block', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold', fontSize: '13px', color: '#ffffff' }}>
                          {art.title || 'Untitled'}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', width: '100%', minWidth: 0, marginTop: '2px' }}>
                          {/* 👉 UPDATED: Triggers the new Stack Push instead of local state! */}
                          <div onClick={(e) => { e.stopPropagation(); onPushLayer('portfolio', art.telegramId); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
                            {art.artistPhotoUrl ? (
                              <img src={art.artistPhotoUrl} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyItems: 'center', fontSize: '8px', fontWeight: 'bold', color: '#ffffff', flexShrink: 0 }}>
                                {art.firstName ? art.firstName.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <span style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>
                              {art.firstName || 'Artist'}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 'bold', color: '#71717a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isLiked ? '#ef4444' : '#71717a' }}>
                                <Heart size={12} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} /> 
                                <span>{formatCount(art.likes?.length || 0)}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MessageCircle size={12} /> 
                                <span>{formatCount(art.comments?.length || 0)}</span>
                              </div>
                            </div>
                            
                            {activeMenuId === art._id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'feedFadeScale 0.2s ease-out' }}>
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (!currentUser) return onRequireLogin(); 
                                    setActiveMenuId(null);
                                    setReportingItem(art); 
                                    setIsReportModalOpen(true); 
                                  }} 
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '3px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                                >
                                  <Flag size={10} /> Report
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(art._id); }} style={{ display: 'flex', color: '#a1a1aa', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', alignItems: 'center' }}>
                                <MoreHorizontal size={16} />
                              </button>
                            )}
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

        <div ref={observerTarget} style={{ height: '40px', width: '100%' }}></div>

        {isFetchingMore && (
          <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '24px', height: '24px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'feedSpin 1s linear infinite' }}></div>
          </div>
        )}
        
        {!hasMore && artworks.length > 0 && (
          <p style={{ textAlign: 'center', padding: '20px 0', color: '#71717a', fontSize: '12px', fontStyle: 'italic', fontWeight: 'bold' }}>
            You've reached the end of the gallery.
          </p>
        )}

        {/* Disable Safety Mode Warning Modal */}
        {showSafetyDisableWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'feedFadeScale 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', marginBottom: '8px' }}>
                  <AlertTriangle size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Disable Safety Mode?</h2>
                <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
                  You are about to allow mature themes (NSFW) globally across Critique Engine. These artworks may not be suitable for all audiences.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <button 
                  onClick={() => { setBlurNsfw(false); setShowSafetyDisableWarning(false); setShowSettingsMenu(false); }} 
                  style={{ width: '100%', padding: '14px', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                >
                  Yes, Show NSFW Content
                </button>
                <button 
                  onClick={() => { setShowSafetyDisableWarning(false); setShowSettingsMenu(false); }} 
                  style={{ width: '100%', padding: '14px', backgroundColor: '#27272a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Individual NSFW Warning Modal */}
        {nsfwWarningArt && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'feedFadeScale 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', marginBottom: '8px' }}>
                  🔞
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Mature Content</h2>
                <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
                  This artwork has been flagged as containing mature themes (NSFW). It may not be suitable for all audiences.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <button 
                  onClick={() => { 
                    // 1. Unblur it in the grid
                    setUnblurredArts(prev => new Set(prev).add(nsfwWarningArt._id));
                    
                    // 2. Drop a session cookie so it bypasses all future interceptors in this session
                    if (typeof sessionStorage !== 'undefined') {
                      sessionStorage.setItem(`nsfw_ack_${nsfwWarningArt._id}`, 'true');
                      sessionStorage.setItem(`nsfw_crit_ack_${nsfwWarningArt._id}`, 'true');
                    }
                    
                    // ❌ REMOVED: onPushLayer('art', nsfwWarningArt);
                    
                    // 3. Close the modal, leaving the user in the Feed to view the now-unblurred image!
                    setNsfwWarningArt(null); 
                  }} 
                  style={{ width: '100%', padding: '14px', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                >
                  Show Anyway
                </button>
                <button 
                  onClick={() => setNsfwWarningArt(null)} 
                  style={{ width: '100%', padding: '14px', backgroundColor: '#27272a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        <ReportModal isOpen={isReportModalOpen} onClose={() => { setIsReportModalOpen(false); setReportingItem(null); }} itemType="artwork" itemId={reportingItem?._id} reportedUserId={reportingItem?.telegramId} currentUser={currentUser} />

      </div>
    </>
  );
}