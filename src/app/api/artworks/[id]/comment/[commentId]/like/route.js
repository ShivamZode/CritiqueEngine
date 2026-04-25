import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { authenticateUser } from '@/lib/auth'; 
import { sendTelegramDM } from '@/lib/telegramNotify'; 

export async function POST(req, context) {
  try {
    const params = await context.params;
    const { id, commentId } = params;
    const { telegramId, replyId } = await req.json(); 
    
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }

    await connectToDatabase();
    const art = await Artwork.findById(id);
    if (!art) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });

    const comment = art.comments.id(commentId);
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const user = await User.findOne({ telegramId }).lean();
    const username = user?.username || 'Someone';

    let targetOwnerId = null;
    let targetLikesArray = [];

    if (replyId) {
      const reply = comment.replies.id(replyId);
      if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 });
      
      const isLiked = reply.likes.includes(telegramId);
      if (isLiked) reply.likes = reply.likes.filter(userId => userId !== telegramId);
      else reply.likes.push(telegramId);
      
      targetOwnerId = reply.telegramId;
      targetLikesArray = reply.likes;
    } else {
      const isLiked = comment.likes.includes(telegramId);
      if (isLiked) comment.likes = comment.likes.filter(userId => userId !== telegramId);
      else comment.likes.push(telegramId);
      
      targetOwnerId = comment.telegramId;
      targetLikesArray = comment.likes;
    }

    if (targetLikesArray.includes(telegramId) && targetOwnerId !== telegramId) {
      const existingNotif = await Notification.findOne({ recipientId: targetOwnerId, type: 'like', itemId: id, isRead: false });

      const likeCount = targetLikesArray.length;
      let notifMessage = 'liked your comment.';
      if (likeCount > 1) {
        const othersText = likeCount - 1 === 1 ? 'other' : 'others';
        notifMessage = `and ${likeCount - 1} ${othersText} liked your comment.`;
      }

      if (existingNotif) {
        // 👉 THE SPAM SHIELD
        const isSpamToggling = String(existingNotif.senderId) === String(telegramId);

        await Notification.findByIdAndUpdate(existingNotif._id, {
          $set: { 
            senderId: telegramId,
            senderUsername: username, 
            message: notifMessage, 
            createdAt: new Date() 
          }
        });

        // 👉 ONLY DM IF IT'S A NEW PERSON
        if (!isSpamToggling) {
          sendTelegramDM(
            targetOwnerId,
            `❤️ <b>${username}</b> and others liked your comment!`,
            `view_${id}`
          );
        }
      } else {
        await Notification.create({
          recipientId: targetOwnerId, senderId: telegramId, senderUsername: username, type: 'like', itemId: id, message: notifMessage
        });

        sendTelegramDM(
          targetOwnerId,
          `❤️ <b>${username}</b> liked your comment!`,
          `view_${id}`
        );
      }
    }

    await art.save();
    return NextResponse.json({ success: true, comments: art.comments });
  } catch (error) {
    return NextResponse.json({ error: "Failed to like" }, { status: 500 });
  }
}