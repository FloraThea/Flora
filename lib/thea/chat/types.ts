export type TheaChatMode = "chat" | "create_seance" | "create_sequence";

export type TheaChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: TheaChatMode;
};

export type TheaCreateDraftInput = {
  matiere: string;
  objectif: string;
  niveau?: string;
  dureeMinutes?: number;
  sessionCount?: number;
  consignes?: string;
};

export type TheaAskRequest = {
  mode: TheaChatMode;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  createContext?: TheaCreateDraftInput;
};

export type TheaAskResponse = {
  reply: string;
  mode: TheaChatMode;
};
