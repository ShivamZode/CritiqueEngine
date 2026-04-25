import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';

export async function POST(req) {
  try {
    const body = await req.json();
    const { reporterId, reporterUsername, reportedItemId, parentItemId, itemType, reportedUserId, reason, customText } = body;

    if (!reporterId || !reportedItemId || !itemType || !reportedUserId || !reason) {
      return NextResponse.json({ error: "Missing required report fields" }, { status: 400 });
    }

    if (customText && customText.length > 500) {
      return NextResponse.json({ error: "Report details cannot exceed 500 characters." }, { status: 400 });
    }

    await connectToDatabase();

    // 👉 1. BAN ENFORCEMENT CHECK
    const user = await User.findOne({ telegramId: reporterId });
    if (user?.bans?.reportUntil && new Date() < new Date(user.bans.reportUntil)) {
      return NextResponse.json({ error: `You are banned from submitting reports until ${new Date(user.bans.reportUntil).toLocaleString()}` }, { status: 403 });
    }

    // 👉 2. DAILY REPORT LIMIT CHECK (10 per day)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const dailyReportsCount = await Report.countDocuments({
      reporterId,
      createdAt: { $gte: startOfDay }
    });

    if (dailyReportsCount >= 10) {
      return NextResponse.json({ error: "Daily report limit reached (10/10). Thank you for keeping the community safe, please try again tomorrow!" }, { status: 403 });
    }
    
    const existingReport = await Report.findOne({ reporterId, reportedItemId });
    if (existingReport) {
      return NextResponse.json({ error: "You have already reported this item." }, { status: 429 });
    }

    const newReport = await Report.create({
      reporterId,
      reporterUsername,
      reportedItemId,
      parentItemId: parentItemId || null,
      itemType,
      reportedUserId,
      reason,
      customText: customText || ''
    });

    return NextResponse.json({ success: true, report: newReport });
  } catch (error) {
    console.error("Report Save Error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}