'use client';

import React, { useEffect, useState, useRef } from 'react';
import HeatmapOverlay from './HeatmapOverlay';
import ReportModal from './ReportModal';
import ShareModal from './ShareModal'; 
import DeleteConfirmBanner from './DeleteConfirmBanner';
import { 
  ArrowLeft, Image as ImageIcon, Trash2, Flag, MoreHorizontal, 
  Eye, Heart, Bookmark, Share2, Target, PenTool, Flame, 
  MessageCircle, MessageSquare, Send, AlertTriangle, Play, CheckCircle, X, Palette 
} from 'lucide-react';

const formatCount = (num) => {
  if (!num) return "0";
  return Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(num);
};

const renderTextWithLinks = (text, onLinkClick) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onLinkClick(part);
          }}
          style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
          onMouseOver={(e) => e.currentTarget.style.color = '#93c5fd'}
          onMouseOut={(e) => e.currentTarget.style.color = '#60a5fa'}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

const ExpandableText = ({ text, maxLength = 150, maxLines = 4, onLinkClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text) return null;

  const lines = text.split('\n');
  const isOverLineLimit = lines.length > maxLines;
  const isOverCharLimit = text.length > maxLength;

  if (!isOverLineLimit && !isOverCharLimit) {
    return <p style={{ fontSize: '13px', color: '#d4d4d8', margin: '4px 0 0 0', lineHeight: '1.5', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(text, onLinkClick)}</p>;
  }

  let truncatedText = text;
  if (isOverLineLimit) {
    truncatedText = lines.slice(0, maxLines).join('\n');
  }
  if (truncatedText.length > maxLength) {
    truncatedText = truncatedText.slice(0, maxLength);
  }

  return (
    <p style={{ fontSize: '13px', color: '#d4d4d8', margin: '4px 0 0 0', lineHeight: '1.5', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
      {renderTextWithLinks(isExpanded ? text : `${truncatedText}...`, onLinkClick)}
      <button 
        onClick={(e) => {
          e.stopPropagation(); 
          setIsExpanded(!isExpanded);
        }} 
        style={{ marginLeft: '8px', color: '#60a5fa', background: 'transparent', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', transition: 'color 0.2s', padding: 0 }}
        onMouseOver={(e) => e.currentTarget.style.color = '#93c5fd'}
        onMouseOut={(e) => e.currentTarget.style.color = '#60a5fa'}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </p>
  );
};

// 👉 UPDATED: Reusable Mini Badge that adapts to Event Difficulty!
const AchievementBadge = ({ achievement }) => {
  if (!achievement) return null;
  
  const medal = achievement.rank === 1 ? '🥇' : achievement.rank === 2 ? '🥈' : '🥉';
  
  // Default to Gold/Hustle ⚡
  let color = '#fde047', bg = 'rgba(234, 179, 8, 0.15)', border = 'rgba(234, 179, 8, 0.4)';
  
  // Dynamically swap colors based on the difficulty string
  if (achievement.difficulty?.includes('Breeze')) { 
    color = '#4ade80'; bg = 'rgba(34, 197, 94, 0.15)'; border = 'rgba(34, 197, 94, 0.4)'; // Green
  } else if (achievement.difficulty?.includes('Crucible')) { 
    color = '#f87171'; bg = 'rgba(239, 68, 68, 0.15)'; border = 'rgba(239, 68, 68, 0.4)'; // Red
  } else if (achievement.difficulty?.includes('God-Tier')) { 
    color = '#c084fc'; bg = 'rgba(168, 85, 247, 0.15)'; border = 'rgba(168, 85, 247, 0.4)'; // Purple
  }

  return (
    <span 
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '6px', padding: '2px 6px', marginLeft: '6px', cursor: 'default', textDecoration: 'none' }} 
      title={`${medal} ${achievement.competitionName} (${achievement.difficulty})`}
    >
      <span style={{ fontSize: '10px' }}>{medal}</span>
      <span style={{ fontSize: '9px', fontWeight: '900', color: color, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {achievement.competitionName}
      </span>
    </span>
  );
};

// 👉 NEW: Helper to get the glowing border based on difficulty!
const getAvatarGlow = (achievement) => {
  if (!achievement || !achievement.difficulty) return { border: '1px solid #3f3f46', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' };
  
  if (achievement.difficulty.includes('Breeze')) return { border: '2px solid #4ade80', boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)' };
  if (achievement.difficulty.includes('Hustle')) return { border: '2px solid #fde047', boxShadow: '0 0 8px rgba(253, 224, 71, 0.4)' };
  if (achievement.difficulty.includes('Crucible')) return { border: '2px solid #ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)' };
  
  return { border: '2px solid #c084fc', boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }; // God-Tier 👑
};

export default function ArtDetail({ 
  art, onClose, onArtClick, onArtistClick, onCategoryClick,
  currentUser, userStats, setUserStats, onUpdateArt,
  onCritiqueClick, onRequireLogin, 
  autoOpenComments, targetCommentId
}) {
  const [showNsfwWarning, setShowNsfwWarning] = useState(() => {
    if (typeof window !== 'undefined') {
      // 1. Did they already acknowledge this image in the Feed/Portfolio?
      const hasAcknowledged = sessionStorage.getItem(`nsfw_ack_${art._id}`);
      
      // 2. If it's an adult artwork and there is NO acknowledgement cookie, 
      // they bypassed the gallery guards completely. It is 100% a direct link!
      return art.isAdult && !hasAcknowledged;
    }
    return false;
  });

  const [nsfwCritiqueWarning, setNsfwCritiqueWarning] = useState(null);

  const [critiques, setCritiques] = useState([]);
  const [loadingCritiques, setLoadingCritiques] = useState(false);
  const [showAllCritiques, setShowAllCritiques] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const [searchCritic, setSearchCritic] = useState('');
  const [sortMode, setSortMode] = useState('newest'); 
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingLink, setPendingLink] = useState(null); 

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingArt, setIsDeletingArt] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null); 
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); 
  const [showAllComments, setShowAllComments] = useState(autoOpenComments || false);

  const stateRef = useRef({ scroll: 0, showComments: autoOpenComments || false });

  // 👉 NEW: DEEP LINK AUTO-SCROLLER
  useEffect(() => {
    if (targetCommentId && showAllComments) {
       let attempts = 0;
       const findAndScroll = setInterval(() => {
         attempts++;
         const exactCommentEl = document.getElementById(`comment-${targetCommentId}`);

         if (exactCommentEl) {
           clearInterval(findAndScroll);
           exactCommentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
           
           // Flash the background blue so they know exactly which comment it is!
           exactCommentEl.style.transition = 'background-color 0.5s ease-out, box-shadow 0.5s ease-out';
           exactCommentEl.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
           exactCommentEl.style.boxShadow = '0 0 0 8px rgba(59, 130, 246, 0.2)';
           exactCommentEl.style.borderRadius = '8px';
           setTimeout(() => { 
             exactCommentEl.style.backgroundColor = 'transparent'; 
             exactCommentEl.style.boxShadow = '0 0 0 0px transparent';
           }, 2500);
         } else if (attempts >= 15) {
           clearInterval(findAndScroll); // Give up if the comment is deleted
         }
       }, 200);
    }
  }, [targetCommentId, showAllComments]);
  
  // 👉 THE SPAM SHIELD REFS
  const pendingLikeClicks = useRef(0);
  const likeTimerRef = useRef(null);
  
  const pendingSaveClicks = useRef(0);
  const saveTimerRef = useRef(null);

  // 👉 NEW: THE FOLLOW SHIELD REFS
  const pendingFollowClicks = useRef(0);
  const followTimerRef = useRef(null);

  const pendingCommentLikeClicks = useRef({}); 
  const commentLikeTimerRef = useRef({});

  useEffect(() => {
    stateRef.current.showComments = showAllComments;
  }, [showAllComments]);

  useEffect(() => {
    const overlay = document.getElementById('overlay-container');
    const handleScroll = () => { if (overlay) stateRef.current.scroll = overlay.scrollTop; };
    
    if (overlay) overlay.addEventListener('scroll', handleScroll);

    const savedScroll = sessionStorage.getItem(`scroll_art_${art._id}`);
    const savedComments = sessionStorage.getItem(`comments_art_${art._id}`);
    
    if (savedComments === 'true') setShowAllComments(true);
    if (savedScroll && overlay) {
      setTimeout(() => overlay.scrollTop = parseInt(savedScroll, 10), 100);
    }

    return () => {
      if (overlay) overlay.removeEventListener('scroll', handleScroll);
      sessionStorage.setItem(`scroll_art_${art._id}`, stateRef.current.scroll);
      sessionStorage.setItem(`comments_art_${art._id}`, stateRef.current.showComments ? 'true' : 'false');
    };
  }, [art._id]);

  const [isRefreshingComments, setIsRefreshingComments] = useState(false);

  const handleRefreshComments = async () => {
    setIsRefreshingComments(true);
    try {
      const res = await fetch(`/api/resolve?id=${art._id}`);
      const data = await res.json();
      if (data.success && data.type === 'artwork') {
        onUpdateArt(data.item); 
      }
    } catch (e) {
      console.error("Failed to refresh comments", e);
    } finally {
      setIsRefreshingComments(false);
    }
  };

  const [reportConfig, setReportConfig] = useState({ isOpen: false, itemType: 'artwork', itemId: art._id, reportedUserId: art.telegramId });
  const [showMenu, setShowMenu] = useState(false); 
  const [activeCommentMenu, setActiveCommentMenu] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); 
  const commentInputRef = useRef(null);

  const isLikedByMe = currentUser ? (art.likes || []).some(id => String(id) === String(currentUser.id)) : false;
  const hasCommentedByMe = currentUser ? (art.comments || []).some(c => String(c.telegramId) === String(currentUser.id) || c.username === currentUser.username) : false;
  const isSavedByMe = currentUser ? userStats.savedArtsList.some(id => String(id) === String(art._id)) : false;
  const isFollowingArtist = currentUser ? userStats.following.some(id => String(id) === String(art.telegramId)) : false;
  const isMyProfile = currentUser ? String(art.telegramId) === String(currentUser.id) : false;
  const hasCritiquedByMe = currentUser ? critiques.some(c => String(c.critiquerId) === String(currentUser.id)) : false;

  // 👉 THE FIX 1: Initial Load (Shows Spinner)
  useEffect(() => {
    if (!art?._id) return;
    
    async function fetchInitialCritiques() {
      setLoadingCritiques(true); 
      try {
        const res = await fetch(`/api/critiques?artworkId=${art._id}`);
        const data = await res.json();
        if (data.success) setCritiques(data.critiques);
      } catch (err) { console.error(err); } 
      finally { setLoadingCritiques(false); }
    }
    
    fetchInitialCritiques();
  }, [art?._id]); 

  // 👉 THE FIX 2: Silent Background Refresh (Scroll Position Protected)
  useEffect(() => {
    const handleSilentRefresh = async () => {
      console.log("Silently fetching new critiques...");
      try {
        const res = await fetch(`/api/critiques?artworkId=${art._id}`);
        const data = await res.json();
        if (data.success) {
          // Simply update the state without touching the loading spinner!
          // React will surgically inject the new critique into the DOM
          setCritiques(data.critiques);
        }
      } catch (err) { console.error(err); }
    };

    window.addEventListener('critique_added', handleSilentRefresh);
    return () => window.removeEventListener('critique_added', handleSilentRefresh);
  }, [art._id]); 

  // ==========================================
  // INSTANT CRITIQUE DELETION SYNC
  // ==========================================
  useEffect(() => {
    const handleCritiqueDeleted = (e) => {
      const deletedId = e.detail;
      console.log(`Surgically removing deleted critique ${deletedId} from ArtDetail...`);
      
      // Instantly wipe the deleted critique from the visual list!
      setCritiques(prev => prev.filter(c => c._id !== deletedId));
    };

    // We listen to the exact same 'artwork_deleted' event since critiques share the pipeline!
    window.addEventListener('artwork_deleted', handleCritiqueDeleted);
    return () => window.removeEventListener('artwork_deleted', handleCritiqueDeleted);
  }, []);

  const [localViews, setLocalViews] = useState(art.views || 0);

  useEffect(() => {
    const viewKey = `viewed_art_${art._id}`;
    if (!sessionStorage.getItem(viewKey)) {
      fetch(`/api/artworks/${art._id}/view`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLocalViews(data.views);
            sessionStorage.setItem(viewKey, 'true'); 
          }
        }).catch(console.error);
    }
  }, [art._id]);

  useEffect(() => {
    const checkFeedbackStatus = () => {
      if (sessionStorage.getItem('triggerFeedback') === 'true') {
        sessionStorage.removeItem('triggerFeedback');
        if (!isLikedByMe || !hasCommentedByMe) {
          setShowFeedbackModal(true);
        }
      }
    };

    window.addEventListener('focus', checkFeedbackStatus);
    const interval = setInterval(checkFeedbackStatus, 1500);
    
    return () => {
      window.removeEventListener('focus', checkFeedbackStatus);
      clearInterval(interval);
    };
  }, [isLikedByMe, hasCommentedByMe]);

  // useEffect(() => {
  //   window.history.pushState({ overlay: 'open' }, '');
  //   const handleHardwareBack = () => { onClose(); };
  //   window.addEventListener('popstate', handleHardwareBack);
  //   return () => window.removeEventListener('popstate', handleHardwareBack);
  // }, [onClose]);

  const getTgInitData = () => typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

  const handleToggleLike = () => {
    if (!currentUser) return onRequireLogin();
    
    const originalLikes = [...(art.likes || [])];
    const newLikes = isLikedByMe ? originalLikes.filter(id => String(id) !== String(currentUser.id)) : [...originalLikes, currentUser.id];
    onUpdateArt({ ...art, likes: newLikes });
    
    pendingLikeClicks.current += 1;
    if (likeTimerRef.current) clearTimeout(likeTimerRef.current);
    
    likeTimerRef.current = setTimeout(async () => {
      const clicks = pendingLikeClicks.current;
      pendingLikeClicks.current = 0; 
      
      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch(`/api/artworks/${art._id}/like`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ telegramId: currentUser.id }) 
        }); 

        if (res.status === 401) {
           onUpdateArt({ ...art, likes: originalLikes }); 
           return onRequireLogin(); 
        }
      } catch (err) {
         onUpdateArt({ ...art, likes: originalLikes });
      }
    }, 500); 
  };

  const handleToggleSave = () => {
    if (!currentUser) return onRequireLogin();
    
    const willSave = !isSavedByMe;
    const newSaved = willSave ? [...userStats.savedArtsList, art._id] : userStats.savedArtsList.filter(id => String(id) !== String(art._id));
    
    setUserStats(prev => ({ ...prev, savedArtsList: newSaved }));
    window.dispatchEvent(new CustomEvent('art_saved_toggled', { detail: { artwork: art, isSaved: willSave } }));
    
    pendingSaveClicks.current += 1;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const clicks = pendingSaveClicks.current;
      pendingSaveClicks.current = 0; 
      
      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch(`/api/artworks/${art._id}/save`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ telegramId: currentUser.id }) 
        }); 

        if (res.status === 401) {
           setUserStats(prev => ({ ...prev, savedArtsList: isSavedByMe ? [...userStats.savedArtsList, art._id] : userStats.savedArtsList.filter(id => String(id) !== String(art._id)) }));
           return onRequireLogin(); 
        }
      } catch (err) {}
    }, 500);
  };

  // ==========================================
  // 👉 THE FIX: SPAM-PROOF FOLLOW HANDLER
  // ==========================================
  const handleToggleFollow = () => {
    if (!currentUser) return onRequireLogin();
    
    // 1. OPTIMISTIC UPDATE
    const newFollowing = isFollowingArtist 
      ? userStats.following.filter(id => String(id) !== String(art.telegramId)) 
      : [...userStats.following, art.telegramId];
      
    setUserStats(prev => ({ ...prev, following: newFollowing }));
    
    // 2. THE SPAM SHIELD
    pendingFollowClicks.current += 1;
    if (followTimerRef.current) clearTimeout(followTimerRef.current);

    followTimerRef.current = setTimeout(async () => {
      const clicks = pendingFollowClicks.current;
      pendingFollowClicks.current = 0; 
      
      // If clicks are even, they just toggled back to original state. Don't hit Vercel!
      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch('/api/users/follow', { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ currentUserId: currentUser.id, targetUserId: art.telegramId }) 
        });

        if (res.status === 401) {
           // Revert on failure
           setUserStats(prev => ({ 
             ...prev, 
             following: isFollowingArtist 
                ? [...userStats.following, art.telegramId] 
                : userStats.following.filter(id => String(id) !== String(art.telegramId)) 
           }));
           return onRequireLogin(); 
        } 
      } catch (err) {
         // Revert on network error
         setUserStats(prev => ({ 
           ...prev, 
           following: isFollowingArtist 
              ? [...userStats.following, art.telegramId] 
              : userStats.following.filter(id => String(id) !== String(art.telegramId)) 
         }));
      }
    }, 500);
  };

  const handlePostComment = async () => {
    if (!currentUser) return onRequireLogin();
    if (!commentText.trim() || commentText.length > 1000) return;
    setIsSubmittingComment(true);
    let endpoint = `/api/artworks/${art._id}/comment`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTgInitData() || '' 
        },
        body: JSON.stringify({ 
          telegramId: currentUser.id, 
          username: currentUser.username, 
          photoUrl: currentUser.photoUrl || currentUser.photo_url || null, 
          text: commentText.trim(), 
          replyToCommentId: replyingTo ? replyingTo._id : null 
        })
      });

      if (res.status === 401) {
         return onRequireLogin(); 
      }

      const data = await res.json();
      if (data.success) {
        onUpdateArt({ ...art, comments: data.comments });
        setCommentText(''); 
        setReplyingTo(null); 
        setShowAllComments(true);
        if (commentInputRef.current) commentInputRef.current.style.height = 'auto';
      } else if (res.status === 403 && data.error?.includes('banned')) {
        window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
      } else {
        if (res.status === 403 && data.error?.includes('Daily comment limit')) {
           window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
        } else {
           alert(data.error || "Failed to post comment.");
        }
      }
    } catch (err) {} finally { setIsSubmittingComment(false); }
  };

  const handleCommentInput = (e) => {
    setCommentText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleToggleCommentLike = (commentId, replyId = null, currentLikes = []) => {
    if (!currentUser) return onRequireLogin();
    
    const isLiked = currentLikes.some(id => String(id) === String(currentUser.id));
    const newLikes = isLiked ? currentLikes.filter(id => String(id) !== String(currentUser.id)) : [...currentLikes, currentUser.id];
    
    const updatedComments = art.comments.map(c => {
      if (c._id === commentId) {
        if (replyId) return { ...c, replies: c.replies.map(r => r._id === replyId ? { ...r, likes: newLikes } : r) };
        return { ...c, likes: newLikes };
      }
      return c;
    });
    onUpdateArt({ ...art, comments: updatedComments }); 

    const uniqueTargetId = replyId || commentId;
    if (!pendingCommentLikeClicks.current[uniqueTargetId]) pendingCommentLikeClicks.current[uniqueTargetId] = 0;
    
    pendingCommentLikeClicks.current[uniqueTargetId] += 1;
    if (commentLikeTimerRef.current[uniqueTargetId]) clearTimeout(commentLikeTimerRef.current[uniqueTargetId]);

    commentLikeTimerRef.current[uniqueTargetId] = setTimeout(async () => {
      const clicks = pendingCommentLikeClicks.current[uniqueTargetId];
      pendingCommentLikeClicks.current[uniqueTargetId] = 0; 

      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch(`/api/artworks/${art._id}/comment/${commentId}/like`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ telegramId: currentUser.id, replyId }) 
        }); 
        
        if (res.status === 401) {
           const revertedComments = art.comments.map(c => {
             if (c._id === commentId) {
               if (replyId) return { ...c, replies: c.replies.map(r => r._id === replyId ? { ...r, likes: currentLikes } : r) };
               return { ...c, likes: currentLikes };
             }
             return c;
           });
           onUpdateArt({ ...art, comments: revertedComments }); 
           return onRequireLogin(); 
        }
      } catch (err) {}
    }, 500);
  };

  // 👉 THE UPGRADED COMMENT DELETE FUNCTION
  const confirmDeleteComment = async () => {
    if (!deleteCommentTarget) return;

    const { commentId, replyId } = deleteCommentTarget;
    setIsDeletingComment(true); // Lock the banner button

    // 1. OPTIMISTIC UPDATE
    const originalComments = [...art.comments];
    const updatedComments = art.comments.map(c => {
      if (c._id === commentId) {
        if (replyId) return { ...c, replies: c.replies.filter(r => r._id !== replyId) };
        return null; 
      }
      return c;
    }).filter(Boolean);

    onUpdateArt({ ...art, comments: updatedComments });

    // 2. SERVER FETCH
    try {
      const queryParams = new URLSearchParams({ telegramId: currentUser.id, username: currentUser.username });
      if (replyId) queryParams.append('replyId', replyId);
      
      const res = await fetch(`/api/artworks/${art._id}/comment/${commentId}?${queryParams.toString()}`, { 
        method: 'DELETE',
        headers: { 'x-telegram-init-data': getTgInitData() || '' }
      });
      
      if (res.status === 401) {
         onUpdateArt({ ...art, comments: originalComments }); 
         setIsDeletingComment(false);
         setDeleteCommentTarget(null);
         return onRequireLogin(); 
      }

      const data = await res.json();
      
      if (!data.success) {
        onUpdateArt({ ...art, comments: originalComments }); 
        alert(data.error || "Failed to delete comment from server.");
      }
    } catch (err) { 
      onUpdateArt({ ...art, comments: originalComments }); 
      console.error("Failed to delete comment", err); 
    }

    // 3. CLEANUP
    setIsDeletingComment(false);
    setDeleteCommentTarget(null);
  };

  // 👉 THE UPGRADED ARTWORK DELETE FUNCTION
  const handleDelete = async () => {
    setIsDeletingArt(true); // Lock the banner button
    
    try {
      const res = await fetch(`/api/artworks?id=${art._id}`, { 
        method: 'DELETE', 
        headers: { 'x-telegram-init-data': window.Telegram?.WebApp?.initData || '' } 
      });
      
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent('artwork_deleted', { detail: art._id }));
        onClose(); 
      } else {
        alert(data.error || "Failed to delete.");
        setIsDeletingArt(false); // Unlock if it fails
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      alert("An error occurred while deleting.");
      setIsDeletingArt(false);
      setShowDeleteConfirm(false);
    }
  };

  const getAnnotationCount = (commentStr) => {
    if (!commentStr) return 0;
    const match = commentStr.match(/(\d+)\s+annotation/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const processedCritiques = critiques
    .filter(c => c.critiquerUsername?.toLowerCase().includes(searchCritic.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortMode === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortMode === 'most_annotations') return getAnnotationCount(b.comment) - getAnnotationCount(a.comment);
      if (sortMode === 'least_annotations') return getAnnotationCount(a.comment) - getAnnotationCount(b.comment);
      if (sortMode === 'popularity') return (b.likes?.length || 0) - (a.likes?.length || 0); 
      return 0;
    });

  const displayedCritiques = showAllCritiques ? processedCritiques : processedCritiques.slice(0, 2);
  const allCommentsReversed = art.comments ? [...art.comments].reverse() : [];
  const displayedComments = showAllComments ? allCommentsReversed : allCommentsReversed.slice(0, 2);

  const handleStartCritique = async () => {
    if (!currentUser) return onRequireLogin();

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'x-telegram-init-data': getTgInitData() || ''
        }
      });
      
      if (res.status === 401) {
        return onRequireLogin();
      }
    } catch (err) {
      console.error("Session verification failed", err);
    }

    if (art.isPredefined) {
      onArtClick(art.encodedImageUrl, 'editor_decode', art);
    } else {
      onArtClick(art.imageUrl, 'editor', art);
    }
  };

  return (
    <>
      <style>{`
        @keyframes artFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes artZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spinRefresh { to { transform: rotate(360deg); } }
        
        .art-layout { display: flex; flex-direction: column; gap: 24px; padding: 16px; max-width: 1400px; margin: 0 auto; position: relative; z-index: 0; }
        .art-image-col { width: 100%; display: flex; flex-direction: column; gap: 16px; }
        .art-info-col { width: 100%; display: flex; flex-direction: column; gap: 20px; }
        
        .action-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; width: 100%; }
        .artist-card { display: flex; align-items: center; gap: 12px; }
        .stats-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

        @media (max-width: 640px) {
          .artist-card { width: 100%; justify-content: space-between; }
          .stats-group { width: 100%; justify-content: space-between; }
          .stats-group > * { flex: 1; display: flex; justify-content: center; }
        }

        @media (min-width: 1024px) {
          .art-layout { flex-direction: row; padding: 32px 24px; gap: 40px; align-items: flex-start; }
          .art-image-col { width: 65%; flex-shrink: 0; position: sticky; top: 80px; align-self: flex-start; height: max-content; }
          .art-info-col { width: 35%; flex-shrink: 0; }
        }

        .art-image-container { position: relative; border-radius: 16px; overflow: hidden; background-color: #121212; border: 1px solid #27272a; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); cursor: pointer; display: flex; justify-content: center; align-items: center; padding: 8px; transition: border-color 0.2s; }
        .art-image-container:hover { border-color: #3f3f46; }
        
        .art-image { width: 100%; height: auto; max-height: 85vh; object-fit: contain; border-radius: 12px; transition: transform 0.4s ease; pointer-events: none; user-select: none; -webkit-user-select: none; }
        .art-image-container:hover .art-image { transform: scale(1.01); }
        
        .crit-card { transition: border-color 0.2s; }
        .crit-card:hover { border-color: #3b82f6 !important; }
      `}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#ffffff', paddingBottom: '80px', fontFamily: 'system-ui, -apple-system, sans-serif', animation: 'artFadeIn 0.3s ease-out' }}>
        
        {/* Sticky Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'rgba(9, 9, 11, 0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid #27272a', paddingTop: 'calc(12px + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <button 
            onClick={onClose} 
            style={{ padding: '8px 16px', backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', fontWeight: 'bold', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '2px solid #3f3f46', paddingLeft: '16px' }}>
            <ImageIcon size={18} color="#a1a1aa" />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Art <span style={{ color: '#60a5fa' }}>View</span>
            </h2>
          </div>
        </div>

        {/* Main Layout */}
        <div className="art-layout">
          
          {/* Left: Image Column */}
          <div className="art-image-col">
            <div className="art-image-container" onClick={() => onArtClick(art.imageUrl, 'viewer_raw')}>
              <img 
                src={art.imageUrl} 
                alt="Artwork" 
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
                className="art-image"
              />
              {art.isAdult && (
                <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                  🔞 NSFW
                </div>
              )}
              {art.isPredefined && (
                <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: '#9333ea', color: '#ffffff', fontSize: '10px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Target size={12} /> <span>Guided</span>
                </div>
              )}
              {showHeatmap && <HeatmapOverlay art={art} critiques={critiques} onClose={() => setShowHeatmap(false)} onArtClick={onArtClick} />}
            </div>
          </div>

          {/* Right: Info Column */}
          <div className="art-info-col">
            
            {/* Title & Menu */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyItems: 'space-between', gap: '16px' }}>
              <h1 style={{ flex: 1, fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: '1.1', letterSpacing: '-0.5px' }}>
                {art.title || 'Untitled Artwork'}
              </h1>
              
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {showMenu ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'artZoomIn 0.2s ease-out' }}>
                    {isMyProfile ? (
                      <button 
                        onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                      >
                        <Trash2 size={14} /> <span>Delete</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => { setShowMenu(false); setReportConfig({ isOpen: true, itemType: 'artwork', itemId: art._id, reportedUserId: art.telegramId }); }} 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                      >
                        <Flag size={14} /> <span>Report</span>
                      </button>
                    )}
                    <button onClick={() => setShowMenu(false)} style={{ display: 'flex', background: 'transparent', border: 'none', color: '#71717a', fontWeight: 'bold', padding: '4px 8px', cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowMenu(true)} 
                    style={{ background: 'transparent', border: 'none', color: '#a1a1aa', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s, color 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; e.currentTarget.style.color = '#ffffff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Artist & Stats Controls */}
            <div className="action-row">
              
              {/* Artist Block */}
              <div 
                className="artist-card"
                onClick={() => { if(onArtistClick) onArtistClick(art.telegramId); }} 
                style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', padding: '10px 16px 10px 10px', borderRadius: '16px', border: '1px solid #27272a', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.5)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {art.artistPhotoUrl ? (
                    <img src={art.artistPhotoUrl} alt="Artist" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...getAvatarGlow(art.showcasedAchievement) }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 'bold', fontSize: '18px', flexShrink: 0, ...getAvatarGlow(art.showcasedAchievement) }}>
                      {art.firstName ? art.firstName.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#ffffff', fontSize: '14px' }}>{art.firstName || 'Unknown Artist'}</p>
                      <AchievementBadge achievement={art.showcasedAchievement} />
                    </div>
                    {art.username && (
                      <p 
                        onClick={(e) => { e.stopPropagation(); if (onArtistClick) onArtistClick(art.telegramId); }}
                        style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#60a5fa', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                        onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                      >
                        @{art.username}
                      </p>
                    )}
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#a1a1aa' }}>{new Date(art.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {!isMyProfile && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleToggleFollow(); // 👉 SPAM-PROTECTED NOW
                    }} 
                    style={{
                      marginLeft: '8px', padding: '6px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                      backgroundColor: isFollowingArtist ? '#27272a' : '#2563eb',
                      color: isFollowingArtist ? '#a1a1aa' : '#ffffff',
                      border: isFollowingArtist ? '1px solid #3f3f46' : 'none',
                      boxShadow: isFollowingArtist ? 'none' : '0 4px 10px rgba(37,99,235,0.3)'
                    }}
                    onMouseOver={(e) => { if (!isFollowingArtist) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                    onMouseOut={(e) => { if (!isFollowingArtist) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  >
                    {isFollowingArtist ? 'Following' : 'Follow +'}
                  </button>
                )}
              </div>

              {/* Stats Buttons */}
              <div className="stats-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', height: '48px', borderRadius: '12px', border: '1px solid #27272a', backgroundColor: 'rgba(24, 24, 27, 0.5)', color: '#a1a1aa', cursor: 'default' }}>
                  <Eye size={18} style={{ marginRight: '6px' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatCount(localViews)}</span>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLike(); 
                  }} 
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 16px', height: '48px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                    border: isLikedByMe ? '1px solid #ef4444' : '1px solid #27272a',
                    backgroundColor: isLikedByMe ? 'rgba(239, 68, 68, 0.15)' : '#121212',
                    color: isLikedByMe ? '#ef4444' : '#d4d4d8'
                  }}
                  onMouseOver={(e) => { if (!isLikedByMe) e.currentTarget.style.backgroundColor = '#18181b'; }}
                  onMouseOut={(e) => { if (!isLikedByMe) e.currentTarget.style.backgroundColor = '#121212'; }}
                >
                  <Heart 
                    size={18} 
                    fill={isLikedByMe ? '#ef4444' : 'none'} 
                    color={isLikedByMe ? '#ef4444' : 'currentColor'} 
                    style={{ transform: isLikedByMe ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }} 
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatCount(art.likes?.length)}</span>
                </button>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSave(); 
                  }} 
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', padding: '0 12px', height: '48px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                    border: isSavedByMe ? '1px solid #a855f7' : '1px solid #27272a',
                    backgroundColor: isSavedByMe ? 'rgba(168, 85, 247, 0.15)' : '#121212',
                    color: isSavedByMe ? '#c084fc' : '#d4d4d8'
                  }}
                  onMouseOver={(e) => { if (!isSavedByMe) e.currentTarget.style.backgroundColor = '#18181b'; }}
                  onMouseOut={(e) => { if (!isSavedByMe) e.currentTarget.style.backgroundColor = '#121212'; }}
                >
                  <Bookmark 
                    size={18} 
                    fill={isSavedByMe ? '#c084fc' : 'none'} 
                    color={isSavedByMe ? '#c084fc' : 'currentColor'}
                    style={{ transform: isSavedByMe ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }} 
                  />
                </button>

                <button 
                  onClick={() => setIsShareModalOpen(true)} 
                  title="Share Link" 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', padding: '0 12px', height: '48px', borderRadius: '12px', border: '1px solid #27272a', backgroundColor: '#121212', color: '#60a5fa', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#18181b'; e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.color = '#93c5fd'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#121212'; e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#60a5fa'; }}
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            {/* Categories */}
            {art.categories?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {art.categories.map((cat, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => { if(onCategoryClick) onCategoryClick(cat); }} 
                    style={{ padding: '4px 12px', backgroundColor: 'rgba(39, 39, 42, 0.5)', color: '#d4d4d8', border: '1px solid #3f3f46', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.2)'; e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.5)'; e.currentTarget.style.color = '#d4d4d8'; e.currentTarget.style.borderColor = '#3f3f46'; }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            
            {/* Caption */}
            {art.caption && (
              <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(39, 39, 42, 0.5)' }}>
                <ExpandableText text={art.caption} maxLength={200} onLinkClick={(url) => setPendingLink(url)} />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
              {hasCritiquedByMe ? (
                <button disabled style={{ flex: 1, minWidth: '200px', padding: '16px', backgroundColor: '#18181b', color: '#71717a', border: '1px solid #27272a', borderRadius: '12px', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'not-allowed' }}>
                  <CheckCircle size={16} /> Already Critiqued
                </button>
              ) : (
                <button 
                  onClick={handleStartCritique}
                  style={{ flex: 1, minWidth: '200px', padding: '16px', background: 'linear-gradient(to right, #2563eb, #4f46e5)', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.5)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(37,99,235,0.3)'; }}
                >
                  {art.isPredefined ? (
                    <><Target size={16} /> Start Guided Critique</>
                  ) : (
                    <><PenTool size={16} /> Visual Critique</>
                  )}
                </button>
              )}
              {critiques.length > 0 && (
                <button 
                  onClick={() => setShowHeatmap(true)} 
                  style={{ padding: '16px 24px', backgroundColor: 'rgba(127, 29, 29, 0.3)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '12px', fontWeight: 900, color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.5)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.3)'}
                >
                  <Flame size={16} /> Heatmap
                </button>
              )}
            </div>

            <div style={{ height: '1px', backgroundColor: '#27272a', width: '100%', margin: '8px 0' }}></div>

            {/* VISUAL CRITIQUES SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between' }}>
                <h3 style={{ flex: 1, color: '#60a5fa', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={14} /> Visual Critiques ({critiques.length})
                </h3>
                {critiques.length > 0 && (
                  <button 
                    onClick={() => setShowFilterPanel(!showFilterPanel)} 
                    style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa', background: 'rgba(39, 39, 42, 0.5)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}
                  >
                    {showFilterPanel ? '✕ Close Filters' : '⚙️ Sort & Filter'}
                  </button>
                )}
              </div>

              {showFilterPanel && (
                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', borderRadius: '12px', padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', animation: 'artFadeIn 0.2s ease-out' }}>
                  <input 
                    type="text" placeholder="Search critic by name..." value={searchCritic} onChange={(e) => setSearchCritic(e.target.value)} 
                    style={{ flex: 1, minWidth: '150px', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#ffffff', outline: 'none' }} 
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                  />
                  <select 
                    value={sortMode} onChange={(e) => setSortMode(e.target.value)} 
                    style={{ backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="most_annotations">Most Annotations</option>
                    <option value="least_annotations">Least Annotations</option>
                    <option value="popularity">Popularity (Likes)</option>
                  </select>
                </div>
              )}

              {loadingCritiques && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#71717a', fontSize: '13px' }}><div style={{ width: '16px', height: '16px', border: '2px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> Loading feedback...</div>}
              
              {!loadingCritiques && processedCritiques.length === 0 && (
                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px dashed #3f3f46' }}>
                  <p style={{ color: '#71717a', fontSize: '13px', margin: 0 }}>{searchCritic ? `No critiques found for "${searchCritic}".` : "No visual critiques yet."}</p>
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!loadingCritiques && displayedCritiques.map((critique) => (
                  <div 
                    key={critique._id} 
                    className="crit-card"
                    onClick={() => { 
                      if (critique.isAdult && !sessionStorage.getItem(`nsfw_crit_ack_${critique._id}`)) {
                        setNsfwCritiqueWarning(critique);
                      } else {
                        sessionStorage.setItem('triggerFeedback', 'true'); 
                        if (onCritiqueClick) { onCritiqueClick(critique); } 
                        onArtClick(critique.critiqueImageUrl, 'viewer'); 
                      }
                    }}
                    style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  >
                    <div style={{ display: 'flex', itemsCenter: 'center', justifyItems: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        
                        {/* 👉 THE FIX 1: Clickable Avatar */}
                        <div 
                          onClick={(e) => { 
                            e.stopPropagation(); // Stops the card from playing!
                            if(onArtistClick) onArtistClick(critique.critiquerId); 
                          }}
                          style={{ cursor: 'pointer', display: 'flex' }}
                        >
                          {critique.critiquerPhotoUrl ? (
                            <img src={critique.critiquerPhotoUrl} alt="Critic" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...getAvatarGlow(critique.showcasedAchievement) }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 'bold', fontSize: '12px', flexShrink: 0, ...getAvatarGlow(critique.showcasedAchievement) }}>
                              {critique.critiquerUsername ? critique.critiquerUsername.charAt(0).toUpperCase() : '?'}
                            </div>
                          )}
                        </div>

                        {/* 👉 THE FIX 2: Clickable Username with hover effect */}
                        <div 
                          onClick={(e) => { 
                            e.stopPropagation(); // Stops the card from playing!
                            if(onArtistClick) onArtistClick(critique.critiquerId); 
                          }}
                          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        >
                          <p 
                            style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: '#60a5fa', transition: 'color 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                            onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                          >
                            @{critique.critiquerUsername}
                          </p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#71717a' }}>{new Date(critique.createdAt).toLocaleDateString()}</p>
                        </div>

                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        
                        {/* 👉 The Lucide Likes Badge! */}
                        <div style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(24, 24, 27, 0.5)', padding: '4px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                          <Heart size={12} fill={critique.likes?.length > 0 ? '#ef4444' : 'none'} color={critique.likes?.length > 0 ? '#ef4444' : '#71717a'} />
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa' }}>{critique.likes?.length || 0}</span>
                        </div>

                        {/* 👉 The Lucide NSFW Badge! */}
                        {critique.isAdult && (
                          <div style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <AlertTriangle size={12} />
                            <span style={{ fontSize: '10px' }}>NSFW</span>
                          </div>
                        )}
                        
                        {/* 👉 The Lucide Play Button! */}
                        <div style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px', backgroundColor: '#27272a', color: '#d4d4d8', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', alignSelf: 'flex-start' }}>
                          <Play size={12} fill="currentColor" />
                          <span style={{ fontSize: '11px' }}>Play</span>
                        </div>
                        
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#d4d4d8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {critique.comment}
                    </p>
                  </div>
                ))}
              </div>

              {!loadingCritiques && processedCritiques.length > 2 && (
                <button 
                  onClick={() => setShowAllCritiques(!showAllCritiques)} 
                  style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#60a5fa', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'}
                >
                  {showAllCritiques ? 'Show less ▴' : `See all ${processedCritiques.length} critiques ▾`}
                </button>
              )}
            </div>

            <div style={{ height: '1px', backgroundColor: '#27272a', width: '100%', margin: '8px 0' }}></div>

            {/* COMMENTS SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageCircle size={14} /> Discussion ({allCommentsReversed.length})
                </h3>
                <button 
                  onClick={handleRefreshComments}
                  disabled={isRefreshingComments}
                  title="Refresh Comments"
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: isRefreshingComments ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => { if (!isRefreshingComments) e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; }}
                  onMouseOut={(e) => { if (!isRefreshingComments) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg style={{ width: '14px', height: '14px', animation: isRefreshingComments ? 'spinRefresh 1s linear infinite' : 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                </button>
              </div>

              {/* Comment List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px', paddingBottom: '16px' }}>
                {allCommentsReversed.length === 0 && <p style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', fontStyle: 'italic', margin: '16px 0' }}>Be the first to comment!</p>}
                
                {displayedComments.map((comment) => {
                  const isCommentLiked = currentUser ? (comment.likes || []).some(id => String(id) === String(currentUser.id)) : false;
                  const isMyComment = currentUser ? String(comment.username) === String(currentUser.username) : false; 

                  return (
                    <div id={`comment-${comment._id}`} key={comment._id} style={{ display: 'flex', gap: '12px' }}>
                      {/* Avatar */}
                      {comment.photoUrl ? (
                        <img src={comment.photoUrl} alt="User" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: '4px', ...getAvatarGlow(comment.showcasedAchievement) }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#27272a', display: 'flex', alignItems: 'center', justifyItems: 'center', color: '#a1a1aa', fontWeight: 'bold', fontSize: '12px', flexShrink: 0, marginTop: '4px', ...getAvatarGlow(comment.showcasedAchievement) }}>
                          {comment.username ? comment.username.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyItems: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span 
                              onClick={(e) => { e.stopPropagation(); if (onArtistClick) onArtistClick(comment.telegramId); }}
                              style={{ fontWeight: 'bold', fontSize: '13px', color: '#60a5fa', cursor: 'pointer' }}
                              onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                              onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                            >
                              @{comment.username}
                              <AchievementBadge achievement={comment.showcasedAchievement} />
                            </span>
                            <span style={{ fontSize: '10px', color: '#71717a' }}>{new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {activeCommentMenu === comment._id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'artZoomIn 0.2s ease-out' }}>
                                {isMyComment ? (
                                  <button onClick={() => { setActiveCommentMenu(null); setDeleteCommentTarget({ commentId: comment._id, replyId: null, isReply: false }); }} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                ) : (
                                  <button 
                                    onClick={() => { setActiveCommentMenu(null); setReportConfig({ isOpen: true, itemType: 'comment', itemId: comment._id, parentItemId: art._id, reportedUserId: comment.telegramId }); }} 
                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}><Flag size={12} /> Report</button>
                                )}
                                <button onClick={() => setActiveCommentMenu(null)} style={{ color: '#71717a', background: 'transparent', border: 'none', fontSize: '10px', fontWeight: 'bold', padding: '2px 4px', cursor: 'pointer' }}><MoreHorizontal size={16} /></button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setActiveCommentMenu(comment._id)} 
                                style={{ color: '#71717a', background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', transition: 'color 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <ExpandableText text={comment.text} maxLength={150} onLinkClick={(url) => setPendingLink(url)} />
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCommentLike(comment._id, null, comment.likes);
                            }} 
                            style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', background: 'transparent', border: 'none', cursor: 'pointer', color: isCommentLiked ? '#ef4444' : '#71717a', transition: 'color 0.2s', padding: 0 }}
                            onMouseOver={(e) => { if (!isCommentLiked) e.currentTarget.style.color = '#a1a1aa'; }}
                            onMouseOut={(e) => { if (!isCommentLiked) e.currentTarget.style.color = '#71717a'; }}
                          >
                            <Heart size={14} fill={isCommentLiked ? '#ef4444' : 'none'} color={isCommentLiked ? '#ef4444' : 'currentColor'} /> 
                            <span>{comment.likes?.length || 0}</span>
                          </button>
                          
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setReplyingTo(comment); 
                              setCommentText(`@${comment.username} `); 
                              setTimeout(() => { const el = commentInputRef.current; if(el){ el.focus({ preventScroll: true }); el.setSelectionRange(el.value.length, el.value.length); } }, 50); 
                            }} 
                            style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', color: '#71717a', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s', padding: 0 }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                          >
                            <MessageSquare size={14} /> 
                            <span>Reply</span>
                          </button>
                        </div>

                        {/* Nested Replies */}
                        {comment.replies?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', paddingLeft: '16px', borderLeft: '2px solid #27272a' }}>
                            {comment.replies.map((reply) => {
                              const isReplyLiked = currentUser ? (reply.likes || []).some(id => String(id) === String(currentUser.id)) : false;
                              const isMyReply = currentUser ? String(reply.username) === String(currentUser.username) : false;

                              return (
                                <div id={`comment-${reply._id}`} key={reply._id} style={{ display: 'flex', gap: '8px' }}>
                                  {reply.photoUrl ? (
                                    <img src={reply.photoUrl} alt="User" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...getAvatarGlow(reply.showcasedAchievement) }} />
                                  ) : (
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', fontWeight: 'bold', fontSize: '9px', flexShrink: 0, ...getAvatarGlow(reply.showcasedAchievement) }}>
                                      {reply.username ? reply.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                  )}
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                                      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                        <span 
                                          onClick={(e) => { e.stopPropagation(); if (onArtistClick) onArtistClick(reply.telegramId); }}
                                          style={{ fontWeight: 'bold', fontSize: '12px', color: '#60a5fa', cursor: 'pointer' }}
                                          onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                                          onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                                        >
                                          @{reply.username}
                                          <AchievementBadge achievement={reply.showcasedAchievement} />
                                        </span>
                                        <span style={{ fontSize: '9px', color: '#71717a' }}>{new Date(reply.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {activeCommentMenu === reply._id ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'artZoomIn 0.2s ease-out' }}>
                                            {isMyReply ? (
                                              <button onClick={() => { setActiveCommentMenu(null); setDeleteCommentTarget({ commentId: comment._id, replyId: reply._id, isReply: true }); }} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                            ) : (
                                              <button 
                                                onClick={() => { setActiveCommentMenu(null); setReportConfig({ isOpen: true, itemType: 'comment', itemId: reply._id, parentItemId: art._id, reportedUserId: reply.telegramId }); }} 
                                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}><Flag size={12} /> Report</button>
                                            )}
                                            <button onClick={() => setActiveCommentMenu(null)} style={{ color: '#71717a', background: 'transparent', border: 'none', fontSize: '10px', fontWeight: 'bold', padding: '2px 4px', cursor: 'pointer' }}><MoreHorizontal size={16} /></button>
                                          </div>
                                        ) : (
                                          <button 
                                            onClick={() => setActiveCommentMenu(reply._id)} 
                                            style={{ color: '#71717a', background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', transition: 'color 0.2s' }}
                                            onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                                            onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                              <circle cx="5" cy="12" r="2" />
                                              <circle cx="12" cy="12" r="2" />
                                              <circle cx="19" cy="12" r="2" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <ExpandableText text={reply.text} maxLength={150} onLinkClick={(url) => setPendingLink(url)} />
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleCommentLike(comment._id, reply._id, reply.likes);
                                        }} 
                                        style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold', background: 'transparent', border: 'none', cursor: 'pointer', color: isReplyLiked ? '#ef4444' : '#71717a', transition: 'color 0.2s', padding: 0 }}
                                        onMouseOver={(e) => { if (!isReplyLiked) e.currentTarget.style.color = '#a1a1aa'; }}
                                        onMouseOut={(e) => { if (!isReplyLiked) e.currentTarget.style.color = '#71717a'; }}
                                      >
                                        <Heart size={12} fill={isReplyLiked ? '#ef4444' : 'none'} color={isReplyLiked ? '#ef4444' : 'currentColor'} /> 
                                        <span>{reply.likes?.length || 0}</span>
                                      </button>
                                      
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation();
                                          setReplyingTo(comment); 
                                          setCommentText(`@${reply.username} `); 
                                          setTimeout(() => { const el = commentInputRef.current; if(el){ el.focus({ preventScroll: true }); el.setSelectionRange(el.value.length, el.value.length); } }, 50); 
                                        }} 
                                        style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold', color: '#71717a', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s', padding: 0 }}
                                        onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                                        onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                                      >
                                        <MessageSquare size={12} /> 
                                        <span>Reply</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {allCommentsReversed.length > 2 && !showAllComments && (
                <button 
                  onClick={() => setShowAllComments(true)} 
                  style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(39, 39, 42, 0.4)', color: '#a1a1aa', border: '1px solid #27272a', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '16px' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.8)'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.4)'; e.currentTarget.style.color = '#a1a1aa'; }}
                >
                  See all comments ▾
                </button>
              )}

              {/* Sticky Input Area */}
              <div style={{ position: 'sticky', bottom: 0, backgroundColor: 'rgba(9, 9, 11, 0.98)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '16px 16px calc(24px + var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px))) 16px', borderTop: '1px solid #27272a', zIndex: 50, marginTop: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {replyingTo && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(37, 99, 235, 0.15)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 'bold' }}>Replying to Thread</span>
                      <button onClick={() => { setReplyingTo(null); setCommentText(''); }} style={{ color: '#a1a1aa', background: 'transparent', border: 'none', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}><MoreHorizontal size={16} /></button>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea 
                      ref={commentInputRef} 
                      maxLength={1000}
                      value={commentText} 
                      onChange={handleCommentInput}
                      placeholder={replyingTo ? "Write a reply..." : "Leave a comment..."} 
                      style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#121212', border: '1px solid #3f3f46', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: '#ffffff', outline: 'none', resize: 'none', overflowY: 'auto', minHeight: '46px', maxHeight: '120px', fontFamily: 'inherit', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#60a5fa'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
                      rows={1}
                    />
                    <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold', padding: '0 8px', color: commentText.length >= 1000 ? '#ef4444' : '#71717a' }}>
                        {commentText.length}/1000
                      </span>
                      <button 
                        onClick={() => handlePostComment(commentText)} 
                        disabled={isSubmittingComment || !commentText.trim()} 
                        style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: (isSubmittingComment || !commentText.trim()) ? '#1e1e20' : '#2563eb', color: (isSubmittingComment || !commentText.trim()) ? '#71717a' : '#ffffff', border: (isSubmittingComment || !commentText.trim()) ? '1px solid #27272a' : 'none', padding: '8px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: (isSubmittingComment || !commentText.trim()) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', boxShadow: (isSubmittingComment || !commentText.trim()) ? 'none' : '0 4px 10px rgba(37,99,235,0.3)' }}
                        onMouseOver={(e) => { if (!isSubmittingComment && commentText.trim()) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                        onMouseOut={(e) => { if (!isSubmittingComment && commentText.trim()) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                      >
                        <Send size={14} /> 
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'artFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', animation: 'artZoomIn 0.2s ease-out', margin: 'auto' }}>
            <button 
              onClick={() => setShowFeedbackModal(false)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#71717a', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
            >
              <MoreHorizontal size={16} />
            </button>
            
            <button 
              onClick={() => setShowFeedbackModal(false)} 
              style={{ background: 'transparent', border: 'none', color: '#71717a', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#d4d4d8'}
              onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* External Link Warning Modal */}
      {pendingLink && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'artFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', animation: 'artZoomIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 179, 8, 0.2)', boxShadow: '0 0 25px rgba(234, 179, 8, 0.2)', marginBottom: '4px' }}>
                <AlertTriangle size={32} color="#eab308" />
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

      {/* Critique NSFW Interceptor Modal */}
      {nsfwCritiqueWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'artFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', animation: 'artZoomIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', marginBottom: '8px' }}>
                🔞
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Mature Content</h2>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
                This critique contains mature themes (NSFW). Are you sure you want to view it?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => { 
                  const crit = nsfwCritiqueWarning;
                  setNsfwCritiqueWarning(null);
                  sessionStorage.setItem(`nsfw_crit_ack_${crit._id}`, 'true'); 
                  sessionStorage.setItem('triggerFeedback', 'true'); 
                  if (onCritiqueClick) { onCritiqueClick(crit); } 
                  onArtClick(crit.critiqueImageUrl, 'viewer');
                }} 
                style={{ width: '100%', padding: '14px', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Show Anyway
              </button>
              <button 
                onClick={() => setNsfwCritiqueWarning(null)} 
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

      {/* Direct Link NSFW Warning Modal */}
      {showNsfwWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'artFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', animation: 'artZoomIn 0.2s ease-out' }}>
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
                  sessionStorage.setItem(`nsfw_ack_${art._id}`, 'true');
                  setShowNsfwWarning(false);
                }} 
                style={{ width: '100%', padding: '14px', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Show Anyway
              </button>
              <button 
                onClick={onClose} 
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

      <ReportModal isOpen={reportConfig.isOpen} onClose={() => setReportConfig(prev => ({ ...prev, isOpen: false }))} itemType={reportConfig.itemType} itemId={reportConfig.itemId} parentItemId={reportConfig.parentItemId} reportedUserId={reportConfig.reportedUserId} currentUser={currentUser} />
      
      {/* 👉 THE NEW REUSABLE SHARE MODAL */}
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        title="Artwork"
        // 👉 THE FIX: Changed 'art_' to 'post_' to avoid triggering the old editor logic!
        tgLink={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || 'CritiqueEngineBot'}/${process.env.NEXT_PUBLIC_BOT_APP_SHORTNAME || 'app'}?startapp=post_${art._id}`}
        webLink={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?post=${art._id}`}
        shareText={`Check out "${art.title || 'this artwork'}" by @${art.username || 'this artist'} on Critique Engine!`}
      />

      {/* 👉 THE NEW ARTWORK DELETE BANNER */}
      <DeleteConfirmBanner 
        isOpen={showDeleteConfirm} 
        onClose={() => setShowDeleteConfirm(false)} 
        onConfirm={handleDelete} 
        itemName="artwork" 
        isDeleting={isDeletingArt}
      />

      {/* 👉 THE NEW COMMENT/REPLY DELETE BANNER */}
      <DeleteConfirmBanner 
        isOpen={!!deleteCommentTarget} 
        onClose={() => setDeleteCommentTarget(null)} 
        onConfirm={confirmDeleteComment} 
        itemName={deleteCommentTarget?.isReply ? "reply" : "comment"} 
        isDeleting={isDeletingComment}
      />
    </> 
  );
}