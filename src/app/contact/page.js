'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [copied, setCopied] = useState(false);
  const supportEmail = "artforcritique@gmail.com";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#09090b',
      color: '#ffffff',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '560px',
        margin: '0 auto'
      }}>

        {/* Back Button */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#71717a',
              textDecoration: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              marginLeft: '-10px',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
            onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
          >
            ◀ Back to Home
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 900,
            margin: '0 0 12px 0',
            letterSpacing: '-0.5px'
          }}>
            Let’s Talk<span style={{ color: '#2563eb' }}>.</span>
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#a1a1aa',
            lineHeight: '1.6',
            margin: 0,
            maxWidth: '480px'
          }}>
            Questions, ideas, bugs, or general chaos. I’m building this solo, but I’ve got you. Drop a message and I’ll get back to you.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Primary Contact: Email Card */}
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
                border: '1px solid rgba(37, 99, 235, 0.2)'
              }}>
                ✉️
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Email me directly</h2>
                <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                  For account issues, feedback, or anything that needs a real response. I read everything personally.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href={`mailto:${supportEmail}`}
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                Write an Email
              </a>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px',
                  backgroundColor: '#27272a',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  border: '1px solid #3f3f46',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
              >
                {copied ? <span style={{ color: '#4ade80' }}>✓ Copied</span> : <span>📋 Copy</span>}
              </button>
            </div>
          </div>

          {/* Secondary Contacts Grid */}
          <div style={{ display: 'flex', gap: '16px' }}>

            {/* Telegram Community */}
            <div style={{
              flex: 1,
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#818cf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', marginBottom: '16px', border: '1px solid rgba(79, 70, 229, 0.2)'
              }}>
                💬
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Skip the line</h2>
              <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '0 0 16px 0', lineHeight: '1.5', flex: 1 }}>
                Want a faster answer? Jump into the Telegram group. I’m there too, doing the necessary lurking.
              </p>
              <a
                href="https://t.me/ArtGroupChat1"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px', fontWeight: 'bold', color: '#818cf8', textDecoration: 'none',
                  textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={(e) => e.currentTarget.style.color = '#818cf8'}
              >
                Join Chat ↗
              </a>
            </div>

            {/* Bug Reporter */}
            <div style={{
              flex: 1,
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                backgroundColor: 'rgba(225, 29, 72, 0.1)', color: '#fb7185',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', marginBottom: '16px', border: '1px solid rgba(225, 29, 72, 0.2)'
              }}>
                🐞
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Broke something?</h2>
              <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                Found a bug? Impressive. Use the <strong style={{ color: '#e4e4e7' }}>Report</strong> button in the menu on your profile.
              </p>
            </div>

          </div>

          {/* Footer Note */}
          <div style={{ paddingTop: '24px', textAlign: 'center' }}>
            <p style={{
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#52525b',
              fontWeight: 'bold',
              margin: 0
            }}>
              Designed & Developed by a human
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}