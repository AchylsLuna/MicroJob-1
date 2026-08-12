import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: false,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: Number.parseInt(process.env.MESSAGE_MAX_LENGTH || '4000', 10) || 4000,
  },
  attachment: {
    type: {
      type: String,
      enum: ['settlement_request', 'job_offer'],
      default: undefined,
    },
    settlementRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'QrSettlementRequest', default: null },
    qrImageName: { type: String, default: null },
    jobTitle: { type: String, default: null, maxlength: 200 },
    totalAmount: { type: Number, default: null, min: 0 },
    expiresAt: { type: Date, default: null },
    jobOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOffer', default: null },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', default: null },
    offerAmount: { type: Number, default: null, min: 0 },
  },
  clientMessageId: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null,
  },
  editedAt: {
    type: Date,
    required: false,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

});

MessageSchema.index(
  { sender: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);

const Message = mongoose.model('Message', MessageSchema);
export default Message;
