export enum QuizLevel {
  LEVEL_3 = '3級',
  LEVEL_2 = '2級',
  LEVEL_PRE_1 = '準1級',
  LEVEL_1 = '1級',
}

export interface QuizItem {
  id: string; // Internal ID for React keys
  level: QuizLevel | string;
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correct_idx: number; // 0-3
  explanation: string;
  advanced_explanation: string;
  wiki_link: string;
  is_japan: boolean;
}

export interface GeneratorConfig {
  level: QuizLevel;
  count: number;
  focusTopic?: string; // Optional: e.g., "European Cathedrals"
}