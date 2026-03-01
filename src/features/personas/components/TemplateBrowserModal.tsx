"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listTemplates,
  getActiveCategories,
} from "../lib/templateRegistry";
import type { PersonaTemplate } from "../lib/templateTypes";
import type { PersonaCategory } from "../lib/personaTypes";
import { TemplateCard } from "./TemplateCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user picks a template → dispatches inline wizard */
  onSelectTemplate: (template: PersonaTemplate) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TemplateBrowserModal = React.memo(function TemplateBrowserModal({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplateBrowserModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    PersonaCategory | "all"
  >("all");
  const [search, setSearch] = useState("");

  const categories = useMemo(() => getActiveCategories(), []);
  const allTemplates = useMemo(() => listTemplates(), []);

  const filtered = useMemo(() => {
    let list =
      selectedCategory === "all"
        ? allTemplates
        : allTemplates.filter((t) => t.category === selectedCategory);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [allTemplates, selectedCategory, search]);

  const handleSelect = useCallback(
    (template: PersonaTemplate) => {
      onSelectTemplate(template);
      onOpenChange(false);
    },
    [onSelectTemplate, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col sm:max-w-2xl"
        aria-describedby="template-browser-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Starter Kits
          </DialogTitle>
          <DialogDescription id="template-browser-desc">
            Pick a template to create your AI persona. Each kit includes
            brain files, knowledge base, and a practice mode.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className={cn(
              "h-9 w-full rounded-md border border-border/40 bg-background/50 pl-9 pr-3",
              "text-sm text-foreground placeholder:text-muted-foreground/70",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            )}
          />
        </div>

        {/* Category filter tabs — horizontally scrollable on mobile */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
          role="radiogroup"
          aria-label="Filter by category"
        >
          <CategoryTab
            label="All"
            active={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
          />
          {categories.map((cat) => (
            <CategoryTab
              key={cat.key}
              label={cat.label}
              active={selectedCategory === cat.key}
              onClick={() => setSelectedCategory(cat.key)}
            />
          ))}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No templates match your search
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pb-2">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.key}
                  template={template}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* From-scratch placeholder */}
        <div className="border-t border-border/30 pt-3">
          <button
            type="button"
            disabled
            className={cn(
              "flex h-10 w-full items-center justify-center gap-2 rounded-md",
              "border border-dashed border-border/40 text-xs text-muted-foreground/60",
              "cursor-not-allowed",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Start from Scratch — Coming Soon
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

// ---------------------------------------------------------------------------
// CategoryTab (internal)
// ---------------------------------------------------------------------------

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap",
        "min-h-[44px] min-w-[44px]",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </button>
  );
}
