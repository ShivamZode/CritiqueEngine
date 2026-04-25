import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Critique from '@/models/Critique';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { authenticateUser } from '@/lib/auth'; 
// 👉 IMPORT THE TELEGRAM NOTIFIER
import { sendTelegramDM } from '@/lib/telegramNotify';

export async function POST(req, context) {
  try {
    const params = await context.params;
    const { id } = params; 
    const { telegramId } = await req.json();
    
    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 CRITIQUE LIKE SPOOFING BLOCKED: User ${authUser.telegramId} tried to like as ${telegramId}`);
      return NextResponse.json({ error: "Identity mismatch. You cannot perform this action for another user." }, { status: 403 });
    }

    await connectToDatabase(); 
    const crit = await Critique.findById(id);
    if (!crit) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const hasLiked = crit.likes && crit.likes.includes(telegramId);

    if (hasLiked) {
      // UNLIKE
      crit.likes = crit.likes.filter(uid => uid !== telegramId);
    } else {
      // LIKE
      if (!crit.likes) crit.likes = [];
      crit.likes.push(telegramId);

      // 👉 AGGREGATED NOTIFICATION LOGIC & SPAM SHIELD
      if (String(crit.critiquerId) !== String(telegramId)) {
        const user = await User.findOne({ telegramId }).lean();
        const senderName = user?.username || user?.firstName || 'Someone';

        const existingNotif = await Notification.findOne({
          recipientId: crit.critiquerId,
          type: 'like', // Unified type for styling
          itemId: id,
          isRead: false
        });

        const likeCount = crit.likes.length;
        let notifMessage = 'liked your critique.';
        if (likeCount > 1) {
          const othersText = likeCount - 1 === 1 ? 'other' : 'others';
          notifMessage = `and ${likeCount - 1} ${othersText} liked your critique.`;
        }

        if (existingNotif) {
          const isSpamToggling = String(existingNotif.senderId) === String(telegramId);

          await Notification.findByIdAndUpdate(existingNotif._id, {
            $set: { 
              senderId: telegramId,
              senderUsername: senderName, 
              message: notifMessage,
              createdAt: new Date() // Bump to top
            }
          });

          // Only send DM if it's a new person adding a like
          if (!isSpamToggling) {
            sendTelegramDM(crit.critiquerId, `❤️ <b>${senderName}</b> and others liked your critique!`, `crit_${id}`);
          }
        } else {
          await Notification.create({
            recipientId: crit.critiquerId,
            senderId: telegramId,
            senderUsername: senderName,
            type: 'like',
            itemId: id,
            message: notifMessage
          });
          
          sendTelegramDM(crit.critiquerId, `❤️ <b>${senderName}</b> liked your critique!`, `crit_${id}`);
        }
      }
    }

    await crit.save(); 
    return NextResponse.json({ success: true, likes: crit.likes });
  } catch (err) { 
    return NextResponse.json({ error: "Failed" }, { status: 500 }); 
  }
}