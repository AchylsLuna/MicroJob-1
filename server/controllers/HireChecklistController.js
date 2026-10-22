import mongoose from 'mongoose';
import JobApplication from '../models/JobApplication.js';
import Job from '../models/Job.js';

export async function updateHireChecklistItem(req, res) {
  try {
    if (typeof req.body?.completed !== 'boolean') return res.status(400).json({ message: 'The checklist completion value must be true or false.' });
    if (!mongoose.isValidObjectId(req.params.applicationId) || !mongoose.isValidObjectId(req.params.itemId)) return res.status(400).json({ message: 'Invalid checklist item.' });
    const application = await JobApplication.findById(req.params.applicationId).select('job');
    const job = application && await Job.findById(application.job).select('jobPoster');
    if (!job) return res.status(404).json({ message: 'Assignment not found.' });
    if (String(job.jobPoster) !== String(req.user?.id || req.user?.userId || '')) return res.status(403).json({ message: 'Only this employer can update the checklist.' });
    const updated = await JobApplication.findOneAndUpdate({ _id: application._id, 'hireChecklist._id': req.params.itemId }, { $set: { 'hireChecklist.$.completed': req.body.completed } }, { returnDocument: 'after', runValidators: true }).select('hireChecklist');
    if (!updated) return res.status(404).json({ message: 'Checklist item not found.' });
    return res.json({ checklist: updated.hireChecklist });
  } catch { return res.status(500).json({ message: 'Unable to update the checklist.' }); }
}
