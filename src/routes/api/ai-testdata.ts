import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai-testdata")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI is not configured for this project.", { status: 500 });
        }

        const raw = await request.text();
        const body = JSON.parse(raw || "{}") as {
          schema?: string;
          fileName?: string;
          rootName?: string;
          count?: number;
          repeat?: number;
          includeOptional?: boolean;
          soap?: boolean;
          instructions?: string;
          example?: string;
        };

        const schema = (body.schema ?? "").slice(0, 60_000);
        if (!schema) return new Response("No schema provided.", { status: 400 });
        const count = Math.max(1, Math.min(Number(body.count) || 1, 5));

        const system = [
          "You generate synthetic XML test data for a schema editor prototype (XSD Studio).",
          "Rules:",
          "- Output ONLY XML. No markdown fences, no explanation.",
          "- The XML MUST validate against the provided XSD: respect element order, required/optional elements, enumerations, patterns and length/digit restrictions.",
          `- Produce ${count} sample document(s). When more than one, separate them with a line: <!-- ===== Sample N ===== -->`,
          `- Repeat repeating elements about ${Math.max(1, Math.min(Number(body.repeat) || 1, 10))} time(s).`,
          body.includeOptional === false
            ? "- Omit optional elements."
            : "- Include optional elements.",
          body.soap
            ? "- Wrap each payload in a SOAP 1.1 envelope (http://schemas.xmlsoap.org/soap/envelope/)."
            : "",
          "- All values must be obviously fictional demo data (names, IBAN-like strings, addresses). Never use real personal or financial data.",
          body.rootName ? `Root element to generate: ${body.rootName}` : "",
          body.fileName ? `Schema file: ${body.fileName}` : "",
          body.instructions ? `Extra user instructions: ${body.instructions}` : "",
          body.example
            ? `A deterministic (non-AI) sample of the same schema for reference:\n\`\`\`xml\n${body.example.slice(0, 20_000)}\n\`\`\``
            : "",
          `XSD source:\n\`\`\`xml\n${schema}\n\`\`\``,
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
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `Generate ${count} synthetic XML sample document(s) for this schema.`,
                  },
                ],
              },
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          return new Response(detail || "AI request failed.", { status: upstream.status || 500 });
        }

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
              if (event.type === "response.output_text.delta" && event.delta) text += event.delta;
            } catch {
              // ignore partial events
            }
          }
        }

        const cleaned = text
          .replace(/^\s*```(?:xml)?\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();

        return Response.json({ text: cleaned });
      },
    },
  },
});
