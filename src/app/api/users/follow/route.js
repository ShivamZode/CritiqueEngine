import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Notification from '@/models/Notification'; 
import { authenticateUser } from '@/lib/auth'; // 👉 Import Bouncer
// 👉 IMPORT THE TELEGRAM NOTIFIER
import { sendTelegramDM } from '@/lib/telegramNotify';

export async function POST(req) {
  try {
    const { currentUserId, targetUserId } = await req.json();
    
    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(currentUserId) && !authUser.isAdmin) {
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }

    if (currentUserId === targetUserId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    await connectToDatabase();
    
    let currentUser = await User.findOne({ telegramId: currentUserId });
    if (!currentUser) currentUser = await User.create({ telegramId: currentUserId });

    let targetUser = await User.findOne({ telegramId: targetUserId });
    if (!targetUser) targetUser = await User.create({ telegramId: targetUserId });

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(id => id !== targetUserId);
      targetUser.followers = targetUser.followers.filter(id => id !== currentUserId);
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);

      const senderName = currentUser.username || currentUser.firstName || 'Someone';
      
      const existingNotif = await Notification.findOne({
        recipientId: targetUserId, senderId: currentUserId, type: 'follow'
      });

      if (!existingNotif) {
        await Notification.create({
          recipientId: targetUserId, senderId: currentUserId, senderUsername: senderName,
          type: 'follow', itemId: currentUserId, message: 'started following you.'
        });

        // 🚀 👉 FIRE AND FORGET TELEGRAM DM
        sendTelegramDM(
          targetUserId, 
          `👤 <b>${senderName}</b> just started following your portfolio!`, 
          `profile_${currentUserId}` // Deep link directly to the follower's profile
        );
      }
    }

    await currentUser.save();
    await targetUser.save();

    return NextResponse.json({ success: true, following: currentUser.following });
  } catch (error) {
    return NextResponse.json({ error: "Failed to toggle follow" }, { status: 500 });
  }
}