import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import User from '@/models/User';
import Category from '@/models/Category';
import Competition from '@/models/Competition'; 
import { NextResponse } from 'next/server';
import { uploadWithKeyRotation } from '@/lib/imgbbUploader';

// --- Smart Caption Parser for Telegram (STRICT FORMAT MODE) ---
// 👉 THE FIX: We now pass in `fromUser` so we can extract their name!
function parseTelegramCaption(rawText, fromUser) {
  // Build a dynamic fallback title using their Telegram Name & Username
  const name = fromUser?.first_name || "Artist";
  const usernameTag = fromUser?.username ? ` (@${fromUser.username})` : "";
  const fallbackTitle = `Art by ${name}${usernameTag}`;

  if (!rawText) return { title: fallbackTitle, caption: "", categories: ["art"] };

  const cleanText = rawText.replace(/\/art\s*/gi, '');
  
  // Normalize smart quotes (“ ”) to straight quotes (") for accurate counting
  const normalizedText = cleanText.replace(/[“”]/g, '"');

  // 👉 STRICT FORMAT CHECK 1: Parentheses ()
  const openParenCount = (normalizedText.match(/\(/g) || []).length;
  const closeParenCount = (normalizedText.match(/\)/g) || []).length;

  if (openParenCount > 1 || closeParenCount > 1) {
    throw new Error("Format Error: You can only use one pair of parentheses () for the title.");
  }
  if (openParenCount !== closeParenCount) {
    throw new Error("Format Error: Unclosed parentheses. Make sure your title is formatted like (Your Title).");
  }
  if (openParenCount === 1 && normalizedText.indexOf('(') > normalizedText.indexOf(')')) {
    throw new Error("Format Error: Parentheses are in the wrong order.");
  }

  // 👉 STRICT FORMAT CHECK 2: Double Quotes " "
  const quoteCount = (normalizedText.match(/"/g) || []).length;
  if (quoteCount !== 0 && quoteCount !== 2) {
    throw new Error("Format Error: Description must be enclosed in exactly one pair of double quotes (e.g. \"Your description\").");
  }

  // 1. Extract Title
  const titleMatch = normalizedText.match(/\(([\s\S]*?)\)/);
  // 👉 THE FIX: Use our new dynamic fallbackTitle instead of "Telegram Upload"
  let title = titleMatch ? titleMatch[1].trim() : fallbackTitle;
  
  if (title.length > 60) throw new Error("Title cannot exceed 60 characters.");

  // 2. Extract Description
  const descMatch = normalizedText.match(/"([\s\S]*?)"/);
  let description = descMatch ? descMatch[1].trim() : "";
  if (description.length > 500) throw new Error("Description cannot exceed 500 characters.");

  // 3. Extract Categories
  const hashtagMatches = normalizedText.match(/#(\w+)/g);
  let categories = hashtagMatches ? hashtagMatches.map(tag => tag.replace('#', '').toLowerCase()) : [];

  if (categories.length > 5) throw new Error("You can only include a maximum of 5 hashtags.");
  const longTag = categories.find(c => c.length > 20);
  if (longTag) throw new Error(`The hashtag #${longTag} is too long! Maximum 20 characters per tag.`);

  if (categories.length === 0) categories = ["art"];

  // Reconstruct final caption
  const tagsString = categories.map(c => `#${c}`).join(' ');
  const finalCaption = description ? `${description}\n\n${tagsString}` : tagsString;

  return { title, caption: finalCaption, categories };
}

export async function POST(req) {
  try {
    const update = await req.json();

    const msg = update.message || update.edited_message;

    if (!msg) return NextResponse.json({ ok: true });

    const text = msg.text || msg.caption || "";

    const botUsername = `@${process.env.NEXT_PUBLIC_BOT_USERNAME}`;

    if (!text.includes('/art') && !text.includes(botUsername) && !text.startsWith('/menu') && !text.startsWith('/start')) {
      return NextResponse.json({ ok: true });
    }

    console.log("📥 RECEIVED VALID COMMAND:", text);

    const chatId = msg.chat.id;
    const chatType = msg.chat.type; 
    const messageId = msg.message_id;
    const fromUser = msg.from;

    // ==========================================
    // DOOR 1: TEXT MESSAGES (like /menu)
    // ==========================================
    if (msg.text) {
      if (text.startsWith('/menu') || text.startsWith('/start')) {
        await sendWebAppKeyboard(chatId, chatType);
      }
    } 
    // ==========================================
    // DOOR 2: PHOTOS & IMAGE DOCUMENTS (like /art)
    // ==========================================
    else if (msg.caption) {
      const isPhoto = msg.photo;
      const isImageDoc = msg.document && msg.document.mime_type?.startsWith('image/');

      if ((isPhoto || isImageDoc) && (msg.caption.includes('/art') || msg.caption.includes(botUsername))) {
        console.log("🎨 Art detected! Checking file size, format, and processing...");
        
        let fileId;
        let thumbFileId; 
        let fileSize;
        let mimeType;

        if (isPhoto) {
          const photos = msg.photo;
          // Best quality for main image
          fileId = photos[photos.length - 1].file_id;
          fileSize = photos[photos.length - 1].file_size;
          mimeType = 'image/jpeg'; 
          
          // Grab medium resolution for thumbnail
          const thumbIndex = photos.length > 1 ? Math.floor(photos.length / 2) : 0;
          thumbFileId = photos[thumbIndex].file_id;
        } else {
          fileId = msg.document.file_id;
          fileSize = msg.document.file_size;
          mimeType = msg.document.mime_type; 
          
          // Document thumbnail fallback
          const docThumb = msg.document.thumb || msg.document.thumbnail;
          thumbFileId = docThumb ? docThumb.file_id : fileId; 
        }
        
        await handleArtUpload(chatId, messageId, fileId, thumbFileId, fileSize, mimeType, fromUser, msg.caption);
      }
    } 
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ CRITICAL Bot Route Error:", error);
    return NextResponse.json({ ok: true });
  }
}

// --- The Smart Keyboard Router ---
async function sendWebAppKeyboard(chatId, chatType) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // 👉 THE FIX: Dynamically construct the deep link
  const botName = process.env.NEXT_PUBLIC_BOT_USERNAME;
  const appShortName = process.env.NEXT_PUBLIC_BOT_APP_SHORTNAME;
  const APP_DEEP_LINK = `https://t.me/${botName}/${appShortName}`; 

  // 👉 THE FIX: Unified Inline Keyboard!
  // We use Inline Buttons with Direct Mini App Links for ALL chats (private & groups).
  // This guarantees Telegram's native browser injects the auth token and auto-logs them in!
  const reply_markup = {
    inline_keyboard: [
      [ 
        { text: "➕ Upload Art", url: `${APP_DEEP_LINK}?startapp=upload` }, 
        { text: "🎨 My Portfolio", url: `${APP_DEEP_LINK}?startapp=portfolio` } 
      ],
      [ 
        { text: "🌐 Explore & Criticize", url: `${APP_DEEP_LINK}?startapp=feed` } 
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: "🎨 Welcome to the Critique Engine! Tap a button below to launch the app:", 
        reply_markup 
      }) 
    });
  } catch (err) {
    console.error("Keyboard Error:", err);
  } 
}

// --- THE AUTO-UPLOADER WITH VAULT DOOR ---
async function handleArtUpload(chatId, originalMessageId, fileId, thumbFileId, fileSize, mimeType, fromUser, captionText) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // 👉 THE FIX: Dynamically construct the deep link here too
  const botName = process.env.NEXT_PUBLIC_BOT_USERNAME;
  const appShortName = process.env.NEXT_PUBLIC_BOT_APP_SHORTNAME;
  const APP_DEEP_LINK = `https://t.me/${botName}/${appShortName}`; 

  let processingMessageId = null;

  try {
    const processingRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        reply_to_message_id: originalMessageId,
        text: "⏳ **Processing artwork...**\nChecking format and saving to gallery. Please wait."
      })
    });
    
    const processingData = await processingRes.json();
    if (processingData.ok) {
      processingMessageId = processingData.result.message_id;
    }

    const cleanupProcessingMsg = async () => {
      if (processingMessageId) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: processingMessageId })
        }).catch(() => {});
      }
    };

    if (!process.env.IMGBB_API_KEYS) throw new Error("Server configuration error (ImgBB Keys missing).");

    const allowedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!allowedFormats.includes(mimeType)) {
      throw new Error(`Unsupported format (${mimeType}). Please upload a JPG, PNG, WEBP, BMP, or GIF.`);
    }

    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (fileSize && fileSize > MAX_SIZE_BYTES) {
      throw new Error("File is too large! Maximum allowed size is 10MB.");
    }

    // 👉 THE FIX: We pass fromUser into our parser now!
    const { title, caption, categories } = parseTelegramCaption(captionText, fromUser);

    await connectToDatabase();
    const user = await User.findOne({ telegramId: fromUser.id.toString() });
    
    // THE LEGAL GATEKEEPER (T&C / 18+)
    if (!user || !user.hasAcceptedTerms) {
      await cleanupProcessingMsg(); 

      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          reply_to_message_id: originalMessageId, 
          text: "⚠️ Hold up! Before you can upload art to the platform, you need to verify your age and accept the community rules.", 
          reply_markup: { 
            inline_keyboard: [
              [ { text: "📝 Verify & Accept Terms", url: `${APP_DEEP_LINK}?startapp=feed` } ]
            ] 
          } 
        })
      });
      return; 
    }

    // CHECK IF USER IS BANNED FROM UPLOADS
    if (user && user.bans && user.bans.uploadUntil) {
      const now = new Date();
      if (now < new Date(user.bans.uploadUntil)) {
        const unbanTime = new Date(user.bans.uploadUntil).toLocaleString();
        throw new Error(`🚫 You are currently banned from uploading art until ${unbanTime}.`);
      }
    }
    
    // DAILY UPLOAD QUOTA LIMIT
    const MAX_UPLOADS_PER_DAY = 10; 
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentUploadsCount = await Artwork.countDocuments({
      telegramId: fromUser.id.toString(),
      createdAt: { $gte: oneDayAgo }
    });

    if (recentUploadsCount >= MAX_UPLOADS_PER_DAY) {
      throw new Error(`⏳ Upload limit reached! You can only submit ${MAX_UPLOADS_PER_DAY} artworks per 24 hours to prevent spam.`);
    }

    // EVENT VALIDATION
    if (categories.length > 1 || categories[0] !== "art") {
      const foundComps = await Competition.find({ hashtag: { $in: categories } }).lean();

      for (const comp of foundComps) {
        const now = new Date();
        const isTimeValid = now >= new Date(comp.startTime) && now <= new Date(comp.endTime);
        
        if (!comp.isActive || !isTimeValid) {
          throw new Error(`The event #${comp.hashtag} has officially ended.`);
        }

        const existingEntry = await Artwork.findOne({
          telegramId: fromUser.id.toString(),
          caption: { $regex: new RegExp(`#${comp.hashtag}\\b`, 'i') }
        });

        if (existingEntry) {
          throw new Error(`You have already submitted an entry for #${comp.hashtag}!`);
        }
      }
    }

    // Fetch file paths from Telegram
    const getTelegramFileUrl = async (id) => {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${id}`);
      const data = await res.json();
      if (!data.ok) throw new Error("Could not retrieve file path from Telegram.");
      return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${data.result.file_path}`;
    };

    const highResDownloadUrl = await getTelegramFileUrl(fileId);
    const thumbDownloadUrl = (thumbFileId === fileId) ? highResDownloadUrl : await getTelegramFileUrl(thumbFileId);

    const uploadToImgBB = async (urlToUpload) => {
      const data = await uploadWithKeyRotation(urlToUpload);
      return data.url; 
    };

    // Upload both files concurrently
    const [imageUrl, thumbnailUrl] = await Promise.all([
      uploadToImgBB(highResDownloadUrl),
      uploadToImgBB(thumbDownloadUrl)
    ]);

    const hasNsfwTag = categories.some(cat => cat.toLowerCase().includes('nsfw'));

    const newArt = await Artwork.create({ 
      telegramId: fromUser.id.toString(), 
      username: user.username || fromUser.username || '', 
      firstName: user.firstName || fromUser.first_name || 'Unknown', 
      imageUrl: imageUrl, 
      thumbnailUrl: thumbnailUrl, 
      title: title,
      caption: caption,
      categories: categories,
      isPredefined: false,
      isAdult: hasNsfwTag 
    });

    await Promise.all(categories.map(cat => {
      const trimmedCat = cat.trim();
      return Category.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${trimmedCat}$`, 'i') } },
        { $setOnInsert: { name: trimmedCat }, $inc: { count: 1 } },
        { upsert: true } 
      );
    }));

    await cleanupProcessingMsg();

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        reply_to_message_id: originalMessageId, 
        text: "🖼️ **Artwork processed successfully!**\nIt is now live in your portfolio.", 
        reply_markup: { 
          inline_keyboard: [
            // 👉 THE FIX: Changed 'crit_' to 'edit_'
            [ { text: "✍️ Criticize Artwork", url: `${APP_DEEP_LINK}?startapp=edit_${newArt._id}` } ],
            [ { text: "📱 Open in App", url: `${APP_DEEP_LINK}?startapp=view_${newArt._id}` } ]
          ] 
        }
      })
    });

  } catch (err) { 
    console.error("Upload Error:", err.message); 
    const errorMessage = err.message || "An unexpected error occurred.";

    if (processingMessageId) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: processingMessageId })
      }).catch(() => {});
    }

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        reply_to_message_id: originalMessageId, 
        text: `❌ ${errorMessage}`
      })
    });
  }
}