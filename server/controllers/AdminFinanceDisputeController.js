import FinancialDispute from '../models/FinancialDispute.js';

/** GET /admin/finance/disputes */
export async function listAdminFinancialDisputes(req, res) {
  try {
    const disputes = await FinancialDispute.find({})
      .populate('raisedBy', 'firstName lastName email')
      .sort({ raisedAt: -1 })
      .lean();
    return res.status(200).json(
      disputes.map((dispute) => ({
        id: dispute._id,
        subject: dispute.subject,
        raisedBy: dispute.raisedBy
          ? dispute.raisedBy.email || `${dispute.raisedBy.firstName || ''} ${dispute.raisedBy.lastName || ''}`.trim()
          : 'Unknown',
        amount: dispute.amount,
        reason: dispute.reason,
        status: dispute.status,
        raisedAt: dispute.raisedAt,
        resolutionNotes: dispute.resolutionNotes,
      })),
    );
  } catch (error) {
    console.error('List financial disputes error:', error);
    return res.status(500).json({ message: 'Failed to fetch financial disputes.' });
  }
}

/** PATCH /admin/finance/disputes/:disputeId */
export async function updateAdminFinancialDispute(req, res) {
  try {
    const { disputeId } = req.params;
    const status = String(req.body?.status || '').toLowerCase();
    const resolutionNotes = String(req.body?.resolutionNotes || '').trim();

    const allowedStatuses = ['open', 'investigating', 'resolved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid dispute status.' });
    }
    if (['resolved', 'rejected'].includes(status) && !resolutionNotes) {
      return res.status(400).json({ message: 'Resolution notes are required when resolving or rejecting a dispute.' });
    }

    const dispute = await FinancialDispute.findById(disputeId);
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });

    dispute.status = status;
    if (resolutionNotes) dispute.resolutionNotes = resolutionNotes;
    if (['resolved', 'rejected'].includes(status)) {
      dispute.resolvedBy = req.user.id;
      dispute.resolvedAt = new Date();
    }
    await dispute.save();

    return res.status(200).json({ message: 'Dispute updated.', dispute });
  } catch (error) {
    console.error('Update financial dispute error:', error);
    return res.status(500).json({ message: 'Failed to update financial dispute.' });
  }
}
