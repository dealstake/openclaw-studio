"use client";

/**
 * VoiceSettingsPanel — Global voice settings UI.
 *
 * Lives in the management sidebar under a "Voice" tab.
 * Controls: voice picker with preview, model selector, language,
 * auto-speak toggle, and advanced voice tuning (stability, similarity, style).
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Volume2,
  Play,
  Square,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElevenLabsVoice } from "../lib/voiceTypes";
import type { UseVoiceSettingsReturn } from "../hooks/useVoiceSettings";

// ── Voice Card ──────────────────────────────────────────────────────────

interface VoiceCardProps {
  voice: ElevenLabsVoice;
  selected: boolean;
  onSelect: (voiceId: string) => void;
}

const VoiceCard = React.memo(function VoiceCard({
  voice,
  selected,
  onSelect,
}: VoiceCardProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (playing) {
        audioRef.current?.pause();
        audioRef.current = null;
        setPlaying(false);
        return;
      }
      if (!voice.previewUrl) return;
      const audio = new Audio(voice.previewUrl);
      audioRef.current = audio;
      setPlaying(true);
      audio.onended = () => {
        setPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlaying(false);
        audioRef.current = null;
      };
      void audio.play();
    },
    [playing, voice.previewUrl],
  );

  const handleSelect = useCallback(() => {
    onSelect(voice.voiceId);
  }, [onSelect, voice.voiceId]);

  // Parse the display name — format: "Name - Description"
  const [displayName, description] = voice.name.includes(" - ")
    ? [voice.name.split(" - ")[0], voice.name.split(" - ").slice(1).join(" - ")]
    : [voice.name, ""];

  return (
    <button
      type="button"
      onClick={handleSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-border/30 hover:border-border/60 hover:bg-muted/30",
      )}
    >
      {/* Preview button */}
      <button
        type="button"
        onClick={handlePreview}
        aria-label={playing ? "Stop preview" : `Preview ${displayName}`}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
          playing
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {playing ? (
          <Square className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3 ml-0.5" />
        )}
      </button>

      {/* Voice info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {voice.gender}
          </span>
          {voice.accent && (
            <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {voice.accent}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
});

// ── Slider ──────────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  description?: string;
}

const Slider = React.memo(function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
  description,
}: SliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <span className="text-xs text-muted-foreground">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      {description && (
        <p className="text-[10px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
});

// ── Main Panel ──────────────────────────────────────────────────────────

interface VoiceSettingsPanelProps {
  voiceSettings: UseVoiceSettingsReturn;
  className?: string;
}

export const VoiceSettingsPanel = React.memo(function VoiceSettingsPanel({
  voiceSettings,
  className,
}: VoiceSettingsPanelProps) {
  const {
    settings,
    voices,
    voicesLoading,
    updateGlobalVoice,
    toggleAutoSpeak,
  } = voiceSettings;

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleVoiceSelect = useCallback(
    (voiceId: string) => {
      updateGlobalVoice({ voiceId });
    },
    [updateGlobalVoice],
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateGlobalVoice({ modelId: e.target.value });
    },
    [updateGlobalVoice],
  );

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateGlobalVoice({ language: e.target.value });
    },
    [updateGlobalVoice],
  );

  const handleStabilityChange = useCallback(
    (val: number) => {
      updateGlobalVoice({ voiceConfig: { ...settings.voiceConfig, stability: val } });
    },
    [updateGlobalVoice, settings.voiceConfig],
  );

  const handleSimilarityChange = useCallback(
    (val: number) => {
      updateGlobalVoice({ voiceConfig: { ...settings.voiceConfig, similarityBoost: val } });
    },
    [updateGlobalVoice, settings.voiceConfig],
  );

  const handleStyleChange = useCallback(
    (val: number) => {
      updateGlobalVoice({ voiceConfig: { ...settings.voiceConfig, style: val } });
    },
    [updateGlobalVoice, settings.voiceConfig],
  );

  return (
    <div className={cn("flex flex-col gap-6 p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Voice & Speech</h2>
      </div>

      {/* Auto-speak toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card/50 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">Auto-speak responses</p>
          <p className="text-xs text-muted-foreground">
            Automatically speak AI responses when in voice mode
          </p>
        </div>
        <button
          type="button"
          onClick={toggleAutoSpeak}
          role="switch"
          aria-checked={settings.autoSpeak}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            settings.autoSpeak ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              settings.autoSpeak ? "translate-x-[22px]" : "translate-x-[2px]",
            )}
          />
        </button>
      </div>

      {/* TTS Model */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">TTS Model</label>
        <select
          value={settings.modelId}
          onChange={handleModelChange}
          className={cn(
            "min-h-[44px] rounded-lg border border-border/40 bg-background/50 px-3 text-sm",
          )}
        >
          <option value="eleven_flash_v2_5">Flash v2.5 — Fastest, lowest latency</option>
          <option value="eleven_multilingual_v2">Multilingual v2 — Best quality</option>
          <option value="eleven_turbo_v2_5">Turbo v2.5 — Balanced</option>
        </select>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Speech Language</label>
        <select
          value={settings.language}
          onChange={handleLanguageChange}
          className={cn(
            "min-h-[44px] rounded-lg border border-border/40 bg-background/50 px-3 text-sm",
          )}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
        </select>
      </div>

      {/* Voice Picker */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">Voice</label>
        {voicesLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading voices…</span>
          </div>
        ) : voices.length === 0 ? (
          <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
            No voices available. Check your ElevenLabs API key in Credentials.
          </div>
        ) : (
          <div className="flex max-h-[400px] flex-col gap-1.5 overflow-y-auto">
            {voices.map((voice) => (
              <VoiceCard
                key={voice.voiceId}
                voice={voice}
                selected={voice.voiceId === settings.voiceId}
                onSelect={handleVoiceSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Advanced: Voice tuning */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Advanced Voice Settings
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-4 rounded-lg border border-border/20 bg-card/30 p-3">
            <Slider
              label="Stability"
              value={settings.voiceConfig.stability}
              onChange={handleStabilityChange}
              description="Higher = more consistent but can sound robotic"
            />
            <Slider
              label="Clarity + Similarity"
              value={settings.voiceConfig.similarityBoost}
              onChange={handleSimilarityChange}
              description="Higher = closer to original voice"
            />
            <Slider
              label="Style"
              value={settings.voiceConfig.style}
              onChange={handleStyleChange}
              description="Higher = more expressive (may reduce stability)"
            />
          </div>
        )}
      </div>
    </div>
  );
});
