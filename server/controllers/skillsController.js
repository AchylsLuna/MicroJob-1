import mongoose from 'mongoose';
import User from '../models/User.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { normalizeExperience } from '../lib/profileValidation.js';

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

    const skillIndex = user.skills?.findIndex((s) => s._id?.toString() === skillId);
    if (skillIndex === undefined || skillIndex === -1) {
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
    const { description, experience } = req.body || {};

    if (!mongoose.isValidObjectId(skillId)) {
      return sendError(res, 400, 'Invalid skill ID');
    }
    const rawDescription = description ?? experience ?? '';
    if (typeof rawDescription !== 'string') {
      return sendError(res, 400, 'Skill description must be a string');
    }
    const normalizedDescription = normalizeSkillDescription(rawDescription);
    if (normalizedDescription.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      return sendError(res, 400, `Skill description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer`);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const skill = user.skills?.find((s) => s._id?.toString() === skillId);
    if (!skill) {
      return sendError(res, 404, 'Skill not found');
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
    const normalized = normalizeExperience(req.body);
    if (normalized.error) return sendError(res, 400, normalized.error);

    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, 404, 'User not found');

    user.workExperience = user.workExperience || [];
    if (user.workExperience.length >= MAX_WORK_EXPERIENCES) {
      return sendError(res, 400, `You can add up to ${MAX_WORK_EXPERIENCES} work experience entries`);
    }
    const duplicate = user.workExperience.some((item) =>
      item.title.toLowerCase() === normalized.value.title.toLowerCase() &&
      item.company.toLowerCase() === normalized.value.company.toLowerCase() &&
      item.startDate?.getTime() === normalized.value.startDate.getTime()
    );
    if (duplicate) {
      return sendError(res, 409, 'This work experience is already on your profile');
    }
    user.workExperience.push(normalized.value);
    await user.save();

    return sendSuccess(res, 201, 'Work experience added successfully', {
      workExperience: user.workExperience,
    });
  } catch (error) {
    console.error('Add work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to add work experience');
  }
};

export const updateWorkExperience = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.experienceId)) {
      return sendError(res, 400, 'Invalid work experience ID');
    }
    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, 404, 'User not found');

    const experience = user.workExperience?.id(req.params.experienceId);
    if (!experience) return sendError(res, 404, 'Work experience not found');

    const normalized = normalizeExperience({ ...experience.toObject(), ...req.body });
    if (normalized.error) return sendError(res, 400, normalized.error);

    Object.assign(experience, normalized.value);
    await user.save();

    return sendSuccess(res, 200, 'Work experience updated successfully', {
      workExperience: user.workExperience,
    });
  } catch (error) {
    console.error('Update work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to update work experience');
  }
};

export const deleteWorkExperience = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.experienceId)) {
      return sendError(res, 400, 'Invalid work experience ID');
    }
    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, 404, 'User not found');

    const experience = user.workExperience?.id(req.params.experienceId);
    if (!experience) return sendError(res, 404, 'Work experience not found');

    experience.deleteOne();
    await user.save();

    return sendSuccess(res, 200, 'Work experience deleted successfully', {
      workExperience: user.workExperience,
    });
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
