import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Artwork from '@/models/Artwork'; 

export async function POST(req) {
  try {
    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids)) return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });

    await connectToDatabase();
    
    const users = await User.find({ telegramId: { $in: ids } }).lean();

    const enrichedUsers = await Promise.all(users.map(async (u) => {
      if (!u.firstName || u.firstName === 'Unknown' || u.firstName === 'Artist') {
        const art = await Artwork.findOne({ telegramId: u.telegramId });
        if (art) {
          u.firstName = art.firstName;
          u.username = art.username;
        }
      }
      return u;
    }));
                            
    return NextResponse.json({ success: true, users: enrichedUsers });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user list" }, { status: 500 });
  }
}