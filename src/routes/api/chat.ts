import { createFileRoute } from "@tanstack/react-router";
import { buildContextBlock, retrieveContext } from "@/lib/legal-knowledge";

type ChatMessage = { role: "user" | "assistant"; content: string };

const AI_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are "Nyaya Sahayak", a legal information assistant for ordinary citizens of India.

Rules you must always follow:
1. You provide legal INFORMATION only, never legal advice, and never a guarantee of outcome.
2. Answer only questions connected to Indian law, rights, procedures, government schemes or grievance redressal. For anything else, politely say it is outside your scope.
3. Ground your answer in the RETRIEVED LEGAL CONTEXT below whenever it is relevant. Cite the Act and section you rely on. If the context does not cover the question, say so plainly and give only general, widely accepted procedural information.
4. Never invent section numbers, case law, fees or deadlines. If you are unsure, say you are unsure.
5. Write for someone with no legal background: short paragraphs, simple words, no Latin.
6. Structure every substantive answer in markdown as:
   **What the law says** (with the Act and section)
   **Practical steps you can take** (a numbered list)
   **Where to go** (authority, portal or helpline)
7. End by encouraging the person to consult a qualified lawyer, and mention free legal aid (NALSA helpline 15100) where relevant.
8. Keep answers under roughly 350 words.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "The assistant is not configured yet. An AI key needs to be added." },
            { status: 500 },
          );
        }

        let body: { messages?: ChatMessage[] };
        try {
          body = (await request.json()) as { messages?: ChatMessage[] };
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
        const latest = [...messages].reverse().find((m) => m.role === "user");

        if (!latest || typeof latest.content !== "string" || latest.content.trim().length === 0) {
          return Response.json({ error: "Please describe your situation." }, { status: 400 });
        }
        if (latest.content.length > 4000) {
          return Response.json({ error: "That message is too long. Please shorten it." }, { status: 400 });
        }

        // --- RAG: retrieve grounding documents for the latest question ---
        const retrieved = retrieveContext(latest.content);
        const contextBlock = buildContextBlock(retrieved);

        const contents = messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        }));

        // Attach retrieved context to the final user turn.
        const lastIndex = contents.length - 1;
        if (lastIndex >= 0 && contents[lastIndex].role === "user") {
          contents[lastIndex] = {
            role: "user",
            parts: [
              {
                text: `RETRIEVED LEGAL CONTEXT (from official Indian government sources):\n${contextBlock}\n\nUSER'S SITUATION:\n${latest.content}`,
              },
            ],
          };
        }

        const callGateway = () =>
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: AI_MODEL,
              stream: true,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...contents.map((c) => ({
                  role: c.role === "model" ? "assistant" : "user",
                  content: c.parts[0].text,
                })),
              ],
            }),
          });

        try {
          const response = await callGateway();

          if (!response.ok || !response.body) {
            const detail = await response.text();
            console.error(`AI request failed [${response.status}]: ${detail}`);
            const message =
              response.status === 429
                ? "Too many questions right now. Please wait a moment and try again."
                : response.status === 402
                  ? "AI credits have run out. Please add credits in Settings → Plans & credits."
                  : "The assistant could not answer just now. Please try again.";
            return Response.json({ error: message }, { status: response.status === 429 || response.status === 402 ? response.status : 502 });
          }

          // Consume the stream server-side and accumulate the final answer.
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let reply = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
                reply += json.choices?.[0]?.delta?.content ?? "";
              } catch {
                /* partial frame */
              }
            }
          }
          reply = reply.trim();


          if (!reply) {
            return Response.json(
              { error: "The assistant could not produce an answer for that. Try rephrasing your situation." },
              { status: 502 },
            );
          }

          return Response.json({
            reply,
            sources: retrieved.map((doc) => ({
              act: doc.act,
              section: doc.section,
              title: doc.title,
              source: doc.source,
            })),
          });
        } catch (error) {
          console.error("Chat handler error", error);
          return Response.json(
            { error: "Could not reach the assistant. Please check your connection and try again." },
            { status: 502 },
          );
        }
      },
    },
  },
});
