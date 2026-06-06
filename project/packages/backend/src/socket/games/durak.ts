import type {
  Card,
  DurakMovePayload,
  DurakPlayerPublic,
  DurakPlayerState,
  DurakPlayerViewState,
  DurakState,
  GameOverPayload,
  PlayerInRoom,
  Rank,
  Suit
} from "@board-games/shared";

interface EngineResult<TState> {
  ok: boolean;
  state: TState;
  error: string;
  over?: Pick<GameOverPayload, "winnerId" | "reason">;
}

const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const RANKS: Rank[] = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VALUE: Record<Rank, number> = {
  "6": 0,
  "7": 1,
  "8": 2,
  "9": 3,
  "10": 4,
  J: 5,
  Q: 6,
  K: 7,
  A: 8
};

function nowIso(): string {
  return new Date().toISOString();
}

function shuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}-${deck.length}`,
        suit,
        rank
      });
    }
  }

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }

  return deck;
}

function cloneState(state: DurakState): DurakState {
  return {
    ...state,
    deck: [...state.deck],
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    table: state.table.map((pair) => ({
      ...pair,
      attack: { ...pair.attack },
      defense: pair.defense ? { ...pair.defense } : null
    })),
    discard: [...state.discard],
    winnerIds: [...state.winnerIds]
  };
}

function activePlayers(state: DurakState): DurakPlayerState[] {
  if (state.deck.length > 0) return [...state.players];
  return state.players.filter((p) => p.hand.length > 0);
}

function nextActivePlayerId(state: DurakState, currentId: string): string {
  const all = activePlayers(state);
  if (all.length === 0) return currentId;
  const idx = all.findIndex((p) => p.userId === currentId);
  if (idx < 0) return all[0].userId;
  return all[(idx + 1) % all.length].userId;
}

function beats(attack: Card, defend: Card, trump: Suit): boolean {
  if (defend.suit === attack.suit) {
    return RANK_VALUE[defend.rank] > RANK_VALUE[attack.rank];
  }
  if (defend.suit === trump && attack.suit !== trump) {
    return true;
  }
  return false;
}

function removeCard(hand: Card[], cardId: string): Card | null {
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  const [card] = hand.splice(idx, 1);
  return card;
}

function drawUpToSix(state: DurakState, startPlayerId: string): void {
  if (state.deck.length === 0) return;

  const players = [...state.players];
  const startIdx = players.findIndex((p) => p.userId === startPlayerId);
  if (startIdx < 0) return;

  for (let offset = 0; offset < players.length; offset += 1) {
    const idx = (startIdx + offset) % players.length;
    const player = players[idx];
    while (player.hand.length < 6 && state.deck.length > 0) {
      const card = state.deck.shift();
      if (!card) break;
      player.hand.push(card);
    }
  }
}

function maybeResolveGameOver(state: DurakState): Pick<GameOverPayload, "winnerId" | "reason"> | undefined {
  if (state.deck.length > 0) return undefined;

  for (const p of state.players) {
    if (p.hand.length === 0 && !state.winnerIds.includes(p.userId)) {
      state.winnerIds.push(p.userId);
    }
  }

  const playersWithCards = state.players.filter((p) => p.hand.length > 0);
  if (playersWithCards.length === 1) {
    state.loserId = playersWithCards[0].userId;
    state.reason = "durak";
    return {
      winnerId: null,
      reason: `durak:${state.loserId}`
    };
  }

  return undefined;
}

function cardRanksOnTable(state: DurakState): Set<Rank> {
  const ranks = new Set<Rank>();
  for (const pair of state.table) {
    ranks.add(pair.attack.rank);
    if (pair.defense) ranks.add(pair.defense.rank);
  }
  return ranks;
}

export function createInitialDurakState(players: PlayerInRoom[]): DurakState {
  if (players.length < 2 || players.length > 4) {
    throw new Error("Durak supports 2 to 4 players");
  }

  const deck = shuffledDeck();
  const playerStates: DurakPlayerState[] = players.map((p) => ({
    userId: p.userId,
    username: p.username,
    hand: []
  }));

  for (let round = 0; round < 6; round += 1) {
    for (const player of playerStates) {
      const card = deck.shift();
      if (!card) break;
      player.hand.push(card);
    }
  }

  const trumpCard = deck[deck.length - 1];
  const attacker = playerStates[0];
  const defender = playerStates[1];

  return {
    gameType: "durak",
    deck,
    trumpSuit: trumpCard.suit,
    phase: "attack",
    attackerId: attacker.userId,
    defenderId: defender.userId,
    turnPlayerId: attacker.userId,
    players: playerStates,
    table: [],
    discard: [],
    winnerIds: [],
    loserId: null,
    reason: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function applyDurakMove(current: DurakState, payload: DurakMovePayload, playerId: string): EngineResult<DurakState> {
  const state = cloneState(current);
  const player = state.players.find((p) => p.userId === playerId);
  if (!player) {
    return { ok: false, state: current, error: "Player is not in this room" };
  }

  if (state.loserId) {
    return { ok: false, state: current, error: "Game already finished" };
  }

  if (payload.action === "attack") {
    if (playerId !== state.attackerId) {
      return { ok: false, state: current, error: "Only attacker can attack" };
    }
    if (state.phase !== "attack") {
      return { ok: false, state: current, error: "Game expects defense now" };
    }

    const card = removeCard(player.hand, payload.cardId);
    if (!card) {
      return { ok: false, state: current, error: "Card not found in hand" };
    }

    if (state.table.length > 0) {
      const ranks = cardRanksOnTable(state);
      if (!ranks.has(card.rank)) {
        player.hand.push(card);
        return { ok: false, state: current, error: "Attack card rank must match table ranks" };
      }
    }

    const defender = state.players.find((p) => p.userId === state.defenderId);
    const defenderHand = defender ? defender.hand.length : 0;
    if (state.table.length >= defenderHand) {
      player.hand.push(card);
      return { ok: false, state: current, error: "Too many attacking cards for defender hand" };
    }

    state.table.push({
      id: `pair-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      attack: card,
      defense: null,
      attackerId: state.attackerId,
      defenderId: state.defenderId
    });
    state.phase = "defend";
    state.turnPlayerId = state.defenderId;
  } else if (payload.action === "defend") {
    if (playerId !== state.defenderId) {
      return { ok: false, state: current, error: "Only defender can defend" };
    }
    if (state.phase !== "defend") {
      return { ok: false, state: current, error: "Game expects attack now" };
    }

    const pair = state.table.find((p) => p.id === payload.targetPairId);
    if (!pair || pair.defense) {
      return { ok: false, state: current, error: "Target attack is invalid" };
    }

    const card = player.hand.find((c) => c.id === payload.cardId);
    if (!card) {
      return { ok: false, state: current, error: "Defense card not found in hand" };
    }

    if (!beats(pair.attack, card, state.trumpSuit)) {
      return { ok: false, state: current, error: "Defense card does not beat attack card" };
    }

    const removed = removeCard(player.hand, payload.cardId);
    if (!removed) {
      return { ok: false, state: current, error: "Defense card disappeared from hand" };
    }

    pair.defense = removed;

    const allDefended = state.table.every((t) => t.defense !== null);
    if (allDefended) {
      state.phase = "attack";
      state.turnPlayerId = state.attackerId;
    }
  } else if (payload.action === "take") {
    if (playerId !== state.defenderId) {
      return { ok: false, state: current, error: "Only defender can take cards" };
    }
    if (state.table.length === 0) {
      return { ok: false, state: current, error: "Nothing to take" };
    }

    const defender = state.players.find((p) => p.userId === state.defenderId);
    if (!defender) {
      return { ok: false, state: current, error: "Defender not found" };
    }

    for (const pair of state.table) {
      defender.hand.push(pair.attack);
      if (pair.defense) defender.hand.push(pair.defense);
    }
    state.table = [];

    // Draw cards for everyone except the defender (who just took)
    drawUpToSix(state, state.attackerId);

    // Next attacker = player after the defender who just took
    const newAttackerId = nextActivePlayerId(state, state.defenderId);
    const newDefenderId = nextActivePlayerId(state, newAttackerId);
    state.attackerId = newAttackerId;
    state.defenderId = newDefenderId;

    state.phase = "attack";
    state.turnPlayerId = state.attackerId;
  } else if (payload.action === "pass") {
    if (playerId !== state.attackerId) {
      return { ok: false, state: current, error: "Only attacker can pass and end round" };
    }
    if (state.table.length === 0) {
      return { ok: false, state: current, error: "Cannot pass with empty table" };
    }
    if (state.table.some((pair) => pair.defense === null)) {
      return { ok: false, state: current, error: "Cannot pass while there are undefended attacks" };
    }

    for (const pair of state.table) {
      state.discard.push(pair.attack);
      if (pair.defense) state.discard.push(pair.defense);
    }
    state.table = [];

    drawUpToSix(state, state.attackerId);

    const nextAttacker = nextActivePlayerId(state, state.attackerId);
    const nextDefender = nextActivePlayerId(state, nextAttacker);

    state.attackerId = nextAttacker;
    state.defenderId = nextDefender;
    state.phase = "attack";
    state.turnPlayerId = state.attackerId;
  }

  state.updatedAt = nowIso();
  const over = maybeResolveGameOver(state);

  return {
    ok: true,
    state,
    error: "",
    ...(over ? { over } : {})
  };
}

export function sanitizeDurakStateForPlayer(state: DurakState, viewerId: string): DurakPlayerViewState {
  const players: DurakPlayerPublic[] = state.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    handCount: p.hand.length,
    isSelf: p.userId === viewerId
  }));

  const ownHand = state.players.find((p) => p.userId === viewerId)?.hand ?? [];

  return {
    gameType: "durak",
    deckCount: state.deck.length,
    trumpSuit: state.trumpSuit,
    phase: state.phase,
    attackerId: state.attackerId,
    defenderId: state.defenderId,
    turnPlayerId: state.turnPlayerId,
    players,
    ownHand,
    table: state.table,
    discardCount: state.discard.length,
    winnerIds: state.winnerIds,
    loserId: state.loserId,
    reason: state.reason,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}
