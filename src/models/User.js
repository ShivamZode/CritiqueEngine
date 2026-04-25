import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  photoUrl: { type: String },
  telegramFileUniqueId: { type: String },
  lastPhotoSync: { type: Date },
  
  bio: { type: String, default: "" }, 

  showcasedAchievement: { type: Object, default: null },
  
  isAdmin: { type: Boolean, default: false },
  
  hasAcceptedTerms: { type: Boolean, default: false },
  isAdult: { type: Boolean, default: false }, // 18+ verification

  followers: { type: [String], default: [] },
  following: { type: [String], default: [] },
  savedArts: { type: [String], default: [] },
  savedCrits: { type: [String], default: [] },
  webPassword: { type: String },
  createdAt: { type: Date, default: Date.now },
  dailyCommentCount: { type: Number, default: 0 },
  lastCommentDate: { type: Date },

  bans: {
    uploadUntil: { type: Date, default: null },
    commentUntil: { type: Date, default: null },
    critiqueUntil: { type: Date, default: null },
    reportUntil: { type: Date, default: null },
    reason: { type: String, default: null },
    contextInfo: { type: String, default: null }
  },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);