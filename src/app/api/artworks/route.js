import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import Category from '@/models/Category';
import Critique from '@/models/Critique';
import Competition from '@/models/Competition';
import User from '@/models/User';
// 👉 IMPORT THE BOUNCER
import { authenticateUser } from '@/lib/auth'; 

const DAILY_UPLOAD_LIMIT = 10;

export async function GET(req) {
  // ... (Keep your existing GET function exactly as it is) ...
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get('telegramId');
    const checkLimit = searchParams.get('checkLimit');

    if (checkLimit === 'true' && telegramId) {
      await connectToDatabase();
      const user = await User.findOne({ telegramId }).lean();
      if (user?.bans?.uploadUntil && new Date() < new Date(user.bans.uploadUntil)) {
        const banPayload = JSON.stringify({ message: `You are banned from uploading art until ${new Date(user.bans.uploadUntil).toLocaleString()}`, reason: user.bans.reason, context: user.bans.contextInfo });
        return NextResponse.json({ isBanned: true, error: `BANNED_PAYLOAD|${banPayload}` });
      }
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0); 
      const count = await Artwork.countDocuments({ telegramId, createdAt: { $gte: startOfDay } });
      return NextResponse.json({ success: true, count, limit: DAILY_UPLOAD_LIMIT });
    }
    return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: "Server Error" }, { status: 500 }); }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { telegramId, username, firstName, imageUrl, thumbnailUrl, encodedImageUrl, isPredefined, title, caption, categories, isAdult, dryRun } = body;

    if (!telegramId || !title || !categories || categories.length === 0) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    if (!dryRun && !imageUrl) return NextResponse.json({ error: "Missing image" }, { status: 400 });
    if (title.length > 60) return NextResponse.json({ error: "Title cannot exceed 60 characters." }, { status: 400 });
    if (caption && caption.length > 500) return NextResponse.json({ error: "Caption cannot exceed 500 characters." }, { status: 400 });

    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 SPOOFING ATTEMPT BLOCKED: User ${authUser.telegramId} tried to upload as ${telegramId}`);
      return NextResponse.json({ error: "Identity mismatch. You cannot upload for another user." }, { status: 403 });
    }
    
    await connectToDatabase();
    
    // BAN ENFORCEMENT CHECK
    const user = await User.findOne({ telegramId });
    if (user?.bans?.uploadUntil && new Date() < new Date(user.bans.uploadUntil)) {
      const banPayload = JSON.stringify({ message: `You are banned from uploading art until ${new Date(user.bans.uploadUntil).toLocaleString()}`, reason: user.bans.reason, context: user.bans.contextInfo });
      return NextResponse.json({ error: `BANNED_PAYLOAD|${banPayload}` }, { status: 403 });
    }
    
    // STRICT DAILY LIMIT CHECK
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dailyUploads = await Artwork.countDocuments({ telegramId, createdAt: { $gte: startOfDay } });
    
    if (dailyUploads >= DAILY_UPLOAD_LIMIT) {
      return NextResponse.json({ error: `Daily upload limit reached (${DAILY_UPLOAD_LIMIT}/${DAILY_UPLOAD_LIMIT}). Please try again tomorrow!` }, { status: 403 });
    }
    
    // THE VAULT DOOR: Security Checks for Competitions
    if (caption) {
      const hashtags = caption.match(/#(\w+)/g);
      if (hashtags) {
        const cleanTags = hashtags.map(tag => tag.replace('#', '').toLowerCase());
        const foundComps = await Competition.find({ hashtag: { $in: cleanTags } }).lean();
        
        for (const comp of foundComps) {
          const now = new Date();
          const isTimeValid = now >= new Date(comp.startTime) && now <= new Date(comp.endTime);
          if (!comp.isActive || !isTimeValid) {
            return NextResponse.json({ error: `Upload failed: The event #${comp.hashtag} has officially ended.` }, { status: 400 });
          }
          const existingEntry = await Artwork.findOne({ telegramId, caption: { $regex: new RegExp(`#${comp.hashtag}\\b`, 'i') } });
          if (existingEntry) {
            return NextResponse.json({ error: `Upload failed: You have already submitted an entry for #${comp.hashtag}!` }, { status: 400 });
          }
        }
      }
    }
    
    const submittedHasNsfw = categories.some(cat => cat.toLowerCase() === 'nsfw');
    let normalCategories = categories.filter(cat => cat.toLowerCase() !== 'nsfw');

    if (normalCategories.length > 5) return NextResponse.json({ error: "Maximum of 5 standard categories allowed." }, { status: 400 });

    if (dryRun) return NextResponse.json({ success: true, message: "Validations passed." });

    const finalIsAdult = isAdult || submittedHasNsfw;
    let finalCategories = [...normalCategories];
    if (finalIsAdult) finalCategories.push('nsfw');

    const newArt = await Artwork.create({
      telegramId, username, firstName, imageUrl,
      thumbnailUrl: thumbnailUrl || imageUrl,
      encodedImageUrl: encodedImageUrl || null,
      isPredefined: isPredefined || false,
      isAdult: finalIsAdult, 
      title, caption, 
      categories: finalCategories,
      showcasedAchievement: user?.showcasedAchievement || null
    });
    
    await Promise.all(categories.map(cat => {
      const trimmedCat = cat.trim();
      return Category.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${trimmedCat}$`, 'i') } },
        { $setOnInsert: { name: trimmedCat }, $inc: { count: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
    }));
    
    return NextResponse.json({ success: true, art: newArt });
  } catch (error) {
    console.error("Artwork Save Error:", error);
    return NextResponse.json({ error: "Failed to save artwork" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "Missing artwork ID" }, { status: 400 });
    
    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const art = await Artwork.findById(id);
    if (!art) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(art.telegramId) !== String(authUser.telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 DELETION SPOOFING BLOCKED: User ${authUser.telegramId} tried to delete art owned by ${art.telegramId}`);
      return NextResponse.json({ error: "You do not have permission to delete this." }, { status: 403 });
    }

    await Artwork.findByIdAndDelete(id);
    await Critique.deleteMany({ artworkId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Artwork Delete Error:", error);
    return NextResponse.json({ error: "Failed to delete artwork" }, { status: 500 });
  }
}