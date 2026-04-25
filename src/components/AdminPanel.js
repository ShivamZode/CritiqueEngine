'use client';

import React, { useState, useEffect, useMemo } from 'react';

export default function AdminPanel({ currentUser, onBack, onArtistClick }) {
  const [activeTab, setActiveTab] = useState('reports'); 
  const [reportSort, setReportSort] = useState('most_reported'); 
  
  // 👉 NEW: Report Filtering & View States
  const [reportViewMode, setReportViewMode] = useState('items'); // 'items' or 'users'
  const [reportSearchId, setReportSearchId] = useState('');

  const [competitions, setCompetitions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [referenceImage, setReferenceImage] = useState(null);
  const [rules, setRules] = useState(''); 
  const [difficulty, setDifficulty] = useState('Breeze 🌱');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(''); 

  const [rankingModal, setRankingModal] = useState({ isOpen: false, comp: null, artworks: [], rankings: {} });

  const [banModal, setBanModal] = useState({ isOpen: false, targetUserId: null, targetName: '', itemType: '', itemSnippet: '', itemTitle: '' });
  const [banDuration, setBanDuration] = useState('24'); 
  const [banTypes, setBanTypes] = useState({ upload: true, comment: true, critique: true, report: true });
  const [banReasonType, setBanReasonType] = useState('auto');
  const [customBanReason, setCustomBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  const [legalType, setLegalType] = useState('terms');
  const [legalPoints, setLegalPoints] = useState([]);
  const [isLegalLoading, setIsLegalLoading] = useState(false);
  const [isLegalSaving, setIsLegalSaving] = useState(false);

  const [adminAuth, setAdminAuth] = useState({ isOpen: false, password: '', error: '', actionCallback: null });

  const confirmAction = (callback) => {
    setAdminAuth({ isOpen: true, password: '', error: '', actionCallback: callback });
  };

  const handleAuthSubmit = () => {
    if (!adminAuth.password) return setAdminAuth(prev => ({ ...prev, error: "Password required" }));
    const pwd = adminAuth.password;
    const cb = adminAuth.actionCallback;
    setAdminAuth({ isOpen: false, password: '', error: '', actionCallback: null });
    cb(pwd); 
  };

  const fetchLegalDoc = async (type) => {
    setIsLegalLoading(true);
    try {
      const res = await fetch(`/api/legal?type=${type}`);
      const data = await res.json();
      if (data.success && data.doc && data.doc.content) {
        try { setLegalPoints(JSON.parse(data.doc.content)); } 
        catch(e) { setLegalPoints([]); }
      } else { setLegalPoints([]); }
    } catch(e) { console.error(e); }
    finally { setIsLegalLoading(false); }
  };

  useEffect(() => { if (activeTab === 'legal') fetchLegalDoc(legalType); }, [activeTab, legalType]);

  const handleSaveLegal = async () => {
    // 👉 Removed window.confirm
    confirmAction(async (adminPassword) => {
      setIsLegalSaving(true);
      try {
        const res = await fetch('/api/legal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) },
          body: JSON.stringify({ telegramId: currentUser.id, type: legalType, content: JSON.stringify(legalPoints) })
        });
        const data = await res.json();
        if(data.success) alert("Legal document updated successfully! All users have been reset.");
        else alert(data.error || "Failed to save.");
      } catch(e) { alert("Network Error saving document."); }
      finally { setIsLegalSaving(false); }
    });
  };

  useEffect(() => { 
    if (activeTab === 'competitions') fetchCompetitions();
    if (activeTab === 'reports') fetchReports();
  }, [activeTab]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports', { headers: { 'x-admin-id': currentUser.id } });
      const data = await res.json();
      if (data.success) setReports(data.reports);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleReportAction = async (reportId, action, reportedItemId) => {
    const isDismissAll = action === 'dismiss_all';
    // 👉 Removed window.confirms
    confirmAction(async (adminPassword) => {
      try {
        if (isDismissAll) {
          const groupReports = reports.filter(r => r.reportedItemId === reportedItemId);
          for (const r of groupReports) {
            await fetch(`/api/admin/reports?reportId=${r._id}&action=dismiss`, { method: 'DELETE', headers: { 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) } });
          }
          setReports(prev => prev.filter(r => r.reportedItemId !== reportedItemId));
        } else {
          const res = await fetch(`/api/admin/reports?reportId=${reportId}&action=${action}`, { method: 'DELETE', headers: { 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) } });
          const data = await res.json();
          if (data.success) setReports(prev => prev.filter(r => r.reportedItemId !== reportedItemId));
          else alert(data.error); 
        }
      } catch (err) { alert("Action failed."); }
    });
  };

  const handleBanSubmit = async () => {
    if (banModal.targetUserId === currentUser.id) return alert("You cannot ban yourself, oh Mighty One.");
    // 👉 Removed window.confirm
    confirmAction(async (adminPassword) => {
      setIsBanning(true);
      
      const isMultiple = banModal.itemType === 'multiple';
      const autoReasonText = isMultiple 
        ? "Violation of community guidelines across multiple items." 
        : `Violation of community guidelines regarding ${banModal.itemType}.`;
      
      const finalReason = banReasonType === 'auto' ? autoReasonText : customBanReason;
      let finalContext = '';
      if (banModal.itemType === 'artwork') finalContext = `Artwork: "${banModal.itemTitle}"`;
      else if (banModal.itemType === 'critique') finalContext = `Critique on Artwork: "${banModal.itemTitle}"\nCritique text: "${banModal.itemSnippet}"`;
      else if (banModal.itemType === 'comment') finalContext = `Comment on "${banModal.itemTitle}"\nComment text: "${banModal.itemSnippet}"`;
      else if (isMultiple) finalContext = `Multiple violations recorded across profile.`;

      try {
        const res = await fetch('/api/admin/ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) },
          body: JSON.stringify({ telegramId: banModal.targetUserId, durationHours: parseInt(banDuration), privileges: banTypes, reason: finalReason, contextInfo: finalContext })
        });
        const data = await res.json();
        if (data.success) {
          alert(`${banModal.targetName} has been successfully restricted.`);
          setBanModal({ isOpen: false, targetUserId: null, targetName: '', itemType: '', itemSnippet: '', itemTitle: '' });
        } else alert(data.error || "Failed to apply ban.");
      } catch (err) { alert("Network error occurred while banning."); } 
      finally { setIsBanning(false); }
    });
  };

  const fetchCompetitions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/competitions', { headers: { 'x-admin-id': currentUser.id } });
      const data = await res.json();
      if (data.success) setCompetitions(data.competitions);
    } catch (err) {} finally { setLoading(false); }
  };

  const uploadToTempfile = async (fileObj) => {
    const formData = new FormData();
    formData.append('file', fileObj);
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Tempfile upload failed");
    const data = await res.json();
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  };

  const handleCreateCompetition = async (e) => {
    e.preventDefault();
    confirmAction(async (adminPassword) => {
      setIsSubmitting(true);
      setUploadPhase('Preparing...');
      try {
        let tempImageUrl = null;
        if (referenceImage) {
          setUploadPhase('Uploading to Temp Server...');
          tempImageUrl = await uploadToTempfile(referenceImage);
        }
        setUploadPhase('Securing & Saving to Database...');
        const res = await fetch('/api/admin/competitions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) },
          body: JSON.stringify({ name, hashtag, startTime: new Date(startTime), endTime: new Date(endTime), rules, tempImageUrl, difficulty })
        });
        const data = await res.json();
        if (data.success) {
          alert("Competition Declared!");
          setName(''); setHashtag(''); setStartTime(''); setEndTime(''); setRules(''); setReferenceImage(null); setDifficulty('Breeze 🌱');
          fetchCompetitions();
        } else { alert(data.error); }
      } catch (err) { alert("Error: " + err.message); } finally { setIsSubmitting(false); setUploadPhase(''); }
    });
  };

  const toggleStatus = async (id, currentStatus) => {
    // 👉 Removed window.confirm
    confirmAction(async (adminPassword) => {
      try {
        const res = await fetch('/api/admin/competitions', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) },
          body: JSON.stringify({ action: 'toggleStatus', id, isActive: !currentStatus })
        });
        const data = await res.json();
        if (data.success) fetchCompetitions(); else alert(data.error);
      } catch (err) {}
    });
  };

  const openRankingModal = async (comp) => {
    setUploadPhase('Fetching entries...');
    try {
      const cleanTag = comp.hashtag.replace('#', '').trim();
      const res = await fetch(`/api/competition?tag=${encodeURIComponent(cleanTag)}`);
      const data = await res.json();
      
      if (data.success) {
        const initialRankings = {};
        // 👉 THE FIX: Start everyone blank. Only the ones you type a number for will win!
        data.artworks.forEach(a => initialRankings[a._id] = ''); 
        setRankingModal({ isOpen: true, comp, artworks: data.artworks, rankings: initialRankings });
      } else { alert(`Server Error: ${data.error}`); }
    } catch(e) { alert(`Network error: Could not fetch entries. ${e.message}`); } 
    finally { setUploadPhase(''); }
  };

  const submitRankings = async () => {
    // 👉 Removed window.confirm
    confirmAction(async (adminPassword) => {
      const formattedRankings = Object.entries(rankingModal.rankings)
        .filter(([_, rank]) => rank !== '' && rank !== null)
        .map(([artworkId, rank]) => ({ artworkId, rank: Number(rank) }));
      try {
        const res = await fetch('/api/admin/competitions', {
          method: 'PATCH', headers: {'Content-Type': 'application/json', 'x-admin-id': currentUser.id, 'x-admin-password': encodeURIComponent(adminPassword) },
          body: JSON.stringify({ action: 'declareResults', id: rankingModal.comp._id, rankings: formattedRankings })
        });
        const data = await res.json();
        if (data.success) {
          setRankingModal({ isOpen: false, comp: null, artworks: [], rankings: {} });
          fetchCompetitions();
          alert("Results Declared Successfully!");
        } else { alert(data.error); }
      } catch(e) { alert("Failed to save rankings"); }
    });
  };

  // 👉 NEW: Aggregate Reports by User
  const userReportStats = useMemo(() => {
    const users = {};
    reports.forEach(r => {
      if (!users[r.reportedUserId]) {
        users[r.reportedUserId] = {
          telegramId: r.reportedUserId,
          displayName: r.reportedUserDisplayName,
          total: 0,
          artwork: 0,
          critique: 0,
          comment: 0,
          uniqueItemIds: new Set()
        };
      }
      users[r.reportedUserId].total += 1;
      users[r.reportedUserId].uniqueItemIds.add(r.reportedItemId);
      if (r.itemType === 'artwork') users[r.reportedUserId].artwork += 1;
      if (r.itemType === 'critique') users[r.reportedUserId].critique += 1;
      if (r.itemType === 'comment') users[r.reportedUserId].comment += 1;
    });

    let arr = Object.values(users);
    if (reportSearchId.trim()) {
       arr = arr.filter(u => u.telegramId.includes(reportSearchId.trim()));
    }
    return arr.sort((a, b) => b.total - a.total); // Sort by total reports descending
  }, [reports, reportSearchId]);

  // 👉 UPDATED: Aggregate Reports by Item, respecting the Search Filter
  const groupedReports = useMemo(() => {
    const groups = {};
    
    const filteredReports = reportSearchId.trim() 
      ? reports.filter(r => r.reportedUserId.includes(reportSearchId.trim()))
      : reports;

    filteredReports.forEach(report => {
      if (!groups[report.reportedItemId]) {
        groups[report.reportedItemId] = {
          reportedItemId: report.reportedItemId,
          itemType: report.itemType,
          itemTitle: report.itemTitle,
          itemImageUrl: report.itemImageUrl,
          itemSnippet: report.itemSnippet,
          itemLink: report.itemLink,
          reportedUserId: report.reportedUserId,
          reportedUserDisplayName: report.reportedUserDisplayName,
          latestDate: new Date(report.createdAt).getTime(),
          reportsList: []
        };
      }
      groups[report.reportedItemId].reportsList.push(report);
      
      const reportTime = new Date(report.createdAt).getTime();
      if (reportTime > groups[report.reportedItemId].latestDate) {
         groups[report.reportedItemId].latestDate = reportTime;
      }
    });

    const groupsArray = Object.values(groups);

    if (reportSort === 'most_reported') {
      return groupsArray.sort((a, b) => b.reportsList.length - a.reportsList.length);
    } else {
      return groupsArray.sort((a, b) => b.latestDate - a.latestDate);
    }
  }, [reports, reportSort, reportSearchId]);

  if (!currentUser?.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '48px', margin: 0, filter: 'drop-shadow(0 0 20px rgba(239,68,68,0.5))' }}>⛔</h1>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Access Denied</h2>
          <button 
            onClick={onBack} 
            style={{ marginTop: '8px', backgroundColor: '#27272a', border: '1px solid #3f3f46', padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', color: '#ffffff', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes adminFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes adminZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes adminSpin { to { transform: rotate(360deg); } }

        .admin-layout { display: flex; flex-direction: column; gap: 32px; width: 100%; max-width: 1200px; margin: 0 auto; padding: 24px 16px; box-sizing: border-box; }
        .admin-col-1 { width: 100%; display: flex; flex-direction: column; gap: 24px; }
        .admin-col-2 { width: 100%; display: flex; flex-direction: column; gap: 24px; }

        .report-card { display: flex; flex-direction: column; gap: 20px; background-color: #121212; border-radius: 16px; padding: 20px; }
        .report-img-col { width: 100%; border-bottom: 1px solid #27272a; padding-bottom: 16px; display: flex; flex-direction: column; gap: 12px; flex-shrink: 0; }
        .report-info-col { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }

        @media (min-width: 768px) {
          .report-card { flex-direction: row; }
          .report-img-col { width: 33%; border-bottom: none; border-right: 1px solid #27272a; padding-bottom: 0; padding-right: 20px; }
        }

        @media (min-width: 1024px) {
          .admin-layout { flex-direction: row; padding: 40px 24px; }
          .admin-col-1 { width: 35%; flex-shrink: 0; }
          .admin-col-2 { width: 65%; flex-shrink: 0; }
        }

        .admin-input { width: 100%; box-sizing: border-box; background-color: #09090b; border: 1px solid #3f3f46; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #ffffff; outline: none; transition: border-color 0.2s; }
        .admin-input:focus { border-color: #3b82f6; }
        
        .admin-label { font-size: 10px; font-weight: bold; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
      `}</style>

      {/* Universal Admin Password Modal */}
      {adminAuth.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000000, backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'adminFadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', width: '100%', maxWidth: '340px', borderRadius: '24px', padding: '32px 24px', border: '1px solid #ef4444', boxShadow: '0 0 50px rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'adminZoomIn 0.2s ease-out' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px', filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.5))' }}>🔒</div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444', margin: 0, letterSpacing: '-0.5px' }}>Authentication Required</h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '8px 0 0 0', lineHeight: '1.5' }}>Please enter your Web Password to authorize this destructive action.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="password" autoFocus placeholder="Enter admin password..."
                value={adminAuth.password} 
                onChange={(e) => setAdminAuth(prev => ({...prev, password: e.target.value, error: ''}))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuthSubmit(); }}
                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#121212', border: '1px solid #3f3f46', borderRadius: '12px', padding: '14px', color: '#ffffff', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
              />
              {adminAuth.error && <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#f87171', margin: 0, textAlign: 'center' }}>{adminAuth.error}</p>}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setAdminAuth({ isOpen: false, password: '', error: '', actionCallback: null })}
                style={{ flex: 1, padding: '14px', backgroundColor: '#27272a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAuthSubmit}
                style={{ flex: 1, padding: '14px', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 900, borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#ffffff', paddingBottom: '80px', fontFamily: 'system-ui, -apple-system, sans-serif', animation: 'adminFadeIn 0.3s ease-out' }}>
        
        <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(9, 9, 11, 0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid #27272a', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
            <button 
              onClick={onBack} 
              style={{ padding: '8px 16px', backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', fontWeight: 'bold', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', transition: 'background-color 0.2s', flexShrink: 0 }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
            >
              ◀ Exit God Mode
            </button>
          </div>
          
          <h1 style={{ fontSize: '16px', fontWeight: 900, color: '#ef4444', letterSpacing: '2px', margin: 0, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px' }}>
            👑 God Mode
          </h1>
          
          <div style={{ flex: 1, minWidth: 0 }}></div>
        </div>

        <div style={{ display: 'flex', backgroundColor: '#09090b', borderBottom: '1px solid #27272a', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <button 
            onClick={() => setActiveTab('reports')} 
            style={{ flex: 1, minWidth: 'max-content', padding: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', transition: 'all 0.2s', cursor: 'pointer', border: 'none', borderBottom: activeTab === 'reports' ? '2px solid #ef4444' : '2px solid transparent', backgroundColor: activeTab === 'reports' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'reports' ? '#ef4444' : '#71717a' }}
            onMouseOver={(e) => { if(activeTab !== 'reports') e.currentTarget.style.color = '#d4d4d8'; }}
            onMouseOut={(e) => { if(activeTab !== 'reports') e.currentTarget.style.color = '#71717a'; }}
          >
            🚩 Pending Reports ({activeTab === 'reports' && !loading ? reports.length : '~'})
          </button>
          <button 
            onClick={() => setActiveTab('competitions')} 
            style={{ flex: 1, minWidth: 'max-content', padding: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', transition: 'all 0.2s', cursor: 'pointer', border: 'none', borderBottom: activeTab === 'competitions' ? '2px solid #3b82f6' : '2px solid transparent', backgroundColor: activeTab === 'competitions' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: activeTab === 'competitions' ? '#60a5fa' : '#71717a' }}
            onMouseOver={(e) => { if(activeTab !== 'competitions') e.currentTarget.style.color = '#d4d4d8'; }}
            onMouseOut={(e) => { if(activeTab !== 'competitions') e.currentTarget.style.color = '#71717a'; }}
          >
            🏆 Competitions
          </button>
          <button 
            onClick={() => setActiveTab('legal')} 
            style={{ flex: 1, minWidth: 'max-content', padding: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', transition: 'all 0.2s', cursor: 'pointer', border: 'none', borderBottom: activeTab === 'legal' ? '2px solid #eab308' : '2px solid transparent', backgroundColor: activeTab === 'legal' ? 'rgba(234, 179, 8, 0.1)' : 'transparent', color: activeTab === 'legal' ? '#facc15' : '#71717a' }}
            onMouseOver={(e) => { if(activeTab !== 'legal') e.currentTarget.style.color = '#d4d4d8'; }}
            onMouseOut={(e) => { if(activeTab !== 'legal') e.currentTarget.style.color = '#71717a'; }}
          >
            ⚖️ Policies
          </button>
        </div>

        <div className="admin-layout">
          
          {activeTab === 'reports' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* 👉 NEW: Universal Filter & View Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', backgroundColor: '#121212', padding: '12px 16px', borderRadius: '12px', border: '1px solid #27272a' }}>
                <input 
                  type="text" 
                  placeholder="Filter by Telegram ID..." 
                  value={reportSearchId} 
                  onChange={(e) => setReportSearchId(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none' }} 
                  onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                />
                
                <div style={{ display: 'flex', backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #3f3f46', overflow: 'hidden', flexShrink: 0 }}>
                  <button 
                    onClick={() => setReportViewMode('items')} 
                    style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: reportViewMode === 'items' ? 'rgba(239, 68, 68, 0.2)' : 'transparent', color: reportViewMode === 'items' ? '#ef4444' : '#71717a', transition: 'all 0.2s' }}
                  >
                    View Items
                  </button>
                  <button 
                    onClick={() => setReportViewMode('users')} 
                    style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: reportViewMode === 'users' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: reportViewMode === 'users' ? '#60a5fa' : '#71717a', transition: 'all 0.2s' }}
                  >
                    View Users
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div style={{ width: '32px', height: '32px', border: '4px solid rgba(239, 68, 68, 0.2)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'adminSpin 1s linear infinite' }}></div>
                </div>
              ) : reportViewMode === 'items' ? (
                // --- ITEM VIEW MODE ---
                <>
                  {groupedReports.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#a1a1aa' }}>Filtered Items: {groupedReports.length}</span>
                      <select 
                        value={reportSort} 
                        onChange={(e) => setReportSort(e.target.value)}
                        style={{ backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        <option value="most_reported">🔥 Most Reported</option>
                        <option value="recent">🕒 Most Recent</option>
                      </select>
                    </div>
                  )}

                  {groupedReports.length === 0 ? (
                    <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '16px', padding: '40px 20px', textAlign: 'center' }}>
                      <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🛡️</span>
                      <h3 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 900, margin: '0 0 8px 0' }}>No pending reports</h3>
                      <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0 }}>The community is safe and sound!</p>
                    </div>
                  ) : (
                    groupedReports.map(group => (
                      <div key={group.reportedItemId} className="report-card" style={{ border: group.reportsList.length >= 3 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #27272a', boxShadow: group.reportsList.length >= 3 ? '0 0 20px rgba(239, 68, 68, 0.1)' : '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                        <div className="report-img-col">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 'bold', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {group.itemType}
                            </span>
                            <span style={{ backgroundColor: group.reportsList.length >= 3 ? '#ef4444' : '#3f3f46', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              🚨 {group.reportsList.length} Reports
                            </span>
                            <span style={{ color: '#71717a', fontSize: '11px', fontWeight: 'bold' }}>Last: {new Date(group.latestDate).toLocaleString()}</span>
                          </div>
                          
                          {group.itemImageUrl ? (
                            <div style={{ position: 'relative', width: '100%', height: '140px', backgroundColor: '#09090b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <img src={group.itemImageUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              <a href={group.itemImageUrl} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '6px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#000'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.7)'}>🔍</a>
                            </div>
                          ) : (
                            <div style={{ width: '100%', height: '60px', backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '12px', fontStyle: 'italic', fontWeight: 'bold' }}>
                              Image deleted or unavailable
                            </div>
                          )}
                          
                          {group.itemSnippet && (
                            <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '12px', border: '1px solid #27272a' }}>
                              <p style={{ fontSize: '12px', color: '#a1a1aa', fontFamily: 'monospace', fontStyle: 'italic', wordBreak: 'break-word', margin: 0, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{group.itemSnippet}"</p>
                            </div>
                          )}
                        </div>

                        <div className="report-info-col">
                          <div>
                            <div style={{ marginBottom: '16px', maxHeight: '150px', overflowY: 'auto', paddingRight: '8px' }}>
                              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' }}>Report Details</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {group.reportsList.map(r => (
                                  <div key={r._id} style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                      <span style={{ color: '#f87171', fontWeight: 900, fontSize: '13px' }}>{r.reason}</span>
                                      <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold' }}>by @{r.reporterUsername}</span>
                                    </div>
                                    {r.customText && <p style={{ fontSize: '12px', color: '#d4d4d8', fontStyle: 'italic', margin: '2px 0 0 0' }}>"{r.customText}"</p>}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', backgroundColor: '#09090b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Suspect (Target)</p>
                                  <button 
                                    onClick={() => { if(onArtistClick) onArtistClick(group.reportedUserId); }} 
                                    style={{ background: 'transparent', border: 'none', padding: 0, color: '#ffffff', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', transition: 'color 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#60a5fa'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#ffffff'}
                                  >
                                    {group.reportedUserDisplayName} <span style={{ color: '#71717a', fontWeight: 'normal', fontSize: '11px' }}>@{group.reportedUserId}</span>
                                  </button>
                                </div>
                                {group.itemLink && (
                                  <a 
                                    href={group.itemLink} target="_blank" rel="noopener noreferrer" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(30, 58, 138, 0.3)', color: '#60a5fa', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid rgba(59, 130, 246, 0.3)', transition: 'all 0.2s' }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.5)'; e.currentTarget.style.color = '#93c5fd'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.3)'; e.currentTarget.style.color = '#60a5fa'; }}
                                  >
                                    🔗 View Post
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            <button 
                              onClick={() => handleReportAction(group.reportsList[0]._id, 'dismiss_all', group.reportedItemId)} 
                              style={{ flex: 1, minWidth: '100px', padding: '12px 8px', backgroundColor: '#27272a', color: '#d4d4d8', fontWeight: 'bold', borderRadius: '10px', fontSize: '13px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                            >
                              ✅ Dismiss All
                            </button>

                            <button 
                              onClick={() => handleReportAction(group.reportsList[0]._id, 'flag_nsfw', group.reportedItemId)} 
                              style={{ flex: 1, minWidth: '100px', padding: '12px 8px', backgroundColor: 'rgba(147, 51, 234, 0.2)', color: '#c084fc', fontWeight: 'bold', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(168, 85, 247, 0.3)', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.4)'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)'}
                            >
                              🔞 Flag NSFW
                            </button>

                            <button 
                              onClick={() => handleReportAction(group.reportsList[0]._id, 'delete_item', group.reportedItemId)} 
                              style={{ flex: 1, minWidth: '100px', padding: '12px 8px', backgroundColor: 'rgba(220, 38, 38, 0.8)', color: '#ffffff', fontWeight: 900, borderRadius: '10px', fontSize: '13px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.8)'}
                            >
                              🗑️ Nuke Item
                            </button>

                            <button 
                              onClick={() => setBanModal({ 
                                isOpen: true, 
                                targetUserId: group.reportedUserId, 
                                targetName: group.reportedUserDisplayName,
                                itemType: group.itemType,
                                itemSnippet: group.itemSnippet,
                                itemTitle: group.itemTitle
                              })} 
                              style={{ flex: 1, minWidth: '100px', padding: '12px 8px', backgroundColor: 'rgba(234, 88, 12, 0.8)', color: '#ffffff', fontWeight: 900, borderRadius: '10px', fontSize: '13px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f97316'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(234, 88, 12, 0.8)'}
                            >
                              🔨 Ban User
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                // --- USER VIEW MODE ---
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#a1a1aa', marginBottom: '8px' }}>Users with pending reports: {userReportStats.length}</span>
                  
                  {userReportStats.length === 0 ? (
                    <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '16px', padding: '40px 20px', textAlign: 'center' }}>
                      <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>No users match this filter.</p>
                    </div>
                  ) : (
                    userReportStats.map(user => (
                      <div key={user.telegramId} style={{ backgroundColor: '#121212', padding: '16px 20px', borderRadius: '16px', border: '1px solid #27272a', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '250px' }}>
                          <div>
                            <h4 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '16px', fontWeight: 900 }}>
                              {user.displayName} <span style={{color: '#71717a', fontSize: '12px', fontWeight: 'normal'}}>@{user.telegramId}</span>
                            </h4>
                          </div>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#a1a1aa', fontWeight: 'bold', backgroundColor: '#09090b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                            <span style={{color: '#ef4444'}}>🚨 {user.total} Total</span>
                            <span>📦 Across {user.uniqueItemIds.size} items</span>
                            <span style={{color: '#3f3f46'}}>|</span>
                            <span>🎨 Art: {user.artwork}</span>
                            <span>✍️ Critiques: {user.critique}</span>
                            <span>💬 Comments: {user.comment}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button 
                            onClick={() => { setReportSearchId(user.telegramId); setReportViewMode('items'); }} 
                            style={{ padding: '10px 16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontWeight: 'bold', borderRadius: '10px', fontSize: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
                          >
                            🔍 View Items
                          </button>
                          
                          <button 
                            onClick={() => setBanModal({ 
                              isOpen: true, 
                              targetUserId: user.telegramId, 
                              targetName: user.displayName,
                              itemType: 'multiple',
                              itemSnippet: 'Multiple reports across profile.',
                              itemTitle: 'User Profile'
                            })} 
                            style={{ padding: '10px 16px', backgroundColor: 'rgba(234, 88, 12, 0.8)', color: '#ffffff', fontWeight: 900, borderRadius: '10px', fontSize: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f97316'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(234, 88, 12, 0.8)'}
                          >
                            🔨 Ban User
                          </button>
                        </div>

                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'competitions' && (
            <>
              <div className="admin-col-1">
                <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📢</span> Declare Competition
                  </h2>
                  <form onSubmit={handleCreateCompetition} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="admin-label">Name</label>
                      <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="admin-input" placeholder="e.g. Summer Fantasy" />
                    </div>
                    <div>
                      <label className="admin-label">Hashtag</label>
                      <input required type="text" value={hashtag} onChange={(e) => setHashtag(e.target.value)} className="admin-input" placeholder="e.g. summerfantasy" />
                    </div>

                    {/* 👉 NEW DIFFICULTY DROPDOWN */}
                    <div>
                      <label className="admin-label">Difficulty Tier</label>
                      <select 
                        value={difficulty} 
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="admin-input"
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="Breeze 🌱">Breeze 🌱 (Easy)</option>
                        <option value="Hustle ⚡">Hustle ⚡ (Intermediate)</option>
                        <option value="Crucible 🔥">Crucible 🔥 (Hard)</option>
                        <option value="God-Tier 👑">God-Tier 👑 (Unbeatable)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="admin-label">Start Time</label>
                        <input required type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="admin-input" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="admin-label">End Time</label>
                        <input required type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="admin-input" />
                      </div>
                    </div>
                    <div>
                      <label className="admin-label">Rules / Brief</label>
                      <textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Explain the task, rules, and guidelines..." className="admin-input" style={{ resize: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label className="admin-label">Reference Photo</label>
                      <input type="file" accept="image/*" onChange={(e) => setReferenceImage(e.target.files[0])} className="admin-input" style={{ padding: '8px', cursor: 'pointer' }} />
                    </div>
                    <button 
                      disabled={isSubmitting} type="submit" 
                      style={{ width: '100%', marginTop: '8px', backgroundColor: isSubmitting ? '#1e1e20' : '#2563eb', color: isSubmitting ? '#71717a' : '#ffffff', fontWeight: 900, padding: '14px', borderRadius: '10px', border: 'none', fontSize: '13px', cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', boxShadow: isSubmitting ? 'none' : '0 4px 15px rgba(37,99,235,0.3)' }}
                      onMouseOver={(e) => { if(!isSubmitting) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                      onMouseOut={(e) => { if(!isSubmitting) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                    >
                      {isSubmitting ? uploadPhase : 'Launch Competition'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="admin-col-2">
                <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🕹️</span> Active & Past Events
                </h2>
                {loading ? ( 
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div style={{ width: '32px', height: '32px', border: '4px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'adminSpin 1s linear infinite' }}></div></div>
                ) : competitions.length === 0 ? ( 
                  <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: '#71717a', fontWeight: 'bold', fontSize: '13px', fontStyle: 'italic' }}>No competitions declared yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {competitions.map(comp => {
                      const now = new Date();
                      const isTimeValid = now >= new Date(comp.startTime) && now <= new Date(comp.endTime);
                      const isTrulyActive = comp.isActive && isTimeValid;

                      return (
                        <div key={comp._id} style={{ backgroundColor: '#121212', border: isTrulyActive ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid #27272a', borderRadius: '16px', padding: '16px', display: 'flex', gap: '16px', boxShadow: isTrulyActive ? '0 0 20px rgba(34,197,94,0.1)' : 'none' }}>
                          {comp.referenceImageUrl ? ( 
                            <img src={comp.referenceImageUrl} alt="Ref" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0, border: '1px solid #3f3f46' }} />
                          ) : ( 
                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', backgroundColor: '#09090b', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🖼️</div> 
                          )}
                          
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                <h3 style={{ fontWeight: 900, fontSize: '15px', color: '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.name}</h3>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0, backgroundColor: isTrulyActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isTrulyActive ? '#4ade80' : '#f87171' }}>
                                  {isTrulyActive ? 'Active' : 'Closed'}
                                </span>
                              </div>
                              <p style={{ fontSize: '12px', color: '#60a5fa', fontFamily: 'monospace', margin: '4px 0 0 0', fontWeight: 'bold' }}>#{comp.hashtag}</p>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                              {(!isTrulyActive && !comp.resultsDeclared) && (
                                <button 
                                  onClick={() => openRankingModal(comp)} 
                                  style={{ fontSize: '11px', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'rgba(202, 138, 4, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(202, 138, 4, 0.3)'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(202, 138, 4, 0.2)'}
                                >
                                  🏆 Rank Winners
                                </button>
                              )}
                              <button 
                                onClick={() => toggleStatus(comp._id, comp.isActive)} 
                                style={{ fontSize: '11px', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: comp.isActive ? 'rgba(127, 29, 29, 0.3)' : 'rgba(20, 83, 45, 0.3)', color: comp.isActive ? '#f87171' : '#4ade80', border: comp.isActive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = comp.isActive ? 'rgba(127, 29, 29, 0.5)' : 'rgba(20, 83, 45, 0.5)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = comp.isActive ? 'rgba(127, 29, 29, 0.3)' : 'rgba(20, 83, 45, 0.3)'}
                              >
                                {comp.isActive ? '🛑 Stop' : '▶️ Start'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Legal & Policies View */}
          {activeTab === 'legal' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setLegalType('terms')} style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', border: legalType === 'terms' ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid #27272a', backgroundColor: legalType === 'terms' ? 'rgba(202, 138, 4, 0.2)' : '#121212', color: legalType === 'terms' ? '#fde047' : '#a1a1aa' }}>Terms & Rules</button>
                <button onClick={() => setLegalType('privacy')} style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', border: legalType === 'privacy' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #27272a', backgroundColor: legalType === 'privacy' ? 'rgba(37, 99, 235, 0.2)' : '#121212', color: legalType === 'privacy' ? '#93c5fd' : '#a1a1aa' }}>Privacy Policy</button>
              </div>

              {isLegalLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div style={{ width: '32px', height: '32px', border: '4px solid rgba(234, 179, 8, 0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'adminSpin 1s linear infinite' }}></div></div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {legalPoints.map((point, index) => (
                      <div key={index} style={{ backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px' }}>Section {index + 1}</span>
                          <button onClick={() => setLegalPoints(prev => prev.filter((_, i) => i !== index))} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🗑️ Remove</button>
                        </div>
                        
                        <input 
                          type="text" value={point.title} placeholder="Section Title (e.g. 1. Community Rules)" 
                          onChange={(e) => { const newPoints = [...legalPoints]; newPoints[index].title = e.target.value; setLegalPoints(newPoints); }}
                          style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', fontWeight: 'bold', outline: 'none' }} 
                        />
                        
                        <textarea 
                          rows={4} value={point.content} placeholder="Section body text..."
                          onChange={(e) => { const newPoints = [...legalPoints]; newPoints[index].content = e.target.value; setLegalPoints(newPoints); }}
                          style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 12px', color: '#d4d4d8', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} 
                        />
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => setLegalPoints(prev => [...prev, { title: '', content: '' }])}
                    style={{ padding: '16px', backgroundColor: '#18181b', border: '1px dashed #3f3f46', borderRadius: '16px', color: '#a1a1aa', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', gap: '8px' }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#71717a'; e.currentTarget.style.color = '#ffffff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa'; }}
                  >
                    ➕ Add New Section
                  </button>

                  <div style={{ marginTop: '16px', borderTop: '1px solid #27272a', paddingTop: '24px' }}>
                    <button 
                      onClick={handleSaveLegal} disabled={isLegalSaving}
                      style={{ width: '100%', padding: '16px', backgroundColor: isLegalSaving ? '#1e1e20' : '#ca8a04', color: isLegalSaving ? '#71717a' : '#ffffff', fontWeight: 900, borderRadius: '12px', border: 'none', fontSize: '14px', cursor: isLegalSaving ? 'not-allowed' : 'pointer', boxShadow: isLegalSaving ? 'none' : '0 4px 20px rgba(202, 138, 4, 0.4)', transition: 'background-color 0.2s' }}
                    >
                      {isLegalSaving ? 'Publishing...' : `🚀 Publish ${legalType === 'terms' ? 'Terms' : 'Privacy Policy'} & Reset Users`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {rankingModal.isOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'adminFadeIn 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', width: '100%', maxWidth: '640px', borderRadius: '24px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', border: '1px solid #27272a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', animation: 'adminZoomIn 0.2s ease-out' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090b', flexShrink: 0 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#eab308', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🏆</span> Judge: {rankingModal.comp.name}
                </h2>
                <button onClick={() => setRankingModal({ isOpen: false, comp: null, artworks: [], rankings: {} })} style={{ color: '#71717a', background: 'transparent', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}>✕</button>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rankingModal.artworks.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#71717a', fontStyle: 'italic', padding: '40px 0', margin: 0, fontSize: '13px', fontWeight: 'bold' }}>No entries to judge.</p>
                ) : (
                  rankingModal.artworks.map(art => (
                    <div key={art._id} style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#121212', padding: '12px', borderRadius: '16px', border: '1px solid #27272a' }}>
                      <img src={art.thumbnailUrl || art.imageUrl} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #3f3f46' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '14px', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.title}</h4>
                        <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0, fontWeight: 'bold' }}>@{art.username}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a' }}>RANK:</span>
                        <input 
                          type="number" min="1" 
                          // 👉 THE FIX: Removed the 'max' limit! Type any number you want.
                          placeholder="-"
                          value={rankingModal.rankings[art._id] || ''}
                          onChange={(e) => setRankingModal(prev => ({...prev, rankings: {...prev.rankings, [art._id]: e.target.value}}))}
                          style={{ width: '64px', backgroundColor: '#09090b', border: '1px solid #3f3f46', color: '#ffffff', borderRadius: '8px', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#eab308'}
                          onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ padding: '20px 24px', borderTop: '1px solid #27272a', backgroundColor: '#09090b', flexShrink: 0 }}>
                <button 
                  onClick={submitRankings} 
                  style={{ width: '100%', backgroundColor: '#ca8a04', color: '#ffffff', fontWeight: 900, padding: '16px', borderRadius: '12px', border: 'none', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(202, 138, 4, 0.4)', transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#a16207'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ca8a04'}
                >
                  ✅ Publish Official Results
                </button>
              </div>
            </div>
          </div>
        )}

        {banModal.isOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'adminFadeIn 0.2s ease-out' }}>
            <div style={{ backgroundColor: '#0a0a0a', width: '100%', maxWidth: '400px', borderRadius: '24px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #27272a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', animation: 'adminZoomIn 0.2s ease-out' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(127, 29, 29, 0.15)', flexShrink: 0 }}>
                <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔨</span> Restrict {banModal.targetName}
                </h2>
                <button onClick={() => setBanModal({ isOpen: false, targetUserId: null, targetName: '', itemType: '', itemSnippet: '', itemTitle: '' })} style={{ color: '#71717a', background: 'transparent', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'} onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}>✕</button>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '12px' }}>Reason for Ban</label>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: banReasonType === 'auto' ? 'rgba(59, 130, 246, 0.2)' : '#09090b', border: banReasonType === 'auto' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #3f3f46', padding: '10px', borderRadius: '8px', transition: 'all 0.2s' }}>
                      <input type="radio" checked={banReasonType === 'auto'} onChange={() => setBanReasonType('auto')} style={{ accentColor: '#3b82f6', margin: 0 }} />
                      <span style={{ fontSize: '12px', color: banReasonType === 'auto' ? '#60a5fa' : '#a1a1aa', fontWeight: 'bold' }}>Auto Reason</span>
                    </label>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: banReasonType === 'custom' ? 'rgba(59, 130, 246, 0.2)' : '#09090b', border: banReasonType === 'custom' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #3f3f46', padding: '10px', borderRadius: '8px', transition: 'all 0.2s' }}>
                      <input type="radio" checked={banReasonType === 'custom'} onChange={() => setBanReasonType('custom')} style={{ accentColor: '#3b82f6', margin: 0 }} />
                      <span style={{ fontSize: '12px', color: banReasonType === 'custom' ? '#60a5fa' : '#a1a1aa', fontWeight: 'bold' }}>Custom</span>
                    </label>
                  </div>

                  {banReasonType === 'auto' ? (
                    <div style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', padding: '12px', borderRadius: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#d4d4d8', margin: 0, fontStyle: 'italic' }}>
                        {banModal.itemType === 'multiple' ? '"Violation of community guidelines across multiple items."' : `"Violation of community guidelines regarding ${banModal.itemType}."`}
                      </p>
                    </div>
                  ) : (
                    <textarea 
                      placeholder="Type custom reason here..."
                      value={customBanReason}
                      onChange={(e) => setCustomBanReason(e.target.value)}
                      rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '12px', color: '#ffffff', fontSize: '13px', outline: 'none', resize: 'none' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                    />
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '12px' }}>Revoke Privileges</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {Object.entries({
                      upload: "Uploading Art",
                      critique: "Making Critiques",
                      comment: "Commenting",
                      report: "Filing Reports"
                    }).map(([key, label]) => (
                      <label 
                        key={key} 
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: banTypes[key] ? '1px solid rgba(249, 115, 22, 0.5)' : '1px solid #27272a', backgroundColor: banTypes[key] ? 'rgba(124, 45, 18, 0.3)' : '#09090b', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseOver={(e) => { if(!banTypes[key]) e.currentTarget.style.backgroundColor = '#18181b'; }}
                        onMouseOut={(e) => { if(!banTypes[key]) e.currentTarget.style.backgroundColor = '#09090b'; }}
                      >
                        <input 
                          type="checkbox" 
                          checked={banTypes[key]}
                          onChange={(e) => setBanTypes(prev => ({...prev, [key]: e.target.checked}))}
                          style={{ margin: 0, width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: banTypes[key] ? '#fed7aa' : '#a1a1aa' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>Duration</label>
                  <select 
                    value={banDuration} 
                    onChange={(e) => setBanDuration(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#ffffff', outline: 'none', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                  >
                    <option value="12">12 Hours</option>
                    <option value="24">1 Day</option>
                    <option value="48">2 Days</option>
                    <option value="168">1 Week</option>
                    <option value="720">1 Month</option>
                    <option value="876000">Permanent (100 Years)</option>
                  </select>
                </div>

                <button 
                  onClick={handleBanSubmit} 
                  disabled={isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === '')} 
                  style={{ width: '100%', backgroundColor: (isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === '')) ? '#1e1e20' : '#ea580c', color: (isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === '')) ? '#71717a' : '#ffffff', fontWeight: 900, padding: '16px', borderRadius: '12px', border: 'none', fontSize: '14px', cursor: (isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === '')) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', boxShadow: (isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === '')) ? 'none' : '0 4px 20px rgba(234, 88, 12, 0.4)' }}
                  onMouseOver={(e) => { if(!(isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === ''))) e.currentTarget.style.backgroundColor = '#c2410c'; }}
                  onMouseOut={(e) => { if(!(isBanning || !Object.values(banTypes).some(Boolean) || (banReasonType === 'custom' && customBanReason.trim() === ''))) e.currentTarget.style.backgroundColor = '#ea580c'; }}
                >
                  {isBanning ? 'Applying Restrictions...' : 'Enforce Ban'}
                </button>

              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}