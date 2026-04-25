import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
// 👉 THE FIX: Import the models so we can mass-update them!
import Artwork from '@/models/Artwork';
import Critique from '@/models/Critique';
import Competition from '@/models/Competition';
import { uploadWithKeyRotation } from '@/lib/imgbbUploader';
import { authenticateUser } from '@/lib/auth'; 

// ==========================================
// 1. GET: Fetch user stats for Feed & Portfolio
// ==========================================
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get('telegramId');
    
    if (!telegramId) return NextResponse.json({ error: "Missing Telegram ID" }, { status: 400 });

    await connectToDatabase();
    let user = await User.findOne({ telegramId }).lean();
    
    if (!user) user = { telegramId, following: [], savedArts: [], followers: [] };

    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user stats" }, { status: 500 });
  }
}

// ==========================================
// 2. POST: Smart Sync & ImgBB Upload
// ==========================================
export async function POST(req) {
  try {
    const { telegramId, username, firstName } = await req.json();
    if (!telegramId) return NextResponse.json({ error: "Missing Telegram ID" }, { status: 400 });

    await connectToDatabase();
    let user = await User.findOne({ telegramId });

    if (!user) {
      user = new User({ telegramId, username, firstName });
    } else {
      if (username) user.username = username;
      if (firstName) user.firstName = firstName;
    }

    const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();
    const lastSync = user.lastPhotoSync ? new Date(user.lastPhotoSync).getTime() : 0;

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.IMGBB_API_KEYS && (now.getTime() - lastSync > SYNC_INTERVAL_MS || !user.photoUrl)) {
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        const profileRes = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
        const profileData = await profileRes.json();

        if (profileData.ok && profileData.result.total_count > 0) {
          const photos = profileData.result.photos[0];
          const bestPhoto = photos[photos.length - 1]; 
          
          const fileUniqueId = bestPhoto.file_unique_id; 

          if (user.telegramFileUniqueId !== fileUniqueId) {
            const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${bestPhoto.file_id}`);
            const fileData = await fileRes.json();

            if (fileData.ok) {
              const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;

              try {
                const imgbbData = await uploadWithKeyRotation(downloadUrl);
                
                user.photoUrl = imgbbData.thumb?.url || imgbbData.url;
                user.telegramFileUniqueId = fileUniqueId; 
                console.log(`✅ Synced NEW profile picture for ${firstName}`);
              } catch (err) {
                console.error(`Failed to rotate/upload profile pic for ${firstName}:`, err);
              }
            }
          } else {
            console.log(`⏭️ Profile picture for ${firstName} hasn't changed. Skipped ImgBB.`);
          }
        }
        
        user.lastPhotoSync = now;

      } catch (syncError) {
        console.error("Profile Sync Failed:", syncError);
      }
    }

    await user.save();
    return NextResponse.json({ success: true, user });

  } catch (error) {
    console.error("User Sync Error:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}

// ==========================================
// 3. PATCH: Update User Profile & Legal Consent
// ==========================================
export async function PATCH(req) {
  try {
    const { telegramId, bio, hasAcceptedTerms, isAdult, firstName, username, photoUrl, showcasedAchievement } = await req.json();

    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }

    await connectToDatabase();
    
    let updateData = {};
    if (bio !== undefined) updateData.bio = bio.slice(0, 300);
    if (hasAcceptedTerms !== undefined) updateData.hasAcceptedTerms = hasAcceptedTerms;
    if (isAdult !== undefined) updateData.isAdult = isAdult;
    if (firstName) updateData.firstName = firstName.slice(0, 40);
    if (photoUrl) updateData.photoUrl = photoUrl;

    if (showcasedAchievement !== undefined) {
      if (showcasedAchievement === null) {
        // They are just un-pinning the badge, allow it.
        updateData.showcasedAchievement = null;
      } else {
        // They are trying to pin a badge. We must verify it with the database!
        
        // 1. Did this user actually upload this artwork?
        const realArt = await Artwork.findOne({ _id: showcasedAchievement.artworkId, telegramId: authUser.telegramId }).lean();
        if (!realArt) return NextResponse.json({ error: "Fraud detected: You do not own this artwork." }, { status: 403 });

        // 2. Does this competition exist and is it officially declared?
        const realComp = await Competition.findOne({ hashtag: showcasedAchievement.hashtag, resultsDeclared: true }).lean();
        if (!realComp) return NextResponse.json({ error: "Fraud detected: Competition not found or not finished." }, { status: 403 });

        // 3. Did this specific artwork actually get the rank they are claiming?
        const actualRank = realComp.rankings.find(r => r.artworkId === realArt._id.toString());
        if (!actualRank || actualRank.rank !== showcasedAchievement.rank) {
           return NextResponse.json({ error: "Fraud detected: Fake ranking." }, { status: 403 });
        }

        // It passed all checks! It is a legitimate achievement. Save it.
        updateData.showcasedAchievement = showcasedAchievement;
      }
    }
    
    // 🛡️ 👉 STRICT USERNAME VALIDATION
    if (username) {
      const cleanUsername = username.replace('@', '').trim().slice(0, 30);
      
      const existingUser = await User.findOne({
        username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
        telegramId: { $ne: telegramId } 
      }).lean();

      if (existingUser) {
        return NextResponse.json({ error: "That username is already taken!" }, { status: 400 });
      }
      
      updateData.username = cleanUsername;
    }

    const user = await User.findOneAndUpdate(
      { telegramId }, { $set: updateData }, { returnDocument: 'after' } 
    );

    // 👉 Mass-Update Historical Artworks & Critiques!
    if (firstName || username) {
      const artUpdate = {};
      if (firstName) artUpdate.firstName = updateData.firstName;
      if (username) artUpdate.username = updateData.username;

      await Promise.all([
        Artwork.updateMany({ telegramId }, { $set: artUpdate }),
        username ? Critique.updateMany({ critiquerId: telegramId }, { $set: { critiquerUsername: updateData.username } }) : Promise.resolve()
      ]);
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Profile Update Error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}