import mongoose, { Document, Schema, Model, Types } from "mongoose";

export interface ITemplate extends Document {
  userId: Types.ObjectId;
  templateName: string;
  frontDesign: Record<string, unknown>;
  backDesign: Record<string, unknown>;
  elements: unknown[];
  canvasConfig?: Record<string, unknown> | null;
  thumbnail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    frontDesign: { type: Schema.Types.Mixed, default: {} },
    backDesign: { type: Schema.Types.Mixed, default: {} },
    elements: { type: [Schema.Types.Mixed], default: [] },
    canvasConfig: { type: Schema.Types.Mixed, default: null },
    thumbnail: { type: String, default: null },
  },
  { timestamps: true }
);

templateSchema.index({ userId: 1, createdAt: -1 });

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>("Template", templateSchema);
