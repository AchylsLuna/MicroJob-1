import FinancialDispute from '../models/FinancialDispute.js';
import { resolvePaymentDispute } from '../services/paymentDisputeResolution.js';

/** GET /admin/finance/disputes */
export async function listAdminFinancialDisputes(req, res) {
  try {
    const disputes = await FinancialDispute.find({})
      .populate('raisedBy', 'firstName lastName email')
      .populate({
        path: 'application',
        select: 'applicant job agreedAmount workStatus paymentStatus',
        populate: [
          { path: 'applicant', select: 'firstName lastName email' },
          { path: 'job', select: 'title' },
        ],
      })
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
        applicationId: dispute.application?._id || null,
        jobTitle: dispute.application?.job?.title || null,
        worker: dispute.application?.applicant
          ? dispute.application.applicant.email || `${dispute.application.applicant.firstName || ''} ${dispute.application.applicant.lastName || ''}`.trim()
          : null,
        workerPayoutAmount: dispute.workerPayoutAmount,
        employerRefundAmount: dispute.employerRefundAmount,
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

    if (dispute.application) {
      if (status === 'resolved') {
        try {
          const result = await resolvePaymentDispute({
            disputeId,
            workerPayoutAmount: req.body?.workerPayoutAmount,
            resolutionNotes,
            adminId: req.user.id,
          });
          return res.status(200).json({ message: 'Dispute resolved and escrow settled.', dispute: result.dispute });
        } catch (error) {
          return res.status(error.status || 500).json({ message: error.message || 'Failed to settle payment dispute.' });
        }
      }
      if (status === 'rejected') {
        return res.status(400).json({ message: 'Choose a worker payout amount, including zero, to resolve a payment dispute.' });
      }
      if (status !== 'investigating' || dispute.status !== 'open') {
        return res.status(409).json({ message: 'This payment dispute can no longer be updated.' });
      }
    }

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
