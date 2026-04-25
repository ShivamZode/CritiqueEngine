import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function POST(req) {
  try {
    let { username, password } = await req.json();
    
    // Clean up username if they accidentally typed the "@" symbol
    username = username.replace('@', '').trim();

    await connectToDatabase();
    
    // Find user (case-insensitive)
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    
    if (!user || !user.webPassword) {
      return NextResponse.json({ error: "Invalid username or password. Have you set a Web Password in Telegram?" }, { status: 401 });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.webPassword);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    // 👉 FIX: Generate secure token WITH the isAdmin badge!
    const token = jwt.sign(
      { 
        telegramId: user.telegramId, 
        username: user.username, 
        firstName: user.firstName,
        isAdmin: user.isAdmin === true 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' } // Stays logged in for 7 days
    );

    // 👉 FIX: Create response and send the isAdmin badge to the frontend
    const res = NextResponse.json({ 
      success: true, 
      user: { 
        id: user.telegramId, 
        username: user.username, 
        firstName: user.firstName,
        isAdmin: user.isAdmin === true
      } 
    });
    
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}