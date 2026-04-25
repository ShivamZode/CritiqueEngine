'use client';

import React, { useState, useRef, useEffect } from 'react';
import { uploadToTempService } from '@/utils/tempUpload';
import { 
  ArrowLeft, Camera, Image as ImageIcon, X, AlertTriangle, 
  Package, Trophy, Upload as UploadIcon, PenTool, CornerDownLeft, 
  OctagonX
} from 'lucide-react';

export default function Upload({ onBack, onDirectSuccess, onPredefine, currentUser, competitionTag }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadPhase, setUploadPhase] = useState(null); 
  const [error, setError] = useState(null);

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  
  const [categories, setCategories] = useState([]); 
  const [categoryInput, setCategoryInput] = useState('');
  
  // State for NSFW Toggle
  const [isAdult, setIsAdult] = useState(false);
  
  const [allCategories, setAllCategories] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [oversizedFile, setOversizedFile] = useState(null); 
  const [isProcessing, setIsProcessing] = useState(false);  
  
  const [dailyUploadCount, setDailyUploadCount] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [isLoadingLimit, setIsLoadingLimit] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const galleryRef = useRef(null);
  const categoryInputRef = useRef(null);

  // 👉 THE FIX: Server-side search logic for Categories inside Upload
  useEffect(() => {
    const h = setTimeout(() => {
      fetch(`/api/categories?q=${encodeURIComponent(categoryInput)}&_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => { if (data.success) setAllCategories(data.categories); })
        .catch(console.error);
    }, 300);
    return () => clearTimeout(h);
  }, [categoryInput]);

  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/artworks?telegramId=${currentUser.id}&checkLimit=true&_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          // 👉 Catch the ban instantly on load
          if (data.isBanned) {
            window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
            onBack(); // Kick them out of the upload screen immediately!
            return;
          }

          if (data.success) {
            setDailyUploadCount(data.count);
            if (data.count >= 10) setIsLimitReached(true);
          }
          setIsLoadingLimit(false);
        })
        .catch(() => setIsLoadingLimit(false));
    } else {
      setIsLoadingLimit(false);
    }
    
    return () => stopCamera();
  }, [currentUser, onBack]);

  const addCategory = (catText) => {
    const cleanCat = catText.replace(/[, #]/g, '').trim().toLowerCase();
    
    if (cleanCat) {
      if (cleanCat === 'nsfw') {
        // 👉 THE FIX: Just turn on the toggle, don't show the tag visually
        setIsAdult(true);
      } else if (!categories.includes(cleanCat)) {
        // Normal tags get added to the array
        setCategories(prev => [...prev, cleanCat]);
      }
    }
    setCategoryInput('');
    setShowSuggestions(false);
  };

  const removeCategory = (indexToRemove) => {
    setCategories(categories.filter((_, index) => index !== indexToRemove));
  };

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    if (val.endsWith(' ') || val.endsWith(',')) {
      addCategory(val);
    } else {
      setCategoryInput(val);
    }
  };

  const handleCategoryKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      addCategory(categoryInput);
    } else if (e.key === 'Backspace' && categoryInput === '') {
      setCategories(categories.slice(0, -1));
    }
  };

  const handleCategoryBlur = () => {
    setTimeout(() => {
      if (categoryInputRef.current && categoryInput.trim() !== '') {
        addCategory(categoryInput);
      }
      setShowSuggestions(false);
    }, 200);
  };

  // We filter out any categories they've already selected
  const filteredCategories = allCategories.filter(c => 
    !categories.some(existing => existing === c.name.toLowerCase()) 
  );

  const stripAndCompressImage = (inputFile, enforceSizeLimit = false) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_DIM = 4000;
          if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.95; 

          const compress = () => {
            canvas.toBlob((blob) => {
              if (!blob) return reject("Image processing failed");
              const sizeMB = blob.size / (1024 * 1024);

              if (enforceSizeLimit && sizeMB > 9.5 && quality > 0.2) {
                quality -= 0.15;
                if (quality <= 0.5) {
                  width *= 0.8; height *= 0.8;
                  canvas.width = width; canvas.height = height;
                  ctx.drawImage(img, 0, 0, width, height);
                }
                compress(); 
              } else {
                const safeName = inputFile.name ? inputFile.name.replace(/\.[^/.]+$/, ".jpg") : `secure_upload_${Date.now()}.jpg`;
                resolve(new File([blob], safeName, { type: 'image/jpeg' }));
              }
            }, 'image/jpeg', quality);
          };
          compress();
        };
        img.onerror = () => reject("Failed to load image");
        img.src = e.target.result;
      };
      reader.onerror = () => reject("Failed to read file");
      reader.readAsDataURL(inputFile);
    });
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
      if (!allowedFormats.includes(selectedFile.type)) {
        return setError(`Unsupported format (${selectedFile.type}). Please upload a JPG, PNG, WEBP, BMP, or GIF.`);
      }

      const MAX_SIZE_BYTES = 10 * 1024 * 1024;
      if (selectedFile.size > MAX_SIZE_BYTES) {
        setOversizedFile(selectedFile);
        return;
      }

      setIsProcessing(true);
      try {
        const cleanFile = await stripAndCompressImage(selectedFile, false);
        setFile(cleanFile);
        setPreviewUrl(URL.createObjectURL(cleanFile));
        setError(null);
      } catch (err) { setError("Error processing image."); }
      setIsProcessing(false);
    }
  };

  const handleAcceptCompression = async () => {
    setIsProcessing(true);
    try {
      const compressedFile = await stripAndCompressImage(oversizedFile, true);
      setFile(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));
      setOversizedFile(null);
      setError(null);
    } catch (err) { setError("Failed to compress image."); setOversizedFile(null); }
    setIsProcessing(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);
    } catch (err) {
      setError("Camera blocked by device. If you are inside Telegram, you must use the Gallery instead.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        stopCamera();
        setIsProcessing(true);
        const rawFile = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        
        try {
          const finalFile = await stripAndCompressImage(rawFile, true);
          setFile(finalFile);
          setPreviewUrl(URL.createObjectURL(finalFile));
        } catch(e) { setError("Failed to process capture."); }
        setIsProcessing(false);
      }, "image/jpeg", 1.0);
    }
  };

  const generateThumbnail = (fileObj) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 800; 
          let width = img.width; let height = img.height;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
            else { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
        };
        img.onerror = reject; img.src = e.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(fileObj);
    });
  };

  const uploadToTempfile = async (fileObj) => {
    const formData = new FormData();
    formData.append('file', fileObj);
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Tempfile upload failed");
    const data = await res.json();
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  };

  const processAndUploadDual = async () => {
    setUploadPhase('compressing');
    await new Promise(resolve => setTimeout(resolve, 50)); 
    
    // 1. Generate thumbnail and convert to File
    const thumbnailBase64 = await generateThumbnail(file);
    const base64Response = await fetch(`data:image/jpeg;base64,${thumbnailBase64}`);
    const thumbBlob = await base64Response.blob();
    const thumbFile = new File([thumbBlob], "thumbnail.jpg", { type: 'image/jpeg' });

    setUploadPhase('uploading_temp');
    
    // 2. Upload BOTH to your temp service concurrently!
    // (Make sure to import or define your new uploadToTempService here too)
    const [tempUrl, thumbTempUrl] = await Promise.all([
      uploadToTempService(file),
      uploadToTempService(thumbFile)
    ]);

    setUploadPhase('syncing_cloud');
    
    // 3. Send ONLY URLs to Vercel
    const res = await fetch('/api/upload', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbTempUrl, tempUrl })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Cloud sync failed");
    return data;
  };

  const validateInputs = () => {
    if (dailyUploadCount >= 10) return "Daily upload limit reached (10/10).";
    if (!file) return "Please select an image.";
    if (!title || title.trim() === '') return "Title is required.";
    if (categories.length === 0) return "At least one Category is required.";
    if (title.length > 60) return "Title cannot exceed 60 characters.";
    if (caption.length > 500) return "Caption cannot exceed 500 characters.";

    // 👉 THE FIX: Simple 5-tag limit since 'nsfw' is handled invisibly
    if (categories.length > 5) return "You can only include a maximum of 5 tags.";
    
    const longTag = categories.find(c => c.length > 20);
    if (longTag) return `The tag #${longTag} is too long! Maximum 20 characters per tag.`;
    return null; 
  };

  const handleDirectUpload = async () => {
    const validationError = validateInputs();
    if (validationError) return setError(validationError);
    setError(null);
    
    const finalCaption = competitionTag ? `${caption}\n\n#${competitionTag}` : caption;
    
    // 👉 Extract Telegram Signature
    const tgInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

    try {
      const preflightRes = await fetch('/api/artworks', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-telegram-init-data': tgInitData || '' // 👉 Send to backend
        },
        body: JSON.stringify({ telegramId: currentUser.id, title, caption: finalCaption, categories, dryRun: true })
      });
      const preflightData = await preflightRes.json();
      if (!preflightRes.ok) throw new Error(preflightData.error || "Validation failed");
    } catch (err) {
      return setError(err.message); 
    }

    try {
      const urls = await processAndUploadDual();
      setUploadPhase('saving_database');
      const dbRes = await fetch('/api/artworks', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-telegram-init-data': tgInitData || '' // 👉 Send to backend
        },
        body: JSON.stringify({
          telegramId: currentUser.id, username: currentUser.username, firstName: currentUser.firstName,    
          imageUrl: urls.imageUrl, thumbnailUrl: urls.thumbnailUrl, isPredefined: false,
          title, caption: finalCaption, categories, 
          isAdult 
        }) 
      });
      
      const dbData = await dbRes.json();
      if (!dbRes.ok) throw new Error(dbData.error || "Failed to save to database");
      
      setUploadPhase(null);

      // 👉 THE FIX: Broadcast the global refresh events before closing the layer!
      setTimeout(() => {
        window.dispatchEvent(new Event('artwork_added'));
        window.dispatchEvent(new Event('refresh_portfolio'));
      }, 100);
      
      onDirectSuccess();
    } catch (err) { setError(err.message); setUploadPhase(null); }
  };

  const handleAddContext = async () => {
    const validationError = validateInputs();
    if (validationError) return setError(validationError);
    setError(null);
    
    const finalCaption = competitionTag ? `${caption}\n\n#${competitionTag}` : caption;

    // 👉 Extract Telegram Signature
    const tgInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

    try {
      const preflightRes = await fetch('/api/artworks', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-telegram-init-data': tgInitData || '' 
        },
        body: JSON.stringify({ telegramId: currentUser.id, title, caption: finalCaption, categories, dryRun: true })
      });
      const preflightData = await preflightRes.json();
      if (!preflightRes.ok) throw new Error(preflightData.error || "Validation failed");
      
      // 👉 THE FIX: Convert the File to a Base64 string for the Critique Engine
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        onPredefine(previewUrl, { 
          title, 
          caption: finalCaption, 
          categories, 
          isAdult, 
          originalFile: file // Passing the Base64 string here!
        }); 
      };

    } catch (err) {
      setError(err.message);
    }
  };

  const formIsValid = title.trim() !== '' && categories.length > 0 && !isLimitReached;

  const renderStep = (phaseId, text) => {
    const phases = ['compressing', 'uploading_temp', 'syncing_cloud', 'saving_database'];
    const curIdx = phases.indexOf(uploadPhase);
    const stepIdx = phases.indexOf(phaseId);
    const status = curIdx === stepIdx ? 'active' : curIdx > stepIdx ? 'done' : 'pending';
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', flexShrink: 0 }}>
          {status === 'active' && <div style={{ position: 'absolute', width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'upPulse 1.5s infinite' }}></div>}
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', position: 'relative', zIndex: 10, transition: 'background-color 0.3s',
            backgroundColor: status === 'active' ? '#60a5fa' : status === 'done' ? '#22c55e' : '#3f3f46',
            boxShadow: status === 'active' ? '0 0 8px rgba(96,165,250,0.8)' : 'none'
          }}></div>
        </div>
        <p style={{
          fontSize: '13px', fontFamily: 'monospace', margin: 0, transition: 'color 0.3s',
          color: status === 'active' ? '#ffffff' : status === 'done' ? '#d4d4d8' : '#71717a',
          fontWeight: status === 'active' ? 'bold' : 'normal'
        }}>
          {text}
        </p>
      </div>
    );
  };

  if (isLoadingLimit) {
    return (
      <>
        <style>{`@keyframes upSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ minHeight: '100vh', backgroundColor: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'upSpin 1s linear infinite' }}></div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes upFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes upZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes upPulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
        @keyframes upSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* 👉 THE FIX: Added Notch Padding and Bottom Safe Area Padding! */}
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#09090b', 
        color: '#ffffff', 
        paddingTop: 'calc(16px + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))', 
        paddingRight: '16px', 
        paddingBottom: 'calc(80px + var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))', 
        paddingLeft: '16px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        position: 'relative', 
        fontFamily: 'system-ui, -apple-system, sans-serif' 
      }}>

        {/* Header */}
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', zIndex: 10 }}>
          <button 
            onClick={onBack} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              backgroundColor: '#27272a', 
              color: '#ffffff', 
              borderRadius: '8px', 
              fontWeight: 'bold', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: '13px', 
              transition: 'background-color 0.2s' 
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
          >
            <ArrowLeft size={16} /> <span>Back</span>
          </button>
          <h1 style={{ fontSize: '16px', fontWeight: 900, color: '#60a5fa', margin: 0 }}>
            {competitionTag ? 'Submit Entry' : 'Publish Art'}
          </h1>
          
          <div style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#18181b', padding: '6px 12px', borderRadius: '999px', border: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
            <span style={{ color: dailyUploadCount >= 10 ? '#f87171' : '#4ade80' }}>{dailyUploadCount}</span>
            <span style={{ color: '#71717a' }}>/ 10 Today</span>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '80px', zIndex: 10 }}>
          
          

          {/* THE LIMIT LOCK SCREEN */}
          {isLimitReached ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginTop: '48px', padding: '32px', backgroundColor: '#121212', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'upZoomIn 0.3s ease-out' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(127, 29, 29, 0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '16px', border: '2px solid rgba(239, 68, 68, 0.5)', boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}>
                <OctagonX size={32} color="#f87171" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#f87171', margin: '0 0 8px 0' }}>Daily Limit Reached</h2>
              <p style={{ color: '#a1a1aa', fontSize: '13px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                You have successfully uploaded <strong style={{ color: '#ffffff' }}>10 artworks</strong> today. To ensure high-quality curation, the grid limit resets at midnight. 
              </p>
              <p style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '13px', backgroundColor: 'rgba(30, 58, 138, 0.3)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(30, 58, 138, 0.5)', margin: 0 }}>
                Take a break and critique some art! ✍️
              </p>
            </div>
          ) : (
            <>
              {/* Oversized File Warning */}
              {oversizedFile && !isProcessing && (
                <div style={{ backgroundColor: 'rgba(124, 45, 18, 0.4)', border: '1px solid rgba(249, 115, 22, 0.5)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'upFadeIn 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Package size={32} color="#fb923c" />
                    <div>
                      <h3 style={{ fontWeight: 'bold', color: '#fb923c', fontSize: '16px', margin: '0 0 4px 0' }}>Heavy File Detected</h3>
                      <p style={{ fontSize: '13px', color: '#d4d4d8', margin: 0 }}>This image is {(oversizedFile.size / 1024 / 1024).toFixed(1)}MB (Max 10MB).</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0 }}>Would you like me to automatically optimize and compress it so you can upload it?</p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button onClick={() => setOversizedFile(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#27272a', color: '#ffffff', borderRadius: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                    <button onClick={handleAcceptCompression} style={{ flex: 1, padding: '12px', backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)' }}>Yes, Optimize</button>
                  </div>
                </div>
              )}

              <input type="file" accept="image/jpeg, image/png, image/webp, image/gif, image/bmp" ref={galleryRef} onChange={handleFileChange} style={{ display: 'none' }} />

              {isProcessing && (
                <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'upSpin 1s linear infinite', marginBottom: '16px' }}></div>
                  <p style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>Securing & Processing Image...</p>
                </div>
              )}

              {/* Camera Active State */}
              {isCameraActive && !isProcessing && !oversizedFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', marginTop: '16px', animation: 'upZoomIn 0.3s ease-out' }}>
                  <div 
                    style={{ position: 'relative', width: '100%', height: '70vh', backgroundColor: '#000000', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '2px solid #27272a', cursor: 'pointer' }}
                    onClick={capturePhoto} 
                  >
                    <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    
                    <button onClick={(e) => { e.stopPropagation(); stopCamera(); }} style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                    
                    <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255,255,255,0.2)', borderRadius: '24px', pointerEvents: 'none' }}></div>
                    <div style={{ position: 'absolute', bottom: '24px', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
                      <span style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', color: '#ffffff', padding: '8px 16px', borderRadius: '999px', fontWeight: 'bold', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Tap anywhere to capture
                      </span>
                    </div>
                  </div>
                </div>
              ) : !previewUrl && !isProcessing && !oversizedFile ? (
                // Initial Upload Choices
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', marginTop: '16px' }}>
                  <button 
                    onClick={startCamera} 
                    style={{ width: '100%', padding: '24px', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', color: '#ffffff' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#27272a'}
                  >
                    <Camera size={32} style={{ marginBottom: '8px' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Open Camera</span>
                  </button>
                  
                  <button 
                    onClick={() => galleryRef.current?.click()} 
                    style={{ width: '100%', padding: '24px', backgroundColor: '#121212', border: '1px solid #27272a', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', color: '#ffffff' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#a855f7'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#27272a'}
                  >
                    <ImageIcon size={32} style={{ marginBottom: '8px' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Choose from Gallery</span>
                  </button>
                  
                  <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '12px', marginTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0, textAlign: 'center', lineHeight: '1.6' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Telegram Users:</span> 
                      Live camera requires browser permissions. If it fails to open inside Telegram, please use the Gallery option.
                    </p>
                  </div>
                </div>
              ) : previewUrl && !isProcessing && !oversizedFile ? (
                // Form Details View
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'upZoomIn 0.3s ease-out' }}>
                  
                  <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#121212', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #27272a', flexShrink: 0 }}>
                    <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <button onClick={() => { setFile(null); setPreviewUrl(null); setError(null); }} style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#ffffff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#18181b', padding: '20px', borderRadius: '16px', border: '1px solid #27272a', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 4px 0' }}>Details</h2>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title *</label>
                      <input type="text" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name your artwork..." style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '10px', padding: '12px', color: '#ffffff', fontSize: '13px', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'} />
                    </div>

                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Categories *</label>
                      <div style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '10px', padding: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', cursor: 'text' }} onClick={() => categoryInputRef.current?.focus()}>
                        {categories.map((cat, index) => (
                          <span key={index} style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10 }}>
                            {cat}
                            <button onClick={(e) => { e.stopPropagation(); removeCategory(index); }} style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: '#60a5fa', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}><X size={12} /></button>
                          </span>
                        ))}
                        
                        <input 
                          ref={categoryInputRef} 
                          type="text" 
                          value={categoryInput} 
                          onChange={handleCategoryChange} 
                          onKeyDown={handleCategoryKeyDown} 
                          onFocus={() => setShowSuggestions(true)} 
                          onBlur={handleCategoryBlur} 
                          placeholder={categories.length === 0 ? "Type and press Space..." : ""} 
                          style={{ flex: 1, backgroundColor: 'transparent', color: '#ffffff', border: 'none', outline: 'none', minWidth: '120px', fontSize: '13px', padding: '4px', zIndex: 10, position: 'relative' }} 
                        />
                      </div>
                      
                      {showSuggestions && categoryInput.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '8px', backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 50, maxHeight: '192px', overflowY: 'auto' }}>
                          {filteredCategories.length > 0 ? filteredCategories.map(cat => (
                              <div key={cat._id} onMouseDown={(e) => { e.preventDefault(); addCategory(cat.name); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', cursor: 'pointer', borderBottom: '1px solid rgba(63, 63, 70, 0.5)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27272a'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <span style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '13px' }}>{cat.name}</span>
                                <span style={{ fontSize: '10px', backgroundColor: '#09090b', color: '#a1a1aa', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>{cat.count} uses</span>
                              </div>
                            )) : (
                            <div style={{ padding: '12px', backgroundColor: 'rgba(30, 58, 138, 0.2)', color: '#93c5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onMouseDown={(e) => { e.preventDefault(); addCategory(categoryInput); }}>
                              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Create tag "{categoryInput}"</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', backgroundColor: '#2563eb', color: '#ffffff', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                <CornerDownLeft size={10} /> Enter
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'flex-end' }}>
                        <label style={{ flex: 1, fontSize: '10px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Caption (Optional)</label>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: caption.length > 480 ? '#f87171' : '#71717a' }}>{caption.length}/500</span>
                      </div>
                      <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share your process, tools used, or story behind this piece..." style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '10px', padding: '12px', color: '#ffffff', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'} />
                    </div>

                    {/* The NSFW Toggle Block */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#09090b', border: isAdult ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #3f3f46', borderRadius: '10px', padding: '12px', marginTop: '4px', transition: 'border-color 0.2s' }}>
                       <div>
                         <span style={{ fontSize: '13px', fontWeight: 'bold', color: isAdult ? '#f87171' : '#ffffff', display: 'block', marginBottom: '2px', transition: 'color 0.2s' }}>🔞 Mature Content (NSFW)</span>
                         <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Flag if this contains nudity or gore.</span>
                       </div>
                       
                       <div 
                         onClick={() => setIsAdult(!isAdult)} 
                         style={{ width: '44px', height: '24px', backgroundColor: isAdult ? '#ef4444' : '#27272a', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}
                       >
                         <div style={{ position: 'absolute', top: '2px', left: isAdult ? '22px' : '2px', width: '20px', height: '20px', backgroundColor: '#ffffff', borderRadius: '50%', transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}></div>
                       </div>
                    </div>
                  </div>

                  {competitionTag && (
                    <div style={{ backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                      <span style={{ fontSize: '28px' }}><Trophy size={28} color="#60a5fa" /></span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#60a5fa', margin: '0 0 2px 0' }}>Event Entry</p>
                        <p style={{ fontSize: '12px', color: '#d4d4d8', margin: 0 }}>This artwork will automatically be submitted to <strong style={{ color: '#ffffff' }}>#{competitionTag}</strong></p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '12px', borderRadius: '12px', animation: 'upFadeIn 0.3s ease-out' }}>
                      <p style={{ color: '#f87171', fontWeight: 'bold', textAlign: 'center', fontSize: '13px', margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    <button 
                      onClick={handleDirectUpload} 
                      disabled={!formIsValid} 
                      style={{
                        width: '100%', padding: '14px', backgroundColor: '#27272a', color: '#ffffff', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', border: 'none', cursor: formIsValid ? 'pointer' : 'not-allowed', opacity: formIsValid ? 1 : 0.5, transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                      onMouseOver={(e) => { if(formIsValid) e.currentTarget.style.backgroundColor = '#3f3f46'; }}
                      onMouseOut={(e) => { if(formIsValid) e.currentTarget.style.backgroundColor = '#27272a'; }}
                    >
                      <UploadIcon size={16} /> Direct Upload
                    </button>
                    
                    <button 
                      onClick={handleAddContext} 
                      disabled={!formIsValid} 
                      style={{
                        width: '100%', padding: '16px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', border: 'none', cursor: formIsValid ? 'pointer' : 'not-allowed', opacity: formIsValid ? 1 : 0.5, transition: 'background-color 0.2s', boxShadow: formIsValid ? '0 0 20px rgba(37,99,235,0.4)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                      onMouseOver={(e) => { if(formIsValid) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                      onMouseOut={(e) => { if(formIsValid) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                    >
                      <PenTool size={16} /> Guide Critics (Add Context)
                    </button>
                  </div>
                  
                </div>
              ) : null}
            </>
          )}
        </div>

        {uploadPhase && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '16px', animation: 'upFadeIn 0.3s ease-out' }}>
            <div style={{ backgroundColor: '#121212', border: '1px solid #27272a', padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%', maxWidth: '360px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', overflow: 'hidden' }}>
              
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '160px', height: '160px', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%', filter: 'blur(40px)', animation: 'upPulse 2s infinite' }}></div>
              
              <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '16px' }}>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid #27272a', borderRadius: '50%' }}></div>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'upSpin 1s linear infinite', filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' }}></div>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}><UploadIcon size={32} color="#ffffff" /></div>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Publishing...</h2>
                <p style={{ color: '#f87171', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '999px', border: '1px solid rgba(239, 68, 68, 0.2)', margin: 0, animation: 'upPulse 2s infinite' }}>Do not close this tab</p>
              </div>

              <div style={{ width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.6)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(39, 39, 42, 0.5)', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
                {renderStep('compressing', 'Baking high-speed thumbnail')}
                {renderStep('uploading_temp', 'Securing high-res original')}
                {renderStep('syncing_cloud', 'Syncing with cloud network')}
                {renderStep('saving_database', 'Saving to gallery')}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}