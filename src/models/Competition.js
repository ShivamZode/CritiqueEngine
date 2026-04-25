import mongoose from 'mongoose';

const CompetitionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hashtag: { type: String, required: true, unique: true }, // e.g., "weeklycomp"
  referenceImageUrl: { type: String }, // Optional reference photo
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  rules: { type: String, default: '' },
  difficulty: { type: String, default: 'Breeze 🌱' },
  resultsDeclared: { type: Boolean, default: false },
  rankings: { type: Array, default: [] }, // Stores [{ artworkId, rank }]
  
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Competition || mongoose.model('Competition', CompetitionSchema);