import mongoose from 'mongoose';

const PaymentMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cardholderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    brand: {
      type: String,
      enum: ['Visa', 'Mastercard', 'Card'],
      default: 'Card',
    },
    last4: {
      type: String,
      required: true,
      match: /^\d{4}$/,
    },
    expiryMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    expiryYear: {
      type: Number,
      required: true,
      min: 2000,
      max: 2200,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

PaymentMethodSchema.index({ user: 1, createdAt: -1 });
PaymentMethodSchema.index(
  { user: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

export default mongoose.model('PaymentMethod', PaymentMethodSchema);
