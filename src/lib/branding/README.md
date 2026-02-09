# Branding System

Everything needed to rebrand the dashboard lives in this directory and a few related files.

## Files to swap when rebranding

| File | What it controls |
|------|-----------------|
| `config.ts` | Company name, short name, tagline, page title, URLs (logout, identity endpoint) |
| `theme.ts` | ALL color values for light mode and dark mode (oklch + hex reference) |
| `../../app/globals.css` | CSS custom properties — **must be synced with `theme.ts`** (`:root` = light, `.dark` = dark) |
| `../../../public/branding/trident.svg` | Logo SVG (`fill="currentColor"` so it inherits color) |
| `../../../public/branding/trident.png` | Logo PNG fallback |
| `../../components/brand/TridentLogo.tsx` | Inline SVG path data — update if the logo shape changes |

## Rebranding steps

1. **Edit `config.ts`** — update company name, URLs, metadata
2. **Edit `theme.ts`** — update `lightTheme`, `darkTheme`, and `brandHex` objects
3. **Sync `globals.css`** — copy the oklch values from `theme.ts` into the `:root` and `.dark` sections (clearly marked with comments)
4. **Replace assets** — drop new SVG/PNG into `public/branding/` and update the path data in `TridentLogo.tsx`
5. **Build & verify** — `npm run build` to catch any issues

## Architecture

- `theme.ts` is the **single source of truth** for all color values
- `globals.css` consumes these as CSS custom properties (manual sync required since CSS can't import TS)
- Components never hardcode hex colors — they use Tailwind classes that reference CSS custom properties
- Brand text/URLs come from `config.ts`, never hardcoded in components
- Visual brand elements use `src/components/brand/` components (TridentLogo, BrandMark, UserBadge, LogoutButton)
