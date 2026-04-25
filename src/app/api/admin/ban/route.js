import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { verifyAdminRequest } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized. God Mode required." }, { status: 403 });
    
    // 👉 THE FIX: Password Check
    const adminId = req.headers.get('x-admin-id');
    const adminPassword = decodeURIComponent(req.headers.get('x-admin-password') || '');
    if (!adminPassword) return NextResponse.json({ error: "Admin password required." }, { status: 401 });

    await connectToDatabase();
    
    const adminUser = await User.findOne({ telegramId: adminId });
    if (!adminUser || !adminUser.webPassword) return NextResponse.json({ error: "Admin account invalid." }, { status: 401 });
    
    const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.webPassword);
    if (!isPasswordValid) return NextResponse.json({ error: "Incorrect admin password!" }, { status: 401 });

    const { telegramId, durationHours, privileges, reason, contextInfo } = await req.json();
    if (!telegramId || !durationHours || !privileges) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const user = await User.findOne({ telegramId });
    if (!user) return NextResponse.json({ error: "User not found in the database." }, { status: 404 });

    const unbanDate = new Date(Date.now() + (durationHours * 60 * 60 * 1000));
    const currentBans = user.bans || {};

    currentBans.reason = reason || null;
    currentBans.contextInfo = contextInfo || null;

    if (privileges.upload) currentBans.uploadUntil = unbanDate;
    if (privileges.comment) currentBans.commentUntil = unbanDate;
    if (privileges.critique) currentBans.critiqueUntil = unbanDate;
    if (privileges.report) currentBans.reportUntil = unbanDate;

    user.bans = currentBans;
    await user.save();

    return NextResponse.json({ success: true, unbanDate });
  } catch (error) {
    console.error("Ban API Error:", error);
    return NextResponse.json({ error: "Failed to apply ban" }, { status: 500 });
  }
}