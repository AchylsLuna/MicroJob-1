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
