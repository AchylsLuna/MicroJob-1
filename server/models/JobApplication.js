import mongoose from 'mongoose';

const JobApplicationSchema = new mongoose.Schema(
    {
        job: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Job',
            required: true
        },
        applicant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        resume: {
            type: String,
            default: null
        },
        coverLetter: {
            type: String,
            default: null
        },
        status: {
            type: String,
            // New workflow: Pending -> Shortlisted -> Terms -> Hired
            enum: ['Pending', 'Shortlisted', 'Terms', 'Hired'],
            default: 'Pending'
        },
        applicantReadAt: {
            type: Date,
            default: null
        },
        employerReadAt: {
            type: Date,
            default: null
        },
        employerHidden: {
            type: Boolean,
            default: false
        },
        employerHiddenAt: {
            type: Date,
            default: null
        },
        appliedDate: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true, versionKey: false }
);

// Create a compound index to prevent duplicate applications
JobApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export default mongoose.model('JobApplication', JobApplicationSchema);
