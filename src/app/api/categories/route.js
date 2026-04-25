import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Category from '@/models/Category';

// 👉 Force Next.js to never cache this, so searches are always live!
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || ''; // Grab the search text

    await connectToDatabase();

    // If there is text, search for it. Otherwise, get the top 20 globally.
    let query = {};
    if (q) {
      query.name = { $regex: new RegExp(q, 'i') }; 
    }

    // Fetch the top 20 most used categories matching the query
    const categories = await Category.find(query).sort({ count: -1 }).limit(20).lean();
    
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}