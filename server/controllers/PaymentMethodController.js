import PaymentMethod from '../models/PaymentMethod.js';
import {
  isExpiredPaymentMethod,
  normalizePaymentMethodMetadata,
} from '../lib/paymentMethodValidation.js';

const MAX_PAYMENT_METHODS = 10;
const EMPLOYER_PAYMENT_ROLES = new Set(['hire', 'employer', 'both']);

const getUserId = (req) => req.user?.id || req.user?.userId || null;
const isValidId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const hasEmployerPaymentAccess = (req) =>
  EMPLOYER_PAYMENT_ROLES.has(String(req.user?.role || '').trim().toLowerCase());

const rejectWorkerPaymentAccess = (req, res) => {
  if (hasEmployerPaymentAccess(req)) return false;
  res.status(403).json({ message: 'Employer access is required to manage payment methods.' });
  return true;
};

const serializePaymentMethod = (method, now = new Date()) => {
  const expired = isExpiredPaymentMethod(method.expiryMonth, method.expiryYear, now);
  return {
    id: String(method._id),
    cardholderName: method.cardholderName,
    brand: method.brand,
    last4: method.last4,
    expiry: `${String(method.expiryMonth).padStart(2, '0')}/${String(method.expiryYear).slice(-2)}`,
    status: expired ? 'expired' : method.isDefault ? 'default' : 'active',
  };
};

const listForUser = async (userId) => {
  const methods = await PaymentMethod.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
  return methods.map((method) => serializePaymentMethod(method));
};

export async function listPaymentMethods(req, res) {
  try {
    if (rejectWorkerPaymentAccess(req, res)) return;
    const userId = getUserId(req);
    const paymentMethods = await listForUser(userId);
    return res.json({ paymentMethods });
  } catch (error) {
    console.error('List payment methods error:', error);
    return res.status(500).json({ message: 'Failed to load payment methods.' });
  }
}

export async function addPaymentMethod(req, res) {
  try {
    if (rejectWorkerPaymentAccess(req, res)) return;
    const userId = getUserId(req);
    const normalized = normalizePaymentMethodMetadata(req.body);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const [existingCount, currentDefault] = await Promise.all([
      PaymentMethod.countDocuments({ user: userId }),
      PaymentMethod.findOne({ user: userId, isDefault: true }),
    ]);
    if (existingCount >= MAX_PAYMENT_METHODS) {
      return res.status(400).json({ message: `You can save up to ${MAX_PAYMENT_METHODS} payment methods.` });
    }

    const duplicate = await PaymentMethod.exists({
      user: userId,
      last4: normalized.value.last4,
      expiryMonth: normalized.value.expiryMonth,
      expiryYear: normalized.value.expiryYear,
    });
    if (duplicate) {
      return res.status(409).json({ message: 'This payment method is already saved.' });
    }

    const shouldBecomeDefault =
      existingCount === 0 ||
      !currentDefault ||
      isExpiredPaymentMethod(currentDefault.expiryMonth, currentDefault.expiryYear);

    const paymentMethod = await PaymentMethod.create({
      user: userId,
      ...normalized.value,
      isDefault: shouldBecomeDefault && !currentDefault,
    });
    if (shouldBecomeDefault && currentDefault) {
      currentDefault.isDefault = false;
      await currentDefault.save();
      paymentMethod.isDefault = true;
      await paymentMethod.save();
    }

    return res.status(201).json({
      message: 'Payment method added.',
      paymentMethod: serializePaymentMethod(paymentMethod),
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    return res.status(500).json({ message: 'Failed to add payment method.' });
  }
}

export async function setDefaultPaymentMethod(req, res) {
  try {
    if (rejectWorkerPaymentAccess(req, res)) return;
    const userId = getUserId(req);
    if (!isValidId(req.params.paymentMethodId)) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.paymentMethodId,
      user: userId,
    });

    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }
    if (isExpiredPaymentMethod(paymentMethod.expiryMonth, paymentMethod.expiryYear)) {
      return res.status(400).json({ message: 'An expired card cannot be the default payment method.' });
    }

    await PaymentMethod.updateMany({ user: userId, isDefault: true }, { isDefault: false });
    await PaymentMethod.updateOne({ _id: paymentMethod._id, user: userId }, { isDefault: true });

    return res.json({
      message: 'Default payment method updated.',
      paymentMethods: await listForUser(userId),
    });
  } catch (error) {
    console.error('Set default payment method error:', error);
    return res.status(500).json({ message: 'Failed to update the default payment method.' });
  }
}

export async function removePaymentMethod(req, res) {
  try {
    if (rejectWorkerPaymentAccess(req, res)) return;
    const userId = getUserId(req);
    if (!isValidId(req.params.paymentMethodId)) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }
    const removed = await PaymentMethod.findOneAndDelete({
      _id: req.params.paymentMethodId,
      user: userId,
    });

    if (removed?.isDefault) {
      const remainingMethods = await PaymentMethod.find({
        user: userId,
        isDefault: false,
      }).sort({ createdAt: -1 });
      const replacement = remainingMethods.find(
        (method) => !isExpiredPaymentMethod(method.expiryMonth, method.expiryYear)
      );
      if (replacement) {
        replacement.isDefault = true;
        await replacement.save();
      }
    }

    if (!removed) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }

    return res.json({
      message: 'Payment method removed.',
      paymentMethods: await listForUser(userId),
    });
  } catch (error) {
    console.error('Remove payment method error:', error);
    return res.status(500).json({ message: 'Failed to remove payment method.' });
  }
}
