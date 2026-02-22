export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface PiedrasBalance {
  piedras: number;
}

export interface GameState {
  roomId: string;
  players: string[];
  currentTurn: number;
}
