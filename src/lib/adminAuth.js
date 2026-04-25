import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';

export async function verifyAdminRequest(req) {
  // 1. Get the user's ID from the session/header (assuming you use a session cookie or header)
  // For now, we will extract it from a custom header you'll send from the frontend
  const telegramId = req.headers.get('x-admin-id'); 

  if (!telegramId) return false;

  await connectToDatabase();
  const user = await User.findOne({ telegramId }).lean();
  
  return user && user.isAdmin;
}