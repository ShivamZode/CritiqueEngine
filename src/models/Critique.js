import mongoose from 'mongoose';

const CritiqueSchema = new mongoose.Schema({
  artworkId: { type: String, required: true }, // 👉 THE FIX: Added artworkId
  originalImageUrl: { type: String, required: true },
  critiquerId: { type: String, required: true },
  critiquerUsername: { type: String },
  critiqueImageUrl: { type: String, required: true },
  comment: { type: String },
  views: { type: Number, default: 0 },

  isAdult: { type: Boolean, default: false },

  showcasedAchievement: { type: Object, default: null },
  
  // --- NEW: SOCIAL FEATURES FOR CRITIQUES ---
  likes: { type: [String], default: [] }, 
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
      likes: { type: [String], default: [] }, 
      createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

// Faster lookups when loading an artwork's specific critiques
CritiqueSchema.index({ artworkId: 1, createdAt: -1 });

// Faster lookups for finding all critiques made by a specific user
CritiqueSchema.index({ critiquerId: 1, createdAt: -1 });

export default mongoose.models.Critique || mongoose.model('Critique', CritiqueSchema);