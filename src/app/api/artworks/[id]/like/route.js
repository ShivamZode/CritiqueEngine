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
    const { id } = params;
    const { telegramId } = await req.json(); 

    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }
    
    await connectToDatabase();
    
    const artwork = await Artwork.findById(id);
    if (!artwork) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });

    const hasLiked = artwork.likes.includes(telegramId);
    
    if (hasLiked) {
      // UNLIKE
      artwork.likes = artwork.likes.filter(uid => uid !== telegramId);
    } else {
      // LIKE
      artwork.likes.push(telegramId);
      
      if (artwork.telegramId !== telegramId) {
        const user = await User.findOne({ telegramId }).lean();
        const senderName = user?.username || user?.firstName || 'Someone';

        const existingNotif = await Notification.findOne({
          recipientId: artwork.telegramId,
          type: 'like',
          itemId: id,
          isRead: false
        });

        const likeCount = artwork.likes.length;
        let notifMessage = 'liked your artwork.';
        if (likeCount > 1) {
          const othersText = likeCount - 1 === 1 ? 'other' : 'others';
          notifMessage = `and ${likeCount - 1} ${othersText} liked your artwork.`;
        }

        if (existingNotif) {
          // 👉 THE SPAM SHIELD: Did this exact same user trigger this exact notification last time?
          const isSpamToggling = String(existingNotif.senderId) === String(telegramId);

          await Notification.findByIdAndUpdate(existingNotif._id, {
            $set: { 
              senderId: telegramId, // Track the newest person
              senderUsername: senderName, 
              message: notifMessage,
              createdAt: new Date() 
            }
          });

          // 👉 ONLY send the DM if it's a different person adding a new like!
          if (!isSpamToggling) {
            sendTelegramDM(
              artwork.telegramId,
              `❤️ <b>${senderName}</b> and others liked your artwork!`,
              `view_${id}` 
            );
          }
        } else {
          // Brand new notification
          await Notification.create({
            recipientId: artwork.telegramId,
            senderId: telegramId,
            senderUsername: senderName,
            type: 'like',
            itemId: id,
            message: notifMessage
          });

          sendTelegramDM(
            artwork.telegramId,
            `❤️ <b>${senderName}</b> liked your artwork!`,
            `view_${id}` 
          );
        }
      }
    }

    await artwork.save();
    return NextResponse.json({ success: true, likes: artwork.likes });
  } catch (error) {
    console.error("Like Error:", error);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}