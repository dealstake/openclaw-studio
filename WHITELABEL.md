# Whitelabel Guide

This dashboard is designed to be easily rebranded for any client or organization. All brand identity is centralized — no hunting through components for hardcoded strings or colors.

## Quick Rebrand (5 minutes)

### 1. Update Brand Config

Edit `src/lib/branding/config.ts`:

```typescript
export const BRANDING = {
  name: "Your Company Name",           // Full legal name
  shortName: "YOUR BRAND",             // Header display name
  subtitle: "Your Tagline",            // Italic accent text in header
  tagline: "Agent Control Center",     // Dashboard subtitle
  pageTitle: "Your Control Center",    // Browser tab title
  pageDescription: "Your meta description.",
  logoutUrl: "https://yourteam.cloudflareaccess.com/cdn-cgi/access/logout",
  identityUrl: "/cdn-cgi/access/get-identity",
  colors: {
    navy: "#0F1B2D",    // Dark background
    gold: "#D4A843",    // Primary accent
    offWhite: "#E8DCC8", // Light text on dark
  },
} as const;
```

### 2. Update Theme Colors

Edit `src/app/globals.css`. The theme uses CSS custom properties with oklch color space. Key variables to change:

**Dark mode** (inside `@media (prefers-color-scheme: dark)` and `.dark`):
- `--primary` — Main accent color (buttons, links, highlights)
- `--accent` — Secondary accent
- `--ring` — Focus ring color
- `--background` — Page background
- `--foreground` — Main text color
- `--sidebar-primary`, `--sidebar-accent` — Sidebar accent colors

**Light mode** (default):
- Same variables but with lighter values

### 3. Replace Logo

**Option A — Inline SVG (recommended):**
Edit `src/components/brand/TridentLogo.tsx`. Replace the SVG path data with your logo's paths. Keep `fill="currentColor"` so the logo inherits theme colors.

**Option B — Image file:**
Replace `public/branding/trident.svg` and `public/branding/trident.png`. Update `TridentLogo.tsx` to use an `<Image>` tag instead of inline SVG.

### 4. Update BrandMark Layout

Edit `src/components/brand/BrandMark.tsx` to match your brand's text layout. The current implementation splits "TRIDENT" (off-white) and "FUNDING SOLUTIONS" (gold italic). Adjust for your brand's typography.

### 5. Update Agent Avatar Default

Edit `src/features/agents/components/AgentAvatar.tsx`. The `TRIDENT_FALLBACK` constant points to `/branding/trident.svg`. Change this to your logo, or revert to the multiavatar library for generated avatars:

```typescript
// To use generated avatars instead of a static logo:
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
// Then in the component: src = buildAvatarDataUrl(seed);
```

### 6. Update Favicon

The favicon is set dynamically in `src/app/page.tsx` as `/branding/trident.svg`. Change the `faviconHref` constant to your logo path.

## Files to Touch

| File | What to change |
|------|---------------|
| `src/lib/branding/config.ts` | Company name, URLs, color palette |
| `src/app/globals.css` | CSS custom property color values |
| `src/components/brand/TridentLogo.tsx` | SVG logo path data |
| `src/components/brand/BrandMark.tsx` | Text layout and styling |
| `src/features/agents/components/AgentAvatar.tsx` | Default avatar fallback |
| `src/app/page.tsx` | Favicon path |
| `src/app/layout.tsx` | Metadata (title, description) — or leave it, it imports from branding config |
| `public/branding/` | Static logo assets (SVG, PNG) |

## Files You Should NOT Touch

| File | Why |
|------|-----|
| `src/lib/gateway/` | Gateway WebSocket client — shared infrastructure |
| `src/features/agents/state/` | Agent state management — no brand coupling |
| `src/features/agents/components/AgentChatPanel.tsx` | Chat UI — uses brand components via composition |
| `src/features/agents/components/FleetSidebar.tsx` | Fleet UI — uses AgentAvatar component |
| `src/lib/studio/` | Settings coordinator — brand-agnostic |

## Authentication

Auth is handled by Cloudflare Access. To rebrand auth:

1. Create a new Cloudflare Access application for the client's domain
2. Set up Google OAuth (or other IdP) in Cloudflare Zero Trust
3. Update `BRANDING.logoutUrl` and `BRANDING.identityUrl` in config.ts
4. The Access login page is Cloudflare's — customize it via the Cloudflare dashboard (logo, colors)

## Fonts

Fonts are loaded in `src/app/layout.tsx`:
- **Display**: Bebas Neue (headings, brand text)
- **Body**: IBM Plex Sans
- **Mono**: IBM Plex Mono (code, status text)

To change fonts, update the imports in `layout.tsx` and the CSS variable references in `globals.css`.

## Deployment Checklist

- [ ] Updated `src/lib/branding/config.ts` with client details
- [ ] Updated theme colors in `src/app/globals.css`
- [ ] Replaced logo SVG in `src/components/brand/TridentLogo.tsx`
- [ ] Replaced static assets in `public/branding/`
- [ ] Updated `BrandMark.tsx` text layout
- [ ] Updated `AgentAvatar.tsx` fallback
- [ ] Updated `layout.tsx` metadata (or verified it pulls from branding config)
- [ ] Updated Cloudflare Access application + policy
- [ ] Ran `npm run build` — no errors
- [ ] Visually inspected light and dark modes
- [ ] Tested all user flows (connect, chat, settings, brain, create/delete agent)
- [ ] Committed and pushed to client's repo
