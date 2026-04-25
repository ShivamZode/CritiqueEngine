import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Critique from '@/models/Critique';
import User from '@/models/User';
import { authenticateUser } from '@/lib/auth'; 

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
    
    const crit = await Critique.findById(id);
    if (!crit) return NextResponse.json({ error: "Critique not found" }, { status: 404 });

    const user = await User.findOne({ telegramId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 👉 THE FIX: We now use the savedCrits array!
    const hasSaved = user.savedCrits.includes(id);

    if (hasSaved) {
      user.savedCrits = user.savedCrits.filter(savedId => savedId !== id);
    } else {
      user.savedCrits.push(id);
    }

    await user.save();
    return NextResponse.json({ success: true, savedCrits: user.savedCrits });
  } catch (error) {
    console.error("Save Critique Error:", error);
    return NextResponse.json({ error: "Failed to toggle save" }, { status: 500 });
  }
}