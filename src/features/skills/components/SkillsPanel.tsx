"use client";

import React, { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { SectionLabel } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useSkills } from "../hooks/useSkills";
import { SkillsList } from "./SkillsList";
import { SkillDetailSheet } from "./SkillDetailSheet";
import type { Skill } from "../lib/types";

export interface SkillsPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
}

export const SkillsPanel = React.memo(function SkillsPanel({
  client,
  status,
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

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelect = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    setSheetOpen(true);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedSkill(null);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <SectionLabel>Skills</SectionLabel>
        {report && (
          <span className="text-[11px] text-muted-foreground">
            {report.total} installed
          </span>
        )}
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
        busy={busyKey === selectedSkill?.key}
      />
    </div>
  );
});
