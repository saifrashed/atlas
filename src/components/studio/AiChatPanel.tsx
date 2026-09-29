import { useRef, useState } from "react";
import { Send, Sparkle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStudio } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AiChatPanel({
  content,
  fileName,
  documentKind = "XSD",
}: {
  content?: string | undefined;
  fileName?: string | undefined;
  documentKind?: "XSD" | "XML";
}) {
  const schemas = useStudio((s) => s.schemas);
  const activeId = useStudio((s) => s.activeId);
  const schema = schemas.find((s) => s.id === activeId);
  const activeContent = content ?? schema?.content ?? "";
  const activeFileName = fileName ?? schema?.fileName ?? "";
  const { lang, t } = useLanguage();
  const SUGGESTIONS = [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | undefined>(undefined);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(undefined);
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          content: activeContent,
          fileName: activeFileName,
          documentKind,
          lang,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { text?: string };
      const answer = (data.text ?? "").trim();
      setMessages([
        ...next,
        {
          role: "assistant",
          content: answer || t("chat.noAnswer"),
        },
      ]);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((prev) => prev.filter((m) => m.content.trim().length > 0));
      } else {
        setMessages(next);
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
      abortRef.current = undefined;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Sparkle className="size-3.5 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("chat.title")}
        </h2>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-[11px]"
            onClick={() => {
              abortRef.current?.abort();
              setMessages([]);
              setError(undefined);
            }}
          >
            {t("chat.clear")}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("chat.intro")} {activeFileName || (documentKind === "XML" ? "your XML" : t("chat.yourSchema"))}{" "}
              {t("chat.introTail")}
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded border bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded bg-primary px-2.5 py-1.5 text-xs text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {m.content || (busy ? t("chat.thinking") : "")}
            </div>
          ),
        )}

        {error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="border-t p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={
            documentKind === "XML"
              ? lang === "nl"
                ? "Vraag iets over deze XML..."
                : "Ask something about this XML..."
              : t("chat.placeholder")
          }
          className="min-h-16 resize-none text-xs"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("chat.disclaimer")}
          </span>
          {busy ? (
            <Button size="sm" variant="secondary" onClick={() => abortRef.current?.abort()}>
              <Square className="size-3.5" />
              {t("chat.stop")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => void send(input)} disabled={!input.trim()}>
              <Send className="size-3.5" />
              {t("chat.ask")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
