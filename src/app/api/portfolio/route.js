import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';
import User from '@/models/User';
import Critique from '@/models/Critique';
import Competition from '@/models/Competition';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get('telegramId');
    const tab = searchParams.get('tab') || 'gallery';
    
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 15;
    const skip = (page - 1) * limit;

    if (!telegramId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await connectToDatabase();
    let user = await User.findOne({ telegramId }).lean();
    if (!user) user = await User.create({ telegramId, username: 'Unknown', firstName: 'Artist' });

    let items = [];
    let hasMore = false;

    if (tab === 'gallery') {
      const rawArtworks = await Artwork.find({ telegramId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      items = rawArtworks.map(a => ({ ...a, artistPhotoUrl: user.photoUrl }));
      hasMore = rawArtworks.length === limit;
    } 
    else if (tab === 'saved') {
      const rawSavedArts = await Artwork.find({ _id: { $in: user.savedArts || [] } }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      
      const uniqueArtistIds = [...new Set(rawSavedArts.map(a => a.telegramId))];
      const artistProfiles = await User.find({ telegramId: { $in: uniqueArtistIds } }).lean();
      const artistPhotoMap = {};
      artistProfiles.forEach(p => artistPhotoMap[p.telegramId] = p.photoUrl);
      
      items = rawSavedArts.map(a => ({ ...a, artistPhotoUrl: artistPhotoMap[a.telegramId] || null }));
      hasMore = rawSavedArts.length === limit;
    } 
    // 👉 NEW: Dedicated Saved Critiques Tab!
    else if (tab === 'savedCrits') {
      const rawSavedCrits = await Critique.find({ _id: { $in: user.savedCrits || [] } }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      
      // Hydrate the critiques with original artwork info
      const uniqueArtIds = [...new Set(rawSavedCrits.map(c => c.artworkId))];
      const originalArts = await Artwork.find({ _id: { $in: uniqueArtIds } }).lean();
      const artMap = {};
      originalArts.forEach(a => artMap[a._id] = a);

      const uniqueArtistIds = [...new Set(originalArts.map(a => a.telegramId))];
      const artistProfiles = await User.find({ telegramId: { $in: uniqueArtistIds } }).lean();
      const artistPhotoMap = {};
      artistProfiles.forEach(p => artistPhotoMap[p.telegramId] = p.photoUrl);

      // Grab the photo of the critic as well
      const criticIds = [...new Set(rawSavedCrits.map(c => c.critiquerId))];
      const criticProfiles = await User.find({ telegramId: { $in: criticIds } }).lean();
      const criticPhotoMap = {};
      criticProfiles.forEach(p => criticPhotoMap[p.telegramId] = p.photoUrl);

      items = rawSavedCrits.map(crit => {
        const originalArt = artMap[crit.artworkId];
        let photo = originalArt ? artistPhotoMap[originalArt.telegramId] : null;
        let criticPhoto = criticPhotoMap[crit.critiquerId] || null;
        
        return {
          ...crit,
          originalThumbnail: originalArt?.thumbnailUrl || originalArt?.imageUrl || crit.originalImageUrl,
          originalTitle: originalArt?.title || 'Unknown Artwork',
          originalArtistName: originalArt?.firstName || 'Unknown Artist',
          originalArtistUsername: originalArt?.username || 'unknown',
          originalArtistId: originalArt?.telegramId || null,
          originalArtistPhotoUrl: photo, 
          critiquerPhotoUrl: criticPhoto,
          originalArtObject: originalArt || null 
        };
      });
      hasMore = rawSavedCrits.length === limit;
    }
    else if (tab === 'critiques') {
      const rawCritiques = await Critique.find({ critiquerId: telegramId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      
      const uniqueArtIds = [...new Set(rawCritiques.map(c => c.artworkId))];
      const originalArts = await Artwork.find({ _id: { $in: uniqueArtIds } }).lean();
      const artMap = {};
      originalArts.forEach(a => artMap[a._id] = a);

      const uniqueArtistIds = [...new Set(originalArts.map(a => a.telegramId))];
      const artistProfiles = await User.find({ telegramId: { $in: uniqueArtistIds } }).lean();
      const artistPhotoMap = {};
      artistProfiles.forEach(p => artistPhotoMap[p.telegramId] = p.photoUrl);

      items = rawCritiques.map(crit => {
        const originalArt = artMap[crit.artworkId];
        let photo = originalArt ? artistPhotoMap[originalArt.telegramId] : null;
        
        return {
          ...crit,
          originalThumbnail: originalArt?.thumbnailUrl || originalArt?.imageUrl || crit.originalImageUrl,
          originalTitle: originalArt?.title || 'Unknown Artwork',
          originalArtistName: originalArt?.firstName || 'Unknown Artist',
          originalArtistUsername: originalArt?.username || 'unknown',
          originalArtistId: originalArt?.telegramId || null,
          originalArtistPhotoUrl: photo, 
          critiquerPhotoUrl: user.photoUrl,
          originalArtObject: originalArt || null 
        };
      });
      hasMore = rawCritiques.length === limit;
    }
    else if (tab === 'competitions') {
      const rawComps = await Competition.find({})
        .sort({ isActive: -1, createdAt: -1 }) 
        .skip(skip)
        .limit(limit)
        .lean();
      items = rawComps;
      hasMore = rawComps.length === limit;
    }
    else if (tab === 'achievements') {
      // 1. Get all artworks created by this user
      const userArts = await Artwork.find({ telegramId }, '_id thumbnailUrl imageUrl').lean();
      const userArtIds = userArts.map(a => a._id.toString());

      // 2. 👉 THE FIX: Fetch ALL declared comps and filter in memory to bypass Mongoose's Mixed Array bugs
      const comps = await Competition.find({ resultsDeclared: true }).lean();

      let achievements = [];
      comps.forEach(comp => {
        if (!comp.rankings) return; // Safety check

        // 3. Find which specific artworks won in this comp (safely converted to strings)
        const winningRanks = comp.rankings.filter(r => userArtIds.includes(r.artworkId?.toString()));
        
        winningRanks.forEach(ranking => {
          const art = userArts.find(a => a._id.toString() === ranking.artworkId?.toString());
          
          if (art) {
            achievements.push({
              _id: `${comp._id}-${ranking.artworkId}`, 
              competitionName: comp.name,
              hashtag: comp.hashtag,
              rank: ranking.rank,
              date: comp.endTime,
              difficulty: comp.difficulty || 'Breeze 🌱', // 👉 NEW: Injecting difficulty for the Showcase!
              thumbnailUrl: art.thumbnailUrl || art.imageUrl,
              artworkId: art._id.toString()
            });
          }
        });
      });

      // Sort by best rank first (1st place at the top), then by newest dates
      achievements.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return new Date(b.date) - new Date(a.date);
      });

      // Handle pagination slices manually since we processed it in JS
      items = achievements.slice(skip, skip + limit);
      hasMore = (skip + limit) < achievements.length;
    }

    let displayFirstName = user.firstName; let displayUsername = user.username;
    if ((!displayFirstName || displayFirstName === 'Artist' || displayFirstName === 'Unknown') && items.length > 0 && tab === 'gallery') {
      displayFirstName = items[0].firstName; displayUsername = items[0].username;
    }

    return NextResponse.json({ 
      success: true, 
      user: { 
        firstName: displayFirstName, 
        username: displayUsername, 
        photoUrl: user.photoUrl, 
        bio: user.bio || '', 
        followers: user.followers || [], 
        following: user.following || [], 
        savedArtsList: user.savedArts || [],
        savedCritsList: user.savedCrits || [], // 👉 NEW: Include the list so the UI knows what is saved!
        showcasedAchievement: user.showcasedAchievement || null,
        hasWebPassword: !!user.webPassword
      },
      items,      
      hasMore
    });
  } catch (error) { 
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500 }); 
  }
}