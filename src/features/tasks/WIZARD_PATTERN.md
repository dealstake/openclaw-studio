# Wizard Pattern — Reusable Conversational Creation Flow

## Overview

The Tasks feature implements a **conversational wizard** pattern for creating new entities.
This pattern is designed for reuse by future wizards (agents, projects, skills).

## Architecture

```
TaskWizardModal (shell: modal chrome, step routing)
  ├── TypeSelectStep (step 1: choose entity type)
  ├── WizardChat (step 2: conversational AI config extraction)
  │     ├── systemPrompt — built per type via buildSystemPrompt()
  │     ├── starters — pre-built conversation starters per type
  │     └── configExtractor — extracts structured config from AI responses
  ├── ConfirmStep (step 3: success confirmation)
  └── useTaskWizard() — state machine (type-select → chat → confirm)
```

## Key Components

### 1. Modal Shell (`TaskWizardModal.tsx`)
- Full-screen on mobile (bottom sheet), centered card on desktop
- Escape to close, body scroll lock, mount animation
- Header with back navigation and step-aware title
- Delegates step rendering to child components

### 2. State Machine (`useTaskWizard.ts`)
- Steps: `type-select` → `chat` → `confirm`
- `selectType(type)` — advances to chat with selected type
- `setTaskConfig(config)` — stores extracted config
- `goBack()` — returns to previous step
- `reset()` — returns to initial state

### 3. WizardChat (`@/components/chat/WizardChat`)
- **Shared component** — not task-specific
- Takes: `client`, `agentId`, `systemPrompt`, `starters`, `configExtractor`
- Renders a chat UI that talks to the gateway AI
- Calls `onConfigExtracted(config)` when AI emits a structured config block

### 4. Config Extractor (`wizardConfigExtractor.ts`)
- `createConfigExtractor("task")` — returns a function that parses AI messages
- Looks for JSON code blocks with a specific schema
- Type: `WizardTaskConfig` — name, description, prompt, schedule, model, etc.

### 5. System Prompt Builder (`wizard-prompts.ts`)
- `buildSystemPrompt(taskType, agents)` — creates the AI system prompt
- Instructs the AI to ask questions and emit a config block when ready
- Includes available agent IDs for the user to choose from

## Reuse Guide — Creating a New Wizard

1. **Define your config type** (e.g., `WizardAgentConfig`)
2. **Create a state machine hook** (e.g., `useAgentWizard`) following `useTaskWizard` pattern
3. **Build system prompts** for each entity type/subtype
4. **Create conversation starters** — 2-3 pre-built options per type
5. **Register a config extractor** via `createConfigExtractor("agent")`
6. **Create your modal shell** — copy `TaskWizardModal` structure:
   - Type selection step (if multiple subtypes)
   - `WizardChat` step with your system prompt + extractor
   - Confirmation step
7. **Wire creation** — your `onCreateEntity` handler receives the extracted config

## Design Principles

- **Mobile-first**: full-height sheet on mobile, centered card on desktop
- **Conversational**: AI guides the user through configuration
- **Progressive disclosure**: simple type selection → guided chat → done
- **Escape hatches**: templates shortcut for power users, back button at every step
- **No jargon**: user-facing language throughout (e.g., "What kind of task?" not "Select cron type")
