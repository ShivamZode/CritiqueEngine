import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { authenticateUser } from '@/lib/auth'; // 👉 1. Import the Bouncer

export async function GET(req) {
  try {
    // 🛡️ 👉 BOUNCER CHECK: Verifies Telegram Signature OR JWT Cookie
    const authUser = await authenticateUser(req);
    
    if (!authUser) {
      // 👉 THE FIX: Explicitly send a 401 Unauthorized status code!
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // If they pass the bouncer, fetch their fresh legal status from the database
    await connectToDatabase();
    const dbUser = await User.findOne({ telegramId: authUser.telegramId }).lean();
    
    return NextResponse.json({ 
      success: true, 
      user: { 
        id: authUser.telegramId, 
        username: authUser.username, 
        firstName: dbUser?.firstName || authUser.firstName || 'Artist',
        isAdmin: authUser.isAdmin === true,
        // Get the real status straight from the DB
        hasAcceptedTerms: dbUser ? (dbUser.hasAcceptedTerms === true) : false
      } 
    });
  } catch (error) {
    // 👉 THE FIX: Send 401 on server crash too
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 401 });
  }
}