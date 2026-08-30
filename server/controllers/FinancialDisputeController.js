import FinancialDispute from '../models/FinancialDispute.js';
import monitor from '../lib/monitor.js';

const VALID_STATUSES = new Set(['open', 'investigating', 'resolved', 'rejected']);

export async function listFinancialDisputes(req, res) {
  try {
    const disputes = await FinancialDispute.find({})
      .sort({ createdAt: -1 })
      .lean();

    const shaped = disputes.map((dispute) => ({
      id: String(dispute._id),
      subject: dispute.subject,
      raisedBy: dispute.raisedBy,
      amount: Number(dispute.amount || 0),
      reason: dispute.reason,
      status: VALID_STATUSES.has(dispute.status) ? dispute.status : 'open',
      raisedAt: dispute.createdAt,
      resolutionNotes: dispute.resolutionNotes || undefined,
    }));

    return res.status(200).json(shaped);
  } catch (error) {
    console.error('List financial disputes error:', error);
    return res.status(500).json({ message: 'Failed to load financial disputes.' });
  }
}

export async function investigateFinancialDispute(req, res) {
  try {
    const { disputeId } = req.params;
    const dispute = await FinancialDispute.findById(disputeId);
    if (!dispute) {
      return res.status(404).json({ message: 'Financial dispute not found.' });
    }

    dispute.status = 'investigating';
    dispute.updatedAt = new Date();
    await dispute.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'finance_dispute_investigated',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        disputeId: String(dispute._id),
        subject: dispute.subject,
        amount: Number(dispute.amount || 0),
      },
    });

    return res.status(200).json({
      message: 'Dispute marked for investigation.',
      dispute: {
        id: String(dispute._id),
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error('Investigate financial dispute error:', error);
    return res.status(500).json({ message: 'Failed to investigate financial dispute.' });
  }
}

export async function resolveFinancialDispute(req, res) {
  try {
    const { disputeId } = req.params;
    const { resolutionNotes } = req.body || {};
    const note = String(resolutionNotes || '').trim();
    if (!note) {
      return res.status(400).json({ message: 'Resolution notes are required.' });
    }

    const dispute = await FinancialDispute.findById(disputeId);
    if (!dispute) {
      return res.status(404).json({ message: 'Financial dispute not found.' });
    }

    dispute.status = 'resolved';
    dispute.resolutionNotes = note;
    dispute.updatedAt = new Date();
    await dispute.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'finance_dispute_resolved',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        disputeId: String(dispute._id),
        subject: dispute.subject,
        amount: Number(dispute.amount || 0),
        resolutionNotes: note,
      },
    });

    return res.status(200).json({
      message: 'Dispute resolved.',
      dispute: {
        id: String(dispute._id),
        status: dispute.status,
        resolutionNotes: dispute.resolutionNotes,
      },
    });
  } catch (error) {
    console.error('Resolve financial dispute error:', error);
    return res.status(500).json({ message: 'Failed to resolve financial dispute.' });
  }
}

export async function rejectFinancialDispute(req, res) {
  try {
    const { disputeId } = req.params;
    const { resolutionNotes } = req.body || {};
    const note = String(resolutionNotes || '').trim();
    if (!note) {
      return res.status(400).json({ message: 'Resolution notes are required.' });
    }

    const dispute = await FinancialDispute.findById(disputeId);
    if (!dispute) {
      return res.status(404).json({ message: 'Financial dispute not found.' });
    }

    dispute.status = 'rejected';
    dispute.resolutionNotes = note;
    dispute.updatedAt = new Date();
    await dispute.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'finance_dispute_rejected',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        disputeId: String(dispute._id),
        subject: dispute.subject,
        amount: Number(dispute.amount || 0),
        resolutionNotes: note,
      },
    });

    return res.status(200).json({
      message: 'Dispute rejected.',
      dispute: {
        id: String(dispute._id),
        status: dispute.status,
        resolutionNotes: dispute.resolutionNotes,
      },
    });
  } catch (error) {
    console.error('Reject financial dispute error:', error);
    return res.status(500).json({ message: 'Failed to reject financial dispute.' });
  }
}

export default {
  listFinancialDisputes,
  investigateFinancialDispute,
  resolveFinancialDispute,
  rejectFinancialDispute,
};
