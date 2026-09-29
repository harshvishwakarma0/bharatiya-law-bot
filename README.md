# Nyaya Sahayak — Indian Legal Information Assistant

A full-stack web app where a citizen describes a real-life situation in plain words and
receives legal information grounded in official Indian legal sources, with the applicable
Act and section, practical next steps, and where to go.

> **Disclaimer:** This AI provides legal information only, not legal advice. Always consult
> a qualified legal professional for your specific situation.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + Tailwind CSS v4 (TanStack Start) |
| Server | TanStack Start server routes (Node/edge runtime) |
| AI | Google Gemini API (`gemini-2.0-flash`) |
| Retrieval | In-process lexical retriever over a curated legal corpus (RAG foundation) |

## Project layout

```
src/
  lib/legal-knowledge.ts     Legal corpus + retrieval (the RAG layer)
  routes/api/chat.ts         Server endpoint: retrieve -> prompt -> Gemini -> answer
  components/LegalChat.tsx   Chat UI (messages, typing indicator, disclaimer, reset)
  routes/index.tsx           Landing page + embedded assistant
  styles.css                 Design tokens (colours, typography, effects)
```

## Environment variables

| Name | Purpose |
| --- | --- |
| `GOOGLE_API_KEY` | Google Gemini API key (free tier available at Google AI Studio) |

The key is read **only on the server** (`process.env.GOOGLE_API_KEY`) and is never sent to
the browser. For local development create a `.env` file:

```
GOOGLE_API_KEY=your_key_here
```

## Running locally

```bash
bun install      # or: npm install
bun run dev      # http://localhost:8080
```

## RAG architecture

1. **Knowledge base** — `LEGAL_CORPUS` in `src/lib/legal-knowledge.ts` holds self-contained
   chunks, each with the Act, section, text, tags and an official government source URL.
2. **Retrieval** — `retrieveContext(query, topK)` scores chunks against the user's question
   and returns the best matches. The prototype uses transparent lexical scoring so it runs
   with no external infrastructure.
3. **Augmentation** — `buildContextBlock()` renders the retrieved chunks into the prompt.
4. **Generation** — the system prompt forces the model to rely on the retrieved context,
   cite the Act and section, refuse non-legal questions, and never invent provisions.
5. **Citation** — the retrieved sources are returned with the answer and rendered under it.

### Upgrading to a vector store

Only step 2 changes. Embed each `LegalDoc` once, store the vectors (FAISS, pgvector,
Pinecone…), and replace the body of `retrieveContext()` with a similarity search that
returns the same `RetrievedDoc[]` shape. Nothing else in the app needs to change.

## Adding legal documents

Append an entry to `LEGAL_CORPUS` with a unique `id`, the `act`, `section`, a short
`title`, the provision `text`, an official `source` URL, and `tags` used for matching.

## Deployment

The app builds to a standard Node/edge server bundle and deploys to Vercel, Render, or any
Node host. Set `GOOGLE_API_KEY` in the host's environment variables, then:

```bash
bun run build
bun run start
```

## Safety guardrails

- The system prompt restricts answers to Indian law and refuses out-of-scope questions.
- Answers must cite the Act and section; the model is instructed never to invent citations.
- The disclaimer is shown in the hero, next to the chat input, and in the footer.
- API failures (missing key, rejected key, rate limits, network errors) are surfaced to the
  user as readable messages rather than silent failures.
