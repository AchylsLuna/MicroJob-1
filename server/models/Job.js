import mongoose from 'mongoose';
import { ALL_JOB_TYPES } from '../lib/jobPosting.js';

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
            required: true,
            min: 1,
        },
        jobType: {
            type: String,
            enum: ALL_JOB_TYPES,
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
            enum: ['Available', 'In Progress', 'Completed', 'Cancelled', 'Closed'],
            default: 'Available',
        },
        urgent: {
            type: Boolean,
            default: false,
        },
        // Number of workers needed for this job post
        positionsNeeded: {
            type: Number,
            default: 1,
            min: 1,
        },
        // How many applicants have been hired
        hiredCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        reservedOfferCount: {
            type: Number,
            default: 0,
            min: 0,
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
