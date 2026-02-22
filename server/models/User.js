import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { PHONE_DIGITS } from "../lib/authValidation.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../lib/passwordPolicy.js";

const UserSchema = new mongoose.Schema(
    {   
        username: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
            trim: true,
            maxlength: 80,
        },
        phoneNumber: {
            type: String,
            required: false, // Changed to optional - can be added in settings later
            unique: true,
            sparse: true, // Allows multiple null values for unique field
            minlength: PHONE_DIGITS,
            maxlength: PHONE_DIGITS,
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
        city: {
            type: String,
            trim: true,
            maxlength: 80,
        },
        country: {
            type: String,
            trim: true,
            maxlength: 80,
        },
        linkedin: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        avatarUrl: {
            type: String,
            trim: true,
            maxlength: 500,
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
        passwordHashed: {
            type: String,
            required: true,
        },
    },
);
UserSchema.methods.setPassword = async function (password) {
    if (!isStrongPassword(password)) {
        throw new Error(PASSWORD_POLICY_MESSAGE);
    }
    this.passwordHashed = await bcrypt.hash(password, 10);
};
UserSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHashed);
}

export default mongoose.model("User", UserSchema)
