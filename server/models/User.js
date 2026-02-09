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
            maxlength: 15,
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
    this.passwordHashed = await bcrypt.hash(password, 10);
};
UserSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHashed);
}

export default mongoose.model("User", UserSchema)
