"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { TheaGlow } from "@/components/ui/TheaGlow";
import { cn } from "@/lib/cn";
import type {
  TheaAskResponse,
  TheaChatMessage,
  TheaChatMode,
  TheaCreateDraftInput,
} from "@/lib/thea/chat/types";
import { useTheaChat } from "./thea-chat-context";

const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-light outline-none focus:border-rose-poudre/50";

const CHAT_SUGGESTIONS = [
  "Comment structurer une séance de maths en CE2 ?",
  "Quelles compétences travailler en début d'année ?",
  "Comment différencier une activité en classe ?",
];

type TabMode = "chat" | "create";

function newMessage(role: TheaChatMessage["role"], content: string, mode?: TheaChatMode): TheaChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    mode,
  };
}

export function TheaChatDrawer() {
  const { isOpen, initialMode, closeChat } = useTheaChat();
  const [tab, setTab] = useState<TabMode>("chat");
  const [createKind, setCreateKind] = useState<"create_seance" | "create_sequence">("create_seance");
  const [messages, setMessages] = useState<TheaChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TheaCreateDraftInput>({
    matiere: "",
    objectif: "",
    niveau: "",
    dureeMinutes: 45,
    sessionCount: 4,
    consignes: "",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialMode === "chat" ? "chat" : "create");
    if (initialMode === "create_seance" || initialMode === "create_sequence") {
      setCreateKind(initialMode);
    }
    window.setTimeout(() => inputRef.current?.focus(), 200);
  }, [initialMode, isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendRequest = useCallback(
    async (mode: TheaChatMode, message: string, createContext?: TheaCreateDraftInput) => {
      setLoading(true);
      setError(null);

      const history = messages.map((entry) => ({ role: entry.role, content: entry.content }));

      try {
        const response = await fetch("/api/thea/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, message, history, createContext }),
        });

        const data = (await response.json()) as TheaAskResponse & { error?: string; message?: string };

        if (!response.ok) {
          throw new Error(data.message || data.error || "Impossible de contacter Théa.");
        }

        setMessages((prev) => [...prev, newMessage("assistant", data.reply, mode)]);
      } catch (requestError) {
        const messageText =
          requestError instanceof Error ? requestError.message : "Une erreur est survenue.";
        setError(messageText);
      } finally {
        setLoading(false);
      }
    },
    [messages],
  );

  const handleSendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, newMessage("user", text, "chat")]);
    setInput("");
    await sendRequest("chat", text);
  }, [input, loading, sendRequest]);

  const handleCreate = useCallback(async () => {
    if (loading) return;

    const objectif = draft.objectif.trim() || (draft.consignes ?? "").trim();
    if (!draft.matiere.trim() || !objectif) {
      setError("Indiquez au minimum la matière et l'objectif.");
      return;
    }

    const summary = createKind === "create_seance"
      ? `Créer une séance de ${draft.matiere} — ${objectif}`
      : `Créer une séquence de ${draft.matiere} — ${objectif}`;

    setMessages((prev) => [...prev, newMessage("user", summary, createKind)]);
    setError(null);
    await sendRequest(createKind, (draft.consignes ?? "").trim() || objectif, draft);
  }, [createKind, draft, loading, sendRequest]);

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fermer la discussion avec Théa"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
        onClick={closeChat}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/60 bg-[var(--flora-surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="thea-chat-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <TheaGlow size="sm" pulse showFace={false} />
            <div>
              <h2 id="thea-chat-title" className="font-serif text-xl font-medium text-flora-text">
                Théa
              </h2>
              <p className="text-sm font-light text-flora-text-muted">
                Posez vos questions ou demandez une création.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeChat}
            className="rounded-full px-2 py-1 text-flora-text-subtle transition hover:bg-white/50 hover:text-flora-text"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-white/40 px-4 py-2">
          {(["chat", "create"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className={cn(
                "flex-1 rounded-2xl px-3 py-2 text-sm font-light transition",
                tab === mode
                  ? "bg-white/80 text-flora-text shadow-sm"
                  : "text-flora-text-muted hover:bg-white/40",
              )}
            >
              {mode === "chat" ? "Discuter" : "Créer"}
            </button>
          ))}
        </div>

        {tab === "chat" ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-light text-flora-text-muted">
                    Bonjour ! Je suis Théa, votre assistante pédagogique. Posez-moi une question sur
                    vos séances, progressions ou organisation de classe.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CHAT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestion(suggestion)}
                        className="rounded-2xl border border-white/70 bg-white/50 px-3 py-2 text-left text-xs font-light text-flora-text-muted transition hover:bg-white/80 hover:text-flora-text"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[92%] rounded-2xl px-4 py-3 text-sm font-light leading-relaxed",
                        message.role === "user"
                          ? "ml-auto bg-rose-poudre/20 text-flora-text"
                          : "mr-auto bg-white/70 text-flora-text",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                  {loading ? (
                    <div className="mr-auto max-w-[92%] rounded-2xl bg-white/70 px-4 py-3 text-sm font-light text-flora-text-muted">
                      Théa réfléchit…
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/50 px-4 py-3">
              {error ? (
                <p className="mb-2 text-xs font-light text-rose-600">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder="Posez votre question…"
                  className={cn(inputClassName, "min-h-[3rem] resize-none")}
                  disabled={loading}
                />
                <FloraButton
                  accent="rose"
                  onClick={() => void handleSendChat()}
                  disabled={loading || !input.trim()}
                  className="self-end"
                >
                  Envoyer
                </FloraButton>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCreateKind("create_seance")}
                className={cn(
                  "flex-1 rounded-2xl px-3 py-2 text-sm font-light transition",
                  createKind === "create_seance"
                    ? "bg-rose-poudre/25 text-flora-text"
                    : "bg-white/50 text-flora-text-muted hover:bg-white/70",
                )}
              >
                Séance
              </button>
              <button
                type="button"
                onClick={() => setCreateKind("create_sequence")}
                className={cn(
                  "flex-1 rounded-2xl px-3 py-2 text-sm font-light transition",
                  createKind === "create_sequence"
                    ? "bg-rose-poudre/25 text-flora-text"
                    : "bg-white/50 text-flora-text-muted hover:bg-white/70",
                )}
              >
                Séquence
              </button>
            </div>

            <p className="mb-4 text-sm font-light text-flora-text-muted">
              Génération IA sur demande — Théa propose un brouillon que vous pourrez adapter avant
              import.
            </p>

            <div className="space-y-3">
              <label className="block text-sm font-light text-flora-text-muted">
                Matière
                <input
                  className={cn(inputClassName, "mt-1")}
                  value={draft.matiere}
                  onChange={(event) => setDraft((prev) => ({ ...prev, matiere: event.target.value }))}
                  placeholder="Ex. Mathématiques"
                />
              </label>

              <label className="block text-sm font-light text-flora-text-muted">
                Niveau
                <input
                  className={cn(inputClassName, "mt-1")}
                  value={draft.niveau}
                  onChange={(event) => setDraft((prev) => ({ ...prev, niveau: event.target.value }))}
                  placeholder="Ex. CE2"
                />
              </label>

              <label className="block text-sm font-light text-flora-text-muted">
                {createKind === "create_seance" ? "Objectif de la séance" : "Thème / objectifs"}
                <textarea
                  className={cn(inputClassName, "mt-1 min-h-[4rem] resize-none")}
                  value={draft.objectif}
                  onChange={(event) => setDraft((prev) => ({ ...prev, objectif: event.target.value }))}
                  placeholder={
                    createKind === "create_seance"
                      ? "Ex. Comparer et ranger des nombres jusqu'à 999"
                      : "Ex. Les fractions — comprendre la notion de partage équitable"
                  }
                />
              </label>

              {createKind === "create_seance" ? (
                <label className="block text-sm font-light text-flora-text-muted">
                  Durée (minutes)
                  <input
                    type="number"
                    min={15}
                    max={180}
                    className={cn(inputClassName, "mt-1")}
                    value={draft.dureeMinutes ?? 45}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, dureeMinutes: Number(event.target.value) }))
                    }
                  />
                </label>
              ) : (
                <label className="block text-sm font-light text-flora-text-muted">
                  Nombre de séances
                  <input
                    type="number"
                    min={2}
                    max={12}
                    className={cn(inputClassName, "mt-1")}
                    value={draft.sessionCount ?? 4}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, sessionCount: Number(event.target.value) }))
                    }
                  />
                </label>
              )}

              <label className="block text-sm font-light text-flora-text-muted">
                Consignes complémentaires (optionnel)
                <textarea
                  className={cn(inputClassName, "mt-1 min-h-[3rem] resize-none")}
                  value={draft.consignes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, consignes: event.target.value }))}
                  placeholder="Matériel disponible, contraintes, méthode…"
                />
              </label>
            </div>

            {error ? <p className="mt-3 text-xs font-light text-rose-600">{error}</p> : null}

            <FloraButton
              accent="rose"
              className="mt-4 w-full"
              onClick={() => void handleCreate()}
              disabled={loading}
            >
              {loading ? "Génération en cours…" : "Générer avec Théa"}
            </FloraButton>

            {messages.filter((message) => message.mode !== "chat").length > 0 ? (
              <div className="mt-6 space-y-3 border-t border-white/40 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-flora-text-subtle">
                  Dernière proposition
                </p>
                {messages
                  .filter((message) => message.mode !== "chat")
                  .slice(-2)
                  .map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm font-light leading-relaxed",
                        message.role === "user"
                          ? "bg-rose-poudre/15 text-flora-text-muted"
                          : "bg-white/70 text-flora-text",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </>
  );
}
