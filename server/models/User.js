import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      minlength: 11,
      maxlength: 11,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 30,
    },
    role: {
      type: String,
      enum: ['hire', 'work', 'both', 'admin', 'superadmin'],
      default: 'work',
    },
    staffRole: {
      type: String,
      enum: ['superadmin', 'admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff'],
      default: null,
    },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archivedConversations: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'active', 'disabled', 'deleted'],
      default: 'pending',
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    redactedAt: {
      type: Date,
      default: null,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaMethod: {
      type: String,
      default: null,
      trim: true,
    },
    mfaSecret: {
      type: String,
      default: null,
      select: false,
    },
    mfaPendingSecret: {
      type: String,
      default: null,
      select: false,
    },
    mfaBackupCodes: {
      type: [String],
      default: [],
      select: false,
    },
    employerBalance: {
      type: Number,
      default: 0,
    },
    workerBalance: {
      type: Number,
      default: 0,
    },
    hideHiredCandidates: {
      type: Boolean,
      default: true,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    province: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    barangay: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    addressType: {
      type: String,
      enum: ['home', 'office', 'place'],
      default: 'home',
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    facebook: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    profilePhotoName: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    jobPosition: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    startDate: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    endDate: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    logoName: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    resumeFileName: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    resumeUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    about: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    linkedin: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    totalExperience: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    projectsCompleted: {
      type: Number,
      default: 0,
    },
    jobsApplied: {
      type: Number,
      default: 0,
    },
    successRate: {
      type: String,
      trim: true,
    },
    skills: [
      {
        name: {
          type: String,
          trim: true,
          required: true,
          maxlength: 80,
        },
        description: {
          type: String,
          trim: true,
          default: '',
          maxlength: 500,
        },
        endorsements: {
          type: Number,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    preferredCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    jobPreferences: [{
      type: String,
      trim: true,
      maxlength: 120,
    }],
    workExperience: [
      {
        title: {
          type: String,
          trim: true,
          required: true,
          maxlength: 100,
        },
        company: {
          type: String,
          trim: true,
          required: true,
          maxlength: 120,
        },
        location: {
          type: String,
          trim: true,
          maxlength: 120,
          default: '',
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          default: null,
        },
        current: {
          type: Boolean,
          default: false,
        },
        description: {
          type: String,
          trim: true,
          maxlength: 1000,
          default: '',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    verification: {
      emailVerified: {
        type: Boolean,
        default: false,
      },
      phoneVerified: {
        type: Boolean,
        default: false,
      },
      identityVerified: {
        type: Boolean,
        default: false,
      },
      addressVerified: {
        type: Boolean,
        default: false,
      },
      identityDocument: {
        status: {
          type: String,
          enum: ['pending', 'in-review', 'complete', 'rejected'],
          default: 'pending',
        },
        documentUrl: {
          type: String,
          trim: true,
        },
        uploadedAt: {
          type: Date,
        },
        reviewedAt: {
          type: Date,
        },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        rejectionReason: {
          type: String,
          trim: true,
          maxlength: 500,
        },
      },
      addressDocument: {
        status: {
          type: String,
          enum: ['pending', 'in-review', 'complete', 'rejected'],
          default: 'pending',
        },
        documentUrl: {
          type: String,
          trim: true,
        },
        uploadedAt: {
          type: Date,
        },
        reviewedAt: {
          type: Date,
        },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        rejectionReason: {
          type: String,
          trim: true,
          maxlength: 500,
        },
      },
    },
    passwordHashed: {
      type: String,
      required: true,
      select: false,
    },
    passwordChangeRequired: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, versionKey: false }
);

UserSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHashed = await bcrypt.hash(password, 10);
};

UserSchema.methods.validatePassword = async function validatePassword(password) {
  if (!this.passwordHashed) return false;
  return bcrypt.compare(password, this.passwordHashed);
};

export default mongoose.model('User', UserSchema);
