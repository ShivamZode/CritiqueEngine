'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReportModal from './ReportModal';
import ShareModal from './ShareModal';
import DeleteConfirmBanner from './DeleteConfirmBanner';
import { 
  ArrowLeft, PenTool, Trash2, Flag, MoreHorizontal, 
  Eye, Heart, Bookmark, Share2, MessageCircle, MessageSquare, 
  Send, AlertTriangle, Sparkles, X, Play 
} from 'lucide-react';

const formatCount = (num) => {
  if (!num) return "0";
  return Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(num);
};

// Utility to find URLs and wrap them in clickable spans (Themed Green)
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
          style={{ color: '#4ade80', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
          onMouseOver={(e) => e.currentTarget.style.color = '#86efac'}
          onMouseOut={(e) => e.currentTarget.style.color = '#4ade80'}
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
        style={{ marginLeft: '8px', color: '#4ade80', background: 'transparent', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', transition: 'color 0.2s', padding: 0 }}
        onMouseOver={(e) => e.currentTarget.style.color = '#86efac'}
        onMouseOut={(e) => e.currentTarget.style.color = '#4ade80'}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </p>
  );
};

// 👉 NEW: Reusable Mini Badge that adapts to Event Difficulty!
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
const getAvatarGlow = (achievement, defaultBorder = '1px solid #3f3f46', defaultShadow = 'none') => {
  if (!achievement || !achievement.difficulty) return { border: defaultBorder, boxShadow: defaultShadow };
  
  if (achievement.difficulty.includes('Breeze')) return { border: '2px solid #4ade80', boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)' };
  if (achievement.difficulty.includes('Hustle')) return { border: '2px solid #fde047', boxShadow: '0 0 8px rgba(253, 224, 71, 0.4)' };
  if (achievement.difficulty.includes('Crucible')) return { border: '2px solid #ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)' };
  
  return { border: '2px solid #c084fc', boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }; // God-Tier 👑
};

export default function CritiqueDetail({ 
  crit, onClose, onPlay, onArtistClick, onOpenOriginalArt, 
  currentUser, onUpdateCritique, onRequireLogin,
  autoOpenComments, targetCommentId,
  userStats, setUserStats // 👉 ADDED: State trackers for Follow/Save
}) {
  const [showNsfwWarning, setShowNsfwWarning] = useState(() => {
    if (typeof window !== 'undefined') {
      // 1. Did they already acknowledge this in the Feed/Portfolio?
      const hasAcknowledged = sessionStorage.getItem(`nsfw_ack_${crit._id}`);
      
      // 2. Check if the critique or its parent art is NSFW
      const isAdult = crit.isAdult || (crit.originalArtObject && crit.originalArtObject.isAdult);

      // 3. If it's adult content and NO cookie exists, they bypassed the grid via direct link!
      return isAdult && !hasAcknowledged;
    }
    return false;
  });

  const [playNsfwWarning, setPlayNsfwWarning] = useState(false);
  const [nsfwAcknowledged, setNsfwAcknowledged] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAllComments, setShowAllComments] = useState(autoOpenComments || false);
  
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);

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

  const pendingCommentLikeClicks = useRef({}); 
  const commentLikeTimerRef = useRef({});

  const pendingSaveClicks = useRef(0);
  const saveTimerRef = useRef(null);

  const pendingFollowClicks = useRef(0);
  const followTimerRef = useRef(null);

  useEffect(() => {
    stateRef.current.showComments = showAllComments;
  }, [showAllComments]);

  useEffect(() => {
    const overlay = document.getElementById('overlay-container-top');
    const handleScroll = () => { if (overlay) stateRef.current.scroll = overlay.scrollTop; };
    
    if (overlay) overlay.addEventListener('scroll', handleScroll);

    // Restore state on mount
    const savedScroll = sessionStorage.getItem(`scroll_crit_${crit._id}`);
    const savedComments = sessionStorage.getItem(`comments_crit_${crit._id}`);
    
    if (savedComments === 'true') setShowAllComments(true);
    if (savedScroll && overlay) {
      setTimeout(() => overlay.scrollTop = parseInt(savedScroll, 10), 100);
    }

    // Save state on unmount
    return () => {
      if (overlay) overlay.removeEventListener('scroll', handleScroll);
      sessionStorage.setItem(`scroll_crit_${crit._id}`, stateRef.current.scroll);
      sessionStorage.setItem(`comments_crit_${crit._id}`, stateRef.current.showComments ? 'true' : 'false');
    };
  }, [crit._id]);

  const handleRefreshComments = async () => {
    setIsRefreshingComments(true);
    try {
      const res = await fetch(`/api/resolve?id=${crit._id}`);
      const data = await res.json();
      if (data.success && data.type === 'critique') {
        onUpdateCritique(data.item);
      }
    } catch (e) {
      console.error("Failed to refresh comments", e);
    } finally {
      setIsRefreshingComments(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingCritique, setIsDeletingCritique] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null); 
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [modalCommentText, setModalCommentText] = useState('');
  
  const [pendingLink, setPendingLink] = useState(null);

  const [reportConfig, setReportConfig] = useState({ isOpen: false, itemType: 'critique', itemId: crit._id, reportedUserId: crit.critiquerId });
  const [showMenu, setShowMenu] = useState(false); 
  const [activeCommentMenu, setActiveCommentMenu] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const initialCriticPhoto = crit.critiquerPhotoUrl || (currentUser && String(crit.critiquerId) === String(currentUser.id) ? currentUser.photoUrl : null);
  const initialArtistPhoto = crit.originalArtistPhotoUrl || (currentUser && String(crit.originalArtistId) === String(currentUser.id) ? currentUser.photoUrl : null);

  const [criticPhoto, setCriticPhoto] = useState(initialCriticPhoto);
  const [artistPhoto, setArtistPhoto] = useState(initialArtistPhoto);

  const isMyCritique = currentUser ? String(crit.critiquerId) === String(currentUser.id) : false;
  
  // 👉 NEW: Save and Follow status based on userStats
  const isSavedByMe = currentUser && userStats?.savedCritsList ? userStats.savedCritsList.some(id => String(id) === String(crit._id)) : false;
  const isFollowingCritic = currentUser && userStats?.following ? userStats.following.some(id => String(id) === String(crit.critiquerId)) : false;
  
  useEffect(() => {
    if (!criticPhoto && crit.critiquerId) {
      fetch(`/api/users/me?telegramId=${crit.critiquerId}`)
        .then(res => res.json())
        .then(data => { if (data.success && data.user.photoUrl) setCriticPhoto(data.user.photoUrl); })
        .catch(console.error);
    }
    if (!artistPhoto && crit.originalArtistId) {
      fetch(`/api/users/me?telegramId=${crit.originalArtistId}`)
        .then(res => res.json())
        .then(data => { if (data.success && data.user.photoUrl) setArtistPhoto(data.user.photoUrl); })
        .catch(console.error);
    }
  }, [crit.critiquerId, crit.originalArtistId, criticPhoto, artistPhoto]);

  useEffect(() => {
    if (sessionStorage.getItem('triggerFeedback') === 'true') {
      setShowFeedbackModal(true);
      sessionStorage.removeItem('triggerFeedback'); 
    }
  }, []);

  const [localViews, setLocalViews] = useState(crit.views || 0);

  useEffect(() => {
    const viewKey = `viewed_crit_${crit._id}`;
    if (!sessionStorage.getItem(viewKey)) {
      fetch(`/api/critiques/${crit._id}/view`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLocalViews(data.views);
            sessionStorage.setItem(viewKey, 'true'); 
          }
        }).catch(console.error);
    }
  }, [crit._id]);

  // useEffect(() => {
  //   window.history.pushState({ overlay: 'open' }, '');
  //   const handleHardwareBack = () => { onClose(); };
  //   window.addEventListener('popstate', handleHardwareBack);
  //   return () => window.removeEventListener('popstate', handleHardwareBack);
  // }, [onClose]);

  const interactionRef = useRef(null);
  const commentInputRef = useRef(null);

  const isLikedByMe = currentUser ? (crit.likes || []).includes(currentUser.id) : false;

  const getTgInitData = () => typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

  const handleToggleLike = () => {
    if (!currentUser) return onRequireLogin();
    
    const originalLikes = [...(crit.likes || [])];
    const newLikes = isLikedByMe ? originalLikes.filter(id => String(id) !== String(currentUser.id)) : [...originalLikes, currentUser.id];
    onUpdateCritique({ ...crit, likes: newLikes });
    
    pendingLikeClicks.current += 1;
    if (likeTimerRef.current) clearTimeout(likeTimerRef.current);

    likeTimerRef.current = setTimeout(async () => {
      const clicks = pendingLikeClicks.current;
      pendingLikeClicks.current = 0; 
      
      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch(`/api/critiques/${crit._id}/like`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ telegramId: currentUser.id }) 
        }); 

        if (res.status === 401) {
           onUpdateCritique({ ...crit, likes: originalLikes });
           return onRequireLogin(); 
        }
      } catch (err) {
        onUpdateCritique({ ...crit, likes: originalLikes });
      }
    }, 500); 
  };

  // 👉 NEW: Save Handler
  const handleToggleSave = () => {
    if (!currentUser || !setUserStats) return onRequireLogin();
    
    const willSave = !isSavedByMe;
    
    // 👉 Updated to use savedCritsList
    const newSaved = willSave 
      ? [...(userStats.savedCritsList || []), crit._id] 
      : (userStats.savedCritsList || []).filter(id => String(id) !== String(crit._id));
    
    setUserStats(prev => ({ ...prev, savedCritsList: newSaved }));
    
    // Dispatch a unique event for critiques so the Portfolio can catch it!
    window.dispatchEvent(new CustomEvent('crit_saved_toggled', { detail: { critique: crit, isSaved: willSave } }));
    
    pendingSaveClicks.current += 1;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const clicks = pendingSaveClicks.current;
      pendingSaveClicks.current = 0; 
      
      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch(`/api/critiques/${crit._id}/save`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ telegramId: currentUser.id }) 
        }); 

        if (res.status === 401) {
           // Revert on failure
           setUserStats(prev => ({ 
             ...prev, 
             savedCritsList: isSavedByMe 
               ? [...(userStats.savedCritsList || []), crit._id] 
               : (userStats.savedCritsList || []).filter(id => String(id) !== String(crit._id)) 
           }));
           return onRequireLogin(); 
        }
      } catch (err) {}
    }, 500);
  };

  // 👉 NEW: Follow Handler
  const handleToggleFollow = () => {
    if (!currentUser || !setUserStats) return onRequireLogin();
    
    const originalFollowing = [...userStats.following];
    const newFollowing = isFollowingCritic ? originalFollowing.filter(id => String(id) !== String(crit.critiquerId)) : [...originalFollowing, crit.critiquerId];
      
    setUserStats(prev => ({ ...prev, following: newFollowing }));
    
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
          body: JSON.stringify({ currentUserId: currentUser.id, targetUserId: crit.critiquerId }) 
        });

        if (res.status === 401) {
           setUserStats(prev => ({ ...prev, following: originalFollowing }));
           return onRequireLogin(); 
        } 
      } catch (err) {
         setUserStats(prev => ({ ...prev, following: originalFollowing }));
      }
    }, 500);
  };

  const handlePlayClick = () => {
    if (crit.isAdult && !nsfwAcknowledged) {
      setPlayNsfwWarning(true);
    } else {
      setShowFeedbackModal(true);
      onPlay(crit.critiqueImageUrl, 'viewer');
    }
  };

  const handlePostComment = async (textToPost = commentText) => {
    if (!currentUser) return onRequireLogin();

    if (!textToPost.trim() || textToPost.length > 1000) return;
    setIsSubmittingComment(true);
    let endpoint = `/api/critiques/${crit._id}/comment`;
    
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
          text: textToPost.trim(), 
          replyToCommentId: replyingTo ? replyingTo._id : null 
        })
      });

      if (res.status === 401) {
         setShowFeedbackModal(false);
         return onRequireLogin(); 
      }

      const data = await res.json();
      if (data.success) {
        onUpdateCritique({ ...crit, comments: data.comments });
        setCommentText(''); 
        setModalCommentText('');
        setReplyingTo(null); 
        setShowAllComments(true);
      } else if (res.status === 403 && data.error?.includes('banned')) {
        window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
        setShowFeedbackModal(false); 
      } else {
        if (res.status === 403 && data.error?.includes('Daily comment limit')) {
           window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
           setShowFeedbackModal(false);
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

  const handleModalDone = async () => {
    if (modalCommentText.trim() && modalCommentText.length <= 1000) {
      await handlePostComment(modalCommentText);
    }
    setShowFeedbackModal(false);
    setTimeout(() => { interactionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleToggleCommentLike = (commentId, replyId = null, currentLikes = []) => {
    if (!currentUser) return onRequireLogin();
    
    // 1. OPTIMISTIC UPDATE
    const originalComments = [...(crit.comments || [])];
    const isLiked = currentLikes.some(id => String(id) === String(currentUser.id));
    const newLikes = isLiked ? currentLikes.filter(id => String(id) !== String(currentUser.id)) : [...currentLikes, currentUser.id];
    
    const updatedComments = originalComments.map(c => {
      if (c._id === commentId) {
        if (replyId) return { ...c, replies: c.replies.map(r => r._id === replyId ? { ...r, likes: newLikes } : r) };
        return { ...c, likes: newLikes };
      }
      return c;
    });
    onUpdateCritique({ ...crit, comments: updatedComments });
    
    // 2. THE SPAM SHIELD
    const uniqueTargetId = replyId || commentId;
    if (!pendingCommentLikeClicks.current[uniqueTargetId]) pendingCommentLikeClicks.current[uniqueTargetId] = 0;
    
    pendingCommentLikeClicks.current[uniqueTargetId] += 1;
    if (commentLikeTimerRef.current[uniqueTargetId]) clearTimeout(commentLikeTimerRef.current[uniqueTargetId]);

    commentLikeTimerRef.current[uniqueTargetId] = setTimeout(async () => {
      const clicks = pendingCommentLikeClicks.current[uniqueTargetId];
      pendingCommentLikeClicks.current[uniqueTargetId] = 0; 

      if (clicks % 2 === 0) return; 

      try { 
        const res = await fetch(`/api/critiques/${crit._id}/comment/${commentId}/like`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTgInitData() || '' 
          }, 
          body: JSON.stringify({ telegramId: currentUser.id, replyId }) 
        }); 

        if (res.status === 401) {
           onUpdateCritique({ ...crit, comments: originalComments });
           return onRequireLogin(); 
        }
      } catch (err) {
        onUpdateCritique({ ...crit, comments: originalComments });
      }
    }, 500);
  };

  // 👉 THE UPGRADED COMMENT DELETE FUNCTION
  const confirmDeleteComment = async () => {
    if (!deleteCommentTarget) return;
    
    const { commentId, replyId } = deleteCommentTarget;
    setIsDeletingComment(true); // Lock the banner button
    
    // 1. OPTIMISTIC UPDATE
    const originalComments = [...(crit.comments || [])];
    const updatedComments = originalComments.map(c => {
      if (c._id === commentId) {
        if (replyId) return { ...c, replies: c.replies.filter(r => r._id !== replyId) };
        return null; 
      }
      return c;
    }).filter(Boolean); 

    onUpdateCritique({ ...crit, comments: updatedComments });
    
    // 2. SERVER FETCH
    try {
      const queryParams = new URLSearchParams({ telegramId: currentUser.id, username: currentUser.username });
      if (replyId) queryParams.append('replyId', replyId);
      
      const res = await fetch(`/api/critiques/${crit._id}/comment/${commentId}?${queryParams.toString()}`, { 
        method: 'DELETE',
        headers: { 'x-telegram-init-data': getTgInitData() || '' }
      });

      if (res.status === 401) {
         onUpdateCritique({ ...crit, comments: originalComments });
         setIsDeletingComment(false);
         setDeleteCommentTarget(null);
         return onRequireLogin(); 
      }

      const data = await res.json();
      if (!data.success) {
        onUpdateCritique({ ...crit, comments: originalComments });
        alert(data.error || "Failed to delete comment from server.");
      }
    } catch (err) { 
      onUpdateCritique({ ...crit, comments: originalComments });
      console.error("Failed to delete comment", err); 
    }
    
    // 3. CLEANUP
    setIsDeletingComment(false);
    setDeleteCommentTarget(null);
  };

  // 👉 THE STACK-AWARE DELETE FUNCTION
  const handleDeleteCritique = async () => {
    
    setIsDeletingCritique(true);

    try {
      const res = await fetch(`/api/critiques?id=${crit._id}`, { 
        method: 'DELETE', 
        headers: { 'x-telegram-init-data': window.Telegram?.WebApp?.initData || '' } 
      });
      
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent('artwork_deleted', { detail: crit._id }));
        onClose(); 
      } else {
        alert(data.error || "Failed to delete.");
        setIsDeletingCritique(false); // Unlock if it fails
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      alert("An error occurred while deleting.");
      setIsDeletingCritique(false);
      setShowDeleteConfirm(false);
    }
  };

  const allCommentsReversed = crit.comments ? [...crit.comments].reverse() : [];
  const displayedComments = showAllComments ? allCommentsReversed : allCommentsReversed.slice(0, 2);

  return (
    <>
      <style>{`
        @keyframes critFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes critZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spinRefresh { to { transform: rotate(360deg); } }
        
        .crit-layout { display: flex; flex-direction: column; gap: 24px; padding: 16px; max-width: 1400px; margin: 0 auto; position: relative; z-index: 0; }
        .crit-image-col { width: 100%; display: flex; flex-direction: column; gap: 16px; }
        .crit-info-col { width: 100%; display: flex; flex-direction: column; gap: 20px; }
        
        .action-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; width: 100%; }
        .artist-card { display: flex; align-items: center; gap: 12px; }
        .stats-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

        @media (max-width: 640px) {
          .artist-card { width: 100%; justify-content: space-between; }
          .stats-group { width: 100%; justify-content: space-between; }
          .stats-group > * { flex: 1; display: flex; justify-content: center; }
        }

        @media (min-width: 1024px) {
          .crit-layout { flex-direction: row; padding: 32px 24px; gap: 40px; align-items: flex-start; }
          .crit-image-col { width: 65%; flex-shrink: 0; position: sticky; top: 80px; align-self: flex-start; height: max-content; }
          .crit-info-col { width: 35%; flex-shrink: 0; }
        }

        .crit-image-container { position: relative; border-radius: 16px; overflow: hidden; background-color: #121212; border: 1px solid #27272a; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); cursor: pointer; display: flex; justify-content: center; align-items: center; padding: 8px; }
        
        .crit-image { width: 100%; height: auto; max-height: 85vh; object-fit: contain; border-radius: 12px; transition: filter 0.4s ease; pointer-events: none; user-select: none; -webkit-user-select: none; }
        
        .crit-play-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 140px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.3); background-color: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none; z-index: 10; }
        
        .crit-image-container:hover .crit-image { filter: brightness(0.6); }
        .crit-image-container:hover .crit-play-overlay { transform: translate(-50%, -50%) scale(1.1); background-color: rgba(22, 163, 74, 0.8); border-color: #4ade80; }
      `}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#ffffff', paddingBottom: '80px', fontFamily: 'system-ui, -apple-system, sans-serif', animation: 'critFadeIn 0.3s ease-out' }}>
        
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
            <PenTool size={16} color="#a1a1aa" />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Critique <span style={{ color: '#4ade80' }}>View</span>
            </h2>
          </div>
        </div>

        {/* Main Layout */}
        <div className="crit-layout">
          
          {/* Left: Image Column */}
          <div className="crit-image-col">
            <div className="crit-image-container" onClick={handlePlayClick}>
              <img 
                src={crit.originalImageUrl} 
                alt="Critique Cover" 
                draggable="false" 
                onContextMenu={(e) => e.preventDefault()} 
                className="crit-image" 
                style={{ 
                  filter: showNsfwWarning ? 'blur(16px) brightness(0.7)' : 'none', 
                  transition: 'filter 0.3s ease' 
                }} 
              />
              
              {crit.isAdult && (
                <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                  🔞 NSFW
                </div>
              )}
              
              {!showFeedbackModal && !showNsfwWarning && (
                <div className="crit-play-overlay">
                  <svg viewBox="0 0 160 50" style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                    <polygon points="50,15 50,35 65,25" fill="white" />
                    <text x="75" y="31" fill="white" fontSize="16" fontFamily="system-ui, sans-serif" fontWeight="900" letterSpacing="1.5">PLAY</text>
                  </svg> 
                </div>
              )}
            </div>
          </div>

          {/* Right: Info Column */}
          <div className="crit-info-col">
            
            {/* Title & Menu */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <h1 style={{ flex: 1, fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: '1.2', letterSpacing: '-0.5px' }}>
                Critique on:{' '}
                <span 
                  onClick={(e) => { 
                    e.stopPropagation();
                    if (crit.originalArtObject && onOpenOriginalArt) {
                      onOpenOriginalArt(crit.originalArtObject);
                    } else if (crit.artworkId) {
                      window.location.href = `/?art=${crit.artworkId}`;
                    }
                  }} 
                  style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'none' }}
                  onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                  onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                >
                  {crit.originalTitle}
                </span>
              </h1>
              
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {showMenu ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'critZoomIn 0.2s ease-out' }}>
                    {isMyCritique ? (
                      <button 
                        onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} 
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    ) : (
                      <button 
                        onClick={() => { setShowMenu(false); setReportConfig({ isOpen: true, itemType: 'critique', itemId: crit._id, reportedUserId: crit.critiquerId }); }} 
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                      >
                        <Flag size={14} /> Report
                      </button>
                    )}
                    <button onClick={() => setShowMenu(false)} style={{ background: 'transparent', border: 'none', color: '#71717a', fontWeight: 'bold', padding: '4px 8px', cursor: 'pointer' }}>✕</button>
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
            
            <div ref={interactionRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 👉 NEW: Action Row matching ArtDetail */}
              <div className="action-row">
                {/* Critic Card */}
                <div 
                  className="artist-card"
                  onClick={() => onArtistClick(crit.critiquerId)} 
                  style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', padding: '10px 16px 10px 10px', borderRadius: '16px', border: '1px solid rgba(22, 163, 74, 0.3)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.5)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {criticPhoto ? (
                      <img src={criticPhoto} alt="Critic" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...getAvatarGlow(crit.showcasedAchievement, '1px solid rgba(34, 197, 94, 0.5)', '0 0 10px rgba(34,197,94,0.2)') }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 'bold', fontSize: '16px', flexShrink: 0, ...getAvatarGlow(crit.showcasedAchievement, '1px solid rgba(34, 197, 94, 0.5)', '0 0 10px rgba(34,197,94,0.2)') }}>
                        {crit.critiquerUsername ? crit.critiquerUsername.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#ffffff', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                        Critiqued by:{' '}
                        <span style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'none', marginLeft: '4px' }}>
                          @{crit.critiquerUsername}
                        </span>
                        <AchievementBadge achievement={crit.showcasedAchievement} />
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 0 0' }}>
                        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Original Artist:</span>
                        <span 
                          onClick={(e) => { e.stopPropagation(); if (crit.originalArtistId) onArtistClick(crit.originalArtistId); }} 
                          style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold' }}
                          onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                          onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                        >
                          @{crit.originalArtistUsername}
                        </span>
                        <AchievementBadge achievement={crit.originalArtObject?.showcasedAchievement} />
                      </div>
                    </div>
                  </div>
                  {/* 👉 THE NEW FOLLOW BUTTON */}
                  {!isMyCritique && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleToggleFollow(); 
                      }} 
                      style={{
                        marginLeft: '8px', padding: '6px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                        backgroundColor: isFollowingCritic ? '#27272a' : '#16a34a',
                        color: isFollowingCritic ? '#a1a1aa' : '#ffffff',
                        border: isFollowingCritic ? '1px solid #3f3f46' : 'none',
                        boxShadow: isFollowingCritic ? 'none' : '0 4px 10px rgba(22, 163, 74, 0.3)'
                      }}
                      onMouseOver={(e) => { if (!isFollowingCritic) e.currentTarget.style.backgroundColor = '#15803d'; }}
                      onMouseOut={(e) => { if (!isFollowingCritic) e.currentTarget.style.backgroundColor = '#16a34a'; }}
                    >
                      {isFollowingCritic ? 'Following' : 'Follow +'}
                    </button>
                  )}
                </div>

                {/* Stats Row */}
                <div className="stats-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', height: '48px', borderRadius: '12px', border: '1px solid #27272a', backgroundColor: '#121212', color: '#a1a1aa', cursor: 'default' }}>
                    <Eye size={18} style={{ marginRight: '6px' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatCount(localViews)}</span>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike();
                    }} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '48px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                      border: isLikedByMe ? '1px solid #ef4444' : '1px solid #27272a',
                      backgroundColor: isLikedByMe ? 'rgba(239, 68, 68, 0.15)' : '#121212',
                      color: isLikedByMe ? '#ef4444' : '#d4d4d8'
                    }}
                    onMouseOver={(e) => { if (!isLikedByMe) e.currentTarget.style.backgroundColor = '#18181b'; }}
                    onMouseOut={(e) => { if (!isLikedByMe) e.currentTarget.style.backgroundColor = '#121212'; }}
                  >
                    <Heart size={18} fill={isLikedByMe ? '#ef4444' : 'none'} color={isLikedByMe ? '#ef4444' : 'currentColor'} style={{ transform: isLikedByMe ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatCount(crit.likes?.length)}</span>
                  </button>

                  {/* 👉 THE NEW SAVE BUTTON */}
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
                    <Bookmark size={18} fill={isSavedByMe ? '#c084fc' : 'none'} color={isSavedByMe ? '#c084fc' : 'currentColor'} style={{ transform: isSavedByMe ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }} />
                  </button>
                  
                  <button 
                    onClick={() => setIsShareModalOpen(true)} 
                    title="Share Link" 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', border: '1px solid #27272a', backgroundColor: '#121212', color: '#4ade80', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#18181b'; e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.color = '#86efac'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#121212'; e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#4ade80'; }}
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Critique Comment */}
            {crit.comment && (
              <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(39, 39, 42, 0.5)' }}>
                <ExpandableText text={crit.comment} maxLength={200} onLinkClick={(url) => setPendingLink(url)} />
              </div>
            )}
            
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
                {allCommentsReversed.length === 0 && <p style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', fontStyle: 'italic', margin: '16px 0' }}>Discuss this critique!</p>}
                
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
                              style={{ fontWeight: 'bold', fontSize: '13px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'critZoomIn 0.2s ease-out' }}>
                                {isMyComment ? (
                                  <button onClick={() => { setActiveCommentMenu(null); setDeleteCommentTarget({ commentId: comment._id, replyId: null, isReply: false }); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    <Trash2 size={10} /> Delete
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => { setActiveCommentMenu(null); setReportConfig({ isOpen: true, itemType: 'comment', itemId: comment._id, parentItemId: crit._id, reportedUserId: comment.telegramId }); }} 
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    <Flag size={10} /> Report
                                  </button>
                                )}
                                <button onClick={() => setActiveCommentMenu(null)} style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', fontSize: '10px', fontWeight: 'bold', padding: '2px 4px', cursor: 'pointer' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setActiveCommentMenu(comment._id)} 
                                style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', transition: 'color 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                              >
                                <MoreHorizontal size={14} />
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
                                  {/* 👉 FIX: ADDED GLOW TO REPLY AVATAR */}
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
                                          style={{ fontWeight: 'bold', fontSize: '12px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                          onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#93c5fd'; }}
                                          onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#60a5fa'; }}
                                        >
                                          @{reply.username}
                                          {/* 👉 FIX: ADDED BADGE TO REPLY USERNAME */}
                                          <AchievementBadge achievement={reply.showcasedAchievement} />
                                        </span>
                                        <span style={{ fontSize: '9px', color: '#71717a' }}>{new Date(reply.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {activeCommentMenu === reply._id ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', animation: 'critZoomIn 0.2s ease-out' }}>
                                            {isMyReply ? (
                                              <button onClick={() => { setActiveCommentMenu(null); setDeleteCommentTarget({ commentId: comment._id, replyId: reply._id, isReply: true }); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <Trash2 size={10} /> Delete
                                              </button>
                                            ) : (
                                              <button 
                                                onClick={() => { setActiveCommentMenu(null); setReportConfig({ isOpen: true, itemType: 'comment', itemId: reply._id, parentItemId: crit._id, reportedUserId: reply.telegramId }); }} 
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                <Flag size={10} /> Report
                                              </button>
                                            )}
                                            <button onClick={() => setActiveCommentMenu(null)} style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', fontSize: '10px', fontWeight: 'bold', padding: '2px 4px', cursor: 'pointer' }}>
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ) : (
                                          <button 
                                            onClick={() => setActiveCommentMenu(reply._id)} 
                                            style={{ display: 'flex', color: '#71717a', background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', transition: 'color 0.2s' }}
                                            onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                                            onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                                          >
                                            <MoreHorizontal size={14} />
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
                      <button onClick={() => { setReplyingTo(null); setCommentText(''); }} style={{ color: '#a1a1aa', background: 'transparent', border: 'none', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}>✕</button>
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
                      onFocus={(e) => e.currentTarget.style.borderColor = '#4ade80'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                      rows={1}
                    />
                    <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold', padding: '0 8px', color: commentText.length >= 1000 ? '#ef4444' : '#71717a' }}>
                        {commentText.length}/1000
                      </span>
                      <button 
                        onClick={() => handlePostComment(commentText)} 
                        disabled={isSubmittingComment || !commentText.trim()} 
                        style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: (isSubmittingComment || !commentText.trim()) ? '#1e1e20' : '#15803d', color: (isSubmittingComment || !commentText.trim()) ? '#71717a' : '#ffffff', border: (isSubmittingComment || !commentText.trim()) ? '1px solid #27272a' : 'none', padding: '8px 24px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: (isSubmittingComment || !commentText.trim()) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', boxShadow: (isSubmittingComment || !commentText.trim()) ? 'none' : '0 4px 10px rgba(22, 163, 74, 0.3)' }}
                        onMouseOver={(e) => { if (!isSubmittingComment && commentText.trim()) e.currentTarget.style.backgroundColor = '#166534'; }}
                        onMouseOut={(e) => { if (!isSubmittingComment && commentText.trim()) e.currentTarget.style.backgroundColor = '#15803d'; }}
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

      {/* Play Warning Modal for NSFW Critiques */}
      {playNsfwWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'critFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', marginBottom: '8px' }}>
                🔞
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Mature Content</h2>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
                This critique contains mature themes. Are you sure you want to view it?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => { 
                  setNsfwAcknowledged(true);
                  setPlayNsfwWarning(false);
                  setShowFeedbackModal(true); 
                  onPlay(crit.critiqueImageUrl, 'viewer');
                }} 
                style={{ width: '100%', padding: '14px', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Yes, Play Critique
              </button>
              <button 
                onClick={() => setPlayNsfwWarning(false)} 
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

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'critFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', animation: 'critZoomIn 0.2s ease-out', margin: 'auto' }}>
            <button 
              onClick={() => setShowFeedbackModal(false)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#71717a', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
            >
              ✕
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', marginTop: '8px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '1px solid rgba(34, 197, 94, 0.2)', boxShadow: '0 0 25px rgba(34,197,94,0.2)', marginBottom: '8px', paddingLeft: '14px' }}>
                <Sparkles size={32} color="#4ade80" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>Was this helpful?</h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>Support <strong style={{ color: '#ffffff' }}>@{crit.critiquerUsername}</strong> by leaving a like and a comment!</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLike();
                }} 
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  border: isLikedByMe ? '1px solid #ef4444' : '1px solid #3f3f46',
                  backgroundColor: isLikedByMe ? 'rgba(239, 68, 68, 0.15)' : '#18181b',
                  color: isLikedByMe ? '#ef4444' : '#ffffff',
                  boxShadow: isLikedByMe ? '0 0 15px rgba(239, 68, 68, 0.2)' : '0 4px 10px rgba(0,0,0,0.2)'
                }}
                onMouseOver={(e) => { if (!isLikedByMe) e.currentTarget.style.backgroundColor = '#27272a'; }}
                onMouseOut={(e) => { if (!isLikedByMe) e.currentTarget.style.backgroundColor = '#18181b'; }}
              >
                <span style={{ transform: isLikedByMe ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }}>{isLikedByMe ? '❤️' : '🤍'}</span>
                {isLikedByMe ? 'Liked!' : 'Like Critique'}
              </button>
              
              <textarea 
                maxLength={1000} 
                value={modalCommentText} 
                onChange={(e) => setModalCommentText(e.target.value)} 
                placeholder="Add a comment..." 
                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '12px', padding: '14px', color: '#ffffff', fontSize: '13px', outline: 'none', resize: 'none', height: '96px', fontFamily: 'inherit', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }} 
                onFocus={(e) => e.currentTarget.style.borderColor = '#4ade80'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
              />
            </div>
            
            <button 
              disabled={isSubmittingComment} 
              onClick={handleModalDone} 
              style={{
                width: '100%', padding: '14px', backgroundColor: isSubmittingComment ? '#1e1e20' : '#16a34a', border: isSubmittingComment ? '1px solid #27272a' : 'none', color: isSubmittingComment ? '#71717a' : '#ffffff', fontWeight: 900, borderRadius: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', cursor: isSubmittingComment ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', boxShadow: isSubmittingComment ? 'none' : '0 4px 15px rgba(22, 163, 74, 0.3)'
              }}
              onMouseOver={(e) => { if (!isSubmittingComment) e.currentTarget.style.backgroundColor = '#15803d'; }}
              onMouseOut={(e) => { if (!isSubmittingComment) e.currentTarget.style.backgroundColor = '#16a34a'; }}
            >
              {isSubmittingComment ? 'Saving...' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* External Link Warning Modal */}
      {pendingLink && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'critFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', animation: 'critZoomIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '1px solid rgba(234, 179, 8, 0.2)', boxShadow: '0 0 25px rgba(234, 179, 8, 0.2)', marginBottom: '4px' }}>
                ⚠️
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>External Link Warning</h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                You are about to leave Critique Engine and visit an external website. This content is not controlled or maintained by the platform.
              </p>
              <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '8px', padding: '12px', width: '100%', marginTop: '4px', wordBreak: 'break-all' }}>
                <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 'bold' }}>{pendingLink}</span>
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
                style={{ flex: 1, padding: '12px', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '13px', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.3)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
              >
                Proceed
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
                This critique (or the original artwork) has been flagged as containing mature themes (NSFW). It may not be suitable for all audiences.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => {
                  sessionStorage.setItem(`nsfw_ack_${crit._id}`, 'true');
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
        title="Critique"
        tgLink={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || 'CritiqueEngineBot'}/${process.env.NEXT_PUBLIC_BOT_APP_SHORTNAME || 'app'}?startapp=crit_${crit._id}`}
        webLink={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?critique=${crit._id}`}
        shareText={`Check out this critique by @${crit.critiquerUsername} on "${crit.originalTitle || 'this artwork'}" on Critique Engine!`}
      />

      {/* 1. The Main Critique Delete Banner */}
      <DeleteConfirmBanner 
        isOpen={showDeleteConfirm} 
        onClose={() => setShowDeleteConfirm(false)} 
        onConfirm={handleDeleteCritique} 
        itemName="critique" 
        isDeleting={isDeletingCritique}
      />

      {/* 👉 2. The Comment & Reply Delete Banner */}
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