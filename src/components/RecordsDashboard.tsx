import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, ApiError, clearToken, getToken, setToken } from "@/lib/api-client";
import {
  caseSchema,
  CASE_CATEGORIES,
  CASE_STATUSES,
  type CaseInput,
  type CaseRecord,
} from "@/lib/case-schema";

type SessionUser = { id: string; name: string; email: string };

const EMPTY_CASE: CaseInput = {
  name: "",
  email: "",
  phone: "",
  category: "Consumer",
  title: "",
  description: "",
  status: "Open",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function RecordsDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const form = useForm<CaseInput>({
    resolver: zodResolver(caseSchema),
    defaultValues: EMPTY_CASE,
  });

  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    setListError(null);
    try {
      const data = await api<{ cases: CaseRecord[] }>("/api/cases");
      setCases(data.cases);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearToken();
        setUser(null);
      } else {
        setListError(error instanceof Error ? error.message : "Could not load cases.");
      }
    } finally {
      setCasesLoading(false);
    }
  }, []);

  // Restore the session from the saved token on first render (browser only).
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api<{ user: SessionUser }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (user) void loadCases();
  }, [user, loadCases]);

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    setAuthError(null);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (authMode === "signup" && name.length < 2) {
      setAuthError("Please enter your name.");
      return;
    }

    setAuthBusy(true);
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = authMode === "login" ? { email, password } : { name, email, password };
      const data = await api<{ token: string; user: SessionUser }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* clear locally regardless */
    }
    clearToken();
    setUser(null);
    setCases([]);
    setShowForm(false);
    setEditingId(null);
  }

  const submitCase = form.handleSubmit(async (values) => {
    setSaveMessage(null);
    try {
      if (editingId) {
        const data = await api<{ case: CaseRecord }>(`/api/cases/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
        setCases((prev) => prev.map((c) => (c._id === data.case._id ? data.case : c)));
        setSaveMessage("Case updated.");
      } else {
        const data = await api<{ case: CaseRecord }>("/api/cases", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setCases((prev) => [data.case, ...prev]);
        setSaveMessage("Case saved to the database.");
      }
      form.reset(EMPTY_CASE);
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof CaseInput, { message });
        }
      }
      setSaveMessage(error instanceof Error ? error.message : "Could not save the case.");
    }
  });

  function startEdit(record: CaseRecord) {
    setEditingId(record._id);
    setShowForm(true);
    setSaveMessage(null);
    form.reset({
      name: record.name,
      email: record.email,
      phone: record.phone,
      category: record.category,
      title: record.title,
      description: record.description,
      status: record.status,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setShowForm(false);
    form.reset(EMPTY_CASE);
  }

  async function deleteCase(id: string) {
    setListError(null);
    try {
      await api(`/api/cases/${id}`, { method: "DELETE" });
      setCases((prev) => prev.filter((c) => c._id !== id));
      if (editingId === id) cancelEdit();
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not delete the case.");
    }
  }

  const counts = {
    total: cases.length,
    open: cases.filter((c) => c.status === "Open").length,
    progress: cases.filter((c) => c.status === "In Progress").length,
    resolved: cases.filter((c) => c.status === "Resolved").length,
  };

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50";
  const labelClass = "mb-1 block text-xs font-semibold text-muted-foreground";

  /* ---------- Signed-out: login / signup ---------- */
  if (!user) {
    if (authLoading) {
      return (
        <div className="flex min-w-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Checking your session…
        </div>
      );
    }
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
          <div className="mb-1 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
              NS
            </span>
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">
              {authMode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Log in to save and manage your legal case records.
            </p>
          </div>
          <form onSubmit={handleAuth} className="mt-5 space-y-3">
            {authMode === "signup" && (
              <div>
                <label className={labelClass} htmlFor="auth-name">Full name</label>
                <input id="auth-name" name="name" className={inputClass} placeholder="Aarav Sharma" />
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="auth-email">Email</label>
              <input id="auth-email" name="email" type="email" className={inputClass} placeholder="you@example.com" />
            </div>
            <div>
              <label className={labelClass} htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>
            {authError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {authBusy ? "Please wait…" : authMode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {authMode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthError(null);
              }}
              className="font-bold text-primary hover:underline"
            >
              {authMode === "login" ? "Create an account" : "Log in instead"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Signed-in: case records dashboard ---------- */
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border bg-surface-raised/50 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-foreground">Case Records</h2>
            <p className="text-[11px] text-muted-foreground">
              Logged in as {user.email} — records stored in the database
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-dark"
            >
              {showForm && !editingId ? "Close form" : "+ New case"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total cases", value: counts.total },
            { label: "Open", value: counts.open },
            { label: "In Progress", value: counts.progress },
            { label: "Resolved", value: counts.resolved },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-2xl font-extrabold text-primary">{stat.value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Case form */}
        {showForm && (
          <form
            onSubmit={(event) => void submitCase(event)}
            className="space-y-4 rounded-2xl border border-border bg-surface p-5"
          >
            <h3 className="text-sm font-extrabold text-foreground">
              {editingId ? "Edit case" : "New case record"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="case-name">Full name *</label>
                <input id="case-name" className={inputClass} placeholder="Aarav Sharma" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="mt-1 text-[11px] text-destructive-foreground">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="case-email">Email *</label>
                <input id="case-email" className={inputClass} placeholder="you@example.com" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="mt-1 text-[11px] text-destructive-foreground">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="case-phone">Mobile number *</label>
                <input id="case-phone" className={inputClass} placeholder="9876543210" inputMode="numeric" {...form.register("phone")} />
                {form.formState.errors.phone && (
                  <p className="mt-1 text-[11px] text-destructive-foreground">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="case-category">Category *</label>
                <select id="case-category" className={inputClass} {...form.register("category")}>
                  {CASE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="case-title">Case title *</label>
                <input id="case-title" className={inputClass} placeholder="Security deposit not returned by landlord" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="mt-1 text-[11px] text-destructive-foreground">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="case-description">Description *</label>
                <textarea
                  id="case-description"
                  rows={4}
                  className={`${inputClass} resize-none`}
                  placeholder="Describe the problem, dates and what has happened so far…"
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="mt-1 text-[11px] text-destructive-foreground">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="case-status">Status *</label>
                <select id="case-status" className={inputClass} {...form.register("status")}>
                  {CASE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-dark"
              >
                {editingId ? "Update case" : "Save case"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              {saveMessage && <p className="text-xs text-muted-foreground">{saveMessage}</p>}
            </div>
          </form>
        )}

        {listError && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {listError}
          </p>
        )}

        {/* Case list */}
        <div className="space-y-3">
          {casesLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading cases…</p>
          ) : cases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center">
              <p className="text-sm font-semibold text-foreground">No case records yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click "+ New case" to save your first record.
              </p>
            </div>
          ) : (
            cases.map((record) => (
              <div key={record._id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-foreground">{record.title}</h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {record.name} · {record.phone} · {record.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                      {record.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        record.status === "Resolved"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {record.description}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">Updated {formatDate(record.updatedAt)}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(record)}
                      className="rounded-lg border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCase(record._id)}
                      className="rounded-lg border border-destructive/40 px-3 py-1 text-[11px] font-semibold text-destructive-foreground transition-colors hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
