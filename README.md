# Trident Funding Solutions — Agent Control Center

A branded AI agent operations dashboard built on [OpenClaw Studio](https://github.com/grp06/openclaw-studio). Manages one or more OpenClaw agents through a real-time WebSocket connection to the OpenClaw Gateway.

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              Cloudflare Edge                │
                    │   ┌─────────────────────────────────────┐   │
                    │   │  Cloudflare Access (Google OAuth)   │   │
                    │   └─────────────────────────────────────┘   │
                    │          │                     │             │
                    │     DNS CNAME             Tunnel Route      │
                    │          ↓                     ↓            │
                    └──────────┼─────────────────────┼────────────┘
                               │                     │
              dev.trident...com│    alex.trident...com│
                               ↓                     ↓
                    ┌──────────────────┐   ┌──────────────────┐
                    │  Cloud Run (GCP) │   │  Mac Mini (local)│
                    │  Docker container│   │  launchd service │
                    │  Port 8080       │   │  Port 3000       │
                    └────────┬─────────┘   └────────┬─────────┘
                             │                      │
                             └──────────┬───────────┘
                                        ↓
                             ┌──────────────────┐
                             │ OpenClaw Gateway  │
                             │ localhost:18789   │
                             │ WebSocket JSON-RPC│
                             └──────────────────┘
```

### Environments

| Environment | URL | Host | Deploys |
|---|---|---|---|
| **Prod** | `alex.tridentfundingsolutions.com` | Mac Mini via Cloudflare Tunnel | `npm run build` + launchd restart |
| **Dev** | `dev.tridentfundingsolutions.com` | Cloud Run (GCP) via Cloudflare DNS | Push to `main` → GitHub Actions |

Both environments connect to the **same Gateway** on the Mac Mini (port 18789).

## Stack

- **Frontend**: Next.js 16 App Router + React 19 + Tailwind CSS v4
- **Auth**: Cloudflare Access (Zero Trust) — Google OAuth for `@tridentfundingsolutions.com`
- **Transport**: Cloudflare Tunnel (`alex-gateway`) — no open ports, no static IP
- **Backend**: OpenClaw Gateway (WebSocket JSON-RPC, ~55 methods)
- **Database**: Filesystem (sessions as JSONL, memory as Markdown)
- **Infra**: Terraform (Cloudflare tunnel, DNS, Access), GitHub Actions CI/CD
- **Repo**: [`dealstake/openclaw-studio`](https://github.com/dealstake/openclaw-studio)

## Quick Start

### Prerequisites
- Node.js 20+
- An OpenClaw Gateway running (default: `ws://127.0.0.1:18789`)
- Gateway auth token (from `~/.openclaw/openclaw.json` → `gateway.auth.token`)

### Local Development
```bash
git clone git@github.com:dealstake/openclaw-studio.git
cd openclaw-studio
npm install
npm run dev
```

Open `http://localhost:3000`. Configure gateway connection (URL + token) via the settings menu.

### Production Build (Mac Mini)
```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.trident.studio
```

The launchd service (`com.trident.studio`) runs the standalone Next.js server with a WebSocket proxy on port 3000.

## Project Structure

```
src/
├── app/                        # Next.js App Router (layout, page, globals.css)
├── components/
│   ├── brand/                  # BrandMark, TridentLogo, UserBadge, LogoutButton
│   ├── ui/                     # Shadcn-style primitives
│   ├── HeaderIconButton.tsx    # Shared h-10 w-10 icon button (toolbar)
│   └── theme-toggle.tsx        # Dark/light theme toggle
├── features/
│   ├── agents/
│   │   ├── components/         # HeaderBar, FleetSidebar, AgentChatPanel,
│   │   │                       # AgentInspectPanels, AgentAvatar, ContextPanel
│   │   ├── operations/         # Agent lifecycle transactions
│   │   └── state/              # Agent store + runtime event bridge
│   └── tasks/
│       └── components/         # TasksPanel (placeholder)
├── lib/
│   ├── branding/               # Centralized brand config (config.ts, theme.ts)
│   ├── gateway/                # Vendored gateway WebSocket client
│   ├── avatars/                # Avatar generation
│   ├── agents/                 # Agent file definitions
│   ├── cloudflare-auth.ts      # Cloudflare Access identity helper
│   ├── cron/                   # Cron job types and helpers
│   └── studio/                 # Settings coordinator
└── public/
    └── branding/               # Static assets (trident.svg, trident.png)
```

## UI Layout (Material Design 3 Canonical Layout)

The dashboard uses a **List-Detail + Supporting Pane** hybrid pattern:

```
┌─────────┬────────────────────────┬──────────────┐
│  Fleet  │         Chat           │   Context    │
│ (280px) │       (flex-1)         │   (360px)    │
│         │                        │              │
│ Agent   │  Message thread        │ ┌──────────┐ │
│ cards   │  with streaming        │ │Tasks     │ │
│         │  responses             │ │Brain     │ │
│         │                        │ │Settings  │ │
│         │                        │ └──────────┘ │
│         │                        │   — OR —     │
│         │                        │ ┌──────────┐ │
│         │                        │ │  Files   │ │
│         │                        │ └──────────┘ │
└─────────┴────────────────────────┴──────────────┘
```

- **Fleet** (280px fixed): Agent list with status indicators
- **Chat** (flex-1): Message thread with input
- **Context Panel** (360px fixed): Tabbed panel with two modes:
  - **Agent mode**: Tasks > Brain > Settings tabs (per-agent)
  - **Files mode**: Global file browser (activated via header button)

### Responsive Breakpoints
- **Mobile** (<768px): 3-tab navigation (Fleet | Chat | Context)
- **xl** (1280px): Fleet + Chat; Context appears on toggle
- **2xl** (1536px+): All 3 columns visible

## Authentication

Handled entirely by **Cloudflare Access** (Zero Trust free tier):

1. User navigates to `alex.tridentfundingsolutions.com`
2. Cloudflare Access shows Google OAuth login
3. `CF_Authorization` JWT cookie is set
4. Studio reads identity from `/cdn-cgi/access/get-identity`
5. Logout → `tridentfundingsolutions.cloudflareaccess.com/.../logout`

No custom auth system needed. Access policy restricts to `@tridentfundingsolutions.com`.

## Gateway Connection

The Gateway uses **token auth**. Connection config:

| Setting | Prod (Mac Mini) | Dev (Cloud Run) |
|---|---|---|
| Gateway URL | `wss://alex.tridentfundingsolutions.com/gateway-ws` (proxied) | `wss://gateway.tridentfundingsolutions.com` (direct) |
| Token | Baked at build time via `NEXT_PUBLIC_GATEWAY_TOKEN` | Same (GitHub secret `GATEWAY_TOKEN`) |

Prod uses a WebSocket proxy (`server.mjs`) because the studio and gateway share the same tunnel hostname. Dev connects directly to the gateway subdomain.

## Deployment

### Dev (Cloud Run) — Automatic
Push to `main` triggers `.github/workflows/deploy.yml`:
1. Docker build with `NEXT_PUBLIC_GATEWAY_TOKEN` baked in
2. Push to Artifact Registry
3. Deploy to Cloud Run (`openclaw-studio-dev`, us-central1)

### Prod (Mac Mini) — Manual
```bash
cd /Users/thing1/.openclaw/workspace/openclaw-studio
git pull origin main
npm install
npm run build
launchctl kickstart -k gui/$(id -u)/com.trident.studio
```

Launchd plist: `~/Library/LaunchAgents/com.trident.studio.plist`

## Branding

All brand identity is centralized in `src/lib/branding/config.ts`. See [WHITELABEL.md](./WHITELABEL.md) for rebranding instructions.

- **Dark mode**: Navy background (`#0F1B2D`), gold accent (`#D4A843`), off-white text (`#E8DCC8`)
- **Light mode**: Light backgrounds with gold primary
- **Fonts**: Bebas Neue (display), IBM Plex Sans (body), IBM Plex Mono (code)

## Upstream Sync

Fork of `grp06/openclaw-studio`. To sync:
```bash
git fetch upstream
git merge upstream/main
```

Our customizations are isolated to: `src/lib/branding/`, `src/components/brand/`, `src/lib/cloudflare-auth.ts`, `HeaderBar.tsx`, `AgentAvatar.tsx`, `globals.css`, `layout.tsx`, `page.tsx`, `public/branding/`, `HeaderIconButton.tsx`, `ContextPanel.tsx`, `TasksPanel.tsx`.

## Infrastructure

Terraform lives in [`dealstake/infra`](https://github.com/dealstake/infra):
- Cloudflare Tunnel + DNS records
- Cloudflare Access application + Google OAuth IdP
- GCP Workload Identity Federation for GitHub Actions

## License

Forked from [openclaw-studio](https://github.com/grp06/openclaw-studio). See upstream for license terms.
