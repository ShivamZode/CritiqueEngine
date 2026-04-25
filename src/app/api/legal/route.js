import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import LegalDoc from '@/models/LegalDoc';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); 
    
    await connectToDatabase();
    const doc = await LegalDoc.findOne({ type });
    
    return NextResponse.json({ success: true, doc });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { telegramId, type, content } = await req.json();
    await connectToDatabase();

    // 1. Verify Admin (God Mode)
    const adminUser = await User.findOne({ telegramId });
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json({ error: "Unauthorized. God mode required." }, { status: 403 });
    }

    // 👉 THE FIX: Password Check
    const adminPassword = decodeURIComponent(req.headers.get('x-admin-password') || '');
    if (!adminPassword || !adminUser.webPassword) return NextResponse.json({ error: "Admin password required." }, { status: 401 });
    
    const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.webPassword);
    if (!isPasswordValid) return NextResponse.json({ error: "Incorrect admin password!" }, { status: 401 });

    // 2. Update or create the document
    const doc = await LegalDoc.findOneAndUpdate(
      { type },
      { content, lastUpdated: new Date() },
      { upsert: true, new: true }
    );

    // 3. WIPE ACCEPTANCE
    await User.updateMany(
      { hasAcceptedTerms: true }, 
      { $set: { hasAcceptedTerms: false } }
    );

    return NextResponse.json({ success: true, doc });
  } catch (error) {
    console.error("Legal Update Error:", error);
    return NextResponse.json({ error: "Failed to update legal documents" }, { status: 500 });
  }
}