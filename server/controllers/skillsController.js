import mongoose from 'mongoose';
import User from '../models/User.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';

const MAX_PROFILE_SKILLS = 50;
const MAX_WORK_EXPERIENCES = 25;
const MAX_SKILL_NAME_LENGTH = 80;
const MAX_SKILL_DESCRIPTION_LENGTH = 500;

const sendProfileMutationError = (res, error, fallbackMessage) => {
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return sendError(res, 400, error?.message || 'Invalid profile data');
  }
  if (error?.name === 'VersionError') {
    return sendError(res, 409, 'Your profile changed in another request. Refresh and try again.');
  }
  return sendError(res, 500, fallbackMessage);
};

const normalizeSkillDescription = (value = '') => String(value || '').trim();

const parseExperienceDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}(?:-\d{2}(?:T.*)?)?$/.test(raw)) return null;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeExperience = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Work experience must be a JSON object' };
  }
  for (const requiredField of ['title', 'company', 'startDate']) {
    if (typeof payload[requiredField] !== 'string' && !(requiredField === 'startDate' && payload[requiredField] instanceof Date)) {
      return { error: `${requiredField} must be a string` };
    }
  }
  for (const optionalField of ['location', 'description']) {
    if (payload[optionalField] !== undefined && payload[optionalField] !== null && typeof payload[optionalField] !== 'string') {
      return { error: `${optionalField} must be a string` };
    }
  }
  if (![true, false, 'true', 'false'].includes(payload.current)) {
    return { error: 'current must be a boolean' };
  }
  if (
    payload.endDate !== undefined &&
    payload.endDate !== null &&
    typeof payload.endDate !== 'string' &&
    !(payload.endDate instanceof Date)
  ) {
    return { error: 'endDate must be a string' };
  }
  const title = String(payload.title || '').trim();
  const company = String(payload.company || '').trim();
  const location = String(payload.location || '').trim();
  const description = String(payload.description || '').trim();
  const startDate = parseExperienceDate(payload.startDate);
  const current = payload.current === true || payload.current === 'true';
  const endDate = current ? null : parseExperienceDate(payload.endDate);

  if (!title) return { error: 'Job title is required' };
  if (!company) return { error: 'Company or client name is required' };
  if (title.length > 100) return { error: 'Job title must be 100 characters or fewer' };
  if (company.length > 120) return { error: 'Company or client name must be 120 characters or fewer' };
  if (location.length > 120) return { error: 'Location must be 120 characters or fewer' };
  if (description.length > 1000) return { error: 'Description must be 1000 characters or fewer' };
  if (!startDate) return { error: 'A valid start date is required' };
  if (!current && !endDate) return { error: 'End date is required unless this is your current role' };
  if (endDate && endDate < startDate) return { error: 'End date cannot be before start date' };
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (startDate > endOfToday) return { error: 'Start date cannot be in the future' };
  if (endDate && endDate > endOfToday) return { error: 'End date cannot be in the future' };

  return {
    value: { title, company, location, description, startDate, endDate, current },
  };
};

export const addSkill = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, description, experience } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return sendError(res, 400, 'Skill name is required');
    }
    const rawDescription = description ?? experience ?? '';
    if (typeof rawDescription !== 'string') {
      return sendError(res, 400, 'Skill description must be a string');
    }
    const skillName = name.trim();
    const skillDescription = normalizeSkillDescription(rawDescription);
    if (skillName.length > MAX_SKILL_NAME_LENGTH) {
      return sendError(res, 400, `Skill name must be ${MAX_SKILL_NAME_LENGTH} characters or fewer`);
    }
    if (skillDescription.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      return sendError(res, 400, `Skill description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer`);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const existingSkill = user.skills?.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
    if (existingSkill) {
      existingSkill.description = skillDescription;
      await user.save();
      return sendSuccess(res, 200, 'Skill description updated successfully', { skills: user.skills });
    }

    const newSkill = {
      name: skillName,
      description: skillDescription,
      endorsements: 0,
      createdAt: new Date(),
    };

    if (!user.skills) {
      user.skills = [];
    }
    if (user.skills.length >= MAX_PROFILE_SKILLS) {
      return sendError(res, 400, `You can add up to ${MAX_PROFILE_SKILLS} skills`);
    }
    user.skills.push(newSkill);
    await user.save();

    return sendSuccess(res, 201, 'Skill added successfully', { skills: user.skills });
  } catch (error) {
    console.error('Add skill error:', error);
    return sendProfileMutationError(res, error, 'Failed to add skill');
  }
};

export const deleteSkill = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { skillId } = req.params;

    if (!mongoose.isValidObjectId(skillId)) {
      return sendError(res, 400, 'Invalid skill ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const skillIndex = user.skills?.findIndex((s) => s._id.toString() === skillId);
    if (skillIndex === undefined || skillIndex < 0) {
      return sendError(res, 404, 'Skill not found');
    }

    user.skills.splice(skillIndex, 1);
    await user.save();
    return sendSuccess(res, 200, 'Skill deleted successfully', { skills: user.skills });
  } catch (error) {
    console.error('Delete skill error:', error);
    return sendProfileMutationError(res, error, 'Failed to delete skill');
  }
};

export const updateSkillDescription = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { skillId } = req.params;
    const { description } = req.body || {};

    if (!mongoose.isValidObjectId(skillId)) {
      return sendError(res, 400, 'Invalid skill ID');
    }
    if (typeof description !== 'string') {
      return sendError(res, 400, 'Skill description must be a string');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const skill = user.skills?.find((s) => s._id.toString() === skillId);
    if (!skill) {
      return sendError(res, 404, 'Skill not found');
    }

    const normalizedDescription = normalizeSkillDescription(description);
    if (normalizedDescription.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      return sendError(res, 400, `Skill description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer`);
    }

    skill.description = normalizedDescription;
    await user.save();
    return sendSuccess(res, 200, 'Skill description updated successfully', { skills: user.skills });
  } catch (error) {
    console.error('Update skill description error:', error);
    return sendProfileMutationError(res, error, 'Failed to update skill description');
  }
};

export const addWorkExperience = async (req, res) => {
  try {
    const userId = req.user?.id;
    const payload = normalizeExperience(req.body);
    if (payload.error) {
      return sendError(res, 400, payload.error);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!Array.isArray(user.workExperience)) {
      user.workExperience = [];
    }
    if (user.workExperience.length >= MAX_WORK_EXPERIENCES) {
      return sendError(res, 400, `You can add up to ${MAX_WORK_EXPERIENCES} work experiences`);
    }

    user.workExperience.push({
      ...payload.value,
      createdAt: new Date(),
    });
    await user.save();
    return sendSuccess(res, 201, 'Work experience added successfully', { workExperience: user.workExperience });
  } catch (error) {
    console.error('Add work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to add work experience');
  }
};

export const updateWorkExperience = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { experienceId } = req.params;
    const payload = normalizeExperience(req.body);
    if (payload.error) {
      return sendError(res, 400, payload.error);
    }

    if (!mongoose.isValidObjectId(experienceId)) {
      return sendError(res, 400, 'Invalid experience ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const experienceIndex = user.workExperience?.findIndex((item) => item._id.toString() === experienceId);
    if (experienceIndex === undefined || experienceIndex < 0) {
      return sendError(res, 404, 'Work experience not found');
    }

    user.workExperience[experienceIndex] = {
      ...user.workExperience[experienceIndex],
      ...payload.value,
    };
    await user.save();
    return sendSuccess(res, 200, 'Work experience updated successfully', { workExperience: user.workExperience });
  } catch (error) {
    console.error('Update work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to update work experience');
  }
};

export const deleteWorkExperience = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { experienceId } = req.params;

    if (!mongoose.isValidObjectId(experienceId)) {
      return sendError(res, 400, 'Invalid experience ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const experienceIndex = user.workExperience?.findIndex((item) => item._id.toString() === experienceId);
    if (experienceIndex === undefined || experienceIndex < 0) {
      return sendError(res, 404, 'Work experience not found');
    }

    user.workExperience.splice(experienceIndex, 1);
    await user.save();
    return sendSuccess(res, 200, 'Work experience deleted successfully', { workExperience: user.workExperience });
  } catch (error) {
    console.error('Delete work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to delete work experience');
  }
};

export default {
  addSkill,
  deleteSkill,
  updateSkillDescription,
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  normalizeExperience,
};
