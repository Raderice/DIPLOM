import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage, Text, Group } from "react-konva";
import type { DurakMovePayload, DurakPlayerViewState } from "@board-games/shared";
import { emitGameMove } from "../socket/client";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { durakPhaseRu, translateServerMessage } from "../lib/i18n";

const TABLE_W = 980;
const TABLE_H = 520;
const CARD_W = 72;
const CARD_H = 104;
const TABLE_ZONE = { x: 38, y: 112, width: TABLE_W - 76, height: 228 };

function suitSymbol(suit: string): string {
  if (suit === "hearts") return "♥";
  if (suit === "diamonds") return "♦";
  if (suit === "clubs") return "♣";
  return "♠";
}

function toFriendlyMoveError(message: string): string {
  if (/card not found|defense card not found/i.test(message)) {
    return "Выбранная карта больше недоступна. Выберите карту заново.";
  }
  if (/only attacker/i.test(message)) {
    return "Сейчас это действие доступно только атакующему.";
  }
  if (/only defender/i.test(message)) {
    return "Сейчас это действие доступно только защищающемуся.";
  }
  return translateServerMessage(message);
}

export function DurakGame(): React.JSX.Element {
  const room = useGameStore((s) => s.room);
  const gameState = useGameStore((s) => s.gameState);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [tableScale, setTableScale] = useState(1);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const state = useMemo(() => {
    if (!gameState || gameState.gameType !== "durak") return null;
    return gameState as DurakPlayerViewState;
  }, [gameState]);

  useEffect(() => {
    if (!boardRef.current) return;
    const update = () => {
      const width = boardRef.current?.clientWidth ?? TABLE_W;
      setTableScale(Math.max(0.3, Math.min(1, width / TABLE_W)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  if (!room || !state) {
    return <div className="rounded-lg border p-4">Состояние партии в дурака недоступно.</div>;
  }

  const me = window.localStorage.getItem("user_id") ?? "";
  const isAttacker = state.attackerId === me;
  const isDefender = state.defenderId === me;
  const canAttackByDrag = isAttacker && state.phase === "attack" && !state.reason;
  const canDefendByDrag = isDefender && state.phase === "defend" && !state.reason;

  const findNearestUndefendedPair = (dropX: number): string | null => {
    const undefended = state.table
      .map((pair, idx) => ({
        id: pair.id,
        defended: Boolean(pair.defense),
        centerX: 80 + idx * 130 + CARD_W / 2
      }))
      .filter((pair) => !pair.defended);

    if (undefended.length === 0) return null;

    const first = undefended[0];
    if (!first) return null;

    let nearest = first;
    let bestDistance = Math.abs(dropX - nearest.centerX);
    for (const candidate of undefended.slice(1)) {
      const distance = Math.abs(dropX - candidate.centerX);
      if (distance < bestDistance) {
        nearest = candidate;
        bestDistance = distance;
      }
    }

    return nearest.id;
  };

  const isInsideTableZone = (x: number, y: number): boolean => {
    return (
      x >= TABLE_ZONE.x &&
      x <= TABLE_ZONE.x + TABLE_ZONE.width &&
      y >= TABLE_ZONE.y &&
      y <= TABLE_ZONE.y + TABLE_ZONE.height
    );
  };

  const sendAction = async (payload: DurakMovePayload) => {
    const result = await emitGameMove(payload);
    if (!result.ok) {
      setMoveError(toFriendlyMoveError(result.error));
      return;
    }
    setMoveError(null);
    setSelectedCardId(null);
    setSelectedPairId(null);
  };

  const attack = async () => {
    if (!selectedCardId) return;
    await sendAction({
      gameType: "durak",
      roomId: room.id,
      action: "attack",
      cardId: selectedCardId
    });
  };

  const defend = async () => {
    if (!selectedCardId || !selectedPairId) return;
    await sendAction({
      gameType: "durak",
      roomId: room.id,
      action: "defend",
      cardId: selectedCardId,
      targetPairId: selectedPairId
    });
  };

  const take = async () => {
    await sendAction({
      gameType: "durak",
      roomId: room.id,
      action: "take"
    });
  };

  const pass = async () => {
    await sendAction({
      gameType: "durak",
      roomId: room.id,
      action: "pass"
    });
  };

  const onCardDragEnd = async (
    cardId: string,
    event: { target: { x: () => number; y: () => number; position: (p: { x: number; y: number }) => void } },
    baseX: number,
    baseY: number
  ) => {
    const dropX = event.target.x();
    const dropY = event.target.y();
    event.target.position({ x: baseX, y: baseY });

    setSelectedCardId(cardId);

    if (!isInsideTableZone(dropX, dropY)) {
      setMoveError("Перетащите карту в игровую зону стола или используйте кнопки действий.");
      return;
    }

    if (canAttackByDrag) {
      await sendAction({
        gameType: "durak",
        roomId: room.id,
        action: "attack",
        cardId
      });
      return;
    }

    if (canDefendByDrag) {
      const targetPairId = selectedPairId ?? findNearestUndefendedPair(dropX);
      if (!targetPairId) {
        setMoveError("Сначала выберите неотбитую карту атаки на столе.");
        return;
      }

      await sendAction({
        gameType: "durak",
        roomId: room.id,
        action: "defend",
        cardId,
        targetPairId
      });
      return;
    }

    setMoveError("Подождите своей фазы действия.");
  };

  const availableActions = (() => {
    if (state.reason) return ["Игра уже завершена."];

    const actions: string[] = [];
    if (isAttacker && state.phase === "attack") {
      actions.push("Выберите карту в руке и нажмите Атака.");
      if (state.table.length > 0) actions.push("Кнопка Пас завершает раунд после отбоя всех атак.");
    }

    if (isDefender && state.phase === "defend") {
      actions.push("Выберите неотбитую карту атаки на столе.");
      actions.push("Выберите свою карту защиты и нажмите Отбой.");
      actions.push("Используйте Взять, если не можете отбиться.");
    }

    if (actions.length === 0) {
      actions.push("Ожидайте своего хода в текущем раунде.");
    }

    return actions;
  })();

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="p-3">
          <div ref={boardRef} className="w-full touch-none">
            <Stage width={TABLE_W * tableScale} height={TABLE_H * tableScale} scaleX={tableScale} scaleY={tableScale}>
            <Layer>
              <Rect x={0} y={0} width={TABLE_W} height={TABLE_H} fill="#1f3a2c" cornerRadius={18} />

              <Rect
                x={TABLE_ZONE.x}
                y={TABLE_ZONE.y}
                width={TABLE_ZONE.width}
                height={TABLE_ZONE.height}
                cornerRadius={12}
                stroke="#f2c94c"
                strokeWidth={2}
                dash={[10, 8]}
                opacity={0.7}
              />
              <Text
                x={TABLE_ZONE.x + 8}
                y={TABLE_ZONE.y + 8}
                text={canDefendByDrag ? "Перетащите карту для защиты" : "Перетащите карту для атаки"}
                fontSize={14}
                fill="#f6e6b6"
              />

              <Text
                x={20}
                y={14}
                text={`Козырь: ${suitSymbol(state.trumpSuit)}  |  Колода: ${state.deckCount}`}
                fontSize={20}
                fill="#f8f1dd"
                fontStyle="bold"
              />
              <Text
                x={20}
                y={42}
                text={`Фаза: ${durakPhaseRu(state.phase)}  |  Ход: ${state.turnPlayerId === me ? "вы" : state.turnPlayerId}`}
                fontSize={16}
                fill="#d9cba4"
              />

              {state.table.map((pair, idx) => {
                const x = 80 + idx * 130;
                const y = 150;
                const activePair = selectedPairId === pair.id;
                return (
                  <Group key={pair.id} onClick={() => setSelectedPairId(pair.id)}>
                    <Rect
                      x={x}
                      y={y}
                      width={CARD_W}
                      height={CARD_H}
                      fill="#f7f1e1"
                      cornerRadius={8}
                      stroke={activePair ? "#f2c94c" : "#2b2f33"}
                      strokeWidth={activePair ? 4 : 2}
                    />
                    <Text
                      x={x + 10}
                      y={y + 10}
                      text={`${pair.attack.rank}${suitSymbol(pair.attack.suit)}`}
                      fontSize={22}
                      fill={pair.attack.suit === "hearts" || pair.attack.suit === "diamonds" ? "#b91c1c" : "#111827"}
                    />
                    {pair.defense ? (
                      <>
                        <Rect
                          x={x + 20}
                          y={y + 22}
                          width={CARD_W}
                          height={CARD_H}
                          fill="#f7f1e1"
                          cornerRadius={8}
                          stroke="#2b2f33"
                          strokeWidth={2}
                        />
                        <Text
                          x={x + 30}
                          y={y + 32}
                          text={`${pair.defense.rank}${suitSymbol(pair.defense.suit)}`}
                          fontSize={22}
                          fill={
                            pair.defense.suit === "hearts" || pair.defense.suit === "diamonds"
                              ? "#b91c1c"
                              : "#111827"
                          }
                        />
                      </>
                    ) : null}
                  </Group>
                );
              })}

              {state.ownHand.map((card, idx) => {
                const x = 40 + idx * 80;
                const y = TABLE_H - 130;
                const selected = selectedCardId === card.id;
                return (
                  <Group
                    key={card.id}
                    x={x}
                    y={y}
                    draggable={canAttackByDrag || canDefendByDrag}
                    onClick={() => setSelectedCardId(card.id)}
                    onDragStart={() => setSelectedCardId(card.id)}
                    onDragEnd={(event) => void onCardDragEnd(card.id, event, x, y)}
                  >
                    <Rect
                      x={0}
                      y={0}
                      width={CARD_W}
                      height={CARD_H}
                      fill={selected ? "#f7e5b8" : "#f7f1e1"}
                      cornerRadius={8}
                      stroke={selected ? "#f2c94c" : "#2b2f33"}
                      strokeWidth={selected ? 4 : 2}
                    />
                    <Text
                      x={10}
                      y={10}
                      text={`${card.rank}${suitSymbol(card.suit)}`}
                      fontSize={22}
                      fill={card.suit === "hearts" || card.suit === "diamonds" ? "#b91c1c" : "#111827"}
                    />
                  </Group>
                );
              })}
            </Layer>
            </Stage>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Дурак</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Атакующий: {state.attackerId === me ? "вы" : state.attackerId}</p>
          <p>Защищающийся: {state.defenderId === me ? "вы" : state.defenderId}</p>
          <p>Ваших карт: {state.ownHand.length}</p>

          <div className="rounded-md border border-border bg-[#23262a] p-3">
            <div className="font-semibold text-foreground">Доступные действия</div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {availableActions.map((action) => (
                <li key={action}>• {action}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Играть можно кнопками и кликами, либо перетягивать карты в игровую зону.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void attack()} disabled={!isAttacker || !selectedCardId}>
              Атака
            </Button>
            <Button variant="secondary" onClick={() => void defend()} disabled={!isDefender || !selectedCardId || !selectedPairId}>
              Отбой
            </Button>
            <Button variant="outline" onClick={() => void take()} disabled={!isDefender}>
              Взять
            </Button>
            <Button variant="outline" onClick={() => void pass()} disabled={!isAttacker}>
              Пас
            </Button>
          </div>

          {moveError ? (
            <div className="rounded-md border border-[#d35d5d]/40 bg-[#2c2020] p-3 text-[#d35d5d]">{moveError}</div>
          ) : null}

          <div className="rounded-md border border-border bg-[#23262a] p-3">
            <div className="font-semibold text-foreground">Игроки</div>
            <ul className="mt-2 space-y-1">
              {state.players.map((p) => (
                <li key={p.userId} className="flex items-center justify-between">
                  <span>{p.isSelf ? `${p.username} (вы)` : p.username}</span>
                  <span className="text-muted-foreground">{p.handCount} карт</span>
                </li>
              ))}
            </ul>
          </div>

          {state.reason ? (
            <div className="rounded-md border border-[#f2c94c]/40 bg-[#2f2a1b] p-3 text-[#f2c94c]">
              Игра завершена: {translateServerMessage(state.reason)}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
