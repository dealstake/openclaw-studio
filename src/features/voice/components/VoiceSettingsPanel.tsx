"use client";

/**
 * VoiceSettingsPanel — Global voice settings UI.
 *
 * Lives in the management sidebar under a "Voice" tab.
 * Controls: voice picker with preview, model selector, language,
 * auto-speak toggle, and advanced voice tuning (stability, similarity, style).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  /** Whether THIS card's preview is currently playing (controlled by parent) */
  playing: boolean;
  onSelect: (voiceId: string) => void;
  /** Called by this card to request start/stop of its preview */
  onPreview: (voice: ElevenLabsVoice, e: React.MouseEvent) => void;
}

const VoiceCard = React.memo(function VoiceCard({
  voice,
  selected,
  playing,
  onSelect,
  onPreview,
}: VoiceCardProps) {
  const handlePreview = useCallback(
    (e: React.MouseEvent) => {
      onPreview(voice, e);
    },
    [onPreview, voice],
  );

  const handleSelect = useCallback(() => {
    onSelect(voice.voiceId);
  }, [onSelect, voice.voiceId]);

  // Parse the display name — format: "Name - Description"
  const [displayName, description] = voice.name.includes(" - ")
    ? [voice.name.split(" - ")[0], voice.name.split(" - ").slice(1).join(" - ")]
    : [voice.name, ""];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect();
      }
    },
    [handleSelect],
  );

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
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
          <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
            {voice.gender}
          </span>
          {voice.accent && (
            <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
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
    </div>
  );
});

// ── Voice Slider ────────────────────────────────────────────────────────

import { Slider as RadixSlider } from "@/components/ui/slider";

interface VoiceSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  description?: string;
}

const VoiceSlider = React.memo(function VoiceSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
  description,
}: VoiceSliderProps) {
  const id = React.useId();
  const handleChange = useCallback(
    (values: number[]) => {
      onChange(values[0]);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label id={`${id}-label`} className="text-xs font-medium text-foreground">{label}</label>
        <span className="text-xs text-muted-foreground">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <RadixSlider
        aria-labelledby={`${id}-label`}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={handleChange}
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
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

  // Lifted audio preview state — prevents multiple simultaneous previews
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Cleanup preview audio on unmount to prevent zombie playback
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleVoicePreview = useCallback(
    (voice: ElevenLabsVoice, e: React.MouseEvent) => {
      e.stopPropagation();
      // Stop any currently-playing preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      // Toggle off if same voice is clicked again
      if (playingVoiceId === voice.voiceId) {
        setPlayingVoiceId(null);
        return;
      }
      if (!voice.previewUrl) return;
      const audio = new Audio(voice.previewUrl);
      previewAudioRef.current = audio;
      setPlayingVoiceId(voice.voiceId);
      audio.onended = () => {
        setPlayingVoiceId(null);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingVoiceId(null);
        previewAudioRef.current = null;
      };
      void audio.play();
    },
    [playingVoiceId],
  );

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
        {/* min-h/w-[44px] ensures ≥44px touch target per WCAG 2.5.8 */}
        <button
          type="button"
          onClick={toggleAutoSpeak}
          role="switch"
          aria-checked={settings.autoSpeak}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <div
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              settings.autoSpeak ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                settings.autoSpeak ? "translate-x-[22px]" : "translate-x-[2px]",
              )}
            />
          </div>
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
          <div role="radiogroup" aria-label="Voice selection" className="flex max-h-[400px] flex-col gap-1.5 overflow-y-auto">
            {voices.map((voice) => (
              <VoiceCard
                key={voice.voiceId}
                voice={voice}
                selected={voice.voiceId === settings.voiceId}
                playing={playingVoiceId === voice.voiceId}
                onSelect={handleVoiceSelect}
                onPreview={handleVoicePreview}
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
          aria-expanded={advancedOpen}
          aria-controls="advanced-voice-settings"
          className="flex w-full items-center gap-1.5 rounded-md p-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Advanced Voice Settings
        </button>
        {advancedOpen && (
          <div id="advanced-voice-settings" className="flex flex-col gap-4 rounded-lg border border-border/20 bg-card/30 p-3">
            <VoiceSlider
              label="Stability"
              value={settings.voiceConfig.stability}
              onChange={handleStabilityChange}
              description="Higher = more consistent but can sound robotic"
            />
            <VoiceSlider
              label="Clarity + Similarity"
              value={settings.voiceConfig.similarityBoost}
              onChange={handleSimilarityChange}
              description="Higher = closer to original voice"
            />
            <VoiceSlider
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
