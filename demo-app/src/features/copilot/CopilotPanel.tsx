import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar, Button, Input, Tooltip } from "@fluentui/react-components";
import {
  BotFilled,
  ChatAddRegular,
  DismissRegular,
  PersonFilled,
  SendRegular,
} from "@fluentui/react-icons";
import { EmptyState } from "@/components/EmptyState";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AgentName } from "@/state/types";
import { cn } from "@/lib/cn";

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  meta?: {
    agentName: AgentName;
    agentVersion: string;
    /** Present when the registry answered — see MessageRow for why it is stamped. */
    framework?: string;
    containerImage?: string;
    latencyMs: number;
    httpStatus: number;
  };
}

/** Latest N messages shown directly; older ones collapse behind "Show earlier messages". */
const VISIBLE_LIMIT = 24;

/**
 * THE COPILOT — a real agent, available at every stop, occupying nothing when
 * closed.
 *
 * It used to be ① Your Agent: a permanent 35% column, and therefore the
 * protagonist of the page. That was the wrong protagonist. The subject of this
 * lab is what the platform does with a container a team supplied, and a
 * conversation is one piece of evidence for that, not the thesis. So the
 * conversation moved off the stage and became something you open when you have
 * a question — about the lab, about the architecture, or about the stop
 * currently on screen (broker/src/demoKnowledge.ts carries all three).
 *
 * What did **not** change is that it is genuinely live. In Azure Live every
 * question is a real APIM → Foundry hosted agent → APIM → gpt-5-mini round
 * trip, and every answer is stamped with the framework, container and
 * immutable version that produced it.
 *
 * Simulation does not call the agent — no fabricated reply stands in for
 * one. The panel says so and disables the input, the same honest-empty-state
 * pattern used everywhere else in Simulation mode.
 */
export function CopilotPanel({ className }: { className?: string }) {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const targetAgent = useDemoStore((s) => s.targetAgent);
  const reducedMotion = useDemoStore((s) => s.reducedMotion);
  const setHasActiveConversation = useDemoStore((s) => s.setHasActiveConversation);
  const setLastAskId = useDemoStore((s) => s.setLastAskId);
  const setCopilotOpen = useDemoStore((s) => s.setCopilotOpen);

  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [showOlder, setShowOlder] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canAsk = mode === "live" && !isBusy;
  const hiddenCount = Math.max(0, messages.length - VISIBLE_LIMIT);
  const visibleMessages = showOlder ? messages : messages.slice(hiddenCount);

  function send(text: string) {
    const trimmed = text.trim();
    if (!canAsk || trimmed.length === 0) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed, timestamp: Date.now() },
    ]);
    setDraft("");
    setIsBusy(true);

    // The broker enriches the question with this deployment's own facts
    // before forwarding (broker/src/demoKnowledge.ts), so questions about
    // this architecture are answered from what is deployed rather than from
    // the model's general beliefs about Azure — but the answer is always the
    // agent's, and the call is always real.
    service
      .ask(trimmed, targetAgent)
      .then((result) => {
        setLastAskId(result.askId);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: result.answerText,
            timestamp: Date.now(),
            meta: {
              agentName: result.agentName,
              agentVersion: result.agentVersion,
              framework: result.framework,
              containerImage: result.containerImage,
              latencyMs: result.latencyMs,
              httpStatus: result.httpStatus,
            },
          },
        ]);
      })
      .catch((error: unknown) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `${t("assistant.liveError")} (${error instanceof Error ? error.message : String(error)})`,
            timestamp: Date.now(),
          },
        ]);
      })
      .finally(() => setIsBusy(false));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  function resetConversation() {
    setMessages([]);
    setShowOlder(false);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages.length, isBusy, reducedMotion]);

  // Lets `Esc` (useKeyboardShortcuts) know whether leaving would lose an
  // in-progress conversation.
  useEffect(() => {
    setHasActiveConversation(messages.length > 0);
  }, [messages.length, setHasActiveConversation]);

  return (
    <aside
      className={cn(
        // No entrance animation: the panel is mounted from the start (hidden)
        // so the conversation survives being closed, which means an animation
        // here would play once, invisibly, on page load and never again.
        "flex min-h-0 w-[360px] shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4",
        className,
      )}
      aria-label={t("assistant.title")}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-body font-semibold text-ink">
            <BotFilled fontSize={16} className="shrink-0 text-accent" aria-hidden="true" />
            {t("assistant.title")}
          </p>
          <p className="mt-0.5 text-caption leading-snug text-ink-muted">{t("copilot.subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Tooltip content={t("assistant.newConversation")} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<ChatAddRegular />}
              aria-label={t("assistant.newConversation")}
              onClick={resetConversation}
              disabled={messages.length === 0}
            />
          </Tooltip>
          <Tooltip content={t("copilot.close")} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissRegular />}
              aria-label={t("copilot.close")}
              onClick={() => setCopilotOpen(false)}
            />
          </Tooltip>
        </div>
      </div>

      {/*
        `min-h-0` is what makes this actually scroll: without it the flex child
        refuses to shrink below its content height and a long conversation
        pushes the panel past the bottom of the stage instead of scrolling
        inside it.
      */}
      <div
        ref={scrollRef}
        className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1"
      >
        {messages.length === 0 && mode !== "live" && (
          <EmptyState>{t("agents.run.simulationNote")}</EmptyState>
        )}
        {messages.length === 0 && mode === "live" && <WelcomeScreen t={t} />}

        {hiddenCount > 0 && !showOlder && (
          <button
            type="button"
            onClick={() => setShowOlder(true)}
            className="mx-auto shrink-0 rounded-full border border-border px-3 py-1 text-caption text-ink-muted transition-colors hover:bg-illustrative-bg"
          >
            {t("assistant.showEarlier")} ({hiddenCount})
          </button>
        )}

        {visibleMessages.map((message) => (
          <MessageRow key={message.id} message={message} t={t} />
        ))}

        {isBusy && <TypingRow t={t} />}
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-border pt-3">
        <Input
          value={draft}
          onChange={(_, data) => setDraft(data.value)}
          disabled={!canAsk}
          className="flex-1"
          placeholder={t("assistant.placeholder")}
        />
        <Button
          type="submit"
          appearance="primary"
          icon={<SendRegular />}
          aria-label={t("assistant.send")}
          disabled={!canAsk}
        />
      </form>

      <ProvenanceBadge provenance={{ band: mode === "live" ? "live" : "illustrative" }} />
    </aside>
  );
}

/**
 * The opening state of the conversation — a greeting and an open invitation.
 *
 * No suggested prompts. Offering a menu of prepared questions framed the agent
 * as a set of canned demos, which both narrowed what people asked and made a
 * live system feel scripted. An empty input invites a real question, which is
 * what this is able to answer.
 */
function WelcomeScreen({ t }: { t: (key: string) => string }) {
  return (
    <div className="m-auto flex flex-col items-center gap-3 py-6 text-center">
      <Avatar size={40} icon={<BotFilled />} color="brand" />
      <p className="whitespace-pre-line text-body leading-relaxed text-ink-muted">
        {t("assistant.welcome")}
      </p>
    </div>
  );
}

function MessageRow({ message, t }: { message: CopilotMessage; t: (key: string) => string }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex animate-fade-slide-in gap-2 rounded-lg px-2 py-1.5",
        !isUser && "bg-illustrative-bg/60",
      )}
    >
      <Avatar
        size={24}
        icon={isUser ? <PersonFilled /> : <BotFilled />}
        color={isUser ? "neutral" : "brand"}
      />
      <div className="min-w-0 flex-1">
        <span className="text-caption font-semibold uppercase tracking-[0.04em] text-ink-muted">
          {isUser ? t("assistant.you") : t("assistant.title")}
        </span>
        {/*
          The answer is the evidence on this surface, so it is the one thing
          here at body size. Everything around it — who said it, which
          container produced it — is metadata and stays at caption.
        */}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-body leading-relaxed text-ink">
          {message.text}
        </p>
        {/*
          Provenance on every answer. Not decoration: the recognition this
          application is built around is "that is my agent" — a named
          framework, a specific container, an immutable version — rather than
          "the AI". The framework and image come from the Foundry registry
          alongside the call, and are omitted rather than guessed if that read
          did not answer.
        */}
        {message.meta && (
          <>
            <p className="mt-1 text-caption text-ink-muted">
              <span className="font-medium text-ink">
                {message.meta.agentName}
                {message.meta.agentVersion}
              </span>
              {message.meta.framework && <> &middot; {message.meta.framework}</>} &middot;{" "}
              {t("assistant.viaApim")} &middot; {(message.meta.latencyMs / 1000).toFixed(1)} s
              &middot; {message.meta.httpStatus} OK
            </p>
            {message.meta.containerImage && (
              <p className="text-caption text-ink-muted">
                {t("assistant.container")}{" "}
                <span className="break-all">
                  {message.meta.containerImage.split("/").pop() ?? message.meta.containerImage}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TypingRow({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex animate-fade-slide-in gap-2 rounded-lg bg-illustrative-bg/60 px-2 py-1.5">
      <Avatar size={24} icon={<BotFilled />} color="brand" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="mb-1 text-caption font-semibold text-ink">{t("assistant.title")}</span>
        <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-surface px-3 py-2">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted" />
        </div>
      </div>
    </div>
  );
}
