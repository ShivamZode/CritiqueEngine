import mongoose from 'mongoose';

const LegalDocSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true }, // 'terms' or 'privacy'
  content: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.models.LegalDoc || mongoose.model('LegalDoc', LegalDocSchema);