import mongoose from 'mongoose';

export const MESSAGE_MAX_LENGTH = Math.max(
  1,
  Number.parseInt(process.env.MESSAGE_MAX_LENGTH || '4000', 10) || 4000,
);

export function normalizeMessageContent(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

export function validateMessageContent(value) {
  const content = normalizeMessageContent(value);
  if (!content) return { content, error: 'Message content is required.' };
  if (content.length > MESSAGE_MAX_LENGTH) {
    return { content, error: `Message content cannot exceed ${MESSAGE_MAX_LENGTH} characters.` };
  }
  return { content, error: null };
}

