"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Plus,
  RefreshCw,
  LayoutList,
  Columns3,
  Trash2,
  Pencil,
  ChevronDown,
  Download,
} from "lucide-react";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { PanelToolbar } from "@/components/ui/PanelToolbar";
import { IconButton } from "@/components/IconButton";
import { SearchInput } from "@/components/SearchInput";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetBody,
  SideSheetClose,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import { useManagementPanel } from "@/components/management/ManagementPanelContext";
import { ContactCard, PIPELINE_STAGES, stageBadge } from "./ContactCard";
import { InteractionTimeline } from "./InteractionTimeline";
import { useContacts, parseTags, type ContactUpsertInput } from "../hooks/useContacts";
import type { ClientContactRow } from "../hooks/useContacts";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STAGES_FILTER = [
  { value: "", label: "All" },
  ...PIPELINE_STAGES.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
];

type ViewMode = "list" | "kanban";

// ─── Contact add/edit form ────────────────────────────────────────────────────

interface ContactFormProps {
  initial?: ClientContactRow | null;
  onSave: (input: ContactUpsertInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const ContactForm = memo(function ContactForm({
  initial,
  onSave,
  onCancel,
  saving,
}: ContactFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [stage, setStage] = useState(initial?.stage ?? "");
  const [tagsRaw, setTagsRaw] = useState(() => {
    const arr = parseTags(initial?.tags);
    return arr.length > 0 ? arr.join(", ") : (initial?.tags ?? "");
  });
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setError(null);

    const tags = tagsRaw.trim()
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : null;

    await onSave({
      id: initial?.id,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      title: title.trim() || null,
      stage: stage || null,
      tags,
      notes: notes.trim() || null,
    });
  };

  const inputCls =
    "w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 px-4 py-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-name">
          Name <span className="text-destructive">*</span>
        </label>
        <input
          id="cf-name"
          className={inputCls}
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-email">Email</label>
          <input
            id="cf-email"
            type="email"
            className={inputCls}
            placeholder="email@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-phone">Phone</label>
          <input
            id="cf-phone"
            type="tel"
            className={inputCls}
            placeholder="+1 555 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-company">Company</label>
          <input
            id="cf-company"
            className={inputCls}
            placeholder="Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-title">Title</label>
          <input
            id="cf-title"
            className={inputCls}
            placeholder="CTO"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-stage">Pipeline Stage</label>
        <div className="relative">
          <select
            id="cf-stage"
            className={`${inputCls} appearance-none pr-8`}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">— No stage —</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-tags">
          Tags <span className="text-[10px] font-normal">(comma-separated)</span>
        </label>
        <input
          id="cf-tags"
          className={inputCls}
          placeholder="prospect, cto, saas"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cf-notes">Notes</label>
        <textarea
          id="cf-notes"
          className={`${inputCls} min-h-[80px] resize-y`}
          placeholder="Any relevant notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-border/30">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Add contact"}
        </button>
      </div>
    </form>
  );
});

// ─── Contact detail view ──────────────────────────────────────────────────────

interface ContactDetailProps {
  contact: ClientContactRow & { recentInteractions?: { id: string; contactId: string; agentId: string; personaId: string; type: string; channel: string | null; summary: string | null; content: string | null; outcome: string | null; artifactLink: string | null; createdAt: string }[] };
  interactionsLoading: boolean;
  interactionsError: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

const ContactDetail = memo(function ContactDetail({
  contact,
  interactionsLoading,
  interactionsError,
  onEdit,
  onDelete,
}: ContactDetailProps) {
  const badge = stageBadge(contact.stage);
  const tags = parseTags(contact.tags);

  return (
    <div className="space-y-4">
      {/* Identity block */}
      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground">{contact.name}</h4>
            {(contact.company || contact.title) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[contact.title, contact.company].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {badge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
          )}
        </div>

        <dl className="space-y-1 text-xs">
          {contact.email && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-14 shrink-0">Email</dt>
              <dd className="text-foreground truncate">
                <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
              </dd>
            </div>
          )}
          {contact.phone && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-14 shrink-0">Phone</dt>
              <dd className="text-foreground">
                <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
              </dd>
            </div>
          )}
        </dl>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        {contact.notes && (
          <p className="mt-1 text-xs text-foreground/70 border-t border-border/30 pt-1.5">
            {contact.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {/* Interaction history */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Interaction history
        </p>
        <InteractionTimeline
          interactions={contact.recentInteractions ?? []}
          loading={interactionsLoading}
          error={interactionsError}
          emptyLabel="No interactions logged yet"
        />
      </div>
    </div>
  );
});

// ─── Kanban column ────────────────────────────────────────────────────────────

const KanbanColumn = memo(function KanbanColumn({
  stage,
  contacts,
  onSelect,
}: {
  stage: string;
  contacts: ClientContactRow[];
  onSelect: (id: string) => void;
}) {
  const badge = stageBadge(stage);
  const label = stage.charAt(0).toUpperCase() + stage.slice(1);

  return (
    <div className="flex w-52 shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-1.5">
        {badge ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
            {label}
          </span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {contacts.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 min-h-[60px] rounded-lg bg-muted/20 p-1.5">
        {contacts.length === 0 ? (
          <p className="py-3 text-center text-[10px] text-muted-foreground">No contacts</p>
        ) : (
          contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="group rounded-md border border-border/40 bg-card px-2.5 py-2 text-left transition hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <p className="text-[12px] font-medium text-foreground group-hover:text-primary truncate">
                {c.name}
              </p>
              {c.company && (
                <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{c.company}</p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
});

// ─── CSV export ──────────────────────────────────────────────────────────────

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  let str = String(value);
  // Prevent CSV formula injection — prefix dangerous first chars with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportContactsCSV(contacts: ClientContactRow[]): void {
  const headers = ["Name", "Email", "Phone", "Company", "Title", "Stage", "Tags", "Notes", "Created"];
  const rows = contacts.map((c) => {
    let tags = "";
    const tagsArr = parseTags(c.tags);
    if (tagsArr.length > 0) tags = tagsArr.join("; ");
    return [
      escapeCSV(c.name),
      escapeCSV(c.email),
      escapeCSV(c.phone),
      escapeCSV(c.company),
      escapeCSV(c.title),
      escapeCSV(c.stage),
      escapeCSV(tags),
      escapeCSV(c.notes),
      escapeCSV(c.createdAt),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ContactsPanel ────────────────────────────────────────────────────────────

export const ContactsPanel = memo(function ContactsPanel() {
  const { focusedAgentId: agentId } = useManagementPanel();

  const {
    contacts,
    total,
    loading,
    error,
    detailContact,
    detailLoading,
    detailError,
    loadContacts,
    loadContactDetail,
    clearDetail,
    upsertContact,
    deleteContact,
  } = useContacts(agentId);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStage, setActiveStage] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContactRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientContactRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastQueryRef = useRef<{ q: string; stage: string }>({ q: "", stage: "" });

  const refresh = useCallback(
    (q: string, stage: string) => {
      lastQueryRef.current = { q, stage };
      void loadContacts({ q: q || undefined, stage: stage || undefined });
    },
    [loadContacts],
  );

  // Initial load
  useEffect(() => {
    if (agentId) void loadContacts({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Search debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        refresh(value, activeStage);
      }, 300);
    },
    [activeStage, refresh],
  );

  const handleStageChange = useCallback(
    (stage: string) => {
      setActiveStage(stage);
      refresh(searchQuery, stage);
    },
    [searchQuery, refresh],
  );

  // Contact click → open detail
  const handleContactClick = useCallback(
    (id: string) => {
      void loadContactDetail(id);
      setDetailOpen(true);
    },
    [loadContactDetail],
  );

  // Detail sheet close
  const handleDetailClose = useCallback(
    (open: boolean) => {
      setDetailOpen(open);
      if (!open) clearDetail();
    },
    [clearDetail],
  );

  // Edit flow
  const handleEditClick = useCallback(() => {
    if (!detailContact) return;
    setEditingContact(detailContact);
    setDetailOpen(false);
    setEditSheetOpen(true);
  }, [detailContact]);

  const handleAddNew = useCallback(() => {
    setEditingContact(null);
    setEditSheetOpen(true);
  }, []);

  const handleEditSheetClose = useCallback((open: boolean) => {
    setEditSheetOpen(open);
    if (!open) setEditingContact(null);
  }, []);

  const handleSave = useCallback(
    async (input: ContactUpsertInput) => {
      setSaving(true);
      const result = await upsertContact(input);
      setSaving(false);
      if (!result) {
        // Save failed — keep form open so user can retry (error shown via hook state)
        return;
      }
      setEditSheetOpen(false);
      setEditingContact(null);
      // Refresh to sync with server
      refresh(searchQuery, activeStage);
    },
    [upsertContact, refresh, searchQuery, activeStage],
  );

  // Delete flow
  const handleDeleteClick = useCallback(() => {
    if (!detailContact) return;
    setDeleteTarget(detailContact);
    setDetailOpen(false);
  }, [detailContact]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const ok = await deleteContact(deleteTarget.id);
    setDeleteTarget(null);
    if (ok) clearDetail();
  }, [deleteTarget, deleteContact, clearDetail]);

  // Kanban: group contacts by stage (memoized to avoid recomputation on every render)
  const contactsByStage = useMemo(
    () =>
      PIPELINE_STAGES.reduce(
        (acc, s) => {
          acc[s] = contacts.filter((c) => c.stage === s);
          return acc;
        },
        {} as Record<string, ClientContactRow[]>,
      ),
    [contacts],
  );

  const unstagedContacts = useMemo(
    () => contacts.filter((c) => !c.stage || !PIPELINE_STAGES.includes(c.stage as typeof PIPELINE_STAGES[number])),
    [contacts],
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <PanelHeader
          icon={<Users className="h-4 w-4" />}
          title={`Contacts${total > 0 ? ` · ${total}` : ""}`}
          actions={
            <>
              {/* View toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === "list" ? "kanban" : "list")}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground ${
                      viewMode === "kanban" ? "bg-muted/60 text-foreground" : ""
                    }`}
                    aria-label={viewMode === "list" ? "Switch to pipeline view" : "Switch to list view"}
                  >
                    {viewMode === "list" ? (
                      <Columns3 className="h-3.5 w-3.5" />
                    ) : (
                      <LayoutList className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {viewMode === "list" ? "Pipeline view" : "List view"}
                </TooltipContent>
              </Tooltip>

              {contacts.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      aria-label="Export contacts as CSV"
                      onClick={() => exportContactsCSV(contacts)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </IconButton>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Export CSV</TooltipContent>
                </Tooltip>
              )}
              <IconButton
                aria-label="Refresh contacts"
                onClick={() => refresh(searchQuery, activeStage)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                aria-label="Add contact"
                variant="primary"
                onClick={handleAddNew}
              >
                <Plus className="h-3.5 w-3.5" />
              </IconButton>
            </>
          }
        />

        {/* Toolbar: search + stage filters */}
        <PanelToolbar>
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search contacts…"
            className="min-w-0 flex-1"
          />
        </PanelToolbar>

        {/* Stage filter pills (list view only) */}
        {viewMode === "list" && (
          <div
            className="flex items-center gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide"
            aria-label="Filter by stage"
          >
            {ALL_STAGES_FILTER.map((opt) => {
              const active = opt.value === activeStage;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleStageChange(opt.value)}
                  className={`shrink-0 rounded-full px-2.5 py-1 min-h-[32px] text-[10px] font-semibold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm dark:bg-primary/20"
                      : "border border-border/40 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <ErrorBanner message={error} onRetry={() => refresh(searchQuery, activeStage)} />
          </div>
        )}

        {/* Content area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 px-4 py-2">
              {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : contacts.length === 0 && !error ? (
            <EmptyState
              icon={Users}
              title="No contacts"
              description={searchQuery ? "No contacts match your search" : "Add your first contact to get started"}
              className="py-16"
            />
          ) : viewMode === "list" ? (
            /* ── List view ── */
            <div className="space-y-1.5 px-3 py-2">
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  lastInteractionAt={contact.updatedAt !== contact.createdAt ? contact.updatedAt : null}
                  onClick={handleContactClick}
                />
              ))}
            </div>
          ) : (
            /* ── Kanban / Pipeline view ── */
            <div className="flex gap-3 overflow-x-auto px-4 py-3 pb-6 h-full">
              {PIPELINE_STAGES.map((s) => (
                <KanbanColumn
                  key={s}
                  stage={s}
                  contacts={contactsByStage[s] ?? []}
                  onSelect={handleContactClick}
                />
              ))}
              {unstagedContacts.length > 0 && (
                <KanbanColumn
                  stage="unstaged"
                  contacts={unstagedContacts}
                  onSelect={handleContactClick}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Contact detail SideSheet ── */}
        <SideSheet open={detailOpen} onOpenChange={handleDetailClose}>
          <SideSheetContent aria-label="Contact details">
            <SideSheetHeader>
              <SideSheetTitle className="text-sm font-semibold">
                {detailContact?.name ?? "Contact"}
              </SideSheetTitle>
              <SideSheetClose />
            </SideSheetHeader>
            <SideSheetBody>
              {detailLoading && !detailContact ? (
                <div className="space-y-3 py-2">
                  {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
                </div>
              ) : detailError ? (
                <ErrorBanner message={detailError} />
              ) : detailContact ? (
                <ContactDetail
                  contact={detailContact}
                  interactionsLoading={detailLoading}
                  interactionsError={detailError}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              ) : null}
            </SideSheetBody>
          </SideSheetContent>
        </SideSheet>

        {/* ── Add / Edit SideSheet ── */}
        <SideSheet open={editSheetOpen} onOpenChange={handleEditSheetClose}>
          <SideSheetContent aria-label={editingContact ? "Edit contact" : "Add contact"}>
            <SideSheetHeader>
              <SideSheetTitle className="text-sm font-semibold">
                {editingContact ? "Edit contact" : "New contact"}
              </SideSheetTitle>
              <SideSheetClose />
            </SideSheetHeader>
            <SideSheetBody>
              <ContactForm
                initial={editingContact}
                onSave={handleSave}
                onCancel={() => setEditSheetOpen(false)}
                saving={saving}
              />
            </SideSheetBody>
          </SideSheetContent>
        </SideSheet>

        {/* ── Delete confirmation ── */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="Delete contact"
          description={`Remove "${deleteTarget?.name ?? "this contact"}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void confirmDelete()}
        />
      </div>
    </TooltipProvider>
  );
});
