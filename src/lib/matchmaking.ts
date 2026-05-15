/**
 * Hibrit eşleştirme algoritması.
 *
 * Faz 1 — Keşif: her resim en az `minAppearances` kez gösterilsin.
 *                  Tüm resimler havuza eşit girer.
 * Faz 2 — Sıralama: Elo'su yakın resimler eşleştirilir; bilgi kazancı
 *                    maksimize edilir (belirsizliği azaltır).
 * Faz 3 — Final:  top 4 → top 2 → tek galip mini turnuvası.
 *
 * Anti-repeat penceresi: son K turda gösterilen çift tekrar gelmez
 * (ancak gerekirse faz değişiminde yeniden seçilebilir).
 */

export type ImageId = string;

export interface PhasedConfig {
  minAppearances: number;
  rankingRounds: number;
  antiRepeatWindow: number;
  kFactor: number;
}

export type Phase = "discovery" | "ranking" | "final" | "done";

export interface HistoryEntry {
  imageA: ImageId;
  imageB: ImageId;
  winner: ImageId;
  round: number;
}

export interface MatchState {
  imageIds: ImageId[];
  elo: Record<ImageId, number>;
  appearances: Record<ImageId, number>;
  history: HistoryEntry[];
  phase: Phase;
  round: number;
}

export function defaultConfig(imageCount: number): PhasedConfig {
  return {
    minAppearances: Math.max(2, Math.ceil(Math.log2(Math.max(2, imageCount)))),
    rankingRounds: Math.max(3, Math.ceil(imageCount / 2)),
    antiRepeatWindow: Math.min(5, Math.max(2, Math.floor(imageCount / 2))),
    kFactor: 32,
  };
}

export function totalRoundsEstimate(imageCount: number): number {
  const cfg = defaultConfig(imageCount);
  const discovery = Math.ceil((imageCount * cfg.minAppearances) / 2);
  const final = 3; // 2 semifinal + 1 final (top 4 → 2 → 1)
  return discovery + cfg.rankingRounds + final;
}

function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function applyVote(
  state: MatchState,
  winnerId: ImageId,
  loserId: ImageId,
  cfg: PhasedConfig
): MatchState {
  const elo = { ...state.elo };
  const ea = expectedScore(elo[winnerId], elo[loserId]);
  const eb = 1 - ea;
  elo[winnerId] = elo[winnerId] + cfg.kFactor * (1 - ea);
  elo[loserId] = elo[loserId] + cfg.kFactor * (0 - eb);

  const appearances = { ...state.appearances };
  appearances[winnerId] = (appearances[winnerId] ?? 0) + 1;
  appearances[loserId] = (appearances[loserId] ?? 0) + 1;

  const history = [
    ...state.history,
    {
      imageA: winnerId,
      imageB: loserId,
      winner: winnerId,
      round: state.round,
    },
  ];

  const round = state.round + 1;
  const phase = decidePhase({ ...state, elo, appearances, history, round }, cfg);

  return { ...state, elo, appearances, history, phase, round };
}

function decidePhase(state: MatchState, cfg: PhasedConfig): Phase {
  const allDiscovered = state.imageIds.every(
    (id) => (state.appearances[id] ?? 0) >= cfg.minAppearances
  );
  if (!allDiscovered) return "discovery";

  const discoveryRoundsTarget = Math.ceil(
    (state.imageIds.length * cfg.minAppearances) / 2
  );
  if (state.round < discoveryRoundsTarget + cfg.rankingRounds) {
    return "ranking";
  }

  // final phase has 3 sub-rounds: 2 semifinal + 1 final
  const finalStart = discoveryRoundsTarget + cfg.rankingRounds;
  if (state.round < finalStart + 3) return "final";
  return "done";
}

function pairKey(a: ImageId, b: ImageId): string {
  return [a, b].sort().join("|");
}

function recentPairs(state: MatchState, window: number): Set<string> {
  const recent = state.history.slice(-window);
  return new Set(recent.map((h) => pairKey(h.imageA, h.imageB)));
}

function pickDiscoveryPair(state: MatchState, cfg: PhasedConfig): [ImageId, ImageId] | null {
  const recent = recentPairs(state, cfg.antiRepeatWindow);
  const sorted = [...state.imageIds].sort(
    (a, b) => (state.appearances[a] ?? 0) - (state.appearances[b] ?? 0)
  );

  // pick the least-shown image, then pair with another least-shown not seen recently
  for (const a of sorted) {
    const candidates = sorted.filter(
      (b) => b !== a && !recent.has(pairKey(a, b))
    );
    if (candidates.length === 0) continue;
    // pick second image with minimum appearances, randomize ties
    const minB = candidates[0];
    const minBCount = state.appearances[minB] ?? 0;
    const tied = candidates.filter(
      (b) => (state.appearances[b] ?? 0) === minBCount
    );
    const b = tied[Math.floor(Math.random() * tied.length)];
    return [a, b];
  }

  // anti-repeat çıkmadıysa ilk geçerli çifti döndür
  if (sorted.length >= 2) return [sorted[0], sorted[1]];
  return null;
}

function pickRankingPair(state: MatchState, cfg: PhasedConfig): [ImageId, ImageId] | null {
  const recent = recentPairs(state, cfg.antiRepeatWindow);
  // sort by Elo asc, pair adjacent (close-rated) images that haven't met recently
  const sorted = [...state.imageIds].sort(
    (a, b) => state.elo[a] - state.elo[b]
  );

  const pairs: Array<{ a: ImageId; b: ImageId; gap: number }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (recent.has(pairKey(a, b))) continue;
    pairs.push({ a, b, gap: Math.abs(state.elo[a] - state.elo[b]) });
  }

  if (pairs.length === 0) {
    // fallback: pick the closest pair even if it's recent
    let best: { a: ImageId; b: ImageId; gap: number } | null = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = Math.abs(state.elo[sorted[i]] - state.elo[sorted[i + 1]]);
      if (!best || gap < best.gap) {
        best = { a: sorted[i], b: sorted[i + 1], gap };
      }
    }
    return best ? [best.a, best.b] : null;
  }

  // pick closest gap with small randomization to keep things lively
  pairs.sort((x, y) => x.gap - y.gap);
  const topK = pairs.slice(0, Math.min(3, pairs.length));
  const pick = topK[Math.floor(Math.random() * topK.length)];
  return [pick.a, pick.b];
}

function pickFinalPair(state: MatchState): [ImageId, ImageId] | null {
  const sorted = [...state.imageIds].sort((a, b) => state.elo[b] - state.elo[a]);

  // Top 4 ile mini turnuva: sub-round 0 = 1v4, sub-round 1 = 2v3,
  // sub-round 2 = winner(0) vs winner(1).
  // Hangi sub-round'da olduğumuzu top-4 içi geçmiş eşleşme sayısından çıkarıyoruz.
  const top4 = new Set(sorted.slice(0, Math.min(4, sorted.length)));
  const finalsSoFar = state.history.filter(
    (h) => top4.has(h.imageA) && top4.has(h.imageB)
  );

  const top = sorted.slice(0, Math.min(4, sorted.length));

  if (top.length === 1) return null;
  if (top.length === 2) return [top[0], top[1]];

  if (finalsSoFar.length === 0) {
    // 1 vs 4
    return [top[0], top[top.length - 1]];
  }
  if (finalsSoFar.length === 1) {
    // 2 vs 3
    return [top[1], top[Math.min(2, top.length - 1)]];
  }
  // final between the two semifinal winners
  const semi1Winner = finalsSoFar[0].winner;
  const semi2Winner = finalsSoFar[1].winner;
  if (semi1Winner === semi2Winner) {
    // şiddetli ihtimal: aynı resim iki yarı finalden çıktıysa
    // ona en yakın diğer resmi getir
    const other = top.find((id) => id !== semi1Winner);
    return other ? [semi1Winner, other] : null;
  }
  return [semi1Winner, semi2Winner];
}

export function nextPair(
  state: MatchState,
  cfg: PhasedConfig
): { pair: [ImageId, ImageId] | null; phase: Phase } {
  if (state.imageIds.length < 2) return { pair: null, phase: "done" };
  if (state.phase === "done") return { pair: null, phase: "done" };

  let pair: [ImageId, ImageId] | null = null;
  if (state.phase === "discovery") pair = pickDiscoveryPair(state, cfg);
  else if (state.phase === "ranking") pair = pickRankingPair(state, cfg);
  else if (state.phase === "final") pair = pickFinalPair(state);

  return { pair, phase: state.phase };
}

export function finalWinner(state: MatchState): ImageId | null {
  if (state.imageIds.length === 0) return null;
  const sorted = [...state.imageIds].sort((a, b) => state.elo[b] - state.elo[a]);
  return sorted[0] ?? null;
}

export function rankedImages(state: MatchState): Array<{ id: ImageId; elo: number }> {
  return [...state.imageIds]
    .map((id) => ({ id, elo: state.elo[id] ?? 1200 }))
    .sort((a, b) => b.elo - a.elo);
}

export function initState(imageIds: ImageId[], startingElo = 1200): MatchState {
  const elo: Record<ImageId, number> = {};
  const appearances: Record<ImageId, number> = {};
  for (const id of imageIds) {
    elo[id] = startingElo;
    appearances[id] = 0;
  }
  return {
    imageIds: [...imageIds],
    elo,
    appearances,
    history: [],
    phase: "discovery",
    round: 0,
  };
}
