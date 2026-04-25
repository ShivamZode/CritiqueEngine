import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import User from '@/models/User'; // 👉 NEW: Import User model to check who they follow

export async function GET(req) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const artist = searchParams.get('artist') || '';
    const sortMode = searchParams.get('sort') || 'newest'; 
    
    // 👉 NEW: Extract Following parameters
    const followingOnly = searchParams.get('followingOnly') === 'true';
    const currentUserId = searchParams.get('telegramId');
    
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 12; 
    const skip = (page - 1) * limit;

    let query = {};

    if (search) query.$or = [ { title: { $regex: search, $options: 'i' } }, { caption: { $regex: search, $options: 'i' } } ];
    if (category) query.categories = { $regex: new RegExp(`^${category}$`, 'i') };
    if (artist) query.username = artist; 

    // 👉 NEW: The Following Filter Logic
    if (followingOnly && currentUserId) {
      const user = await User.findOne({ telegramId: currentUserId }).lean();
      
      if (user && user.following && user.following.length > 0) {
        // Only get art where the creator's ID is in our following list
        query.telegramId = { $in: user.following };
      } else {
        // If they don't follow anyone (or the user isn't found), return empty feed
        return NextResponse.json({ success: true, artworks: [], hasMore: false });
      }
    }

    let pipeline = [ { $match: query } ];

    // If sorting by popular, calculate the score first
    if (sortMode === 'popular') {
      pipeline.push(
        {
          $addFields: {
            likeCount: { $size: { $ifNull: ["$likes", []] } },
            viewsCount: { $ifNull: ["$views", 0] }
          }
        },
        {
          $addFields: {
            popularityScore: { $add: ["$likeCount", "$viewsCount"] }
          }
        },
        { 
          // Sort by Score -> then Likes -> then Views -> then Newest
          $sort: { popularityScore: -1, likeCount: -1, viewsCount: -1, createdAt: -1 } 
        }
      );
    } else {
      // Default Newest sort
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    // Add the rest of the pagination and user lookup stages
    pipeline.push(
      { $skip: skip }, 
      { $limit: limit },  
      {
        $lookup: {
          from: 'users',
          localField: 'telegramId',
          foreignField: 'telegramId',
          as: 'artistInfo'
        }
      },
      { $unwind: { path: '$artistInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          artistPhotoUrl: '$artistInfo.photoUrl'
        }
      },
      { $project: { artistInfo: 0 } } 
    );

    const artworks = await Artwork.aggregate(pipeline);
    
    const hasMore = artworks.length === limit;

    return NextResponse.json({ success: true, artworks, hasMore });
  } catch (error) {
    console.error("Feed Error:", error);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}