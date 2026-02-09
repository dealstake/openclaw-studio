# Trident Funding Solutions — Agent Control Center

A branded AI agent operations dashboard built on [OpenClaw Studio](https://github.com/grp06/openclaw-studio). Manages one or more OpenClaw agents through a real-time WebSocket connection to the OpenClaw Gateway.

## Architecture

```
Browser → Cloudflare Access (Google OAuth) → Cloudflare Tunnel → Studio (Next.js, port 3000)
                                                                    ↕ WebSocket
                                                               Gateway (port 18789)
```

- **Frontend**: Next.js 16 App Router + React 19 + Tailwind CSS v4
- **Auth**: Cloudflare Access (Zero Trust) — Google OAuth SSO for `@tridentfundingsolutions.com`
- **Transport**: Cloudflare Tunnel (`alex-gateway`) — no open ports, no static IP
- **Backend**: OpenClaw Gateway (WebSocket JSON-RPC, ~55 methods)
- **Database**: Filesystem (sessions as JSONL, memory as Markdown)
- **Infrastructure**: Terraform (Cloudflare tunnel, DNS, Access), GitHub Actions CI/CD

## Quick Start

### Prerequisites
- Node.js 20+
- An OpenClaw Gateway running (default: `ws://127.0.0.1:18789`)
- Gateway auth token

### Local Development
```bash
git clone git@github.com:dealstake/openclaw-studio.git
cd openclaw-studio
npm install
npm run dev
```

Open `http://localhost:3000`. On first load, configure the gateway connection (URL + token) via the settings menu.

### Production
```bash
npm run build
npm start -- -p 3000
```

The production deployment runs as a macOS `launchd` service (`com.trident.studio`) behind Cloudflare Tunnel at `https://alex.tridentfundingsolutions.com`.

## Project Structure

```
src/
├── app/                    # Next.js App Router (layout, page, globals.css)
├── components/
│   ├── brand/              # Reusable brand components (BrandMark, TridentLogo, UserBadge, LogoutButton)
│   ├── ui/                 # Shadcn-style primitives
│   └── theme-toggle.tsx
├── features/
│   └── agents/
│       ├── components/     # AgentChatPanel, FleetSidebar, HeaderBar, AgentAvatar, etc.
│       ├── operations/     # Agent lifecycle transactions
│       └── state/          # Zustand-like agent store + runtime event bridge
├── lib/
│   ├── branding/           # Centralized brand config (config.ts, theme.ts)
│   ├── gateway/            # Vendored gateway WebSocket client
│   ├── avatars/            # Avatar generation (multiavatar, fallback to trident)
│   ├── cloudflare-auth.ts  # Cloudflare Access identity helper
│   ├── cron/               # Cron job types and helpers
│   └── studio/             # Settings coordinator, preferences
└── public/
    └── branding/           # Static brand assets (trident.svg, trident.png)
```

## Authentication

Authentication is handled entirely by **Cloudflare Access** (Zero Trust free tier, 50 users):

1. User navigates to `https://alex.tridentfundingsolutions.com`
2. Cloudflare Access intercepts → shows login page (Google OAuth or email OTP)
3. After auth, Cloudflare sets `CF_Authorization` JWT cookie
4. Studio reads user identity from `/cdn-cgi/access/get-identity`
5. Logout redirects to `https://tridentfundingsolutions.cloudflareaccess.com/cdn-cgi/access/logout`

**No custom auth system is needed.** The Access policy restricts to `@tridentfundingsolutions.com` email domain.

## Branding

All brand identity is centralized in `src/lib/branding/config.ts`. See [WHITELABEL.md](./WHITELABEL.md) for instructions on rebranding for a different client.

### Brand Components (`src/components/brand/`)

| Component | Description |
|-----------|-------------|
| `TridentLogo` | Inline SVG trident icon, inherits `currentColor`, accepts `size` + `className` |
| `BrandMark` | Logo + "TRIDENT FUNDING SOLUTIONS" text lockup, `size` variants: sm/md/lg |
| `UserBadge` | Avatar initial circle + email display from Cloudflare Access identity |
| `LogoutButton` | Styled logout button that redirects to CF Access logout URL |

### Theme

- **Dark mode**: Navy background (`#0F1B2D`), gold accent (`#D4A843`), off-white text (`#E8DCC8`)
- **Light mode**: Light backgrounds with gold primary/accent
- CSS custom properties defined in `src/app/globals.css` using oklch color space
- Font stack: Bebas Neue (display), IBM Plex Sans (body), IBM Plex Mono (code)

## Gateway Connection

Studio connects to the OpenClaw Gateway via WebSocket. Settings are stored locally at `~/.openclaw/openclaw-studio/settings.json`:

```json
{
  "gateway": {
    "name": "Main",
    "url": "ws://127.0.0.1:18789",
    "token": "<gateway-auth-token>"
  }
}
```

When deployed behind Cloudflare Tunnel, the browser connects to `wss://gateway.tridentfundingsolutions.com`.

## Features

- **Fleet Management**: View all agents, filter by status, create/delete/rename agents
- **Real-time Chat**: Send messages, view streaming responses with thinking traces
- **Brain Files**: View and edit agent workspace files (SOUL.md, MEMORY.md, etc.)
- **Agent Settings**: Model selection, thinking level, cron jobs, heartbeat management
- **Session Management**: New session, view history, stop running agents
- **Dark/Light Theme**: Toggle with system preference detection

## Infrastructure (Terraform)

All infrastructure is managed via Terraform in the `dealstake/employee-agent` repo:

- Cloudflare Tunnel + DNS records
- Cloudflare Access application + Google OAuth IdP + email domain policy
- GCP Workload Identity Federation for GitHub Actions

## Upstream Sync

This is a fork of `grp06/openclaw-studio`. To sync:

```bash
git remote add upstream https://github.com/grp06/openclaw-studio.git
git fetch upstream
git merge upstream/main
```

Our customizations are isolated to:
- `src/lib/branding/` (config + theme)
- `src/lib/cloudflare-auth.ts`
- `src/components/brand/`
- `src/features/agents/components/HeaderBar.tsx`
- `src/features/agents/components/AgentAvatar.tsx`
- `src/app/globals.css` (theme colors)
- `src/app/layout.tsx` (metadata)
- `src/app/page.tsx` (loading screen + favicon)
- `public/branding/`

## License

Forked from [openclaw-studio](https://github.com/grp06/openclaw-studio). See upstream for license terms.
