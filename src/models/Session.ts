import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const HistoryEntry = new Schema(
  {
    imageA: { type: Schema.Types.ObjectId, required: true },
    imageB: { type: Schema.Types.ObjectId, required: true },
    winner: { type: Schema.Types.ObjectId, required: true },
    round: { type: Number, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SessionSchema = new Schema(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    sessionKey: { type: String, required: true, unique: true, index: true },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    finalWinnerId: { type: Schema.Types.ObjectId },
    totalRounds: { type: Number, default: 0 },
    history: { type: [HistoryEntry], default: [] },
    eloState: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
    appearances: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
    phase: {
      type: String,
      enum: ["discovery", "ranking", "final", "done"],
      default: "discovery",
    },
  },
  { timestamps: true }
);

export type SessionDoc = InferSchemaType<typeof SessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const VoteSession: Model<SessionDoc> =
  (mongoose.models.VoteSession as Model<SessionDoc>) ||
  mongoose.model<SessionDoc>("VoteSession", SessionSchema);
