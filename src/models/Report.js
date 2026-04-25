import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reporterUsername: { type: String, required: true },

  parentItemId: { type: String, default: null },
  
  reportedItemId: { type: String, required: true }, // The Art ID or Critique ID
  itemType: { type: String, enum: ['artwork', 'critique', 'comment'], required: true },
  
  reportedUserId: { type: String, required: true }, // The person who posted the bad content
  
  reason: { type: String, required: true }, // e.g., "Nudity", "Harassment"
  customText: { type: String, default: '' }, // If they selected "Other"
  
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
}, { timestamps: true });

// Quick filtering for admins looking at pending reports
ReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Report || mongoose.model('Report', ReportSchema);