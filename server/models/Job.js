import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            maxlength: 100,
            required: true
        },
        description: {
            type: String,
            maxlength: 1000,
            required: true,
        },
        location: {
            type: String,
            required: true
        },
        salary: {
            type: Number,
            required: true
        },
        jobType: {
            type: String,
            enum: ['Fulltime', 'Freelance', 'Remote', 'Part-time', 'Contract'],
            required: true
        },
        deadline: {
            type: Date,
            required: true
        },
        skills: [{
            type: String
        }],
        responsibilities: [{
            type: String
        }],
        requirements: [{
            type: String
        }],
        image: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['Available', 'In Progress', 'Completed', 'Cancelled'],
            default: 'Available',
        },
        urgent: {
            type: Boolean,
            default: false,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
        },
        jobPoster:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        applicants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        selectedApplicant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
    },
    { timestamps: true, versionKey: false }
)

export default mongoose.model('Job', JobSchema);