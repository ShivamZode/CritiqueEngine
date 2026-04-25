import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';

export async function GET() {
  try {
    await connectToDatabase();
    
    const artists = await Artwork.aggregate([
      // Group by Telegram ID as the primary key so we can join accurately
      { $group: { _id: { telegramId: "$telegramId", username: "$username", firstName: "$firstName" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      // JOIN with the Users table to grab the photoUrl
      { 
        $lookup: {
          from: "users",
          localField: "_id.telegramId",
          foreignField: "telegramId",
          as: "userInfo"
        }
      },
      // Flatten the joined array
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      // Format the final output
      { 
        $project: { 
          telegramId: "$_id.telegramId",
          username: "$_id.username", 
          firstName: "$_id.firstName", 
          photoUrl: "$userInfo.photoUrl", // Inject the profile picture!
          count: 1, 
          _id: 0 
        } 
      }
    ]);

    const validArtists = artists.filter(a => a.username || a.firstName);

    return NextResponse.json({ success: true, artists: validArtists });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch artists" }, { status: 500 });
  }
}