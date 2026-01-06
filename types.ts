
export interface Game {
  id: string;
  n: string; // Nome
  p: string; // Plataforma
  g: string; // Gênero
  t: string[]; // Tags
  obs: string;
  synopsis?: string; // Sinopse gerada por IA
  popularity?: number; // 0 a 5 estrelas
  status: 'Backlog' | 'Jogando' | 'Finalizado';
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  trigger: string; // Gatilho Emocional
}

export interface SageResponse {
  titles: string[];
  synergy: number; // 0 a 100
  analysis: string;
}

export interface GameInsight {
  description: string;
  trivia: string;
  rating: number;
}

export interface GameAutoFill {
  genre: string;
  synopsis: string;
  popularity: number; // 0 to 5
  tags: string[]; // Novas tags classificadas
}
