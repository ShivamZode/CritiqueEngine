import mongoose from 'mongoose';

const IssueSchema = new mongoose.Schema({
  telegramId: { type: String, required: true },
  username: { type: String },
  category: { type: String, required: true },
  text: { type: String, required: true, maxlength: 1000 },
  status: { type: String, default: 'open' }, // Can be 'open', 'in-progress', or 'resolved'
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Issue || mongoose.model('Issue', IssueSchema);