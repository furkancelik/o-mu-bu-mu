import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const ImageSchema = new Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    elo: { type: Number, default: 1200 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    appearances: { type: Number, default: 0 },
  },
  { _id: true, timestamps: false }
);

const GameSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 600 },
    images: { type: [ImageSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "live", "closed"],
      default: "live",
    },
    totalSessions: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type GameImage = InferSchemaType<typeof ImageSchema> & { _id: mongoose.Types.ObjectId };
export type GameDoc = InferSchemaType<typeof GameSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Game: Model<GameDoc> =
  (mongoose.models.Game as Model<GameDoc>) ||
  mongoose.model<GameDoc>("Game", GameSchema);
