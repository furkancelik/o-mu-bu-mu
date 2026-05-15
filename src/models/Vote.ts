import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const VoteSchema = new Schema(
  {
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    sessionKey: { type: String, required: true, index: true },
    winnerImageId: { type: Schema.Types.ObjectId, required: true, index: true },
    loserImageId: { type: Schema.Types.ObjectId, required: true, index: true },
    round: { type: Number, required: true },
    phase: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

VoteSchema.index({ gameId: 1, createdAt: -1 });

export type VoteDoc = InferSchemaType<typeof VoteSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Vote: Model<VoteDoc> =
  (mongoose.models.Vote as Model<VoteDoc>) ||
  mongoose.model<VoteDoc>("Vote", VoteSchema);
