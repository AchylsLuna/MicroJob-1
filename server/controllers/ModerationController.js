import ModerationReport from '../models/ModerationReport.js';
import monitor from '../lib/monitor.js';

const REPORT_STATUSES = new Set(['pending', 'resolved', 'dismissed']);

const normalizeReportStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  return REPORT_STATUSES.has(value) ? value : null;
};

export async function listModerationReports(req, res) {
  try {
    const reports = await ModerationReport.find({})
      .sort({ createdAt: -1 })
      .lean();

    const shaped = reports.map((report) => ({
      id: String(report._id),
      targetType: report.targetType,
      targetName: report.targetName,
      reportedBy: report.reportedBy,
      reason: report.reason,
      reportedAt: report.createdAt,
      status: report.status,
      resolution: report.resolution || undefined,
    }));

    return res.status(200).json(shaped);
  } catch (error) {
    console.error('List moderation reports error:', error);
    return res.status(500).json({ message: 'Failed to load moderation reports.' });
  }
}

export async function enforceModerationReport(req, res) {
  try {
    const { reportId } = req.params;
    const { action, reason } = req.body || {};
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (!['suspended', 'banned'].includes(normalizedAction)) {
      return res.status(400).json({ message: 'Action must be suspended or banned.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A reason is required.' });
    }

    const report = await ModerationReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Moderation report not found.' });
    }

    report.status = 'resolved';
    report.resolution = `${normalizedAction === 'banned' ? 'Banned' : 'Suspended'}: ${String(reason).trim()}`;
    report.resolvedAt = new Date();
    report.resolvedBy = req.user?.id || null;
    await report.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'moderation_report_enforced',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        reportId: String(report._id),
        targetType: report.targetType,
        targetName: report.targetName,
        action: normalizedAction,
        reason: String(reason).trim(),
      },
    });

    return res.status(200).json({
      message: 'Moderation action recorded.',
      report: {
        id: String(report._id),
        status: report.status,
        resolution: report.resolution,
      },
    });
  } catch (error) {
    console.error('Enforce moderation report error:', error);
    return res.status(500).json({ message: 'Failed to enforce moderation action.' });
  }
}

export async function dismissModerationReport(req, res) {
  try {
    const { reportId } = req.params;
    const { reason } = req.body || {};
    const note = String(reason || '').trim();
    if (!note) {
      return res.status(400).json({ message: 'A dismissal reason is required.' });
    }

    const report = await ModerationReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Moderation report not found.' });
    }

    report.status = 'dismissed';
    report.resolution = `Dismissed: ${note}`;
    report.resolvedAt = new Date();
    report.resolvedBy = req.user?.id || null;
    await report.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'moderation_report_dismissed',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        reportId: String(report._id),
        targetType: report.targetType,
        targetName: report.targetName,
        reason: note,
      },
    });

    return res.status(200).json({
      message: 'Moderation report dismissed.',
      report: {
        id: String(report._id),
        status: report.status,
        resolution: report.resolution,
      },
    });
  } catch (error) {
    console.error('Dismiss moderation report error:', error);
    return res.status(500).json({ message: 'Failed to dismiss moderation report.' });
  }
}

export default {
  listModerationReports,
  enforceModerationReport,
  dismissModerationReport,
};
