import ModerationReport from '../models/ModerationReport.js';

/** GET /admin/moderation/reports */
export async function listAdminModerationReports(req, res) {
  try {
    const reports = await ModerationReport.find({})
      .populate('reportedBy', 'firstName lastName email')
      .sort({ reportedAt: -1 })
      .lean();
    return res.status(200).json(
      reports.map((report) => ({
        id: report._id,
        targetType: report.targetType,
        targetId: report.targetId,
        targetName: report.targetName,
        reportedBy: report.reportedBy
          ? `${report.reportedBy.firstName || ''} ${report.reportedBy.lastName || ''}`.trim() || report.reportedBy.email
          : 'Unknown',
        reason: report.reason,
        reportedAt: report.reportedAt,
        status: report.status,
        resolution: report.resolution,
      })),
    );
  } catch (error) {
    console.error('List moderation reports error:', error);
    return res.status(500).json({ message: 'Failed to fetch moderation reports.' });
  }
}

/** PATCH /admin/moderation/reports/:reportId — resolve or dismiss a report. */
export async function updateAdminModerationReport(req, res) {
  try {
    const { reportId } = req.params;
    const status = String(req.body?.status || '').toLowerCase();
    const resolution = String(req.body?.resolution || '').trim();

    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Status must be resolved or dismissed.' });
    }

    const report = await ModerationReport.findById(reportId);
    if (!report) return res.status(404).json({ message: 'Moderation report not found.' });
    if (report.status !== 'pending') {
      return res.status(409).json({ message: 'This report has already been reviewed.' });
    }

    report.status = status;
    report.resolution = resolution || null;
    report.resolvedBy = req.user.id;
    report.resolvedAt = new Date();
    await report.save();

    return res.status(200).json({ message: `Report ${status}.`, report });
  } catch (error) {
    console.error('Update moderation report error:', error);
    return res.status(500).json({ message: 'Failed to update moderation report.' });
  }
}
