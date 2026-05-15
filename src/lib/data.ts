/**
 * Server-side data layer used by server components. Bypasses the
 * internal GraphQL HTTP round-trip so pages can render without
 * depending on the dev server's actual port.
 */

import { connectDB } from "@/lib/db";
import { Game } from "@/models/Game";
import { VoteSession } from "@/models/Session";
import { Vote } from "@/models/Vote";
import {
  defaultConfig,
  nextPair,
  totalRoundsEstimate,
  type MatchState,
  type Phase,
} from "@/lib/matchmaking";

export type GameImageDTO = {
  id: string;
  url: string;
  fileName: string;
  width: number | null;
  height: number | null;
  elo: number;
  wins: number;
  losses: number;
  appearances: number;
};

export type GameDTO = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  images: GameImageDTO[];
  status: string;
  totalSessions: number;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
};

export type ImageStatDTO = {
  image: GameImageDTO;
  sessionWins: number;
  voteWins: number;
  voteLosses: number;
  appearances: number;
  winRate: number;
};

export type AnalyticsDTO = {
  totalSessions: number;
  finishedSessions: number;
  totalVotes: number;
  avgVotesPerSession: number;
  leaderboard: ImageStatDTO[];
  finalWinnerCounts: ImageStatDTO[];
};

export type SessionStateDTO = {
  sessionKey: string;
  gameSlug: string;
  phase: Phase;
  round: number;
  totalRoundsEstimate: number;
  pair: { a: GameImageDTO; b: GameImageDTO } | null;
  finished: boolean;
  winner: GameImageDTO | null;
};

function imgToDTO(img: any): GameImageDTO {
  return {
    id: img._id.toString(),
    url: img.url,
    fileName: img.fileName,
    width: img.width ?? null,
    height: img.height ?? null,
    elo: img.elo ?? 1200,
    wins: img.wins ?? 0,
    losses: img.losses ?? 0,
    appearances: img.appearances ?? 0,
  };
}

function gameToDTO(g: any): GameDTO {
  return {
    id: g._id.toString(),
    slug: g.slug,
    title: g.title,
    description: g.description ?? null,
    images: (g.images ?? []).map(imgToDTO),
    status: g.status,
    totalSessions: g.totalSessions ?? 0,
    totalVotes: g.totalVotes ?? 0,
    createdAt: g.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: g.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function listGames(): Promise<GameDTO[]> {
  await connectDB();
  const rows = await Game.find().sort({ createdAt: -1 }).lean();
  return rows.map((g: any) => gameToDTO(g));
}

export async function getGameBySlug(slug: string): Promise<GameDTO | null> {
  await connectDB();
  const g = await Game.findOne({ slug }).lean<any>();
  return g ? gameToDTO(g) : null;
}

export async function getAnalytics(slug: string): Promise<AnalyticsDTO | null> {
  await connectDB();
  const game = await Game.findOne({ slug }).lean<any>();
  if (!game) return null;

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
  for (const w of finalWinners) finalWinnerMap.set(w._id.toString(), w.count);

  const imgs: ImageStatDTO[] = (game.images as any[]).map((img) => {
    const id = img._id.toString();
    const appearances = img.appearances ?? 0;
    const wins = img.wins ?? 0;
    const losses = img.losses ?? 0;
    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;
    return {
      image: imgToDTO(img),
      sessionWins: finalWinnerMap.get(id) ?? 0,
      voteWins: wins,
      voteLosses: losses,
      appearances,
      winRate,
    };
  });

  return {
    totalSessions,
    finishedSessions,
    totalVotes,
    avgVotesPerSession: totalSessions > 0 ? totalVotes / totalSessions : 0,
    leaderboard: [...imgs].sort((a, b) => b.image.elo - a.image.elo),
    finalWinnerCounts: [...imgs].sort(
      (a, b) => b.sessionWins - a.sessionWins
    ),
  };
}

export async function getSessionState(
  sessionKey: string
): Promise<SessionStateDTO | null> {
  await connectDB();
  const session = await VoteSession.findOne({ sessionKey });
  if (!session) return null;
  const game = await Game.findById(session.gameId);
  if (!game) return null;

  const imgs = game.images as any[];
  const imageIds = imgs.map((i) => i._id.toString());
  const elo: Record<string, number> = Object.fromEntries(
    imageIds.map((id) => [id, 1200])
  );
  const appearances: Record<string, number> = Object.fromEntries(
    imageIds.map((id) => [id, 0])
  );
  const eloMap = session.eloState as unknown as Map<string, number>;
  const appMap = session.appearances as unknown as Map<string, number>;
  if (eloMap) for (const [k, v] of eloMap.entries()) elo[k] = v;
  if (appMap) for (const [k, v] of appMap.entries()) appearances[k] = v;

  const state: MatchState = {
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

  const cfg = defaultConfig(imageIds.length);
  const { pair, phase } = nextPair(state, cfg);
  const finished =
    !!session.finishedAt || state.phase === "done" || pair === null;

  const find = (id: string) => imgs.find((i: any) => i._id.toString() === id);
  const winner =
    finished && session.finalWinnerId
      ? find(session.finalWinnerId.toString())
      : null;

  return {
    sessionKey: session.sessionKey,
    gameSlug: game.slug,
    phase,
    round: session.totalRounds,
    totalRoundsEstimate: totalRoundsEstimate(imgs.length),
    pair: pair
      ? { a: imgToDTO(find(pair[0])), b: imgToDTO(find(pair[1])) }
      : null,
    finished,
    winner: winner ? imgToDTO(winner) : null,
  };
}
