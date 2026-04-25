import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Notification from '@/models/Notification';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get('telegramId');

    if (!telegramId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await connectToDatabase();
    
    // Get the 50 most recent notifications
    const notifications = await Notification.find({ recipientId: telegramId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({ recipientId: telegramId, isRead: false });

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { telegramId } = await req.json();
    await connectToDatabase();
    
    // Mark ALL notifications as read for this user
    await Notification.updateMany(
      { recipientId: telegramId, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}