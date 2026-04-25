import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Critique from '@/models/Critique';
import Notification from '@/models/Notification';
import User from '@/models/User'; 
import { authenticateUser } from '@/lib/auth'; 
// 👉 IMPORT THE TELEGRAM NOTIFIER
import { sendTelegramDM } from '@/lib/telegramNotify';

export async function POST(req, context) {
  try {
    const params = await context.params;
    const { id } = params; 
    const { telegramId, username, photoUrl, text, replyToCommentId } = await req.json(); 
    
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

    const crit = await Critique.findById(id);
    
    let recipientId = null;
    let notifType = '';
    let notifMsg = '';
    let targetArrayLength = 0;
    let newGeneratedId = null;

    if (replyToCommentId) {
      const comment = crit.comments.id(replyToCommentId);
      comment.replies.push({ telegramId, username, photoUrl: dbPhotoUrl, showcasedAchievement: dbShowcasedAchievement, text, createdAt: new Date() }); 
      
      newGeneratedId = comment.replies[comment.replies.length - 1]._id; 
      recipientId = comment.telegramId; 
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

      notifType = 'reply';
      notifMsg = 'replied to your comment on a critique.';
      targetArrayLength = comment.replies.length;
    } else {
      crit.comments.push({ telegramId, username, photoUrl: dbPhotoUrl, showcasedAchievement: dbShowcasedAchievement, text, createdAt: new Date() }); 
      
      newGeneratedId = crit.comments[crit.comments.length - 1]._id; 
      recipientId = crit.critiquerId;
      notifType = 'comment'; 
      notifMsg = 'commented on your critique.';
      targetArrayLength = crit.comments.length;
    }

    await crit.save(); 
    await user.save();

    if (recipientId && String(recipientId) !== String(telegramId)) {
      const existingNotif = await Notification.findOne({
        recipientId: recipientId,
        type: notifType,
        itemId: id,
        isRead: false
      });

      if (existingNotif) {
        const othersText = targetArrayLength - 1 === 1 ? 'other' : 'others';
        const updatedMsg = notifType === 'reply' 
          ? `and ${targetArrayLength - 1} ${othersText} replied to your comment.` 
          : `and ${targetArrayLength - 1} ${othersText} commented on your critique.`;

        await Notification.findByIdAndUpdate(existingNotif._id, {
          $set: { senderUsername: username || 'Someone', message: updatedMsg, commentId: newGeneratedId, createdAt: new Date() }
        });
      } else {
        await Notification.create({
          recipientId: recipientId,
          senderId: telegramId,
          senderUsername: username || 'Someone',
          type: notifType,
          itemId: id,
          commentId: newGeneratedId, 
          message: notifMsg
        });
      }

      // 👉 THE INSTANT DM
      const dmPrefix = notifType === 'reply' ? 'replied to your comment on a critique' : 'commented on your critique';
      sendTelegramDM(
        recipientId,
        `💬 <b>${username || 'Someone'}</b> ${dmPrefix}: \n<i>"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"</i>`,
        `crit_${id}_c_${newGeneratedId}` // 👉 ADDED: _c_ and the ID!
      );
    }

    return NextResponse.json({ success: true, comments: crit.comments });
  } catch (err) { 
    console.error("Critique Comment Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 }); 
  }
}