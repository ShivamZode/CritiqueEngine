import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Issue from '@/models/Issue'; // 👉 NEW: Importing the proper model!
import User from '@/models/User';

export async function POST(req) {
  try {
    const { telegramId, username, category, text } = await req.json();

    if (!telegramId || !category || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (text.length > 1000) {
      return NextResponse.json({ error: "Description exceeds 1000 characters" }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Check if the user is banned entirely
    const user = await User.findOne({ telegramId });
    if (user?.bans?.reportUntil && new Date() < new Date(user.bans.reportUntil)) {
      return NextResponse.json({ error: `You are banned from submitting reports/issues until ${new Date(user.bans.reportUntil).toLocaleString()}` }, { status: 403 });
    }

    // 2. Enforce the Daily Limit (5 per day)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const dailyIssuesCount = await Issue.countDocuments({
      telegramId,
      createdAt: { $gte: startOfDay }
    });

    if (dailyIssuesCount >= 5) {
      return NextResponse.json({ error: "Daily limit reached (5/5). Thank you for the feedback, please try again tomorrow!" }, { status: 403 });
    }

    // 3. Save the issue
    await Issue.create({
      telegramId,
      username,
      category,
      text
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Issue API Error:", error);
    return NextResponse.json({ error: "Failed to submit issue" }, { status: 500 });
  }
}