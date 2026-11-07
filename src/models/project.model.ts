import mongoose, { Document, Schema, Model, Types } from "mongoose";

export type ProjectStatus = "DRAFT" | "COMPLETED" | "ARCHIVED";

export interface IProject extends Document {
  userId: Types.ObjectId;
  projectName: string;
  templateId?: Types.ObjectId;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    templateId: { type: Schema.Types.ObjectId, ref: "Template" },
    status: {
      type: String,
      enum: ["DRAFT", "COMPLETED", "ARCHIVED"],
      default: "DRAFT",
    },
  },
  { timestamps: true }
);

projectSchema.index({ userId: 1, createdAt: -1 });

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", projectSchema);
