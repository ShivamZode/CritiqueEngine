import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Critique from '@/models/Critique';
import Artwork from '@/models/Artwork'; 
import Notification from '@/models/Notification';
import User from '@/models/User';
import { authenticateUser } from '@/lib/auth'; 
// 👉 IMPORT THE TELEGRAM NOTIFIER
import { sendTelegramDM } from '@/lib/telegramNotify';

const DAILY_CRITIQUE_LIMIT = 10;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const artworkId = searchParams.get('artworkId');
    const critiquerId = searchParams.get('critiquerId');
    const checkLimit = searchParams.get('checkLimit');

    await connectToDatabase();

    if (checkLimit === 'true' && critiquerId) {
      const user = await User.findOne({ telegramId: critiquerId }).lean();
      if (user?.bans?.critiqueUntil && new Date() < new Date(user.bans.critiqueUntil)) {
        const banPayload = JSON.stringify({
          message: `You are banned from making critiques until ${new Date(user.bans.critiqueUntil).toLocaleString()}`,
          reason: user.bans.reason,
          context: user.bans.contextInfo
        });
        return NextResponse.json({ isBanned: true, error: `BANNED_PAYLOAD|${banPayload}` });
      }

      // 👉 THE NEW SHIELD: Check if they already critiqued THIS specific artwork!
      if (artworkId) {
        const existingCritique = await Critique.findOne({ critiquerId, artworkId }).lean();
        if (existingCritique) {
          return NextResponse.json({ 
            isAlreadyCritiqued: true, 
            error: "You have already critiqued this artwork! Only one critique per artwork is allowed." 
          });
        }
      }

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const count = await Critique.countDocuments({
        critiquerId,
        createdAt: { $gte: startOfDay }
      });
      return NextResponse.json({ success: true, count, limit: DAILY_CRITIQUE_LIMIT });
    }

    if (!artworkId) return NextResponse.json({ error: "Missing artwork ID" }, { status: 400 });
    
    const critiques = await Critique.aggregate([
      { $match: { artworkId: artworkId } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'critiquerId',
          foreignField: 'telegramId',
          as: 'criticInfo'
        }
      },
      { $unwind: { path: '$criticInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          critiquerPhotoUrl: '$criticInfo.photoUrl' 
        }
      },
      { $project: { criticInfo: 0 } }
    ]);

    return NextResponse.json({ critiques, success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load critiques" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { artworkId, originalImageUrl, critiquerId, critiquerUsername, critiqueImageUrl, comment } = body;

    if (!artworkId || !critiqueImageUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(critiquerId) && !authUser.isAdmin) {
      console.warn(`🚨 CRITIQUE SPOOFING BLOCKED: User ${authUser.telegramId} tried to post critique as ${critiquerId}`);
      return NextResponse.json({ error: "Identity mismatch. You cannot post as another user." }, { status: 403 });
    }

    await connectToDatabase();

    const user = await User.findOne({ telegramId: critiquerId });
    if (user?.bans?.critiqueUntil && new Date() < new Date(user.bans.critiqueUntil)) {
      const banPayload = JSON.stringify({
        message: `You are banned from making critiques until ${new Date(user.bans.critiqueUntil).toLocaleString()}`,
        reason: user.bans.reason,
        context: user.bans.contextInfo
      });
      return NextResponse.json({ error: `BANNED_PAYLOAD|${banPayload}` }, { status: 403 });
    }

    // 👉 THE NEW POST SHIELD: Stop concurrent double-submissions
    const existingCritique = await Critique.findOne({ critiquerId, artworkId }).lean();
    if (existingCritique) {
      return NextResponse.json({ error: "You have already critiqued this artwork!" }, { status: 403 });
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dailyCount = await Critique.countDocuments({
      critiquerId,
      createdAt: { $gte: startOfDay }
    });

    if (dailyCount >= DAILY_CRITIQUE_LIMIT) {
      return NextResponse.json({ error: "Daily critique limit reached (10/10). Try again tomorrow!" }, { status: 403 });
    }
    
    const newCritique = await Critique.create({
      artworkId, originalImageUrl, critiquerId, critiquerUsername, critiqueImageUrl, comment,
      showcasedAchievement: user?.showcasedAchievement || null
    });

    try {
      const originalArt = await Artwork.findById(artworkId);
      if (originalArt && String(originalArt.telegramId) !== String(critiquerId)) {
        await Notification.create({
          recipientId: originalArt.telegramId,
          senderId: critiquerId,
          senderUsername: critiquerUsername || 'Someone',
          type: 'new_critique',
          itemId: String(newCritique._id),
          message: 'published a new critique on your artwork!'
        });

        // 👉 THE INSTANT DM
        sendTelegramDM(
          originalArt.telegramId,
          `🎨 <b>${critiquerUsername || 'Someone'}</b> just dropped a new visual critique on your artwork!`,
          `crit_${newCritique._id}`
        );
      }
    } catch (notifErr) { console.error(notifErr); }

    return NextResponse.json({ critique: newCritique, success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save critique" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "Missing critique ID" }, { status: 400 });

    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    await connectToDatabase();
    
    // 🛡️ 👉 SECURITY CHECK 2: OWNERSHIP VERIFICATION
    const crit = await Critique.findById(id);
    if (!crit) return NextResponse.json({ error: "Critique not found" }, { status: 404 });

    if (String(crit.critiquerId) !== String(authUser.telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 DELETION HIJACK BLOCKED: User ${authUser.telegramId} tried to delete a critique owned by ${crit.critiquerId}`);
      return NextResponse.json({ error: "You don't have permission to delete this critique." }, { status: 403 });
    }

    await Critique.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete critique" }, { status: 500 });
  }
}