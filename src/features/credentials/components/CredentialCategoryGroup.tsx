"use client";

import React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import type { Credential, CredentialCategory } from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";
import { CredentialCard } from "./CredentialCard";
import { cn } from "@/lib/utils";

export interface CredentialCategoryGroupProps {
  category: CredentialCategory;
  credentials: Credential[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClaim?: (id: string) => void;
  defaultOpen?: boolean;
}

export const CredentialCategoryGroup = React.memo(
  function CredentialCategoryGroup({
    category,
    credentials,
    onEdit,
    onDelete,
    onClaim,
    defaultOpen = true,
  }: CredentialCategoryGroupProps) {
    return (
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="group/trigger flex w-full items-center gap-1.5 py-1">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-150",
              "group-data-[state=open]/trigger:rotate-90",
            )}
          />
          <SectionLabel>
            {CATEGORY_LABELS[category]}
          </SectionLabel>
          <span className="ml-1 text-[10px] tabular-nums text-muted-foreground/50">
            {credentials.length}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1.5 pb-3 pt-1">
            {credentials.map((cred, idx) => (
              <CredentialCard
                key={cred.id}
                credential={cred}
                onEdit={() => onEdit(cred.id)}
                onDelete={() => onDelete(cred.id)}
                onClaim={onClaim ? () => onClaim(cred.id) : undefined}
                style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  },
);
