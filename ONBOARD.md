# Onboarding Guide

Get the Trident Agent Control Center running from scratch.

## Prerequisites

1. **Mac Mini** (or any always-on machine) with Node.js 20+
2. **OpenClaw** installed and running (`npm i -g openclaw && openclaw start`)
3. **Cloudflare account** with a domain (for tunnels + Access)
4. **GitHub account** with access to `dealstake/openclaw-studio`
5. **GCP project** (for Cloud Run dev environment — optional)

## Step 1: OpenClaw Gateway

OpenClaw must be running first. It's the brain that this dashboard controls.

```bash
# Install OpenClaw
npm i -g openclaw

# Run the setup wizard
openclaw onboard

# Start the gateway daemon
openclaw start
```

After setup, verify:
```bash
openclaw status
# Should show: Gateway running on port 18789
```

Note the gateway auth token from `~/.openclaw/openclaw.json` → `gateway.auth.token`. You'll need it.

## Step 2: Clone and Build

```bash
git clone git@github.com:dealstake/openclaw-studio.git
cd openclaw-studio
npm install
```

### Local Development
```bash
npm run dev
# Open http://localhost:3000
# Configure gateway URL (ws://127.0.0.1:18789) and token in settings
```

### Production Build
```bash
npm run build
```

## Step 3: Cloudflare Tunnel (Production Access)

The tunnel exposes your local Gateway and Studio to the internet without opening ports.

```bash
# Install cloudflared
brew install cloudflared

# Authenticate
cloudflared login

# Create a named tunnel
cloudflared tunnel create alex-gateway

# Configure routes in ~/.cloudflared/config.yml:
```

```yaml
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: alex.tridentfundingsolutions.com
    service: http://localhost:3000
  - hostname: gateway.tridentfundingsolutions.com
    service: http://localhost:18789
  - service: http_status:404
```

```bash
# Create DNS records
cloudflared tunnel route dns alex-gateway alex.tridentfundingsolutions.com
cloudflared tunnel route dns alex-gateway gateway.tridentfundingsolutions.com

# Install as service (auto-starts on boot)
cloudflared service install
```

## Step 4: Cloudflare Access (Authentication)

Set up Zero Trust to protect the dashboard:

1. Go to Cloudflare Zero Trust dashboard
2. **Access → Applications → Add Application**
   - Type: Self-hosted
   - Domain: `alex.tridentfundingsolutions.com` and `gateway.tridentfundingsolutions.com`
3. **Add Policy**
   - Allow emails ending in `@tridentfundingsolutions.com`
4. **Authentication → Add IdP**
   - Google OAuth (configure Client ID + Secret from GCP console)

## Step 5: launchd Service (Auto-Start)

Create `~/Library/LaunchAgents/com.trident.studio.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.trident.studio</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/path/to/openclaw-studio/server.mjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/openclaw-studio</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>~/.openclaw/logs/studio-out.log</string>
    <key>StandardErrorPath</key>
    <string>~/.openclaw/logs/studio-err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
        <key>GATEWAY_INTERNAL_URL</key>
        <string>ws://127.0.0.1:18789</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.trident.studio.plist
```

## Step 6: Dev Environment (Optional — Cloud Run)

For a staging environment on GCP Cloud Run:

1. Set up GitHub secrets on your repo:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` — WIF provider resource name
   - `GCP_SERVICE_ACCOUNT` — Service account email
   - `GCP_PROJECT_ID` — GCP project ID
   - `GATEWAY_TOKEN` — Gateway auth token (baked into client at build time)

2. Push to `main` — GitHub Actions will build and deploy automatically

3. Point a Cloudflare DNS record to the Cloud Run URL

## Verify Everything Works

1. Open `https://alex.tridentfundingsolutions.com` (or your domain)
2. Cloudflare Access login should appear → sign in with Google
3. Dashboard loads → Fleet sidebar shows your agents
4. Click an agent → chat panel opens
5. Send a message → agent responds in real-time
6. Open Context Panel (cog icon on agent) → Settings/Brain/Tasks tabs work
7. Open Files (folder icon in header) → workspace files listed

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard loads but no agents | Check gateway URL/token in settings. Is OpenClaw running? (`openclaw status`) |
| WebSocket connection fails | Verify Cloudflare tunnel is running (`cloudflared tunnel list`). Check `gateway.controlUi.allowedOrigins` in `openclaw.json` |
| 403 on page load | Cloudflare Access policy may not include your email. Check Zero Trust dashboard |
| Build fails | `rm -rf .next node_modules && npm install && npm run build` |
| Stale UI after deploy | Hard refresh (Cmd+Shift+R). Cloudflare may cache — check Cache-Control headers |
