import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import Notification from '@/models/Notification'; 
import User from '@/models/User'; 
import { authenticateUser } from '@/lib/auth'; 
// 👉 IMPORT THE TELEGRAM NOTIFIER
import { sendTelegramDM } from '@/lib/telegramNotify'; 

export async function POST(req, context) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await req.json();
    const { telegramId, username, text, replyToCommentId } = body; 
    
    if (!text || text.trim() === '') return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    if (text.length > 1000) return NextResponse.json({ error: "Comment exceeds 1000 characters limit" }, { status: 400 });

    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 COMMENT SPOOFING BLOCKED: User ${authUser.telegramId} tried to comment as ${telegramId}`);
      return NextResponse.json({ error: "Identity mismatch. You cannot comment as another user." }, { status: 403 });
    }

    await connectToDatabase();

    const user = await User.findOne({ telegramId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.bans?.commentUntil && new Date() < new Date(user.bans.commentUntil)) {
      const banPayload = JSON.stringify({
        message: `You are banned from commenting until ${new Date(user.bans.commentUntil).toLocaleString()}`,
        reason: user.bans.reason,
        context: user.bans.contextInfo
      });
      return NextResponse.json({ error: `BANNED_PAYLOAD|${banPayload}` }, { status: 403 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.lastCommentDate && user.lastCommentDate >= startOfToday) {
      if (user.dailyCommentCount >= 10) {
        return NextResponse.json({ error: "Daily comment limit reached. You can post a maximum of 10 comments per day." }, { status: 403 });
      }
      user.dailyCommentCount += 1;
    } else {
      user.dailyCommentCount = 1;
      user.lastCommentDate = now;
    }
    
    const dbPhotoUrl = user.photoUrl || null;
    const dbShowcasedAchievement = user.showcasedAchievement || null;

    const art = await Artwork.findById(id);
    if (!art) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });

    if (replyToCommentId) {
      const comment = art.comments.id(replyToCommentId);
      if (!comment) return NextResponse.json({ error: "Original comment not found" }, { status: 404 });
      
      comment.replies.push({ telegramId, username, photoUrl: dbPhotoUrl, showcasedAchievement: dbShowcasedAchievement, text, createdAt: new Date() }); 
      const newReplyId = comment.replies[comment.replies.length - 1]._id;

      let recipientId = comment.telegramId; 
      const mentionMatch = text.match(/^@([a-zA-Z0-9_.-]+)/);
      
      if (mentionMatch) {
          const mentionedUsername = mentionMatch[1];
          const mentionedReply = comment.replies.find(r => r.username === mentionedUsername);
          if (mentionedReply) {
              recipientId = mentionedReply.telegramId;
          } else if (comment.username !== mentionedUsername) {
              const mentionedUser = await User.findOne({ username: new RegExp(`^${mentionedUsername}$`, 'i') }).lean();
              if (mentionedUser) recipientId = mentionedUser.telegramId;
          }
      }

      if (recipientId && String(recipientId) !== String(telegramId)) {
        const existingNotif = await Notification.findOne({ recipientId: recipientId, type: 'reply', itemId: id, isRead: false });
        
        if (existingNotif) {
          const replyCount = comment.replies.length;
          await Notification.findByIdAndUpdate(existingNotif._id, {
            $set: { senderUsername: username, message: `and ${replyCount - 1} others replied to your comment.`, commentId: newReplyId, createdAt: new Date() }
          });
        } else {
          await Notification.create({
            recipientId: recipientId, senderId: telegramId, senderUsername: username, type: 'reply', itemId: id, commentId: newReplyId, message: 'replied to your comment.'
          });
        }
        // 👉 THE FIX: Move DM outside
        sendTelegramDM(
          recipientId,
          `💬 <b>${username || 'Someone'}</b> replied to your comment: \n<i>"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"</i>`,
          `view_${id}_c_${newReplyId}` // 👉 ADDED: _c_ and the ID!
        );
      }

    } else {
      art.comments.push({ telegramId, username, photoUrl: dbPhotoUrl, showcasedAchievement: dbShowcasedAchievement , text, createdAt: new Date() }); 
      const newCommentId = art.comments[art.comments.length - 1]._id;

      if (art.telegramId !== telegramId) {
        const existingNotif = await Notification.findOne({ recipientId: art.telegramId, type: 'comment', itemId: id, isRead: false });
        
        if (existingNotif) {
          const commentCount = art.comments.length;
          await Notification.findByIdAndUpdate(existingNotif._id, {
            $set: { senderUsername: username, message: `and ${commentCount - 1} others commented on your artwork.`, commentId: newCommentId, createdAt: new Date() }
          });
        } else {
          await Notification.create({
            recipientId: art.telegramId, senderId: telegramId, senderUsername: username, type: 'comment', itemId: id, commentId: newCommentId, message: 'commented on your artwork.'
          });
        }
        // 👉 THE FIX: Move DM outside
        sendTelegramDM(
          art.telegramId,
          `💬 <b>${username}</b> commented on your artwork: \n<i>"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"</i>`,
          `view_${id}_c_${newCommentId}` // 👉 ADDED: _c_ and the ID!
        );
      }
    }

    await art.save();
    await user.save(); 
    
    return NextResponse.json({ success: true, comments: art.comments });
  } catch (error) {
    console.error("Comment Error:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}