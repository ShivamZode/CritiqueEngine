import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Critique from '@/models/Critique';

export async function POST(req, context) {
  try {
    // 👉 THE FIX: Safely await the context.params object (Required for Next.js 15+)
    const params = await context.params;
    const id = params.id;
    
    await connectToDatabase();
    
    const critique = await Critique.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
    
    return NextResponse.json({ success: true, views: critique?.views || 0 });
  } catch (error) {
    console.error("View Increment Error:", error);
    return NextResponse.json({ error: "Failed to increment views" }, { status: 500 });
  }
}