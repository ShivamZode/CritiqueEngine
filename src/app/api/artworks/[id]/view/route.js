import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Artwork from '@/models/Artwork';

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    
    // $inc increments the views field by 1 atomically!
    const art = await Artwork.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
    
    return NextResponse.json({ success: true, views: art?.views || 0 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to increment views" }, { status: 500 });
  }
}