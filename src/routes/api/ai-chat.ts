import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI is not configured for this project.", { status: 500 });
        }

        const raw = await request.text();
        const body = JSON.parse(raw || "{}") as {
          messages?: ChatMessage[];
          content?: string;
          fileName?: string;
          lang?: string;
          documentKind?: "XSD" | "XML";
        };
        const messages = body.messages ?? [];
        const content = (body.content ?? "").slice(0, 60_000);
        const documentKind = body.documentKind === "XML" ? "XML" : "XSD";

        const system = [
          "You are an XSD and XML expert inside a schema editor called Atlas.",
          `Explain the current ${documentKind} document below: its structure, fields, relationships, values, types, restrictions, validation issues, and practical fixes.`,
          "Refer to exact element paths and give concrete XML or XSD snippets when useful. Be concise.",
          body.lang === "nl"
            ? "Always answer in Dutch (Nederlands), regardless of the language of the question."
            : "Always answer in English, regardless of the language of the question.",
          "This is a hackathon prototype using synthetic demo data only; findings are illustrative and need human review.",
          body.fileName ? `Current file: ${body.fileName}` : "",
          content
            ? `Current ${documentKind} source:\n\`\`\`xml\n${content}\n\`\`\``
            : `No ${documentKind} document is currently loaded.`,
        ]
          .filter(Boolean)
          .join("\n\n");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            instructions: system,
            reasoning: { effort: "low", summary: "auto" },
            input: messages.map((m) => ({
              role: m.role,
              content: [
                {
                  type: m.role === "assistant" ? "output_text" : "input_text",
                  text: m.content,
                },
              ],
            })),
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          return new Response(detail || "AI request failed.", { status: upstream.status || 500 });
        }

        // The dev/edge server does not forward streamed bodies reliably, so we
        // consume the SSE stream here and return the final answer as JSON.
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as { type?: string; delta?: string };
              if (event.type === "response.output_text.delta" && event.delta) {
                text += event.delta;
              }
            } catch {
              // ignore partial/non-JSON events
            }
          }
        }

        return Response.json({ text });
      },
    },
  },
});
