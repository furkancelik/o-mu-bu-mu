import { connectDB } from "@/lib/db";
import { Game, GameDoc } from "@/models/Game";
import { VoteSession, SessionDoc } from "@/models/Session";
import { Vote } from "@/models/Vote";
import {
  applyVote,
  defaultConfig,
  finalWinner,
  initState,
  MatchState,
  nextPair,
  Phase,
  totalRoundsEstimate,
} from "@/lib/matchmaking";
import { GraphQLError } from "graphql";
import { nanoid } from "nanoid";
import { Types } from "mongoose";
import { DateTimeResolver, JSONResolver } from "graphql-scalars";
import type { GraphQLContext } from "@/lib/graphql/yoga";

function requireAdmin(ctx: GraphQLContext) {
  if (!ctx?.isAdmin) {
    throw new GraphQLError("Yetkisiz işlem", {
      extensions: { code: "UNAUTHORIZED", http: { status: 401 } },
    });
  }
}

function serializeImage(img: any) {
  return {
    id: img._id.toString(),
    url: img.url,
    fileName: img.fileName,
    width: img.width ?? null,
    height: img.height ?? null,
    elo: img.elo,
    wins: img.wins,
    losses: img.losses,
    appearances: img.appearances,
  };
}

function serializeGame(g: GameDoc & { _id: any }) {
  return {
    id: g._id.toString(),
    slug: g.slug,
    title: g.title,
    description: g.description ?? null,
    images: (g.images as any[]).map(serializeImage),
    status: g.status,
    totalSessions: g.totalSessions,
    totalVotes: g.totalVotes,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

function stateFromSession(
  session: SessionDoc,
  game: GameDoc
): MatchState {
  const imageIds = (game.images as any[]).map((i) => i._id.toString());
  const elo: Record<string, number> = {};
  const appearances: Record<string, number> = {};
  for (const id of imageIds) {
    elo[id] = 1200;
    appearances[id] = 0;
  }
  // session stores Maps
  const eloMap = session.eloState as unknown as Map<string, number>;
  const appMap = session.appearances as unknown as Map<string, number>;
  if (eloMap) for (const [k, v] of eloMap.entries()) elo[k] = v;
  if (appMap) for (const [k, v] of appMap.entries()) appearances[k] = v;

  return {
    imageIds,
    elo,
    appearances,
    history: (session.history as any[]).map((h) => ({
      imageA: h.imageA.toString(),
      imageB: h.imageB.toString(),
      winner: h.winner.toString(),
      round: h.round,
    })),
    phase: session.phase as Phase,
    round: session.totalRounds,
  };
}

function persistStateToSession(session: SessionDoc, state: MatchState) {
  session.eloState = new Map(Object.entries(state.elo)) as any;
  session.appearances = new Map(Object.entries(state.appearances)) as any;
  session.phase = state.phase as any;
  session.totalRounds = state.round;
  session.history = state.history.map((h) => ({
    imageA: new Types.ObjectId(h.imageA),
    imageB: new Types.ObjectId(h.imageB),
    winner: new Types.ObjectId(h.winner),
    round: h.round,
  })) as any;
}

function buildSessionState(
  session: SessionDoc,
  game: GameDoc,
  pair: [string, string] | null,
  phase: Phase,
  finished: boolean
) {
  const imgs = game.images as any[];
  const findImg = (id: string) =>
    imgs.find((i) => i._id.toString() === id);

  const winner =
    finished && session.finalWinnerId
      ? findImg(session.finalWinnerId.toString())
      : null;

  return {
    sessionKey: session.sessionKey,
    gameSlug: game.slug,
    phase,
    round: session.totalRounds,
    totalRoundsEstimate: totalRoundsEstimate(imgs.length),
    pair: pair
      ? {
          a: serializeImage(findImg(pair[0])),
          b: serializeImage(findImg(pair[1])),
        }
      : null,
    finished,
    winner: winner ? serializeImage(winner) : null,
  };
}

function ensureSlug(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = nanoid(6);
  return base ? `${base}-${suffix}` : suffix;
}

export const resolvers = {
  DateTime: DateTimeResolver,
  JSON: JSONResolver,

  Query: {
    games: async () => {
      await connectDB();
      const games = await Game.find().sort({ createdAt: -1 }).lean();
      return games.map((g: any) => serializeGame(g));
    },
    game: async (_: unknown, { slug }: { slug: string }) => {
      await connectDB();
      const g = await Game.findOne({ slug }).lean();
      return g ? serializeGame(g as any) : null;
    },
    session: async (_: unknown, { sessionKey }: { sessionKey: string }) => {
      await connectDB();
      const session = await VoteSession.findOne({ sessionKey });
      if (!session) throw new GraphQLError("Oturum bulunamadı");
      const game = await Game.findById(session.gameId);
      if (!game) throw new GraphQLError("Oyun bulunamadı");

      const state = stateFromSession(session, game);
      const cfg = defaultConfig(state.imageIds.length);
      const { pair, phase } = nextPair(state, cfg);
      const finished = state.phase === "done" || pair === null;

      return buildSessionState(
        session,
        game,
        pair as [string, string] | null,
        phase,
        finished
      );
    },
    analytics: async (_: unknown, { slug }: { slug: string }) => {
      await connectDB();
      const game = await Game.findOne({ slug }).lean<any>();
      if (!game) throw new GraphQLError("Oyun bulunamadı");

      const [totalSessions, finishedSessions, totalVotes] = await Promise.all([
        VoteSession.countDocuments({ gameId: game._id }),
        VoteSession.countDocuments({
          gameId: game._id,
          finishedAt: { $exists: true, $ne: null },
        }),
        Vote.countDocuments({ gameId: game._id }),
      ]);

      const finalWinners = await VoteSession.aggregate([
        {
          $match: {
            gameId: game._id,
            finalWinnerId: { $exists: true, $ne: null },
          },
        },
        { $group: { _id: "$finalWinnerId", count: { $sum: 1 } } },
      ]);

      const finalWinnerMap = new Map<string, number>();
      for (const w of finalWinners) {
        finalWinnerMap.set(w._id.toString(), w.count);
      }

      const imgs = (game.images as any[]).map((img) => {
        const id = img._id.toString();
        const appearances = img.appearances ?? 0;
        const wins = img.wins ?? 0;
        const losses = img.losses ?? 0;
        const winRate =
          wins + losses > 0 ? wins / (wins + losses) : 0;
        return {
          image: serializeImage(img),
          sessionWins: finalWinnerMap.get(id) ?? 0,
          sessionFinals: finalWinnerMap.get(id) ?? 0,
          voteWins: wins,
          voteLosses: losses,
          appearances,
          winRate,
        };
      });

      const leaderboard = [...imgs].sort(
        (a, b) => b.image.elo - a.image.elo
      );
      const finalWinnerCounts = [...imgs].sort(
        (a, b) => b.sessionWins - a.sessionWins
      );

      // head to head: { [winnerId]: { [loserId]: count } }
      const h2h = await Vote.aggregate([
        { $match: { gameId: game._id } },
        {
          $group: {
            _id: { w: "$winnerImageId", l: "$loserImageId" },
            count: { $sum: 1 },
          },
        },
      ]);
      const headToHead: Record<string, Record<string, number>> = {};
      for (const row of h2h) {
        const w = row._id.w.toString();
        const l = row._id.l.toString();
        if (!headToHead[w]) headToHead[w] = {};
        headToHead[w][l] = row.count;
      }

      return {
        gameId: game._id.toString(),
        totalSessions,
        finishedSessions,
        totalVotes,
        avgVotesPerSession:
          totalSessions > 0 ? totalVotes / totalSessions : 0,
        leaderboard,
        finalWinnerCounts,
        headToHead,
      };
    },
  },

  Mutation: {
    createGame: async (
      _: unknown,
      args: { title: string; description?: string; images: any[] },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      await connectDB();
      if (!args.title?.trim()) throw new GraphQLError("Başlık zorunlu");
      if (!args.images || args.images.length < 2) {
        throw new GraphQLError("En az 2 resim eklemelisin");
      }
      const slug = ensureSlug(args.title);
      const game = await Game.create({
        slug,
        title: args.title.trim(),
        description: args.description?.trim() || undefined,
        images: args.images.map((i) => ({
          url: i.url,
          fileName: i.fileName,
          width: i.width,
          height: i.height,
        })),
      });
      return serializeGame(game.toObject() as any);
    },

    updateGame: async (
      _: unknown,
      args: { slug: string; title?: string | null; description?: string | null },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      await connectDB();
      const game = await Game.findOne({ slug: args.slug });
      if (!game) throw new GraphQLError("Oyun bulunamadı");
      if (typeof args.title === "string") {
        const t = args.title.trim();
        if (!t) throw new GraphQLError("Başlık boş olamaz");
        game.title = t.slice(0, 140);
      }
      if (typeof args.description === "string") {
        game.description = args.description.trim().slice(0, 600);
      } else if (args.description === null) {
        game.description = undefined as any;
      }
      await game.save();
      return serializeGame(game.toObject() as any);
    },

    addImages: async (
      _: unknown,
      args: { slug: string; images: any[] },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      await connectDB();
      const game = await Game.findOne({ slug: args.slug });
      if (!game) throw new GraphQLError("Oyun bulunamadı");
      for (const i of args.images) {
        game.images.push({
          url: i.url,
          fileName: i.fileName,
          width: i.width,
          height: i.height,
        } as any);
      }
      await game.save();
      return serializeGame(game.toObject() as any);
    },

    deleteImage: async (
      _: unknown,
      args: { slug: string; imageId: string },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      await connectDB();
      const game = await Game.findOne({ slug: args.slug });
      if (!game) throw new GraphQLError("Oyun bulunamadı");
      const target = (game.images as any[]).find(
        (i) => i._id.toString() === args.imageId
      );
      if (!target) throw new GraphQLError("Resim bulunamadı");

      // dosyayı disk'ten temizle (en iyi çaba — başarısız olursa sessizce geç)
      if (target.url?.startsWith("/uploads/")) {
        try {
          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          const abs = path.join(process.cwd(), "public", target.url);
          await fs.unlink(abs);
        } catch {
          /* noop */
        }
      }

      game.images = (game.images as any[]).filter(
        (i) => i._id.toString() !== args.imageId
      ) as any;
      await game.save();

      // bu resme atıfta bulunan oyları da temizle (analitik temiz kalsın)
      try {
        const { Vote } = await import("@/models/Vote");
        await Vote.deleteMany({
          gameId: game._id,
          $or: [
            { winnerImageId: target._id },
            { loserImageId: target._id },
          ],
        });
      } catch {
        /* noop */
      }
      return serializeGame(game.toObject() as any);
    },

    deleteGame: async (
      _: unknown,
      { slug }: { slug: string },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      await connectDB();
      const game = await Game.findOne({ slug });
      if (!game) return false;
      await Promise.all([
        Vote.deleteMany({ gameId: game._id }),
        VoteSession.deleteMany({ gameId: game._id }),
        Game.deleteOne({ _id: game._id }),
      ]);
      return true;
    },

    startSession: async (_: unknown, { slug }: { slug: string }) => {
      await connectDB();
      const game = await Game.findOne({ slug });
      if (!game) throw new GraphQLError("Oyun bulunamadı");
      if (game.images.length < 2) {
        throw new GraphQLError("Oyun başlatmak için en az 2 resim gerekli");
      }

      const imageIds = (game.images as any[]).map((i) => i._id.toString());
      const state = initState(imageIds);
      const cfg = defaultConfig(imageIds.length);
      const { pair, phase } = nextPair(state, cfg);

      const sessionKey = nanoid(16);
      const session = await VoteSession.create({
        gameId: game._id,
        sessionKey,
        startedAt: new Date(),
        eloState: new Map(Object.entries(state.elo)),
        appearances: new Map(Object.entries(state.appearances)),
        history: [],
        phase: phase,
        totalRounds: 0,
      });

      await Game.updateOne(
        { _id: game._id },
        { $inc: { totalSessions: 1 } }
      );

      return buildSessionState(
        session,
        game,
        pair as [string, string] | null,
        phase,
        false
      );
    },

    submitVote: async (
      _: unknown,
      args: {
        sessionKey: string;
        winnerImageId: string;
        loserImageId: string;
      }
    ) => {
      await connectDB();
      const session = await VoteSession.findOne({
        sessionKey: args.sessionKey,
      });
      if (!session) throw new GraphQLError("Oturum bulunamadı");
      if (session.finishedAt) {
        throw new GraphQLError("Oturum zaten tamamlanmış");
      }

      const game = await Game.findById(session.gameId);
      if (!game) throw new GraphQLError("Oyun bulunamadı");

      const validIds = new Set(
        (game.images as any[]).map((i) => i._id.toString())
      );
      if (
        !validIds.has(args.winnerImageId) ||
        !validIds.has(args.loserImageId) ||
        args.winnerImageId === args.loserImageId
      ) {
        throw new GraphQLError("Geçersiz resim seçimi");
      }

      const state = stateFromSession(session, game);
      const cfg = defaultConfig(state.imageIds.length);
      const next = applyVote(state, args.winnerImageId, args.loserImageId, cfg);

      persistStateToSession(session, next);

      // log atomic vote
      await Vote.create({
        gameId: game._id,
        sessionKey: session.sessionKey,
        winnerImageId: new Types.ObjectId(args.winnerImageId),
        loserImageId: new Types.ObjectId(args.loserImageId),
        round: state.round,
        phase: state.phase,
      });

      // update Game.images counters
      await Game.updateOne(
        { _id: game._id, "images._id": new Types.ObjectId(args.winnerImageId) },
        {
          $inc: {
            "images.$.wins": 1,
            "images.$.appearances": 1,
            totalVotes: 1,
          },
        }
      );
      await Game.updateOne(
        { _id: game._id, "images._id": new Types.ObjectId(args.loserImageId) },
        {
          $inc: {
            "images.$.losses": 1,
            "images.$.appearances": 1,
          },
        }
      );

      // update Elo on Game.images (running average across all sessions to give a feel)
      const winnerImg = (game.images as any[]).find(
        (i) => i._id.toString() === args.winnerImageId
      );
      const loserImg = (game.images as any[]).find(
        (i) => i._id.toString() === args.loserImageId
      );
      if (winnerImg && loserImg) {
        const ea = 1 / (1 + Math.pow(10, (loserImg.elo - winnerImg.elo) / 400));
        const k = 16; // global elo daha yumuşak güncellesin
        const newWinnerElo = winnerImg.elo + k * (1 - ea);
        const newLoserElo = loserImg.elo + k * (0 - (1 - ea));
        await Game.updateOne(
          { _id: game._id, "images._id": winnerImg._id },
          { $set: { "images.$.elo": newWinnerElo } }
        );
        await Game.updateOne(
          { _id: game._id, "images._id": loserImg._id },
          { $set: { "images.$.elo": newLoserElo } }
        );
      }

      // determine next pair
      const { pair, phase } = nextPair(next, cfg);
      const finished = next.phase === "done" || pair === null;

      if (finished) {
        const winnerId = finalWinner(next);
        session.finishedAt = new Date();
        if (winnerId) {
          session.finalWinnerId = new Types.ObjectId(winnerId);
        }
        session.phase = "done" as any;
      }
      await session.save();

      // re-read game for fresh counts in response (optional, but nice)
      const freshGame = await Game.findById(game._id);
      return buildSessionState(
        session,
        freshGame!,
        pair as [string, string] | null,
        phase,
        finished
      );
    },
  },
};
