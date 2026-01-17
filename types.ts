
export enum QuizMode {
  SERIAL = 'serial',
  RANDOM_LIMITED = 'rand_limited',
  RANDOM_UNLIMITED = 'rand_unlimited'
}

export interface QuestionOptions {
  [key: string]: string;
}

export interface Question {
  id: string; // Unique ID based on original index or content hash
  originalIndex: number;
  q: string;
  opt: QuestionOptions;
  a: string;
}

export interface QuizConfig {
  timeMinutes: number | string;
  questionLimit: number | string;
  mode: QuizMode;
  shuffleOptions: boolean;
}

export interface ExamResult {
  id: number;
  timestamp: number;
  questions: Question[];
  userChoices: (string | null)[];
  stats: {
    correct: number;
    wrong: number;
    skipped: number;
    total: number;
  };
  negativeMark: 0.25 | 0.50; // Individual preference for this specific result
  parentExamId?: number; // The ID of the root exam if this is a retake
  examName?: string;
}

export interface SessionBackup {
  version: number;
  timestamp: number;
  rawInput: string;
  config: QuizConfig;
  progress: {
    nextSerialIndex: number;
    usedRandomIndices: number[];
  };
  history: ExamResult[];
}

export type AppPhase = 'SETUP' | 'QUIZ' | 'REVIEW';

export type AIProvider = 'gemini' | 'openai' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
}
