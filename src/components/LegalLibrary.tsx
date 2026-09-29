import { useMemo, useState } from "react";
import { LEGAL_CORPUS } from "@/lib/legal-knowledge";

/** Browsable list of every legal document the chat retrieves from. */
export function LegalLibrary({ onMenu, onAsk }: { onMenu: () => void; onAsk: (q: string) => void }) {
  const acts = useMemo(() => ["All", ...Array.from(new Set(LEGAL_CORPUS.map((d) => d.act)))], []);
  const [act, setAct] = useState("All");
  const [q, setQ] = useState("");
  const docs = LEGAL_CORPUS.filter(
    (d) =>
      (act === "All" || d.act === act) &&
      `${d.title} ${d.section} ${d.text} ${d.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface-raised/50 px-4 py-3 sm:px-6">
        <button type="button" aria-label="Open menu" onClick={onMenu} className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground md:hidden">☰</button>
        <div>
          <p className="text-sm font-bold">Legal Documents</p>
          <p className="text-[11px] text-muted-foreground">{LEGAL_CORPUS.length} sections the assistant automatically searches</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sections (e.g. cheating, refund, deposit)"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            {acts.map((a) => (
              <button key={a} type="button" onClick={() => setAct(a)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${act === a ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {a}
              </button>
            ))}
          </div>
          {docs.length === 0 && <p className="text-sm text-muted-foreground">No section matches your search.</p>}
          {docs.map((d) => (
            <article key={d.id} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{d.act} · {d.section}</p>
              <h3 className="mt-1 text-sm font-bold">{d.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.text}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a href={d.source} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Official source ↗</a>
                <button type="button" onClick={() => onAsk(`Explain ${d.act}, ${d.section}: ${d.title}`)} className="text-xs font-semibold text-foreground hover:text-primary">Ask the assistant →</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
