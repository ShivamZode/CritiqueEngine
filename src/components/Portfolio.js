'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Notifications from './Notifications';
import ReportModal from './ReportModal'; 
import ShareModal from './ShareModal';
import DeleteConfirmBanner from './DeleteConfirmBanner'; // 👉 ADDED THIS
import { uploadToTempService } from '@/utils/tempUpload';
import { 
  ArrowLeft, Home, Bell, MoreHorizontal, Share2, Settings, Bug, 
  FileText, Shield, Mail, Pencil, Lock, Globe, Image as ImageIcon, X, ChevronRight, 
  Palette, PenTool, Bookmark, Star, Pin, Heart, MessageCircle, Trash2, 
  Flag, AlertTriangle, CheckCircle, Upload, Play, Target, Clock, RefreshCw, Camera
} from 'lucide-react';

const PAGE_LIMIT = 15;

const ISSUE_CATEGORIES = [
  "Critique Engine", "Profile Page", "Competition Board", 
  "Feed", "Presentation Mode", "Art Detail Page", 
  "Critique Detail Page", "Commenting", "Reporting Modal", 
  "Heat Map", "Uploading Issue", "Other"
];

// 👉 UPDATED: Now accepts `onLinkClick` instead of using window.confirm!
const renderBioWithLinks = (text, onLinkClick) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ color: '#60a5fa', textDecoration: 'underline', wordBreak: 'break-all' }} 
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            onLinkClick(part); // 👉 FIRE THE CUSTOM MODAL
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

const CountdownTimer = ({ startTime, endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      if (now < start) {
        setStatus('starts');
        formatDiff(start - now);
      } else if (now >= start && now <= end) {
        setStatus('ends');
        formatDiff(end - now);
      } else {
        setStatus('ended');
      }
    };

    const formatDiff = (diff) => {
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [startTime, endTime]);

  if (status === 'ended') return <span style={{ color: '#71717a' }}>Event has ended</span>;
  if (status === 'starts') return <span>⏳ Starts in: <strong style={{ color: '#3b82f6' }}>{timeLeft}</strong></span>;
  return <span>⏳ Ends in: <strong style={{ color: '#eab308' }}>{timeLeft}</strong></span>;
};

// 👉 UPGRADED: Added onPushLayer, removed unnecessary props
export default function Portfolio({ telegramId, onBack, onPushLayer, onUpload, currentUser, onRequireLogin, isOverlay, onGoToFeed, globalCompetition }) {
  const [viewProfileId, setViewProfileId] = useState(telegramId);
  const [activeTab, setActiveTab] = useState('gallery'); 
  const [savedTabType, setSavedTabType] = useState('artworks'); 

  const [artworks, setArtworks] = useState([]);
  const [savedArtsData, setSavedArtsData] = useState([]);
  const [savedCritsData, setSavedCritsData] = useState([]); 
  const [critiquesData, setCritiquesData] = useState([]);
  const [competitionsData, setCompetitionsData] = useState([]); 
  const [achievementsData, setAchievementsData] = useState([]); 
  
  const [pages, setPages] = useState({ gallery: 1, saved: 1, savedCrits: 1, critiques: 1, competitions: 1, achievements: 1 });
  const [hasMore, setHasMore] = useState({ gallery: true, saved: true, savedCrits: true, critiques: true, competitions: true, achievements: true });
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const fetchCooldown = useRef(false);
  const observerTarget = useRef(null);

  const [currentUserStats, setCurrentUserStats] = useState({ following: [], savedArtsList: [], savedCritsList: [] });
  const [profileStats, setProfileStats] = useState({ followers: [], following: [], savedArtsList: [] });
  const [profileUser, setProfileUser] = useState({ firstName: '', username: '', photoUrl: null, bio: '', hasWebPassword: false });
  
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [columnCount, setColumnCount] = useState(2);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [pendingLink, setPendingLink] = useState(null); 
  const [deleteTarget, setDeleteTarget] = useState(null); // Will hold { id, type }
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const [followModal, setFollowModal] = useState({ isOpen: false, title: '', ids: [] });
  const [followListUsers, setFollowListUsers] = useState([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueCategory, setIssueCategory] = useState('');
  const [issueText, setIssueText] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState(false);

  const [reportConfig, setReportConfig] = useState({ isOpen: false, itemType: 'artwork', itemId: null, parentItemId: null, reportedUserId: null });

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [blurNsfw, setBlurNsfw] = useState(true); 
  const [unblurredArts, setUnblurredArts] = useState(new Set()); 
  const [nsfwWarningArt, setNsfwWarningArt] = useState(null); 
  const [showSafetyDisableWarning, setShowSafetyDisableWarning] = useState(false); 

  const [currentComp, setCurrentComp] = useState(null);
  const [hideCompBanner, setHideCompBanner] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', username: '', bio: '', photoUrl: null });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState(''); 
  const avatarInputRef = useRef(null);

  // 👉 THE FIX: Scroll-Aware Tabs
  const [showTabs, setShowTabs] = useState(true);
  const portfolioRef = useRef(null);
  const lastScrollY = useRef(0);

  // 👉 THE FIX: Detect scroll direction to hide/show the tab bar
  useEffect(() => {
    // If it's an overlay, listen to the parent container. Otherwise, listen to the window!
    const scrollContainer = isOverlay && portfolioRef.current ? portfolioRef.current.parentElement : window;
    
    const handleScroll = () => {
      const currentScrollY = isOverlay ? scrollContainer.scrollTop : window.scrollY;
      
      // Only start hiding after they scroll down 150px
      if (currentScrollY > 150) {
        if (currentScrollY > lastScrollY.current + 10) {
          setShowTabs(false); // Scrolling down: Hide!
        } else if (currentScrollY < lastScrollY.current - 10) {
          setShowTabs(true);  // Scrolling up: Show!
        }
      } else {
        setShowTabs(true); // Always show at the very top
      }
      
      lastScrollY.current = currentScrollY;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isOverlay]);

  const pendingFollowClicks = useRef(0);
  const followTimerRef = useRef(null);

  const [sessionExpired, setSessionExpired] = useState(false);
  const getTgInitData = () => typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

  // 👉 THE CLEANUP: No more overlay state tracking or history listeners in this file!
  
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

  // 👉 THE FIX: LocalStorage Shield (Zero Database Calls!)
  const handleDismissComp = () => {
    setHideCompBanner(true); 
    
    // Only permanently hide it if it's in Stage 3 (Results Declared)
    if (currentComp?.resultsDeclared) {
      localStorage.setItem(`dismissed_comp_${currentComp._id}`, 'true');
    }
  }

  let compStatus = null;
  let compBadge = null;
  let compActionText = "";
  const [timeLeftStr, setTimeLeftStr] = useState('');

  if (currentComp && !hideCompBanner) {
    const now = new Date();
    const start = new Date(currentComp.startTime);
    const end = new Date(currentComp.endTime);
    
    // 👉 CLEANED UP: No more database checks here!
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

      if (now < start) { diff = start - now; preText = "🚀 Starts in:"; } 
      else if (diff < 0) { setTimeLeftStr("⏱️ Event Closed"); return; }

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

  const isMyProfile = currentUser ? String(viewProfileId) === String(currentUser.id) : false;
  const displayFirstName = isMyProfile ? currentUser.firstName : (profileUser.firstName || 'Unknown Artist');
  const displayUsername = isMyProfile ? currentUser.username : (profileUser.username || 'unknown');

  useEffect(() => {
    if (!currentUser) return; 
    fetch(`/api/users/me?telegramId=${currentUser.id}`).then(res => res.json()).then(data => {
      if (data.success) setCurrentUserStats({ 
        following: data.user.following || [], 
        savedArtsList: data.user.savedArts || [],
        savedCritsList: data.user.savedCrits || [] 
      });
    }).catch(console.error);

    fetch(`/api/notifications?telegramId=${currentUser.id}`).then(res => res.json()).then(data => { if (data.success) setUnreadCount(data.unreadCount); }).catch(console.error);
  }, [currentUser]);

  const fetchTabData = useCallback(async (tabToFetch, pageNum, isInitial = false) => {
    if (isInitial) setLoading(true);
    else { setIsFetchingMore(true); fetchCooldown.current = true; }

    try {
      const res = await fetch(`/api/portfolio?telegramId=${viewProfileId}&tab=${tabToFetch}&page=${pageNum}&limit=${PAGE_LIMIT}`);
      const data = await res.json();
      
      if (data.success) {
        if (isInitial && pageNum === 1) {
          setProfileStats({ followers: data.user.followers || [], following: data.user.following || [], savedArtsList: data.user.savedArtsList || [] });
          setProfileUser({ firstName: data.user.firstName || '', username: data.user.username || '', photoUrl: data.user.photoUrl || null, bio: data.user.bio || '', hasWebPassword: data.user.hasWebPassword || false, showcasedAchievement: data.user.showcasedAchievement || null });
          setBioInput(data.user.bio || ''); 
        }
        
        if (tabToFetch === 'gallery') {
          setArtworks(prev => isInitial ? data.items : [...prev, ...data.items.filter(newItem => !prev.some(old => old._id === newItem._id))]);
        } else if (tabToFetch === 'saved') {
          setSavedArtsData(prev => isInitial ? data.items : [...prev, ...data.items.filter(newItem => !prev.some(old => old._id === newItem._id))]);
        } else if (tabToFetch === 'savedCrits') {
          setSavedCritsData(prev => isInitial ? data.items : [...prev, ...data.items.filter(newItem => !prev.some(old => old._id === newItem._id))]);
        } else if (tabToFetch === 'critiques') {
          setCritiquesData(prev => isInitial ? data.items : [...prev, ...data.items.filter(newItem => !prev.some(old => old._id === newItem._id))]);
        } else if (tabToFetch === 'competitions') {
          setCompetitionsData(prev => isInitial ? data.items : [...prev, ...data.items.filter(newItem => !prev.some(old => old._id === newItem._id))]);
        } else if (tabToFetch === 'achievements') {
          setAchievementsData(prev => isInitial ? data.items : [...prev, ...data.items.filter(newItem => !prev.some(old => old._id === newItem._id))]);
        }

        setHasMore(prev => ({ ...prev, [tabToFetch]: data.hasMore }));
        setPages(prev => ({ ...prev, [tabToFetch]: pageNum }));
      }
    } catch (err) {
      setHasMore(prev => ({ ...prev, [tabToFetch]: false }));
    } finally {
      if (isInitial) setLoading(false);
      else {
        setIsFetchingMore(false);
        setTimeout(() => { fetchCooldown.current = false; }, 1000);
      }
    }
  }, [viewProfileId]);

  // 👉 UPDATED CLEANUP: Added pendingLink and deleteTarget to the scroll lock
  useEffect(() => {
    if (issueModalOpen || isPasswordModalOpen || followModal.isOpen || showSafetyDisableWarning || nsfwWarningArt || sessionExpired || pendingLink || deleteTarget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [issueModalOpen, isPasswordModalOpen, followModal.isOpen, showSafetyDisableWarning, nsfwWarningArt, sessionExpired, pendingLink, deleteTarget]);

  useEffect(() => {
    setArtworks([]); setSavedArtsData([]); setSavedCritsData([]); setCritiquesData([]); setCompetitionsData([]); setAchievementsData([]);
    setPages({ gallery: 1, saved: 1, savedCrits: 1, critiques: 1, competitions: 1, achievements: 1 });
    setHasMore({ gallery: true, saved: true, savedCrits: true, critiques: true, competitions: true, achievements: true });
    setActiveTab('gallery');
    setSavedTabType('artworks');
    setIsEditingBio(false);
    setIsBioExpanded(false);

    window.scrollTo(0, 0);
    
    fetchTabData('gallery', 1, true);
  }, [viewProfileId, fetchTabData]);

  useEffect(() => {
    const actualTab = activeTab === 'saved' ? (savedTabType === 'artworks' ? 'saved' : 'savedCrits') : activeTab;
    const currentData = actualTab === 'gallery' ? artworks : 
                        actualTab === 'saved' ? savedArtsData : 
                        actualTab === 'savedCrits' ? savedCritsData :
                        actualTab === 'critiques' ? critiquesData : 
                        actualTab === 'competitions' ? competitionsData : 
                        actualTab === 'achievements' ? achievementsData : [];
                        
    if (currentData.length === 0 && hasMore[actualTab]) {
      fetchTabData(actualTab, 1, true);
    }
  }, [activeTab, savedTabType, fetchTabData, artworks.length, savedArtsData.length, savedCritsData.length, critiquesData.length, competitionsData.length, achievementsData.length, hasMore]); 

  const loadMore = useCallback(() => {
    const actualTab = activeTab === 'saved' ? (savedTabType === 'artworks' ? 'saved' : 'savedCrits') : activeTab;
    if (isFetchingMore || !hasMore[actualTab] || fetchCooldown.current) return;
    fetchTabData(actualTab, pages[actualTab] + 1, false);
  }, [activeTab, savedTabType, isFetchingMore, hasMore, pages, fetchTabData]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !isFetchingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '400px' } 
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [loadMore, loading, isFetchingMore]);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1280) setColumnCount(5); else if (window.innerWidth >= 1024) setColumnCount(4); 
      else if (window.innerWidth >= 768) setColumnCount(3); else setColumnCount(2); 
    };
    updateColumns(); window.addEventListener('resize', updateColumns); return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Listeners for Art Saves and Critique Saves
  useEffect(() => {
    const handleSaveToggled = (e) => {
      const { artwork, isSaved } = e.detail;
      if (isSaved) setSavedArtsData(prev => [artwork, ...prev]);
      else setSavedArtsData(prev => prev.filter(a => a._id !== artwork._id));
    };
    const handleCritSaveToggled = (e) => {
      const { critique, isSaved } = e.detail;
      if (isSaved) setSavedCritsData(prev => [critique, ...prev]);
      else setSavedCritsData(prev => prev.filter(c => c._id !== critique._id));
    };
    
    window.addEventListener('art_saved_toggled', handleSaveToggled);
    window.addEventListener('crit_saved_toggled', handleCritSaveToggled);
    return () => {
      window.removeEventListener('art_saved_toggled', handleSaveToggled);
      window.removeEventListener('crit_saved_toggled', handleCritSaveToggled);
    };
  }, []);

  // ==========================================
  // INSTANT DELETION SYNC (Zero Database Calls!)
  // ==========================================
  useEffect(() => {
    const handleArtworkDeleted = (e) => {
      const deletedId = e.detail;
      console.log(`Surgically removing deleted artwork ${deletedId} from the grid...`);
      
      // Wipe the deleted item from all local grids instantly!
      setArtworks(prev => prev.filter(a => a._id !== deletedId));
      setSavedArtsData(prev => prev.filter(a => a._id !== deletedId));
      
      // Also wipe any critiques that were attached to that deleted artwork
      setCritiquesData(prev => prev.filter(c => c.originalArtObject?._id !== deletedId && c._id !== deletedId));
      setSavedCritsData(prev => prev.filter(c => c.originalArtObject?._id !== deletedId && c._id !== deletedId));
    };

    window.addEventListener('artwork_deleted', handleArtworkDeleted);
    return () => window.removeEventListener('artwork_deleted', handleArtworkDeleted);
  }, []);

  // ==========================================
  // SILENT BACKGROUND REFRESH LISTENER
  // ==========================================
  useEffect(() => {
    const handleSilentRefresh = async () => {
      console.log("Silently refreshing portfolio data in the background...");
      try {
        // Fetch page 1 of the gallery to grab the latest uploads
        const res = await fetch(`/api/portfolio?telegramId=${viewProfileId}&tab=gallery&page=1&limit=${PAGE_LIMIT}`);
        const data = await res.json();
        
        if (data.success) {
          setArtworks(prev => {
            // Find any brand new items that aren't already in our React state
            const newItems = data.items.filter(newItem => !prev.some(old => old._id === newItem._id));
            
            // Prepend them to the top of the grid so they appear instantly!
            return [...newItems, ...prev];
          });
        }
      } catch (err) {
        console.error("Silent refresh failed", err);
      }
    };

    // Listen for the custom events we fired from page.js
    window.addEventListener('artwork_added', handleSilentRefresh);
    window.addEventListener('refresh_portfolio', handleSilentRefresh);

    return () => {
      window.removeEventListener('artwork_added', handleSilentRefresh);
      window.removeEventListener('refresh_portfolio', handleSilentRefresh);
    };
  }, [viewProfileId]); // Depends on viewProfileId so it fetches for the correct user

  const compressAvatar = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width; let height = img.height;
          if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); 
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const base64Image = await compressAvatar(file);
      
      // 1. Convert to File
      const base64Response = await fetch(base64Image);
      const avatarBlob = await base64Response.blob();
      const avatarFile = new File([avatarBlob], "avatar.jpg", { type: 'image/jpeg' });

      // 2. Route through Litterbox/temp service
      const encodedTempUrl = await uploadToTempService(avatarFile);

      // 3. Send URL to Vercel (Reusing Scenario B in your API route!)
      const res = await fetch('/api/upload', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ encodedTempUrl }) 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditForm(prev => ({ ...prev, photoUrl: data.url }));
    } catch (err) {
      alert("Failed to upload avatar: " + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    const originalProfile = { ...profileUser };
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTgInitData() || '' },
        body: JSON.stringify({ telegramId: currentUser.id, firstName: editForm.firstName, username: editForm.username, bio: editForm.bio, photoUrl: editForm.photoUrl })
      });
      if (res.status === 401) return setSessionExpired(true);
      const data = await res.json();
      if (!data.success) { setProfileError(data.error || "Failed to save profile."); return; }
      setProfileUser(prev => ({ ...prev, ...editForm }));
      setIsEditingProfile(false);
    } catch (err) {
      setProfileUser(originalProfile);
      setProfileError("Network error. Please try again.");
    }
  };

  const handleUpdateArt = (updatedArt) => {
    setArtworks(prev => prev.map(a => a._id === updatedArt._id ? updatedArt : a));
    setSavedArtsData(prev => prev.map(a => a._id === updatedArt._id ? updatedArt : a));
    setCritiquesData(prev => prev.map(c => {
      if (c.originalArtObject && c.originalArtObject._id === updatedArt._id) return { ...c, originalArtObject: updatedArt };
      return c;
    }));
    setSavedCritsData(prev => prev.map(c => {
      if (c.originalArtObject && c.originalArtObject._id === updatedArt._id) return { ...c, originalArtObject: updatedArt };
      return c;
    }));
  };

  const isFollowingArtist = currentUser ? currentUserStats.following.includes(viewProfileId) : false;
  
  const handleToggleProfileFollow = () => {
    if (!currentUser) return onRequireLogin(); 

    const originalFollowing = [...currentUserStats.following];
    const originalFollowers = [...profileStats.followers];

    const newFollowing = isFollowingArtist ? originalFollowing.filter(id => id !== viewProfileId) : [...originalFollowing, viewProfileId];
    setCurrentUserStats(prev => ({ ...prev, following: newFollowing }));

    const newFollowers = isFollowingArtist ? originalFollowers.filter(id => id !== currentUser.id) : [...originalFollowers, currentUser.id];
    setProfileStats(prev => ({ ...prev, followers: newFollowers }));

    pendingFollowClicks.current += 1;
    if (followTimerRef.current) clearTimeout(followTimerRef.current);

    followTimerRef.current = setTimeout(async () => {
      const clicks = pendingFollowClicks.current;
      pendingFollowClicks.current = 0; 
      
      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch('/api/users/follow', { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ currentUserId: currentUser.id, targetUserId: viewProfileId }) 
        }); 

        if (res.status === 401) {
          setCurrentUserStats(prev => ({ ...prev, following: originalFollowing }));
          setProfileStats(prev => ({ ...prev, followers: originalFollowers }));
          return setSessionExpired(true);
        }
      } catch (err) { 
        setCurrentUserStats(prev => ({ ...prev, following: originalFollowing }));
        setProfileStats(prev => ({ ...prev, followers: originalFollowers }));
      }
    }, 500);
  };

  const openFollowModal = async (type) => {
    const ids = type === 'followers' ? profileStats.followers : profileStats.following;
    setFollowModal({ isOpen: true, title: type === 'followers' ? 'Followers' : 'Following', ids });
    setLoadingFollowList(true);
    try {
      const res = await fetch('/api/users/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const data = await res.json();
      if (data.success) setFollowListUsers(data.users);
    } catch (e) { } finally { setLoadingFollowList(false); }
  };

  // 👉 THE UPGRADED BANNER DELETE FUNCTION
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    
    setIsDeletingItem(true); // Lock the banner
    
    try {
      const endpoint = type === 'artwork' ? `/api/artworks?id=${id}` : `/api/critiques?id=${id}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers: { 'x-telegram-init-data': getTgInitData() || '' } });
      
      if (res.status === 401) {
        setIsDeletingItem(false);
        setDeleteTarget(null);
        return setSessionExpired(true);
      }
      
      const data = await res.json();
      if (data.success) {
        if (type === 'artwork') setArtworks(prev => prev.filter(a => a._id !== id));
        else setCritiquesData(prev => prev.filter(c => c._id !== id));
        setDeleteTarget(null); // Close banner on success
      } else { 
        alert(data.error || "Failed to delete."); 
        setIsDeletingItem(false);
      }
    } catch (err) { 
      alert("An error occurred while deleting."); 
      setIsDeletingItem(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError('');
    if (passwordForm.new.length < 6) return setPasswordError('Password must be at least 6 characters.');
    if (passwordForm.new !== passwordForm.confirm) return setPasswordError('Passwords do not match.');

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTgInitData() || '' },
        body: JSON.stringify({ telegramId: currentUser.id, password: passwordForm.new })
      });
      
      if (res.status === 401) {
        setIsPasswordModalOpen(false);
        return setSessionExpired(true);
      }

      const data = await res.json();
      if (data.success) {
        setPasswordSuccess(true);
        setProfileUser(prev => ({ ...prev, hasWebPassword: true }));
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setPasswordSuccess(false);
          setPasswordForm({ new: '', confirm: '' });
        }, 2000);
      } else { setPasswordError(data.error || 'Failed to save password.'); }
    } catch (err) { setPasswordError('Network error. Please try again.'); } finally { setPasswordLoading(false); }
  };

  const handleIssueSubmit = async () => {
    if (!issueText.trim()) return setIssueError("Please describe the issue.");
    setIsSubmittingIssue(true);
    setIssueError('');
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTgInitData() || '' },
        body: JSON.stringify({ telegramId: currentUser.id, username: currentUser.username, category: issueCategory, text: issueText.trim() })
      });

      if (res.status === 401) {
        setIssueModalOpen(false);
        return setSessionExpired(true);
      }

      const data = await res.json();
      if (data.success) {
        setIssueSuccess(true);
        setTimeout(() => {
          setIssueSuccess(false);
          setIssueModalOpen(false);
          setIssueCategory('');
          setIssueText('');
        }, 2000);
      } else if (res.status === 403 && (data.error?.includes('limit') || data.error?.includes('banned'))) {
        window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
        setIssueModalOpen(false);
      } else {
        setIssueError(data.error || "Failed to submit issue.");
      }
    } catch(err) { setIssueError("Network error."); } finally { setIsSubmittingIssue(false); }
  };

  const handleToggleSafetyMode = () => {
    if (blurNsfw) {
      setShowSettingsMenu(false);
      setShowSafetyDisableWarning(true);
    } else {
      setBlurNsfw(true);
    }
  };

  const handleStartUpload = async () => {
    if (!currentUser) return onRequireLogin();
    try {
      const res = await fetch(`/api/auth/me?_t=${Date.now()}`, { headers: { 'x-telegram-init-data': getTgInitData() || '' } });
      if (res.status === 401 || !res.ok) return setSessionExpired(true);
    } catch (err) { console.error("Session verification failed", err); }
    if (onUpload) onUpload();
  };

  const activeGridData = activeTab === 'gallery' ? artworks : 
                         activeTab === 'saved' ? (savedTabType === 'artworks' ? savedArtsData : savedCritsData) : 
                         activeTab === 'critiques' ? critiquesData : [];
                         
  const columns = Array.from({ length: columnCount }, () => []);
  activeGridData.forEach((item, index) => columns[index % columnCount].push(item));

  const BIO_MAX_LENGTH = 120;
  const BIO_MAX_LINES = 3;
  let isBioLong = false;
  let truncatedBio = profileUser.bio || '';

  if (profileUser.bio) {
    const lines = profileUser.bio.split('\n');
    if (lines.length > BIO_MAX_LINES) { isBioLong = true; truncatedBio = lines.slice(0, BIO_MAX_LINES).join('\n'); }
    if (truncatedBio.length > BIO_MAX_LENGTH) { isBioLong = true; truncatedBio = truncatedBio.slice(0, BIO_MAX_LENGTH); }
  }

  const displayBio = (isBioLong && !isBioExpanded) ? truncatedBio : profileUser.bio;

  // 👉 THE NATIVE SHARE FUNCTION
  const handleShareProfile = async () => {
    setIsMoreMenuOpen(false); // Close the 3-dot menu
    
    // ⚠️ IMPORTANT: Change 'CritiqueEngineBot' and 'app' to your actual Telegram Bot username and short-name!
    // Using Telegram's startapp parameter allows deep-linking directly into this specific profile
    const shareUrl = `https://t.me/CaptionGiverBot/AFC?startapp=user_${viewProfileId}`;
    const shareTitle = `${displayFirstName}'s Portfolio`;
    const shareText = `Check out ${displayFirstName}'s art and critiques on Critique Engine!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.log('User canceled the share sheet.');
      }
    } else {
      // Fallback for Desktop or unsupported browsers
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("🔗 Profile link copied to clipboard!");
      } catch (err) {
        alert("Failed to copy link.");
      }
    }
  };

  // 👉 NEW: Handles pinning/unpinning the achievement
  const handleToggleShowcase = async (achievement) => {
    // If they click the one that's already showcased, we remove it (set to null)
    const isCurrentlyShowcased = profileUser.showcasedAchievement?._id === achievement._id;
    const payload = isCurrentlyShowcased ? null : achievement;

    // Optimistic UI update (makes it feel instant)
    setProfileUser(prev => ({ ...prev, showcasedAchievement: payload }));

    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTgInitData() || '' },
        body: JSON.stringify({ telegramId: currentUser.id, showcasedAchievement: payload })
      });
    } catch (e) {
      console.error("Failed to update showcase", e);
    }
  };

  return (
    <>
    <style>{`
        .portfolio-hover:hover { filter: brightness(1.2); }
        .grid-hover { transition: transform 0.2s ease, filter 0.2s ease; }
        .grid-hover:hover { transform: scale(1.02); filter: brightness(1.1); }
        @keyframes portFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes portScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes portSpin { to { transform: rotate(360deg); } }
        .menu-item-hover:hover { background-color: rgba(63, 63, 70, 0.5) !important; color: #ffffff !important; }

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
      `}</style>

    <div ref={portfolioRef} style={{ minHeight: '100vh', backgroundColor: '#09090b', color: 'white', paddingBottom: '80px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Invisible Overlay to catch clicks outside dropdowns */}
      {(isMoreMenuOpen || showSettingsMenu) && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => { setIsMoreMenuOpen(false); setShowSettingsMenu(false); }}></div>
      )}
      
      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: '#09090b', borderBottom: '1px solid #27272a', paddingTop: 'calc(12px + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* LEFT: Clean Navigation Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '22px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Go Back">
            <ArrowLeft size={24} />
          </button>
          
          {isOverlay && onGoToFeed && (
            <button 
              onClick={onGoToFeed} 
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '20px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Return to Feed"
            >
              <Home size={22} />
            </button>
          )}
        </div>

        {/* CENTER: Perfectly Balanced Title */}
        <h1 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px', margin: 0, flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isMyProfile ? 'My Profile' : 'Profile'}
        </h1>
        
        {/* RIGHT: Consolidated Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', flex: 1 }}>
          {currentUser && (
            <button onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); if (!isNotificationsOpen) setUnreadCount(0); }} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '20px', cursor: 'pointer', position: 'relative', padding: 0 }}>
              <Bell size={22} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 'bold', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px solid #09090b' }}>{unreadCount}</span>}
            </button>
          )}

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button onClick={() => { setIsMoreMenuOpen(!isMoreMenuOpen); setShowSettingsMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <MoreHorizontal size={24} />
            </button>

            {isMoreMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: '200px', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', zIndex: 100, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'portScale 0.1s ease-out', transformOrigin: 'top right' }}>
                
                {/* 👉 UPDATED: Opens the custom Share Modal */}
                <button onClick={() => { setIsMoreMenuOpen(false); setShareModalOpen(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #27272a', color: '#60a5fa', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Share2 size={16} /> Share Profile
                </button>

                {/* ⚙️ Moved Settings INSIDE the More Menu! */}
                {!isMyProfile && (
                  <button onClick={() => { setIsMoreMenuOpen(false); handleToggleSafetyMode(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #27272a', color: '#e4e4e7', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={16} /> Safety Settings
                  </button>
                )}

                <button onClick={() => { if (!currentUser) { onRequireLogin(); setIsMoreMenuOpen(false); return; } setIsMoreMenuOpen(false); setIssueModalOpen(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#e4e4e7', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bug size={16} /> Report an Issue
                </button>

                <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={() => setIsMoreMenuOpen(false)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: 'transparent', borderTop: '1px solid #27272a', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <FileText size={14} /> Terms & Conditions
                </a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={() => setIsMoreMenuOpen(false)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: 'transparent', borderTop: '1px solid #27272a', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <Shield size={14} /> Privacy Policy
                </a>
                <a href="/contact" target="_blank" rel="noopener noreferrer" onClick={() => setIsMoreMenuOpen(false)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', backgroundColor: 'transparent', borderTop: '1px solid #27272a', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <Mail size={14} /> Contact Us
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', paddingBottom: '24px', borderBottom: '1px solid #27272a', paddingLeft: '16px', paddingRight: '16px' }}>
        
        {isEditingProfile ? (
          <div style={{ width: '100%', maxWidth: '384px', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'portFade 0.3s ease-out' }}>
            
            {/* Avatar Uploader */}
            <div style={{ alignSelf: 'center', position: 'relative', cursor: isUploadingAvatar ? 'wait' : 'pointer' }} onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}>
              <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(to top right, #2563eb, #9333ea)', padding: '4px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ width: '100%', height: '100%', backgroundColor: '#18181b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 900, overflow: 'hidden', opacity: isUploadingAvatar ? 0.5 : 1 }}>
                  {editForm.photoUrl ? <img src={editForm.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayFirstName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #09090b', fontSize: '14px' }}>
                {isUploadingAvatar ? <Clock size={14} className="animate-spin" /> : <Camera size={14} />}
              </div>
              <input type="file" accept="image/jpeg, image/png, image/webp" ref={avatarInputRef} onChange={handleAvatarSelect} style={{ display: 'none' }} />
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase' }}>Display Name</label>
                <input value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} maxLength={40} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', padding: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase' }}>Username</label>
                <input value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} maxLength={30} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', padding: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase' }}>Bio</label>
                <textarea value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} maxLength={1000} placeholder="Tell people about yourself..." style={{ width: '100%', backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', padding: '12px', color: 'white', fontSize: '14px', outline: 'none', resize: 'none', minHeight: '100px', boxSizing: 'border-box' }} />
              </div>
            </div>

            {profileError && (
              <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#f87171', fontSize: '12px', fontWeight: 'bold', margin: 0 }}>{profileError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
              <button onClick={() => { setIsEditingProfile(false); setProfileError(''); }} style={{ fontSize: '13px', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontWeight: 'bold', padding: '10px' }}>Cancel</button>
              <button onClick={handleSaveProfile} disabled={isUploadingAvatar} style={{ fontSize: '13px', background: isUploadingAvatar ? '#3f3f46' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 'bold', cursor: isUploadingAvatar ? 'not-allowed' : 'pointer', boxShadow: isUploadingAvatar ? 'none' : '0 4px 10px rgba(37,99,235,0.3)' }}>
                {isUploadingAvatar ? 'Uploading...' : 'Save Profile'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(to top right, #2563eb, #9333ea)', padding: '4px', marginBottom: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ width: '100%', height: '100%', backgroundColor: '#18181b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 900, overflow: 'hidden' }}>
                {profileUser.photoUrl ? <img src={profileUser.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayFirstName.charAt(0).toUpperCase()}
              </div>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'white', textAlign: 'center', margin: '0 0 4px 0' }}>{displayFirstName}</h2>
            <p style={{ color: '#a1a1aa', fontSize: '14px', margin: '0 0 12px 0' }}>@{displayUsername}</p>

            <div style={{ marginBottom: '24px', maxWidth: '384px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {profileUser.bio ? (
                <p style={{ fontSize: '14px', color: '#e4e4e7', whiteSpace: 'pre-wrap', margin: 0, wordBreak: 'break-word', lineHeight: '1.5' }}>
                  {renderBioWithLinks(displayBio, setPendingLink)}
                  {isBioLong && !isBioExpanded && <span style={{ color: '#a1a1aa' }}>...</span>}
                  {isBioLong && <button onClick={() => setIsBioExpanded(!isBioExpanded)} style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', padding: '0 0 0 4px' }}>{isBioExpanded ? 'less' : 'more'}</button>}
                </p>
              ) : isMyProfile ? (
                <p style={{ fontSize: '13px', color: '#71717a', fontStyle: 'italic', margin: 0 }}>Add a bio to share your links and story!</p>
              ) : null}

              {/* 👉 UPDATED: DYNAMIC SHOWCASED ACHIEVEMENT BADGE */}
              {profileUser.showcasedAchievement && (() => {
                const ach = profileUser.showcasedAchievement;
                const medal = ach.rank === 1 ? '🥇' : ach.rank === 2 ? '🥈' : '🥉';
                
                // Default to Gold/Hustle ⚡
                let color = '#fde047', bg = 'rgba(234, 179, 8, 0.1)', border = 'rgba(234, 179, 8, 0.3)', shadow = 'rgba(234, 179, 8, 0.1)';
                
                // Dynamically swap colors based on the difficulty string
                if (ach.difficulty?.includes('Breeze')) { 
                  color = '#4ade80'; bg = 'rgba(34, 197, 94, 0.1)'; border = 'rgba(34, 197, 94, 0.3)'; shadow = 'rgba(34, 197, 94, 0.1)';
                } else if (ach.difficulty?.includes('Crucible')) { 
                  color = '#f87171'; bg = 'rgba(239, 68, 68, 0.1)'; border = 'rgba(239, 68, 68, 0.3)'; shadow = 'rgba(239, 68, 68, 0.1)';
                } else if (ach.difficulty?.includes('God-Tier')) { 
                  color = '#c084fc'; bg = 'rgba(168, 85, 247, 0.1)'; border = 'rgba(168, 85, 247, 0.3)'; shadow = 'rgba(168, 85, 247, 0.1)';
                }

                return (
                  <div 
                    onClick={() => onPushLayer('competition', ach.hashtag)}
                    className="portfolio-hover"
                    title={`${medal} ${ach.competitionName} (${ach.difficulty || 'Hustle ⚡'})`}
                    style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '999px', cursor: 'pointer', textDecoration: 'none', boxShadow: `0 4px 10px ${shadow}` }}
                  >
                    <span style={{ fontSize: '16px' }}>{medal}</span>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{ach.competitionName}</span>
                  </div>
                );
              })()}

              {isMyProfile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <button 
                    onClick={() => {
                      setEditForm({ firstName: profileUser.firstName, username: profileUser.username, bio: profileUser.bio || '', photoUrl: profileUser.photoUrl });
                      setIsEditingProfile(true);
                    }} 
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent', border: '1px solid #3f3f46', borderRadius: '999px', padding: '6px 16px', color: '#d4d4d8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; }} 
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Pencil size={12} /> Edit Profile
                  </button>
                  <button onClick={() => setIsPasswordModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: profileUser.hasWebPassword ? 'transparent' : 'rgba(37, 99, 235, 0.2)', border: profileUser.hasWebPassword ? '1px solid rgba(20, 83, 45, 0.5)' : '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '999px', padding: '6px 16px', color: profileUser.hasWebPassword ? '#22c55e' : '#60a5fa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: profileUser.hasWebPassword ? 'none' : '0 0 10px rgba(37,99,235,0.2)' }}>
                    {profileUser.hasWebPassword ? <Lock size={12} /> : <Globe size={12} />} 
                    {profileUser.hasWebPassword ? 'Web Password' : 'Enable Web Access'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {isMyProfile ? (
            <button 
              onClick={handleStartUpload} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '9999px', fontWeight: 900, boxShadow: '0 0 15px rgba(37,99,235,0.4)', border: 'none', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              <Upload size={16} /> Upload Art
            </button>
        ) : (
            <button onClick={handleToggleProfileFollow} style={{ padding: '10px 24px', borderRadius: '9999px', fontWeight: 900, border: isFollowingArtist ? '1px solid #3f3f46' : 'none', backgroundColor: isFollowingArtist ? '#27272a' : '#2563eb', color: isFollowingArtist ? '#d4d4d8' : 'white', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: isFollowingArtist ? 'none' : '0 0 15px rgba(37,99,235,0.4)' }}>
              {isFollowingArtist ? 'Following' : 'Follow +'}
            </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', width: '100%', maxWidth: '384px', backgroundColor: '#18181b', padding: '12px 0', borderRadius: '16px', border: '1px solid #27272a' }}>
          <div onClick={() => openFollowModal('followers')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '96px', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{profileStats.followers.length}</span>
            <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginTop: '4px' }}>Followers</span>
          </div>
          <div style={{ width: '1px', height: '32px', backgroundColor: '#3f3f46' }}></div>
          <div onClick={() => openFollowModal('following')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '96px', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{profileStats.following.length}</span>
            <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginTop: '4px' }}>Following</span>
          </div>
        </div>
      </div>

      {/* The Attraction Banner UI */}
      {compStatus && (
          <div style={{ margin: '0 16px 24px 16px', maxWidth: '600px', width: 'calc(100% - 32px)', alignSelf: 'center', backgroundColor: '#121212', border: `2px solid ${compBadge.bg}`, borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', animation: 'bannerPulse 3s infinite ease-in-out', boxSizing: 'border-box' }}>
            <div 
              onClick={() => onPushLayer('competition', currentComp.hashtag)}
              style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}
            >
              {/* Reference Image with Shine animation */}
              <div style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: '1px solid #27272a', backgroundColor: '#09090b', boxShadow: `0 0 10px ${compBadge.bg}` }}>
                {currentComp.referenceImageUrl ? (
                    <img src={currentComp.referenceImageUrl} draggable="false" onContextMenu={(e) => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'imageShine 4s infinite linear' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}><ImageIcon size={24}/></div>
                )}
              </div>

              {/* Text Info */}
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
            
            {/* Action Icon / Dismiss */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button 
                onClick={handleDismissComp} 
                className="portfolio-hover"
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '12px', cursor: 'pointer', padding: '6px', borderRadius: '50%', transition: 'all 0.2s', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                <X size={16} />
                </button>
                <div onClick={() => onPushLayer('competition', currentComp.hashtag)} style={{ fontSize: '20px', cursor: 'pointer' }} className="portfolio-hover">👉</div>
            </div>
          </div>
        )}

      {/* Primary Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        position: 'sticky', 
        // 👉 THE FIX: Perfectly aligns to the bottom of the navbar, or slides smoothly off screen!
        top: showTabs ? 'calc(49px + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))' : '-60px', 
        backgroundColor: '#09090b', 
        zIndex: (isNotificationsOpen || isPasswordModalOpen || issueModalOpen || nsfwWarningArt || sessionExpired) ? 0 : 49, 
        overflowX: 'auto', 
        WebkitOverflowScrolling: 'touch',
        transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1)' // 👉 Buttery smooth sliding animation
      }}>
        <button onClick={() => { setActiveTab('gallery'); setSavedTabType('artworks'); }} style={{ flex: 1, minWidth: '80px', padding: '16px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'gallery' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'gallery' ? '#60a5fa' : '#71717a', cursor: 'pointer', transition: 'color 0.2s' }}>Gallery</button>
        <button onClick={() => { setActiveTab('critiques'); setSavedTabType('artworks'); }} style={{ flex: 1, minWidth: '80px', padding: '16px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'critiques' ? '2px solid #22c55e' : '2px solid transparent', color: activeTab === 'critiques' ? '#4ade80' : '#71717a', cursor: 'pointer', transition: 'color 0.2s' }}>Critiques</button>
        <button onClick={() => { setActiveTab('competitions'); setSavedTabType('artworks'); }} style={{ flex: 1, minWidth: '100px', padding: '16px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'competitions' ? '2px solid #f97316' : '2px solid transparent', color: activeTab === 'competitions' ? '#fb923c' : '#71717a', cursor: 'pointer', transition: 'color 0.2s' }}>Events</button>
        {isMyProfile && <button onClick={() => setActiveTab('saved')} style={{ flex: 1, minWidth: '80px', padding: '16px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'saved' ? '2px solid #a855f7' : '2px solid transparent', color: activeTab === 'saved' ? '#c084fc' : '#71717a', cursor: 'pointer', transition: 'color 0.2s' }}>Saved</button>}
        <button onClick={() => { setActiveTab('achievements'); setSavedTabType('artworks'); }} style={{ flex: 1, minWidth: '110px', padding: '16px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'achievements' ? '2px solid #eab308' : '2px solid transparent', color: activeTab === 'achievements' ? '#fde047' : '#71717a', cursor: 'pointer', transition: 'color 0.2s' }}>Achievements</button>
      </div>

      {/* Saved Vault Sub-Tabs */}
      {activeTab === 'saved' && (
        <div style={{ display: 'flex', gap: '12px', padding: '16px 16px 0 16px', justifyContent: 'center' }}>
          <button 
            onClick={() => setSavedTabType('artworks')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold', border: savedTabType === 'artworks' ? '1px solid #a855f7' : '1px solid #3f3f46', backgroundColor: savedTabType === 'artworks' ? 'rgba(168, 85, 247, 0.15)' : 'transparent', color: savedTabType === 'artworks' ? '#c084fc' : '#a1a1aa', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Palette size={14} /> Artworks
          </button>
          <button 
            onClick={() => setSavedTabType('critiques')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold', border: savedTabType === 'critiques' ? '1px solid #4ade80' : '1px solid #3f3f46', backgroundColor: savedTabType === 'critiques' ? 'rgba(34, 197, 94, 0.15)' : 'transparent', color: savedTabType === 'critiques' ? '#4ade80' : '#a1a1aa', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <PenTool size={14} /> Critiques
          </button>
        </div>
      )}

      {/* Empty States */}
      {!loading && activeGridData.length === 0 && activeTab !== 'achievements' && activeTab !== 'competitions' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginTop: '64px', padding: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            {activeTab === 'gallery' ? <Palette size={48} /> : activeTab === 'saved' && savedTabType === 'artworks' ? <Bookmark size={48} /> : activeTab === 'saved' && savedTabType === 'critiques' ? <FileText size={48} /> : <PenTool size={48} />}
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 4px 0' }}>Nothing here yet</h3>
          <p style={{ color: '#a1a1aa', fontSize: '14px', margin: 0, maxWidth: '300px' }}>
            {activeTab === 'gallery' ? (isMyProfile ? 'Tap Upload Art to publish your first piece!' : "This artist hasn't uploaded yet.") : 
             activeTab === 'saved' && savedTabType === 'artworks' ? 'Artworks you bookmark will appear here.' : 
             activeTab === 'saved' && savedTabType === 'critiques' ? 'Critiques you bookmark will appear here.' : 
             (isMyProfile ? 'Critiques you make on other artworks will appear here.' : "This artist hasn't posted any critiques yet.")}
          </p>
        </div>
      )}

      {/* Achievements View */}
        {activeTab === 'achievements' && (
          <div style={{ padding: '24px 16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}>
             {!loading && achievementsData.length === 0 ? (
                <div style={{textAlign: 'center', marginTop: '40px', color: '#71717a', fontSize: '13px', fontStyle: 'italic'}}>
                  {isMyProfile ? "No achievements yet. Participate in events to earn ranks!" : "This artist hasn't ranked in an event yet."}
                </div>
             ) : (
               achievementsData.map(ach => {
                 let medal = '🏅';
                 let color = '#a1a1aa';
                 let bg = '#27272a';
                 if (ach.rank === 1) { medal = '🥇'; color = '#eab308'; bg = 'rgba(234, 179, 8, 0.15)'; }
                 else if (ach.rank === 2) { medal = '🥈'; color = '#cbd5e1'; bg = 'rgba(148, 163, 184, 0.1)'; }
                 else if (ach.rank === 3) { medal = '🥉'; color = '#d97706'; bg = 'rgba(180, 83, 9, 0.1)'; }

                 // 👉 NEW: Determine Difficulty Colors for the Card Pill
                 let diffColor = '#fde047', diffBg = 'rgba(234, 179, 8, 0.1)', diffBorder = 'rgba(234, 179, 8, 0.3)';
                 if (ach.difficulty?.includes('Breeze')) { diffColor = '#4ade80'; diffBg = 'rgba(34, 197, 94, 0.1)'; diffBorder = 'rgba(34, 197, 94, 0.3)'; }
                 else if (ach.difficulty?.includes('Crucible')) { diffColor = '#f87171'; diffBg = 'rgba(239, 68, 68, 0.1)'; diffBorder = 'rgba(239, 68, 68, 0.3)'; }
                 else if (ach.difficulty?.includes('God-Tier')) { diffColor = '#c084fc'; diffBg = 'rgba(168, 85, 247, 0.1)'; diffBorder = 'rgba(168, 85, 247, 0.3)'; }

                 return (
                     <div 
                       key={ach._id} 
                       onClick={() => onPushLayer('competition', ach.hashtag)}
                       className="grid-hover"
                       style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#121212', border: `1px solid ${bg}`, padding: '16px', borderRadius: '16px', cursor: 'pointer', boxShadow: ach.rank <= 3 ? `0 4px 20px ${bg}` : 'none' }}
                     >
                      
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', flexShrink: 0 }}>
                           <span style={{ fontSize: '28px' }}>{medal}</span>
                           <span style={{ fontSize: '12px', fontWeight: 900, color: color }}>#{ach.rank}</span>
                        </div>
                        <img 
                          src={ach.thumbnailUrl} 
                          draggable="false" 
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #27272a', backgroundColor: '#09090b', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }} 
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                             <span style={{ fontSize: '9px', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Event Winner</span>
                             
                             {/* 👉 NEW: The Difficulty Badge Pill */}
                             <span style={{ fontSize: '8px', fontWeight: '900', color: diffColor, backgroundColor: diffBg, border: `1px solid ${diffBorder}`, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                               {ach.difficulty || 'Hustle ⚡'}
                             </span>
                           </div>

                           <h4 style={{ margin: '2px 0 4px 0', fontSize: '16px', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ach.competitionName}</h4>
                           <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 'bold' }}>#{ach.hashtag}</span>
                        </div>
                        
                        {/* The Showcase Button */}
                        {isMyProfile && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleShowcase(ach); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
                              border: profileUser.showcasedAchievement?._id === ach._id ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid #3f3f46',
                              backgroundColor: profileUser.showcasedAchievement?._id === ach._id ? 'rgba(234, 179, 8, 0.2)' : '#27272a',
                              color: profileUser.showcasedAchievement?._id === ach._id ? '#fde047' : '#a1a1aa',
                              boxShadow: profileUser.showcasedAchievement?._id === ach._id ? '0 0 10px rgba(234, 179, 8, 0.2)' : 'none'
                            }}
                            onMouseOver={(e) => { if (profileUser.showcasedAchievement?._id !== ach._id) e.currentTarget.style.backgroundColor = '#3f3f46'; }}
                            onMouseOut={(e) => { if (profileUser.showcasedAchievement?._id !== ach._id) e.currentTarget.style.backgroundColor = '#27272a'; }}
                          >
                            {profileUser.showcasedAchievement?._id === ach._id ? <Star size={12} fill="currentColor" /> : <Pin size={12} />} 
                            {profileUser.showcasedAchievement?._id === ach._id ? 'Showcased' : 'Showcase'}
                          </button>
                        )}
                     </div>
                 )
               })
             )}
          </div>
        )}

      {/* Competitions View */}
        {activeTab === 'competitions' && (
          <div style={{ padding: '16px 2vw', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}>
             {!loading && competitionsData.length === 0 ? (
                <div style={{textAlign: 'center', marginTop: '40px', color: '#71717a', fontSize: '13px', fontStyle: 'italic'}}>No events found.</div>
             ) : (
               competitionsData.map(comp => {
                 const now = new Date().getTime();
                 const start = new Date(comp.startTime).getTime();
                 const end = new Date(comp.endTime).getTime();

                 const isLive = comp.isActive && (now >= start && now <= end);
                 const isUpcoming = comp.isActive && now < start;
                 
                 let badgeText = 'ENDED'; let badgeBg = 'rgba(113,113,122,0.2)'; let badgeColor = '#a1a1aa';
                 if (isLive) { badgeText = 'LIVE'; badgeBg = 'rgba(34,197,94,0.2)'; badgeColor = '#4ade80'; } 
                 else if (isUpcoming) { badgeText = 'SOON'; badgeBg = 'rgba(59,130,246,0.2)'; badgeColor = '#60a5fa'; }

                 return (
                   <div 
                     key={comp._id} 
                     onClick={isUpcoming ? undefined : () => onPushLayer('competition', comp.hashtag)}
                     className={isUpcoming ? "" : "grid-hover"}
                     style={{ backgroundColor: '#121212', border: isLive ? '1px solid rgba(34,197,94,0.5)' : '1px solid #27272a', borderRadius: '16px', padding: '16px', display: 'flex', gap: '16px', cursor: isUpcoming ? 'not-allowed' : 'pointer', opacity: isUpcoming ? 0.7 : 1 }}
                   >
                     <div style={{ filter: isUpcoming ? 'blur(6px)' : 'none', overflow: 'hidden', borderRadius: '12px', flexShrink: 0 }}>
                       {comp.referenceImageUrl ? (
                          <img src={comp.referenceImageUrl} draggable="false" onContextMenu={(e) => e.preventDefault()} style={{ width: '70px', height: '70px', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }} />
                       ) : (
                          <div style={{ width: '70px', height: '70px', backgroundColor: '#09090b', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}><ImageIcon size={28} color="#71717a" /></div>
                       )}
                     </div>

                     <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0 }}>
                       <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                         <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.name}</h4>
                         <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, backgroundColor: badgeBg, color: badgeColor }}>{badgeText}</span>
                       </div>
                       <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 'bold', margin: '4px 0' }}>#{comp.hashtag}</span>
                       <span style={{ fontSize: '11px', color: '#a1a1aa' }}><CountdownTimer startTime={comp.startTime} endTime={comp.endTime} /></span>
                     </div>
                   </div>
                 )
               })
             )}
          </div>
        )}

      {/* Masonry Grid for Art/Critiques/Saved */}
        {activeTab !== 'achievements' && activeTab !== 'competitions' && (
          <div style={{ display: 'flex', width: '100%', gap: '16px', padding: '24px 2vw', margin: '0 auto', boxSizing: 'border-box' }}>
            {columns.map((columnItems, colIndex) => (
              <div key={colIndex} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1 1 0%', minWidth: 0, transform: 'translateZ(0)', willChange: 'transform' }}>
                {columnItems.map((item) => {
                  
                  const isCritiqueCard = activeTab === 'critiques' || (activeTab === 'saved' && savedTabType === 'critiques');
                  const isAdultContent = isCritiqueCard ? (item.isAdult || item.originalArtObject?.isAdult) : item.isAdult;
                  const hasAck = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem(`nsfw_ack_${item._id}`) || sessionStorage.getItem(`nsfw_crit_ack_${item._id}`)) : false;
                  const isBlurred = !isMyProfile && isAdultContent && blurNsfw && !unblurredArts.has(item._id);
                  const needsWarning = !isMyProfile && isAdultContent && !hasAck;

                  if (isCritiqueCard) {
                    const crit = item;
                    const isLiked = currentUser ? (crit.likes || []).includes(currentUser.id) : false;
                    return (
                      <div 
                        key={crit._id} 
                        onClick={() => { 
                          if (needsWarning || isBlurred) {
                            setNsfwWarningArt(crit);
                          } else {
                            onPushLayer('critique', crit);
                          }
                        }}
                        className="grid-hover" 
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', width: '100%', minWidth: 0, position: 'relative' }}
                      >
                        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#121212', minHeight: '120px' }}>
                          <img 
                            src={crit.originalThumbnail} 
                            loading="lazy" 
                            draggable="false" 
                            onContextMenu={(e) => e.preventDefault()} 
                            style={{ 
                              width: '100%', height: 'auto', maxHeight: '600px', objectFit: 'cover', display: 'block', 
                              pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                              filter: isBlurred ? 'blur(16px) brightness(0.7)' : 'none',
                              transform: isBlurred ? 'scale(1.1)' : 'scale(1)',
                              transition: 'filter 0.3s ease, transform 0.3s ease'
                            }} 
                          />

                          {isBlurred && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', zIndex: 5 }}>
                              <span style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>🔞</span>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.2)' }}>Tap to View</span>
                            </div>
                          )}

                          {!isBlurred && (
                            <>
                              <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '9px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', zIndex: 10, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <PenTool size={10} /> Critique
                              </div>
                              <div 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (needsWarning) {
                                    setNsfwWarningArt(crit);
                                  } else {
                                    sessionStorage.setItem('triggerFeedback', 'true'); 
                                    onPushLayer('critique', crit);
                                  }
                                }} 
                                className="portfolio-hover" 
                                style={{ position: 'absolute', zIndex: 20, width: 'max-content', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '2px solid #ffffff', borderRadius: '999px', padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                              >
                                <Play size={12} fill="currentColor" color="#ffffff" /><span style={{ color: '#ffffff', fontSize: '11px', fontWeight: 900, letterSpacing: '1px' }}>PLAY</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 4px', gap: '4px', width: '100%', minWidth: 0, overflow: 'hidden' }}>
                          <span style={{ display: 'block', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold', fontSize: '13px', color: '#ffffff' }}>{crit.originalTitle || 'Untitled'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 0, marginTop: '2px' }}>
                            <div 
                                onClick={(e) => { e.stopPropagation(); onPushLayer('portfolio', crit.originalArtistId); }} 
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 0%', minWidth: 0, overflow: 'hidden', cursor: 'pointer' }}
                            >
                              {crit.originalArtistPhotoUrl ? <img src={crit.originalArtistPhotoUrl} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyItems: 'center', fontSize: '8px', fontWeight: 'bold', color: '#ffffff', flexShrink: 0 }}>{crit.originalArtistUsername ? crit.originalArtistUsername.charAt(0).toUpperCase() : '?'}</div>}
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>@{crit.originalArtistUsername || 'unknown'}</span>
                            </div>
                            {/* 👉 THE NEW CRITIQUE FOOTER */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 'bold', color: '#71717a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isLiked ? '#ef4444' : '#71717a' }}>
                                  <Heart size={12} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} /> 
                                  <span>{crit.likes?.length || 0}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <MessageCircle size={12} /> 
                                  <span>{crit.comments?.length || 0}</span>
                                </div>
                              </div>
                              
                              {activeMenuId === crit._id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'portFade 0.2s ease-out' }}>
                                  {isMyProfile && activeTab === 'critiques' ? (
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: crit._id, type: 'critique' }); setActiveMenuId(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '3px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      <Trash2 size={10} /> Delete
                                    </button>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setReportConfig({ isOpen: true, itemType: 'critique', itemId: crit._id, reportedUserId: crit.originalArtistId }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '3px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      <Flag size={10} /> Report
                                    </button>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px' }}><X size={14} /></button>
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(crit._id); }} style={{ display: 'flex', color: '#a1a1aa', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
                                  <MoreHorizontal size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  const art = item;
                  const isLiked = currentUser ? (art.likes || []).some(id => String(id) === String(currentUser.id)) : false;
                  return (
                    <div 
                      key={art._id} 
                      onClick={() => {
                        if (needsWarning || isBlurred) {
                          setNsfwWarningArt(art); 
                        } else {
                          onPushLayer('art', art);
                        }
                      }}
                      className="grid-hover" 
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', width: '100%', minWidth: 0, position: 'relative' }}
                    >
                      <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#121212', minHeight: '120px' }}>
                        <img 
                          src={art.thumbnailUrl || art.imageUrl} 
                          loading="lazy" 
                          draggable="false" 
                          onContextMenu={(e) => e.preventDefault()} 
                          style={{ 
                            width: '100%', height: 'auto', maxHeight: '600px', objectFit: 'cover', display: 'block', 
                            pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                            filter: isBlurred ? 'blur(16px) brightness(0.7)' : 'none',
                            transform: isBlurred ? 'scale(1.1)' : 'scale(1)',
                            transition: 'filter 0.3s ease, transform 0.3s ease'
                          }} 
                        />

                        {isBlurred && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', zIndex: 5 }}>
                            <span style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>🔞</span>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.2)' }}>Tap to View</span>
                          </div>
                        )}

                        {!isBlurred && (
                          <>
                            {art.isPredefined && (
                              <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#9333ea', color: '#ffffff', fontSize: '9px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', zIndex: 10, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                                <Target size={10} /> 
                                <span>Guided</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 4px', gap: '4px', width: '100%', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold', fontSize: '13px', color: '#ffffff' }}>{art.title || 'Untitled'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 0, marginTop: '2px' }}>
                          <div 
                             onClick={(e) => { e.stopPropagation(); onPushLayer('portfolio', art.telegramId); }} 
                             style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 0%', minWidth: 0, overflow: 'hidden', cursor: 'pointer' }}
                          >
                            {art.artistPhotoUrl ? <img src={art.artistPhotoUrl} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyItems: 'center', fontSize: '8px', fontWeight: 'bold', color: '#ffffff', flexShrink: 0 }}>{art.firstName ? art.firstName.charAt(0).toUpperCase() : '?'}</div>}
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>{art.firstName || 'Unknown Artist'}</span>
                          </div>

                          {/* 👉 THE NEW ARTWORK FOOTER */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 'bold', color: '#71717a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isLiked ? '#ef4444' : '#71717a' }}>
                                <Heart size={12} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} /> 
                                <span>{art.likes?.length || 0}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MessageCircle size={12} /> 
                                <span>{art.comments?.length || 0}</span>
                              </div>
                            </div>
                            
                            {activeMenuId === art._id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'portFade 0.2s ease-out' }}>
                                {isMyProfile && activeTab === 'gallery' ? (
                                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: art._id, type: 'artwork' }); setActiveMenuId(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '3px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <Trash2 size={10} /> Delete
                                  </button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setReportConfig({ isOpen: true, itemType: 'artwork', itemId: art._id, reportedUserId: art.telegramId }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '3px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <Flag size={10} /> Report
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px' }}><X size={14} /></button>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(art._id); }} style={{ display: 'flex', color: '#a1a1aa', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
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
            <div style={{ width: '24px', height: '24px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'portSpin 1s linear infinite' }}></div>
          </div>
        )}
        
        {!hasMore[activeTab === 'saved' ? (savedTabType === 'artworks' ? 'saved' : 'savedCrits') : activeTab] && activeGridData.length > 0 && activeTab !== 'achievements' && activeTab !== 'competitions' && (
          <p style={{ textAlign: 'center', padding: '20px 0', color: '#71717a', fontSize: '12px', fontStyle: 'italic', fontWeight: 'bold' }}>
            You've reached the end of this tab.
          </p>
        )}

      {/* Follow Modal */}
        {followModal.isOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: '16px', animation: 'portFade 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', width: '100%', maxWidth: '360px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', animation: 'portScale 0.2s ease-out' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
                <h3 style={{ fontWeight: 900, color: '#ffffff', margin: 0, fontSize: '15px' }}>{followModal.title}</h3>
                <button onClick={() => setFollowModal({ isOpen: false, title: '', ids: [] })} style={{ color: '#71717a', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
                {loadingFollowList ? ( 
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><div style={{ width: '24px', height: '24px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'portSpin 1s linear infinite' }}></div></div> 
                ) : (
                  followListUsers.map(u => (
                    <div key={u.telegramId} onClick={() => { onPushLayer('portfolio', u.telegramId); setFollowModal({ isOpen: false, title: '', ids: [] }); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', cursor: 'pointer', borderBottom: '1px solid rgba(39, 39, 42, 0.5)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {u.photoUrl ? <img src={u.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '14px' }}>{(u.firstName || u.username || '?').charAt(0).toUpperCase()}</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#ffffff', margin: 0 }}>{u.firstName || 'Unknown Artist'}</p>
                        {u.username && <p style={{ fontSize: '11px', color: '#60a5fa', margin: '2px 0 0 0', fontWeight: 'bold' }}>@{u.username}</p>}
                      </div>
                    </div>
                  ))
                )}
                {!loadingFollowList && followListUsers.length === 0 && <p style={{ textAlign: 'center', color: '#71717a', padding: '32px', fontStyle: 'italic', fontSize: '12px', margin: 0 }}>No users found.</p>}
              </div>
            </div>
          </div>
        )}
        
      {/* Password Modal */}
        {isPasswordModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', padding: '16px', animation: 'portFade 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'portScale 0.2s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                  {profileUser.hasWebPassword ? <Lock size={18} /> : <Globe size={18} />} 
                  <span>{profileUser.hasWebPassword ? 'Reset Password' : 'Enable Web Access'}</span>
                </h2>
                
                <button 
                  onClick={() => { setIsPasswordModalOpen(false); setPasswordError(''); setPasswordForm({ new: '', confirm: '' }); }} 
                  style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s', padding: 0 }} 
                  onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} 
                  onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                >
                  <X size={20} />
                </button>
              </div>

              {passwordSuccess ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>✓</div>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Password Saved!</h3>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', textAlign: 'center', margin: 0, lineHeight: '1.5' }}>You can now login on any browser using <strong style={{ color: '#ffffff' }}>@{currentUser?.username}</strong></p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                    {profileUser.hasWebPassword ? "Set a new global password to log into your account from outside of Telegram." : "Set a global password to log into your profile from any browser outside of Telegram."}
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Password</label>
                      <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))} placeholder="At least 6 characters" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '10px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirm Password</label>
                      <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))} placeholder="Type it again" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '10px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'} />
                    </div>
                    {passwordError && <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#f87171', margin: 0, textAlign: 'center' }}>{passwordError}</p>}
                  </div>

                  <button 
                    onClick={handleSavePassword} 
                    disabled={passwordLoading || !passwordForm.new || !passwordForm.confirm}
                    style={{ width: '100%', padding: '12px', marginTop: '8px', backgroundColor: (passwordLoading || !passwordForm.new || !passwordForm.confirm) ? '#1e1e20' : '#2563eb', border: (passwordLoading || !passwordForm.new || !passwordForm.confirm) ? '1px solid #27272a' : '1px solid rgba(37,99,235,0.5)', color: (passwordLoading || !passwordForm.new || !passwordForm.confirm) ? '#71717a' : '#ffffff', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: (passwordLoading || !passwordForm.new || !passwordForm.confirm) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                  >
                    {passwordLoading ? 'Saving...' : 'Save Web Password'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      {/* Issue Reporter Modal */}
        {issueModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', padding: '16px', animation: 'portFade 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '16px', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', maxHeight: '90vh', animation: 'portScale 0.2s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #27272a', flexShrink: 0 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 900, color: '#60a5fa', margin: 0 }}>
                  <Bug size={18} color="#ef4444" /> Report an Issue
                </h2>
                <button onClick={() => { setIssueModalOpen(false); setIssueCategory(''); setIssueText(''); setIssueError(''); }} style={{ color: '#71717a', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}><X size={20} /></button>
              </div>
              
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                {issueSuccess ? (
                   <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                     <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '1px solid rgba(34, 197, 94, 0.2)' }}><CheckCircle size={24} color="#4ade80" /></div>
                     <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Issue Submitted</h3>
                     <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>Thank you for helping me improve Critique Engine! I will investigate this.</p>
                   </div>
                ) : !issueCategory ? (
                   <>
                     <p style={{ fontSize: '13px', color: '#e4e4e7', margin: 0 }}>Where did you encounter a problem?</p>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                       {ISSUE_CATEGORIES.map(cat => (
                         <button 
                           key={cat} onClick={() => setIssueCategory(cat)} 
                           style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: '1px solid #27272a', backgroundColor: '#121212', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                           onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; e.currentTarget.style.color = '#60a5fa'; }}
                           onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#121212'; e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#a1a1aa'; }}
                         >
                           {cat}
                         </button>
                       ))}
                     </div>
                   </>
                ) : (
                   <>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                       <button onClick={() => setIssueCategory('')} style={{ fontSize: '11px', color: '#71717a', background: 'transparent', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}>◀ Back</button>
                       <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa', padding: '4px 8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>{issueCategory}</span>
                     </div>
                     <p style={{ fontSize: '13px', color: '#e4e4e7', margin: 0 }}>Please describe the issue in detail.</p>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                       <textarea
                         value={issueText} maxLength={1000} onChange={(e) => setIssueText(e.target.value)} placeholder="What happened? What were you trying to do?"
                         style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '10px', padding: '12px', color: '#ffffff', fontSize: '13px', outline: 'none', resize: 'none', height: '100px', fontFamily: 'inherit' }}
                         onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
                       />
                       <div style={{ textAlign: 'right' }}>
                         <span style={{ fontSize: '10px', fontWeight: 'bold', color: issueText.length >= 1000 ? '#ef4444' : '#71717a' }}>{issueText.length}/1000</span>
                       </div>
                     </div>
                     
                     {issueError && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>{issueError}</p>}
                     
                     <button 
                       onClick={handleIssueSubmit} disabled={isSubmittingIssue || !issueText.trim()} 
                       style={{ width: '100%', padding: '12px', marginTop: '4px', backgroundColor: (isSubmittingIssue || !issueText.trim()) ? '#1e1e20' : '#2563eb', border: (isSubmittingIssue || !issueText.trim()) ? '1px solid #27272a' : '1px solid rgba(37,99,235,0.5)', color: (isSubmittingIssue || !issueText.trim()) ? '#71717a' : '#ffffff', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: (isSubmittingIssue || !issueText.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                     >
                        {isSubmittingIssue ? 'Sending...' : 'Submit Issue'}
                     </button>
                   </>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Disable Safety Mode Warning Modal */}
      {showSafetyDisableWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'portFade 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', animation: 'portScale 0.2s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', marginBottom: '8px' }}>
                ⚠️
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

      {/* Individual NSFW Warning Modal (Works for Art & Critiques!) */}
      {nsfwWarningArt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'portFade 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', animation: 'portScale 0.2s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', marginBottom: '8px' }}>
                🔞
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Mature Content</h2>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
                This {activeTab === 'critiques' || (activeTab === 'saved' && savedTabType === 'critiques') ? 'critique' : 'artwork'} has been flagged as containing mature themes (NSFW). It may not be suitable for all audiences.
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
                    
                    // ❌ REMOVED: The onPushLayer routing logic has been deleted from here
                    
                    // 3. Close the modal, leaving them on the Portfolio to view the unblurred image!
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

      {/* 👉 THE NEW REUSABLE SHARE MODAL */}
      <ShareModal 
        isOpen={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
        title="Portfolio"
        tgLink={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || 'CritiqueEngineBot'}/${process.env.NEXT_PUBLIC_BOT_APP_SHORTNAME || 'app'}?startapp=user_${viewProfileId}`}
        webLink={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?profile=${viewProfileId}`}
        shareText={`Check out ${displayFirstName}'s art portfolio on Critique Engine!`}
      />

      {/* GLOBAL SESSION EXPIRED HARD STOP MODAL */}
      {sessionExpired && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: '16px', animation: 'portFade 0.3s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '24px', padding: '40px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', animation: 'portScale 0.3s ease-out' }}>
            
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(234, 179, 8, 0.3)', boxShadow: '0 0 40px rgba(234, 179, 8, 0.2)', animation: 'portSpin 10s linear infinite' }}>
              ⏳
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Session Expired</h2>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
                To prevent replay security attacks, your active session expires every 7 days.
              </p>
              <p style={{ fontSize: '14px', color: '#e4e4e7', margin: 0, fontWeight: 'bold' }}>
                Please refresh the page to re-authenticate and continue!
              </p>
            </div>

            <button 
              onClick={() => window.location.reload()} 
              style={{ width: '100%', padding: '16px', backgroundColor: '#eab308', color: '#000000', fontWeight: 900, borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 20px rgba(234, 179, 8, 0.4)' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#facc15'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eab308'}
            >
              🔄 Refresh Page
            </button>

          </div>
        </div>
      )}

      <ReportModal isOpen={reportConfig.isOpen} onClose={() => setReportConfig(prev => ({ ...prev, isOpen: false }))} itemType={reportConfig.itemType} itemId={reportConfig.itemId} parentItemId={reportConfig.parentItemId} reportedUserId={reportConfig.reportedUserId} currentUser={currentUser} />

      {currentUser && (
        <Notifications 
          isOpen={isNotificationsOpen} 
          onClose={() => setIsNotificationsOpen(false)} 
          currentUser={currentUser} 
          onNotificationClick={async (notif) => {
            setIsNotificationsOpen(false);
            if (notif.type === 'follow') { onPushLayer('portfolio', notif.senderId); return; }

            let targetItem = artworks.find(a => String(a._id) === String(notif.itemId)) || savedArtsData.find(a => String(a._id) === String(notif.itemId));
            let isCrit = false;
            
            if (!targetItem) {
              targetItem = critiquesData.find(c => String(c._id) === String(notif.itemId)) || savedCritsData.find(c => String(c._id) === String(notif.itemId));
              if (targetItem) isCrit = true;
            }

            if (!targetItem) {
              try {
                const res = await fetch(`/api/resolve?id=${notif.itemId}`);
                const data = await res.json();
                if (data.success) {
                  targetItem = data.item;
                  isCrit = data.type === 'critique';
                } else { alert("Oops! Looks like this item was deleted."); return; }
              } catch (e) { return; }
            }

            const targetCommentId = (notif.type.includes('comment') || notif.type === 'reply') ? (notif.commentId || notif.relatedItemId) : null;
            
            if (isCrit) {
               onPushLayer('critique', { ...targetItem, targetCommentId });
            } else {
               onPushLayer('art', { ...targetItem, targetCommentId });
            }
          }} 
        />
      )}

      {/* 👉 THE EXTERNAL LINK WARNING MODAL */}
      {pendingLink && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'portFade 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', animation: 'portScale 0.2s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '1px solid rgba(234, 179, 8, 0.2)', boxShadow: '0 0 25px rgba(234, 179, 8, 0.2)', marginBottom: '4px' }}>
                ⚠️
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>External Link Warning</h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                You are about to leave Critique Engine and visit an external website. This content is not controlled or maintained by the platform.
              </p>
              <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '8px', padding: '12px', width: '100%', marginTop: '4px', wordBreak: 'break-all' }}>
                <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 'bold' }}>{pendingLink}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button 
                onClick={() => setPendingLink(null)} 
                style={{ flex: 1, padding: '12px', backgroundColor: '#27272a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '13px' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
              >
                Cancel
              </button>
              <button 
                onClick={() => { window.open(pendingLink, '_blank', 'noopener,noreferrer'); setPendingLink(null); }} 
                style={{ flex: 1, padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '13px', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👉 THE NEW DELETE BANNER */}
      <DeleteConfirmBanner 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        itemName={deleteTarget?.type || "item"}
        isDeleting={isDeletingItem}
      />

    </div>
    </>
  );
}