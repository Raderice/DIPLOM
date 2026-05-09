import type { GameType, RoomStatus } from "@board-games/shared";

export function gameTypeRu(gameType: GameType | string): string {
  if (gameType === "chess" || gameType === "CHESS") return "Шахматы";
  if (gameType === "checkers" || gameType === "CHECKERS") return "Шашки";
  if (gameType === "durak" || gameType === "DURAK") return "Дурак";
  if (gameType === "alias" || gameType === "ALIAS") return "Alias";
  if (gameType === "mafia" || gameType === "MAFIA") return "Мафия";
  return gameType;
}

export function roomStatusRu(status: RoomStatus | string): string {
  if (status === "WAITING") return "Ожидание";
  if (status === "PLAYING") return "Идет игра";
  if (status === "FINISHED") return "Завершена";
  return status;
}

export function durakPhaseRu(phase: string): string {
  if (phase === "attack") return "атака";
  if (phase === "defend") return "защита";
  return phase;
}

export function translateServerMessage(message: string): string {
  const normalized = message.trim();

  const dictionary: Array<[RegExp, string]> = [
    [/failed to load rooms/i, "Не удалось загрузить комнаты."],
    [/failed to create room/i, "Не удалось создать комнату."],
    [/failed to join room/i, "Не удалось войти в комнату."],
    [/failed to join by invite code/i, "Не удалось войти по коду приглашения."],
    [/room not found/i, "Комната не найдена."],
    [/room is full/i, "Комната заполнена."],
    [/room not active/i, "Комната не активна."],
    [/not in room/i, "Вы не состоите в этой комнате."],
    [/only host can start/i, "Только хост может начать игру."],
    [/room already started/i, "Игра в комнате уже началась."],
    [/not enough connected players/i, "Недостаточно подключенных игроков."],
    [/all connected players must be ready/i, "Все подключенные игроки должны быть готовы."],
    [/game is not in playing state/i, "Игра сейчас не находится в активной фазе."],
    [/move payload does not match room game type/i, "Тип хода не соответствует типу игры в комнате."],
    [/message length must be between 1 and 300/i, "Длина сообщения должна быть от 1 до 300 символов."],
    [/user is not in room/i, "Пользователь не находится в комнате."],
    [/host left the room/i, "Хост покинул комнату."],
    [/host disconnected/i, "Хост отключился от комнаты."],
    [/request failed/i, "Ошибка запроса."],
    [/network error/i, "Ошибка сети."],
    [/socket connection timeout/i, "Тайм-аут подключения к сокету."],
    [/socket connection failed/i, "Не удалось подключиться к сокету."],
    [/socket disconnected/i, "Соединение с сокетом разорвано."],
    [/connection is unstable/i, "Соединение нестабильно. Выполняется переподключение."],
    [/temporary network problem/i, "Временная проблема сети."],
    [/unauthorized/i, "Требуется авторизация."],
    [/forbidden/i, "Недостаточно прав доступа."],
    [/invalid credentials/i, "Неверная почта или пароль."],
    [/user already exists/i, "Пользователь с такими данными уже существует."],
    [/invalid move|illegal chess move|illegal checkers move/i, "Недопустимый ход."],
    [/capture is mandatory/i, "Взятие обязательно."],
    [/card not found|defense card not found/i, "Выбранная карта недоступна."],
    [/only attacker/i, "Сейчас действие доступно только атакующему."],
    [/only defender/i, "Сейчас действие доступно только защищающемуся."],
    [/player-left/i, "игрок покинул матч"],
    [/abandoned/i, "соперник не вернулся после отключения"],
    [/checkmate/i, "мат"],
    [/stalemate/i, "пат"],
    [/draw/i, "ничья"],
    [/timeout/i, "время вышло"],
    [/chess requires exactly 2 players/i, "Шахматы рассчитаны на 2 игроков. Измените количество игроков."],
    [/checkers requires exactly 2 players/i, "Шашки рассчитаны на 2 игроков. Измените количество игроков."],
    [/durak supports 2 to 4 players/i, "Дурак поддерживает от 2 до 4 игроков. Измените количество игроков."],
    [/alias requires 4 to 12 players/i, "Alias поддерживает от 4 до 12 игроков. Измените количество игроков."],
    [/mafia requires 6 to 15 players/i, "Мафия поддерживает от 6 до 15 игроков. Измените количество игроков."],
    [/alias round timed out/i, "Раунд Alias завершен по времени."],
    [/alias round already running/i, "Раунд Alias уже идет."],
    [/alias game already finished/i, "Игра Alias уже завершена."],
    [/alias round is not active/i, "Раунд Alias не активен."],
    [/alias requires at least 4 players/i, "Alias требует минимум 4 игроков."],
    [/mafia requires at least 6 players/i, "Мафия требует минимум 6 игроков."],
    [/mafia expects night actions/i, "Сейчас ночь. Доступны ночные действия."],
    [/mafia expects day vote/i, "Сейчас день. Доступно дневное голосование."],
    [/only mafia can vote at night/i, "Ночной выбор доступен только мафии."],
    [/only doctor can save/i, "Лечение доступно только доктору."],
    [/only sheriff can investigate/i, "Проверка доступна только шерифу."],
    [/target is required/i, "Нужно выбрать цель."],
    [/target is not alive/i, "Цель выбыла из игры."],
    [/player is not alive/i, "Игрок выбыл из игры."],
    [/mafia:mafia/i, "Победа мафии."],
    [/mafia:civilians/i, "Победа мирных жителей."],
    [/alias:team/i, "Победа команды в Alias."]
  ];

  for (const [pattern, translation] of dictionary) {
    if (pattern.test(normalized)) {
      return translation;
    }
  }

  return normalized;
}
