'use client';

import React, { useState } from 'react';
import { Flag, X, CheckCircle } from 'lucide-react';

const REPORT_REASONS = [
  "Nudity or Sexual Content",
  "Harassment or Bullying",
  "Hate Speech or Symbols",
  "Spam or Scam",
  "Copyright Violation",
  "Other"
];

export default function ReportModal({ isOpen, onClose, itemType, itemId, parentItemId, reportedUserId, currentUser }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customText, setCustomText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError("Please select a reason.");
      return;
    }
    if (selectedReason === 'Other' && !customText.trim()) {
      setError("Please provide more details.");
      return;
    }
    if (selectedReason === 'Other' && customText.length > 500) {
      setError("Custom details cannot exceed 500 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: currentUser.id,
          reporterUsername: currentUser.username,
          reportedItemId: itemId,
          parentItemId: parentItemId || null, 
          itemType: itemType, 
          reportedUserId: reportedUserId,
          reason: selectedReason,
          customText: selectedReason === 'Other' ? customText.trim() : ''
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setSelectedReason('');
          setCustomText('');
          onClose();
        }, 2000);
      } else if (res.status === 403 && (data.error?.includes('banned') || data.error?.includes('limit'))) {
        window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
        onClose();
      } else {
        setError(data.error || "Failed to submit report.");
      }
    } catch (err) {
      setError("Network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes reportFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes reportScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', animation: 'reportFade 0.2s ease-out',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{
          backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '16px',
          width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden',
          animation: 'reportScale 0.2s ease-out'
        }}>
          
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderBottom: '1px solid #27272a', backgroundColor: '#0a0a0a'
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flag size={18} color="#ef4444" /> Report {itemType === 'artwork' ? 'Artwork' : itemType === 'critique' ? 'Critique' : 'Comment'}
            </h2>
            <button 
              onClick={onClose} 
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px', fontSize: '14px', fontWeight: 'bold', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {success ? (
              <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <CheckCircle size={24} color="#4ade80" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Report Submitted</h3>
                <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>Thank you for keeping the community safe. I will review this shortly.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#e4e4e7', margin: 0 }}>Why are you reporting this content?</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {REPORT_REASONS.map(reason => {
                    const isSelected = selectedReason === reason;
                    return (
                      <label 
                        key={reason} 
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                          borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                          border: isSelected ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #27272a',
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.08)' : '#121212'
                        }}
                        onMouseOver={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = '#18181b'; }}
                        onMouseOut={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = '#121212'; }}
                      >
                        <input 
                          type="radio" 
                          name="reportReason" 
                          value={reason} 
                          checked={isSelected} 
                          onChange={() => { setSelectedReason(reason); setError(null); }} 
                          style={{ margin: 0, accentColor: '#ef4444', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: isSelected ? '#fca5a5' : '#a1a1aa' }}>{reason}</span>
                      </label>
                    );
                  })}
                </div>

                {selectedReason === 'Other' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <textarea
                      value={customText}
                      maxLength={500}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Please describe the issue..."
                      style={{
                        width: '100%', boxSizing: 'border-box', backgroundColor: '#121212',
                        border: '1px solid #27272a', borderRadius: '10px', color: '#ffffff',
                        padding: '12px', fontSize: '13px', outline: 'none', resize: 'none',
                        height: '80px', fontFamily: 'inherit'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
                    />
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: customText.length >= 500 ? '#ef4444' : '#71717a' }}>
                        {customText.length}/500
                      </span>
                    </div>
                  </div>
                )}

                {error && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', margin: '4px 0 0 0' }}>{error}</p>}

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button 
                    onClick={onClose} 
                    disabled={isSubmitting} 
                    style={{
                      flex: 1, padding: '12px', backgroundColor: '#27272a', color: '#ffffff',
                      border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => { if(!isSubmitting) e.currentTarget.style.backgroundColor = '#3f3f46'; }}
                    onMouseOut={(e) => { if(!isSubmitting) e.currentTarget.style.backgroundColor = '#27272a'; }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedReason} 
                    style={{
                      flex: 1, padding: '12px',
                      backgroundColor: (isSubmitting || !selectedReason) ? '#1e1e20' : '#dc2626',
                      border: (isSubmitting || !selectedReason) ? '1px solid #27272a' : '1px solid rgba(220, 38, 38, 0.5)',
                      color: (isSubmitting || !selectedReason) ? '#71717a' : '#ffffff',
                      borderRadius: '10px', fontSize: '13px', fontWeight: 'bold',
                      cursor: (isSubmitting || !selectedReason) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => { if(!isSubmitting && selectedReason) e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                    onMouseOut={(e) => { if(!isSubmitting && selectedReason) e.currentTarget.style.backgroundColor = '#dc2626'; }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}