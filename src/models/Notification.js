import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  recipientId: { type: String, required: true }, // Who gets the notification
  senderId: { type: String, required: true }, // Who caused the notification
  senderUsername: { type: String, required: true },
  
  // Standardized Types: 'like', 'comment', 'reply', 'critique', 'new_post', 'follow'
  type: { type: String, required: true }, 
  itemId: { type: String }, // The Art ID, Critique ID, or User ID
  commentId: { type: String },
  
  message: { type: String, required: true }, // E.g., "liked your artwork"
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

// 1. Super fast lookups for a user's notification feed
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

// 2. Speeds up exact matching
NotificationSchema.index({ recipientId: 1, senderId: 1, type: 1, itemId: 1 });

// 👉 THE FIX: Auto-Garbage Collection (TTL Index)
// MongoDB will automatically delete documents in this collection 14 days after they are created.
// 14 days = 1,209,600 seconds. This is how you survive on the Free Tier!
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export default Notification;

// 👉 THE MAGIC HELPER FUNCTION 
// Note: Likes and Comments use their own advanced aggregation logic inside their API routes now!
// This helper is perfect for simple 1-to-1 alerts (like Follows or basic Critiques).
export async function sendNotification({ recipientId, senderId, senderUsername, type, itemId, message }) {
  // Rule 1: Never send a notification to yourself!
  if (String(recipientId) === String(senderId)) return;

  try {
    // Rule 2: Prevent duplicate spam for simple 1-to-1 actions (like Follows)
    if (type === 'follow' || type === 'critique') {
      const existingAction = await Notification.findOne({ recipientId, senderId, type, itemId });
      if (existingAction) return; // Already notified them!
    }

    await Notification.create({ recipientId, senderId, senderUsername, type, itemId, message });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}