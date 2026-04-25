import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyAdminRequest } from '@/lib/adminAuth';
import Report from '@/models/Report';
import Artwork from '@/models/Artwork';
import Critique from '@/models/Critique';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function GET(req) {
   // ... keep your existing GET function completely unchanged ...
  try {
    const isAdmin = await verifyAdminRequest(req); 
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await connectToDatabase();
    const reports = await Report.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();

    const enrichedReports = await Promise.all(reports.map(async (report) => {
      const reportedUser = await User.findOne({ telegramId: report.reportedUserId }).lean();
      
      let itemSnippet = null;
      let itemImageUrl = null;
      let itemLink = null; 
      let itemTitle = null;

      if (report.itemType === 'artwork') {
        const art = await Artwork.findById(report.reportedItemId).lean();
        if (art) { 
          itemImageUrl = art.thumbnailUrl || art.imageUrl; 
          itemSnippet = art.caption; 
          itemTitle = art.title;
          itemLink = `/?art=${art._id}`; 
        }
      } 
      else if (report.itemType === 'critique') {
        const crit = await Critique.findById(report.reportedItemId).lean();
        if (crit) { 
          const art = await Artwork.findById(crit.artworkId).lean();
          itemTitle = art ? art.title : 'Unknown Art';
          itemImageUrl = crit.originalImageUrl; 
          itemSnippet = crit.comment; 
          itemLink = `/?critique=${crit._id}`; 
        }
      } 
      else if (report.itemType === 'comment' && report.parentItemId) {
        const art = await Artwork.findById(report.parentItemId).lean();
        const crit = await Critique.findById(report.parentItemId).lean();
        const parent = art || crit;
        
        if (parent) {
          if (art) itemTitle = art.title;
          else if (crit) {
            const rootArt = await Artwork.findById(crit.artworkId).lean();
            itemTitle = rootArt ? rootArt.title : 'Unknown Art';
          }

          itemImageUrl = parent.thumbnailUrl || parent.originalImageUrl || parent.imageUrl;
          itemLink = art ? `/?art=${parent._id}` : `/?critique=${parent._id}`;
          
          let found = false;
          for (const c of parent.comments || []) {
            if (String(c._id) === String(report.reportedItemId)) { 
              itemSnippet = c.text; 
              found = true; break; 
            }
            for (const r of c.replies || []) {
              if (String(r._id) === String(report.reportedItemId)) { 
                itemSnippet = r.text; found = true; break; 
              }
            }
            if (found) break; 
          }
        }
      }

      return {
        ...report,
        reportedUserDisplayName: reportedUser ? (reportedUser.firstName || reportedUser.username) : 'Unknown User',
        itemSnippet, itemImageUrl, itemLink, itemTitle
      };
    }));

    return NextResponse.json({ success: true, reports: enrichedReports });
  } catch (error) { return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 }); }
}

export async function DELETE(req) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    await connectToDatabase();

    // 👉 THE FIX: Password Check
    const adminId = req.headers.get('x-admin-id');
    const adminPassword = decodeURIComponent(req.headers.get('x-admin-password') || '');
    if (!adminPassword) return NextResponse.json({ error: "Admin password required." }, { status: 401 });
    
    const adminUser = await User.findOne({ telegramId: adminId });
    if (!adminUser || !adminUser.webPassword) return NextResponse.json({ error: "Admin account invalid." }, { status: 401 });
    
    const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.webPassword);
    if (!isPasswordValid) return NextResponse.json({ error: "Incorrect admin password!" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('reportId');
    const action = searchParams.get('action'); 

    const report = await Report.findById(reportId);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    if (action === 'flag_nsfw') {
      if (report.itemType === 'artwork') await Artwork.findByIdAndUpdate(report.reportedItemId, { isAdult: true });
      else if (report.itemType === 'critique') await Critique.findByIdAndUpdate(report.reportedItemId, { isAdult: true });
      else if (report.itemType === 'comment' && report.parentItemId) {
        await Artwork.findByIdAndUpdate(report.parentItemId, { isAdult: true });
        await Critique.findByIdAndUpdate(report.parentItemId, { isAdult: true });
      }
      await Report.updateMany({ reportedItemId: report.reportedItemId }, { status: 'resolved' });
    } 
    else if (action === 'delete_item') {
      if (report.itemType === 'artwork') {
        await Artwork.findByIdAndDelete(report.reportedItemId);
        await Critique.deleteMany({ artworkId: report.reportedItemId }); 
      } 
      else if (report.itemType === 'critique') {
        await Critique.findByIdAndDelete(report.reportedItemId);
      } 
      else if (report.itemType === 'comment' && report.parentItemId) {
        const art = await Artwork.findById(report.parentItemId);
        const crit = !art ? await Critique.findById(report.parentItemId) : null;
        const parentDoc = art || crit;

        if (parentDoc) {
          let modified = false;
          const rootComment = parentDoc.comments.id(report.reportedItemId);
          if (rootComment) {
            parentDoc.comments.pull(report.reportedItemId);
            modified = true;
          } else {
            for (const c of parentDoc.comments) {
              const reply = c.replies.id(report.reportedItemId);
              if (reply) {
                c.replies.pull(report.reportedItemId);
                modified = true; break;
              }
            }
          }
          if (modified) await parentDoc.save();
        }
      }
      await Report.updateMany({ reportedItemId: report.reportedItemId }, { status: 'resolved' });
    } 
    else {
      report.status = 'resolved';
      await report.save();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin Action Error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}