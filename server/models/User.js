import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
    {   
        phoneNumber: {
            type: String,
            required: false, // Changed to optional - can be added in settings later
            unique: true,
            sparse: true, // Allows multiple null values for unique field
            minlength: 10,
            maxlength: 10,
        },
        email: {
            type: String,
            required: true, // Changed to required since we use it for login
            unique: true,
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
            enum: ["hire", "work", "both", "admin", "superadmin"],
            default: "work",
        },
            blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            archivedConversations: [{ type: String }],
        status: {
            type: String,
            enum: ["pending", "active", "disabled"],
            default: "pending",
        },
        // Separate balances for employer (funds used to post jobs / escrow)
        // and worker (funds received from completed jobs / payouts)
        employerBalance: {
            type: Number,
            default: 0,
        },
        workerBalance: {
            type: Number,
            default: 0,
        },
        city: {
            type: String,
            trim: true,
        },
        province: {
            type: String,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        facebook: {
            type: String,
            trim: true,
        },
        profilePhotoName: {
            type: String,
            trim: true,
        },
        jobPosition: {
            type: String,
            trim: true,
        },
        companyName: {
            type: String,
            trim: true,
        },
        startDate: {
            type: String,
            trim: true,
        },
        endDate: {
            type: String,
            trim: true,
        },
        logoName: {
            type: String,
            trim: true,
        },
        resumeFileName: {
            type: String,
            trim: true,
        },
        passwordHashed: {
            type: String,
            required: true,
        },
    },
);
UserSchema.methods.setPassword = async function (password) {
    this.passwordHashed = await bcrypt.hash(password, 10);
};
UserSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHashed);
}

export default mongoose.model("User", UserSchema)