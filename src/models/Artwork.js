import mongoose from 'mongoose';

const ArtworkSchema = new mongoose.Schema({
  telegramId: { type: String, required: true },
  username: { type: String },
  firstName: { type: String },
  imageUrl: { type: String, required: true },
  thumbnailUrl: { type: String }, 
  encodedImageUrl: { type: String }, 
  isPredefined: { type: Boolean, default: false },
  isAdult: { type: Boolean, default: false },
  title: { type: String, required: true },
  caption: { type: String },
  categories: { type: [String], required: true, default: [] },
  likes: { type: [String], default: [] },
  views: { type: Number, default: 0 }, 
  showcasedAchievement: { type: Object, default: null },
  
  comments: [{
    telegramId: String,
    username: String,
    photoUrl: String,
    text: String,
    showcasedAchievement: { type: Object, default: null },
    likes: { type: [String], default: [] }, 
    replies: [{
      telegramId: String,
      username: String,
      photoUrl: String,
      text: String,
      showcasedAchievement: { type: Object, default: null },
      likes: { type: [String], default: [] }, // NEW: Replies can now be liked!
      createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

// Compound index for the 24-hour upload quota check
ArtworkSchema.index({ telegramId: 1, createdAt: -1 });

// Index for exploring feeds by newest first
ArtworkSchema.index({ createdAt: -1 });

// Index for filtering by category
ArtworkSchema.index({ categories: 1 });

export default mongoose.models.Artwork || mongoose.model('Artwork', ArtworkSchema);