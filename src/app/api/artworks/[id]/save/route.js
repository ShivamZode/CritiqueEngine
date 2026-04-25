import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
// 👉 IMPORT THE BOUNCER
import { authenticateUser } from '@/lib/auth'; 

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { telegramId } = await req.json();

    // 🛡️ 👉 SECURITY CHECK 1: THE BOUNCER
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized. Invalid signature or session." }, { status: 401 });
    }

    // 🛡️ 👉 SECURITY CHECK 2: ANTI-SPOOFING
    if (String(authUser.telegramId) !== String(telegramId) && !authUser.isAdmin) {
      console.warn(`🚨 SAVE SPOOFING BLOCKED: User ${authUser.telegramId} tried to save art for ${telegramId}`);
      return NextResponse.json({ error: "Identity mismatch. You cannot perform this action for another user." }, { status: 403 });
    }
    
    await connectToDatabase();
    let user = await User.findOne({ telegramId });
    if (!user) user = await User.create({ telegramId });

    const isSaved = user.savedArts.includes(id);
    if (isSaved) {
      user.savedArts = user.savedArts.filter(artId => artId !== id); // Un-save
    } else {
      user.savedArts.push(id); // Save
    }

    await user.save();
    return NextResponse.json({ success: true, savedArtsList: user.savedArts });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save artwork" }, { status: 500 });
  }
}