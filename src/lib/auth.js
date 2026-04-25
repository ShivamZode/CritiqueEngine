import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function authenticateUser(req) {
  try {
    // 👉 1. Check for Telegram's Cryptographic Signature (Mini App Users)
    const initDataString = req.headers.get('x-telegram-init-data');

    if (initDataString) {
      const initData = new URLSearchParams(initDataString);
      const hash = initData.get("hash");
      let dataToCheck = [];

      // Telegram requires us to sort the data alphabetically before hashing
      initData.sort();
      initData.forEach((val, key) => {
        if (key !== "hash") dataToCheck.push(`${key}=${val}`);
      });

      // Perform the HMAC-SHA256 cryptographic verification
      const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN);
      const calculatedHash = crypto.createHmac("sha256", secret.digest()).update(dataToCheck.join("\n")).digest("hex");

      if (calculatedHash === hash) {
        
        // 🛡️ 👉 THE NEW FIX: Check for expired tokens (Replay Attack Prevention)
        const authDate = parseInt(initData.get("auth_date"), 10);
        const currentUnixTime = Math.floor(Date.now() / 1000);
        const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

        if (currentUnixTime - authDate > MAX_AGE_SECONDS) {
          console.warn("⚠️ Expired Telegram Signature Detected. Possible replay attack.");
          return null; 
        }

        // SIGNATURE IS VALID AND FRESH! Extract the exact user data Telegram sent us.
        const tgUser = JSON.parse(initData.get("user"));
        const telegramId = String(tgUser.id);

        // Fetch from DB just to check if they are an Admin
        await connectToDatabase();
        const dbUser = await User.findOne({ telegramId }).lean();

        return {
          telegramId,
          username: tgUser.username,
          isAdmin: dbUser ? dbUser.isAdmin : false
        };
      }
      
      console.warn("⚠️ Invalid Telegram Signature Detected!");
      return null; // Hacker tried to forge the Telegram data!
    }

    // 👉 2. Fallback to Web Browser JWT Cookie (Standard Web Users)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      return {
        telegramId: String(decoded.telegramId),
        username: decoded.username,
        isAdmin: decoded.isAdmin === true
      };
    }

    return null; // No signature and no cookie. Kick them out.
  } catch (error) {
    console.error("Authentication Error:", error.message);
    return null;
  }
}