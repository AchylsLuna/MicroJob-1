import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["application", "payment", "message", "alert", "achievement", "system"],
      default: "alert",
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, default: "" },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
