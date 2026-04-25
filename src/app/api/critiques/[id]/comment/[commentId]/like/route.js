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
    const { id, commentId } = params; 
    const { telegramId, replyId } = await req.json();
    
    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 COMMENT LIKE SPOOFING BLOCKED: User ${authUser.telegramId} tried to like as ${telegramId}`);
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }

    await connectToDatabase(); 
    const crit = await Critique.findById(id);
    if (!crit) return NextResponse.json({ error: "Critique not found" }, { status: 404 });

    const comment = crit.comments.id(commentId);
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // Fetch the user to get their username for the notification
    const user = await User.findOne({ telegramId }).lean();
    const username = user?.username || 'Someone';

    let targetOwnerId = null;
    let targetLikesArray = [];

    if (replyId) {
      const reply = comment.replies.id(replyId);
      if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 });

      const isLiked = reply.likes.includes(telegramId);
      if (isLiked) reply.likes = reply.likes.filter(uid => uid !== telegramId); 
      else reply.likes.push(telegramId);

      targetOwnerId = reply.telegramId;
      targetLikesArray = reply.likes;
    } else {
      const isLiked = comment.likes.includes(telegramId);
      if (isLiked) comment.likes = comment.likes.filter(uid => uid !== telegramId); 
      else comment.likes.push(telegramId);

      targetOwnerId = comment.telegramId;
      targetLikesArray = comment.likes;
    }

    // 👉 AGGREGATED COMMENT LIKE NOTIFICATION & SPAM SHIELD
    if (targetLikesArray.includes(telegramId) && targetOwnerId !== telegramId) {
      const existingNotif = await Notification.findOne({ recipientId: targetOwnerId, type: 'like', itemId: id, isRead: false });

      const likeCount = targetLikesArray.length;
      let notifMessage = 'liked your comment.';
      if (likeCount > 1) {
        const othersText = likeCount - 1 === 1 ? 'other' : 'others';
        notifMessage = `and ${likeCount - 1} ${othersText} liked your comment.`;
      }

      if (existingNotif) {
        const isSpamToggling = String(existingNotif.senderId) === String(telegramId);

        await Notification.findByIdAndUpdate(existingNotif._id, {
          $set: { senderId: telegramId, senderUsername: username, message: notifMessage, createdAt: new Date() }
        });

        // Only DM if it's a new person adding a like
        if (!isSpamToggling) {
          sendTelegramDM(targetOwnerId, `❤️ <b>${username}</b> and others liked your comment on a critique!`, `crit_${id}`);
        }
      } else {
        await Notification.create({
          recipientId: targetOwnerId, senderId: telegramId, senderUsername: username, type: 'like', itemId: id, message: notifMessage
        });
        
        sendTelegramDM(targetOwnerId, `❤️ <b>${username}</b> liked your comment on a critique!`, `crit_${id}`);
      }
    }

    await crit.save(); 
    return NextResponse.json({ success: true, comments: crit.comments });
  } catch (err) { 
    return NextResponse.json({ error: "Failed" }, { status: 500 }); 
  }
}