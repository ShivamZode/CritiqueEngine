import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import Notification from '@/models/Notification';
// 👉 IMPORT THE BOUNCER
import { authenticateUser } from '@/lib/auth'; 

export async function DELETE(req, context) {
  try {
    const params = await context.params;
    const { id, commentId } = params;
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get('telegramId');
    const replyId = searchParams.get('replyId');

    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 COMMENT DELETION SPOOFING BLOCKED: User ${authUser.telegramId} tried to act as ${telegramId}`);
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }

    await connectToDatabase();
    const art = await Artwork.findById(id);
    if (!art) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });

    const comment = art.comments.id(commentId);
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // 🛡️ 👉 SECURITY CHECK 3: OWNERSHIP VERIFICATION
    let targetOwnerId = comment.telegramId;
    if (replyId) {
      const targetReply = comment.replies.id(replyId);
      if (!targetReply) return NextResponse.json({ error: "Reply not found" }, { status: 404 });
      targetOwnerId = targetReply.telegramId;
    }

    if (String(targetOwnerId) !== String(authUser.telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 DELETION HIJACK BLOCKED: User ${authUser.telegramId} tried to delete a comment owned by ${targetOwnerId}`);
      return NextResponse.json({ error: "You don't have permission to delete this comment." }, { status: 403 });
    }

    // 👉 PROCEED WITH DELETION
    if (replyId) {
      comment.replies.pull(replyId);
    } else {
      art.comments.pull(commentId);
    }

    await art.save();
    
    // CLEANUP
    try {
       await Notification.deleteMany({ itemId: id, type: { $in: ['comment', 'reply'] } });
    } catch(e) {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}