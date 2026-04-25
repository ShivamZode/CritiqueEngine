'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  const [points, setPoints] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('Loading...');

  useEffect(() => {
    fetch('/api/legal?type=privacy')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.doc) {
          try {
            setPoints(JSON.parse(data.doc.content));
          } catch (e) {
            console.error("Failed to parse DB content");
            setPoints([]);
          }
          setLastUpdated(new Date(data.doc.lastUpdated).toLocaleDateString());
        } else {
          setLastUpdated('Not found');
        }
      })
      .catch(() => setLastUpdated('Error loading'));
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#ffffff', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
      
      {/* Subtle Background Glows */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', backgroundColor: 'rgba(37, 99, 235, 0.05)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', backgroundColor: 'rgba(147, 51, 234, 0.05)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#71717a', textDecoration: 'none', padding: '6px 10px', borderRadius: '6px', marginLeft: '-10px', transition: 'color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
            onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
          >
            ◀ Back to Home
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Privacy Policy<span style={{ color: '#2563eb' }}>.</span>
          </h1>
          <p style={{ fontSize: '12px', color: '#71717a', fontStyle: 'italic', margin: '0 0 16px 0' }}>Last Updated: {lastUpdated}</p>
          <p style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: '1.6', margin: 0 }}>
            Welcome to Critique Engine. I’m building this solo, and I respect your privacy. This page explains exactly what data I collect to make the app work, how it's used, and how you can delete it.
          </p>
        </div>
        
        {/* Dynamic DB Content mapped as Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {points.length === 0 ? (
            <p style={{ color: '#71717a', textAlign: 'center', fontStyle: 'italic' }}>Loading document...</p>
          ) : (
            points.map((point, idx) => (
              <section key={idx} style={{ backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid #27272a', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa', margin: '0 0 12px 0' }}>
                  {point.title}
                </h2>
                <p style={{ fontSize: '13px', color: '#e4e4e7', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {point.content}
                </p>
              </section>
            ))
          )}
        </div>

      </div>
    </div>
  );
}