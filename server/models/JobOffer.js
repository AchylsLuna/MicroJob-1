import mongoose from 'mongoose';

const JobOfferSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', required: true, index: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  additionalEscrow: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'hired'], default: 'pending', index: true },
  acceptedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  chatMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
}, { timestamps: true, versionKey: false });

JobOfferSchema.index(
  { application: 1, status: 1 },
  { name: 'application_offer_status' },
);

export default mongoose.model('JobOffer', JobOfferSchema);
