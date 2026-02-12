import mongoose from "mongoose";

const AlertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      default: "info",
    },
    category: {
      type: String,
      enum: ["security", "payments", "jobs", "system"],
      default: "system",
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "snoozed", "resolved"],
      default: "open",
    },
    actionLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

AlertSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Alert", AlertSchema);
