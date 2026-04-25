import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Competition from '@/models/Competition';
import User from '@/models/User';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { uploadWithKeyRotation } from '@/lib/imgbbUploader';
import bcrypt from 'bcryptjs';

// 👉 Helper to keep code dry
async function verifyAdminPassword(req) {
  const adminId = req.headers.get('x-admin-id');
  const adminPassword = decodeURIComponent(req.headers.get('x-admin-password') || '');
  if (!adminPassword) return false;
  
  const adminUser = await User.findOne({ telegramId: adminId });
  if (!adminUser || !adminUser.webPassword) return false;
  
  return await bcrypt.compare(adminPassword, adminUser.webPassword);
}

export async function GET(req) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await connectToDatabase();
    const comps = await Competition.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, competitions: comps });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch competitions" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const isAdmin = await verifyAdminRequest(req); 
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    await connectToDatabase();
    
    // 👉 Check Password
    const isAuthValid = await verifyAdminPassword(req);
    if (!isAuthValid) return NextResponse.json({ error: "Incorrect admin password!" }, { status: 401 });

    const body = await req.json();
    
    if (body.hashtag) body.hashtag = body.hashtag.replace('#', '').trim().toLowerCase();

    if (body.tempImageUrl) {
      const imgbbData = await uploadWithKeyRotation(body.tempImageUrl);
      body.referenceImageUrl = imgbbData.url; 
    }
    
    delete body.tempImageUrl;
    const comp = await Competition.create(body);
    return NextResponse.json({ success: true, competition: comp });
  } catch (error) {
    console.error("Competition Creation Error:", error); 
    return NextResponse.json({ error: "Failed to create competition" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const isAdmin = await verifyAdminRequest(req); 
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    
    await connectToDatabase();
    
    // 👉 Check Password
    const isAuthValid = await verifyAdminPassword(req);
    if (!isAuthValid) return NextResponse.json({ error: "Incorrect admin password!" }, { status: 401 });

    const body = await req.json();
    
    if (body.action === 'declareResults') {
      const { id, rankings } = body;
      const comp = await Competition.findByIdAndUpdate(id, { 
        resultsDeclared: true, rankings 
      }, { new: true });
      return NextResponse.json({ success: true, competition: comp });
    } 
    else {
      const { id, isActive } = body;
      const comp = await Competition.findByIdAndUpdate(id, { isActive }, { new: true });
      return NextResponse.json({ success: true, competition: comp });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}