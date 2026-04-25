import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import User from '@/models/User';
import Competition from '@/models/Competition';
import Critique from '@/models/Critique'; 

export const revalidate = 300;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tag = searchParams.get('tag');
    const current = searchParams.get('current');

    await connectToDatabase();

    // 👉 NEW: Fetch the latest competition for the Feed banner
    if (current === 'true') {
      const comp = await Competition.findOne().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ success: true, competition: comp });
    }

    if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });

    const competition = await Competition.findOne({ hashtag: tag.toLowerCase() }).lean();
    if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

    const regex = new RegExp(`#${tag}\\b`, 'i');
    let artworks = await Artwork.find({ caption: { $regex: regex } }).lean();

    const telegramIds = [...new Set(artworks.map(a => a.telegramId))];
    const users = await User.find({ telegramId: { $in: telegramIds } }, 'telegramId photoUrl').lean();
    const userPhotoMap = users.reduce((acc, user) => {
      acc[user.telegramId] = user.photoUrl;
      return acc;
    }, {});

    let adminCritiques = [];
    if (competition.resultsDeclared) {
      const adminUsers = await User.find({ isAdmin: true }, 'telegramId').lean();
      const adminIds = adminUsers.map(u => u.telegramId);
      
      adminCritiques = await Critique.find({
        artworkId: { $in: artworks.map(a => a._id.toString()) },
        critiquerId: { $in: adminIds }
      }).lean();
    }

    artworks = artworks.map(art => {
      const likesCount = art.likes?.length || 0;
      const commentsCount = art.comments?.length || 0;
      
      let rank = null;
      let adminCritique = null;

      if (competition.resultsDeclared) {
        const rankObj = competition.rankings?.find(r => r.artworkId === art._id.toString());
        if (rankObj) rank = rankObj.rank;
        adminCritique = adminCritiques.find(c => c.artworkId === art._id.toString()) || null;
      }

      return {
        ...art,
        _id: art._id.toString(),
        artistPhotoUrl: userPhotoMap[art.telegramId] || null,
        score: (likesCount * 2) + commentsCount,
        rank,
        adminCritique 
      };
    });

    artworks.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return NextResponse.json({ success: true, artworks, competition });
  } catch (error) {
    console.error("Competition API Error:", error);
    return NextResponse.json({ error: "Failed to fetch competition data" }, { status: 500 });
  }
}
