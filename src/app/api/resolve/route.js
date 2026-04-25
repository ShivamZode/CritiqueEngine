import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import Critique from '@/models/Critique';
import User from '@/models/User';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await connectToDatabase();
    
    // 1. Check if it is an Artwork
    const art = await Artwork.findById(id).lean();
    if (art) {
       return NextResponse.json({ success: true, type: 'artwork', item: art });
    }

    // 2. Check if it is a Critique
    const crit = await Critique.findById(id).lean();
    if (crit) {
       // We enrich the critique exactly like we do in Portfolio.js so it renders perfectly
       const originalArt = await Artwork.findById(crit.artworkId).lean();
       let artistPhoto = null;
       if (originalArt) {
         const artOwner = await User.findOne({ telegramId: originalArt.telegramId }).lean();
         artistPhoto = artOwner?.photoUrl || null;
       }

       const enrichedCrit = {
         ...crit,
         originalThumbnail: originalArt?.thumbnailUrl || originalArt?.imageUrl || crit.originalImageUrl,
         originalTitle: originalArt?.title || 'Unknown Artwork',
         originalArtistName: originalArt?.firstName || 'Unknown Artist',
         originalArtistUsername: originalArt?.username || 'unknown',
         originalArtistId: originalArt?.telegramId || null,
         originalArtistPhotoUrl: artistPhoto, 
         originalArtObject: originalArt || null 
       };

       return NextResponse.json({ success: true, type: 'critique', item: enrichedCrit });
    }

    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}