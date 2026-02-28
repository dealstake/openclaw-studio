"use client";

import React, { useCallback, useState } from "react";
import { Download, Plus } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { SectionLabel } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useSkills } from "../hooks/useSkills";
import { useCredentials } from "@/features/credentials/hooks/useCredentials";
import { findTemplateForSkillKey } from "@/features/credentials/lib/templates";
import { CredentialSheet } from "@/features/credentials/components/CredentialSheet";
import { SkillsList } from "./SkillsList";
import { SkillDetailSheet } from "./SkillDetailSheet";
import { SkillInstallSheet } from "./SkillInstallSheet";
import type { Skill } from "../lib/types";

export interface SkillsPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  /** Optional callback to launch the skill creation wizard in the main chat */
  onCreateSkill?: () => void;
}

export const SkillsPanel = React.memo(function SkillsPanel({
  client,
  status,
  onCreateSkill,
}: SkillsPanelProps) {
  const {
    report,
    skills,
    loading,
    error,
    busyKey,
    filter,
    search,
    setFilter,
    setSearch,
    reload,
    onToggle,
    onSaveApiKey,
  } = useSkills(client, status);

  const {
    create: createCredential,
  } = useCredentials(client, status);

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [credSheetOpen, setCredSheetOpen] = useState(false);
  const [credTemplateKey, setCredTemplateKey] = useState<string | undefined>(
    undefined,
  );

  const handleSelect = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    setSheetOpen(true);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedSkill(null);
  }, []);

  const handleInstalled = useCallback(() => {
    void reload();
  }, [reload]);

  const handleSetupCredential = useCallback((skill: Skill) => {
    const template = findTemplateForSkillKey(skill.key);
    if (template) {
      setCredTemplateKey(template.key);
      setCredSheetOpen(true);
    }
  }, []);

  const handleCredSheetOpenChange = useCallback((open: boolean) => {
    setCredSheetOpen(open);
    if (!open) {
      setCredTemplateKey(undefined);
      // Refresh skills after credential save
      void reload();
    }
  }, [reload]);

  // Only show "Set up" for skills that have a matching credential template
  const hasTemplateForSkill = useCallback((skill: Skill) => {
    return !!findTemplateForSkillKey(skill.key);
  }, []);

  const setupCredentialHandler = useCallback(
    (skill: Skill) => {
      if (hasTemplateForSkill(skill)) {
        handleSetupCredential(skill);
      }
    },
    [hasTemplateForSkill, handleSetupCredential],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <SectionLabel>Skills</SectionLabel>
        <div className="flex items-center gap-2">
          {onCreateSkill && (
            <button
              type="button"
              onClick={onCreateSkill}
              aria-label="Create new skill"
              className="flex h-8 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              <Plus className="h-3 w-3" />
              Create
            </button>
          )}
          <button
            type="button"
            onClick={() => setInstallSheetOpen(true)}
            aria-label="Install skill from ClawHub"
            className="flex h-6 items-center gap-1 rounded-md border border-border/60 bg-card/50 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-3 w-3" />
            Install
          </button>
          {report && (
            <span className="text-[11px] text-muted-foreground">
              {report.total} installed
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 pb-2">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}

      {/* List */}
      <SkillsList
        skills={skills}
        filter={filter}
        search={search}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
        onToggle={onToggle}
        onSelect={handleSelect}
        onSetupCredential={setupCredentialHandler}
        busyKey={busyKey}
        loading={loading}
      />

      {/* Detail sheet */}
      <SkillDetailSheet
        skill={selectedSkill}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onToggle={onToggle}
        onSaveApiKey={onSaveApiKey}
        onSetupCredential={
          selectedSkill && hasTemplateForSkill(selectedSkill)
            ? handleSetupCredential
            : undefined
        }
        busy={busyKey === selectedSkill?.key}
      />

      {/* Install sheet */}
      <SkillInstallSheet
        client={client}
        open={installSheetOpen}
        onOpenChange={setInstallSheetOpen}
        onInstalled={handleInstalled}
      />

      {/* Credential setup sheet (cross-linked from skills) */}
      <CredentialSheet
        open={credSheetOpen}
        onOpenChange={handleCredSheetOpenChange}
        onSave={createCredential}
        initialTemplateKey={credTemplateKey}
        client={client}
      />
    </div>
  );
});
