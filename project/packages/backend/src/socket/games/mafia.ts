import type {
  GameOverPayload,
  MafiaMovePayload,
  MafiaRole,
  MafiaServerState,
  MafiaState,
  PlayerInRoom
} from "@board-games/shared";

interface EngineResult<TState> {
  ok: boolean;
  state: TState;
  error: string;
  over?: Pick<GameOverPayload, "winnerId" | "reason">;
}

function nowIso(): string {
  return new Date().toISOString();
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j] as T;
    result[j] = temp as T;
  }
  return result;
}

function countAlive(state: MafiaServerState): { mafia: number; civilians: number } {
  let mafia = 0;
  let civilians = 0;
  for (const player of state.players) {
    if (!player.alive) continue;
    if (player.role === "mafia") mafia += 1;
    else civilians += 1;
  }
  return { mafia, civilians };
}

function resolveWinner(state: MafiaServerState): "mafia" | "civilians" | null {
  const { mafia, civilians } = countAlive(state);
  if (mafia >= civilians && mafia > 0) return "mafia";
  if (mafia === 0) return "civilians";
  return null;
}

function pickHighestVote(votes: Record<string, string>): string | null {
  const counts = new Map<string, number>();
  for (const targetId of Object.values(votes)) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }
  let top: string | null = null;
  let max = 0;
  for (const [targetId, count] of counts.entries()) {
    if (count > max) {
      max = count;
      top = targetId;
    }
  }
  return top;
}

function eliminate(state: MafiaServerState, targetId: string | null): void {
  if (!targetId) return;
  const target = state.players.find((p) => p.userId === targetId);
  if (!target || !target.alive) return;
  target.alive = false;
  state.lastEliminatedId = targetId;
}

function isAliveTarget(state: MafiaServerState, targetId: string): boolean {
  const target = state.players.find((p) => p.userId === targetId);
  return Boolean(target && target.alive);
}

function resetNight(state: MafiaServerState): void {
  state.nightVotes = {};
  state.doctorSaveId = null;
  state.sheriffCheckId = null;
}

export function sanitizeMafiaState(state: MafiaServerState, viewerId: string): MafiaState {
  return {
    gameType: "mafia",
    phase: state.phase,
    players: state.players.map((player) => {
      const isSelf = player.userId === viewerId;
      const roleVisible = isSelf || !player.alive ? player.role : null;
      return {
        userId: player.userId,
        username: player.username,
        alive: player.alive,
        role: roleVisible,
        isSelf
      };
    }),
    day: state.day,
    night: state.night,
    dayVotes: state.dayVotes,
    lastEliminatedId: state.lastEliminatedId,
    winner: state.winner,
    reason: state.reason,
    sheriffResult: state.sheriffResult?.userId === viewerId ? state.sheriffResult.result : null,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

export function createInitialMafiaState(players: PlayerInRoom[]): MafiaServerState {
  if (players.length < 6) {
    throw new Error("Mafia requires at least 6 players");
  }

  const shuffled = shuffle(players);
  const mafiaCount = Math.max(1, Math.floor(players.length / 4));
  const roles: MafiaRole[] = ["doctor", "sheriff"];

  for (let i = 0; i < mafiaCount; i += 1) {
    roles.push("mafia");
  }

  while (roles.length < players.length) {
    roles.push("civilian");
  }

  const roleDeck = shuffle(roles);

  const playerStates = shuffled.map((player, index) => ({
    userId: player.userId,
    username: player.username,
    role: roleDeck[index] ?? "civilian",
    alive: true
  }));

  return {
    gameType: "mafia",
    phase: "night",
    players: playerStates,
    day: 1,
    night: 1,
    dayVotes: {},
    nightVotes: {},
    doctorSaveId: null,
    sheriffCheckId: null,
    sheriffResult: null,
    lastEliminatedId: null,
    winner: null,
    reason: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function applyMafiaMove(
  state: MafiaServerState,
  payload: MafiaMovePayload,
  playerId: string
): EngineResult<MafiaServerState> {
  const actor = state.players.find((p) => p.userId === playerId);
  if (!actor || !actor.alive) {
    return { ok: false, state, error: "Player is not alive" };
  }

  if (state.phase === "ended") {
    return { ok: false, state, error: "Mafia game already finished" };
  }

  const resolveAndCheck = (): Pick<GameOverPayload, "winnerId" | "reason"> | undefined => {
    const winner = resolveWinner(state);
    if (!winner) return undefined;
    state.phase = "ended";
    state.winner = winner;
    state.reason = winner === "mafia" ? "mafia-wins" : "civilians-win";
    return { winnerId: null, reason: `mafia:${winner}` };
  };

  const resolveNight = (): Pick<GameOverPayload, "winnerId" | "reason"> | undefined => {
    const mafiaTarget = pickHighestVote(state.nightVotes);
    const saved = state.doctorSaveId;
    if (mafiaTarget && mafiaTarget !== saved) {
      eliminate(state, mafiaTarget);
    }

    if (state.sheriffCheckId) {
      const target = state.players.find((p) => p.userId === state.sheriffCheckId);
      if (target) {
        const sheriffId = state.players.find((p) => p.role === "sheriff" && p.alive)?.userId;
        state.sheriffResult = {
          userId: sheriffId ?? actor.userId,
          result: { targetId: target.userId, role: target.role }
        };
      }
    }

    state.phase = "day";
    state.day += 1;
    resetNight(state);
    state.dayVotes = {};

    return resolveAndCheck();
  };

  const resolveDay = (): Pick<GameOverPayload, "winnerId" | "reason"> | undefined => {
    const target = pickHighestVote(state.dayVotes);
    eliminate(state, target);

    state.phase = "night";
    state.night += 1;
    state.dayVotes = {};
    state.sheriffResult = null;
    resetNight(state);

    return resolveAndCheck();
  };

  let over: Pick<GameOverPayload, "winnerId" | "reason"> | undefined;

  if (payload.action === "night:mafia") {
    if (state.phase !== "night") {
      return { ok: false, state, error: "Mafia expects night actions" };
    }
    if (actor.role !== "mafia") {
      return { ok: false, state, error: "Only mafia can vote at night" };
    }
    if (!payload.targetId) {
      return { ok: false, state, error: "Target is required" };
    }
    if (!isAliveTarget(state, payload.targetId)) {
      return { ok: false, state, error: "Target is not alive" };
    }
    state.nightVotes[playerId] = payload.targetId;
  } else if (payload.action === "night:doctor") {
    if (state.phase !== "night") {
      return { ok: false, state, error: "Mafia expects night actions" };
    }
    if (actor.role !== "doctor") {
      return { ok: false, state, error: "Only doctor can save" };
    }
    if (!payload.targetId) {
      return { ok: false, state, error: "Target is required" };
    }
    if (!isAliveTarget(state, payload.targetId)) {
      return { ok: false, state, error: "Target is not alive" };
    }
    state.doctorSaveId = payload.targetId;
  } else if (payload.action === "night:sheriff") {
    if (state.phase !== "night") {
      return { ok: false, state, error: "Mafia expects night actions" };
    }
    if (actor.role !== "sheriff") {
      return { ok: false, state, error: "Only sheriff can investigate" };
    }
    if (!payload.targetId) {
      return { ok: false, state, error: "Target is required" };
    }
    if (!isAliveTarget(state, payload.targetId)) {
      return { ok: false, state, error: "Target is not alive" };
    }
    state.sheriffCheckId = payload.targetId;
  } else if (payload.action === "night:resolve") {
    if (state.phase !== "night") {
      return { ok: false, state, error: "Mafia expects night actions" };
    }
    over = resolveNight();
  } else if (payload.action === "day:vote") {
    if (state.phase !== "day") {
      return { ok: false, state, error: "Mafia expects day vote" };
    }
    if (!payload.targetId) {
      return { ok: false, state, error: "Target is required" };
    }
    if (!isAliveTarget(state, payload.targetId)) {
      return { ok: false, state, error: "Target is not alive" };
    }
    state.dayVotes[playerId] = payload.targetId;

    const alive = state.players.filter((p) => p.alive);
    if (Object.keys(state.dayVotes).length >= alive.length) {
      over = resolveDay();
    }
  } else if (payload.action === "day:resolve") {
    if (state.phase !== "day") {
      return { ok: false, state, error: "Mafia expects day vote" };
    }
    over = resolveDay();
  }

  if (!over && state.phase === "night") {
    const aliveMafia = state.players.filter((p) => p.alive && p.role === "mafia");
    const mafiaVotes = Object.keys(state.nightVotes).length;
    const doctorAlive = state.players.some((p) => p.alive && p.role === "doctor");
    const sheriffAlive = state.players.some((p) => p.alive && p.role === "sheriff");
    const ready =
      mafiaVotes >= aliveMafia.length &&
      (!doctorAlive || Boolean(state.doctorSaveId)) &&
      (!sheriffAlive || Boolean(state.sheriffCheckId));

    if (ready) {
      over = resolveNight();
    }
  }

  state.updatedAt = nowIso();

  if (over) {
    return { ok: true, state, error: "", over };
  }

  return { ok: true, state, error: "" };
}
