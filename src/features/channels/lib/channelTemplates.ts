/**
 * Channel Configuration — Pre-built templates for each channel type.
 */

import type { ChannelTemplate } from "./types";

const DM_POLICY_OPTIONS = [
  { value: "open", label: "Open — anyone can DM" },
  { value: "allowlist", label: "Allowlist — approved contacts only" },
  { value: "deny", label: "Deny — no DMs" },
];

export const CHANNEL_TEMPLATES: ChannelTemplate[] = [
  {
    id: "telegram",
    label: "Telegram",
    description: "Receive and send messages via a Telegram bot",
    icon: "✈️",
    docsUrl: "https://docs.openclaw.ai/channels/telegram",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        type: "secret",
        required: true,
        placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        helpText: "Get this from @BotFather in Telegram",
      },
      {
        key: "dmPolicy",
        label: "DM Policy",
        type: "select",
        options: DM_POLICY_OPTIONS,
        helpText: "Controls who can message this bot privately",
      },
    ],
    setupInstructions: [
      "1. Open Telegram and chat with **@BotFather**",
      "2. Send `/newbot` and follow the prompts to create a bot",
      "3. Copy the **bot token** BotFather gives you",
      "4. Paste it above and save",
    ].join("\n"),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Connect via WhatsApp Web QR pairing",
    icon: "💬",
    hasQrFlow: true,
    docsUrl: "https://docs.openclaw.ai/channels/whatsapp",
    fields: [
      {
        key: "dmPolicy",
        label: "DM Policy",
        type: "select",
        options: DM_POLICY_OPTIONS,
        helpText: "Controls who can message this number",
      },
    ],
    setupInstructions: [
      "1. Click **Start Pairing** below to generate a QR code",
      "2. Open WhatsApp on your phone → **Linked Devices** → **Link a Device**",
      "3. Scan the QR code with your phone",
      "4. Wait for the connection to be confirmed",
    ].join("\n"),
  },
  {
    id: "discord",
    label: "Discord",
    description: "Connect a Discord bot to servers and DMs",
    icon: "🎮",
    docsUrl: "https://docs.openclaw.ai/channels/discord",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        type: "secret",
        required: true,
        placeholder: "MTI3NTk0Nz...",
        helpText: "From Discord Developer Portal → Bot → Token",
      },
      {
        key: "guildId",
        label: "Server ID (optional)",
        type: "text",
        placeholder: "123456789012345678",
        helpText: "Restricts the bot to a single server. Leave empty for all servers.",
      },
      {
        key: "dmPolicy",
        label: "DM Policy",
        type: "select",
        options: DM_POLICY_OPTIONS,
      },
    ],
    setupInstructions: [
      "1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)",
      "2. Click **New Application** and name it",
      "3. Go to **Bot** → click **Reset Token** → copy the token",
      "4. Under **Privileged Gateway Intents**, enable **Message Content Intent**",
      "5. Go to **OAuth2** → **URL Generator** → select `bot` scope + `Send Messages` permission",
      "6. Open the generated URL to add the bot to your server",
      "7. Paste the bot token above and save",
    ].join("\n"),
  },
  {
    id: "slack",
    label: "Slack",
    description: "Connect a Slack app via Socket Mode",
    icon: "📋",
    docsUrl: "https://docs.openclaw.ai/channels/slack",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        type: "secret",
        required: true,
        placeholder: "xoxb-...",
        helpText: "OAuth Bot Token from your Slack app settings",
      },
      {
        key: "appToken",
        label: "App-Level Token",
        type: "secret",
        required: true,
        placeholder: "xapp-...",
        helpText: "App-Level Token with connections:write scope",
      },
      {
        key: "dmPolicy",
        label: "DM Policy",
        type: "select",
        options: DM_POLICY_OPTIONS,
      },
    ],
    setupInstructions: [
      "1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)",
      "2. Enable **Socket Mode** and generate an **App-Level Token** with `connections:write`",
      "3. Under **OAuth & Permissions**, add bot scopes: `chat:write`, `im:history`, `im:read`",
      "4. Install the app to your workspace and copy the **Bot User OAuth Token**",
      "5. Paste both tokens above and save",
    ].join("\n"),
  },
  {
    id: "signal",
    label: "Signal",
    description: "Connect via signal-cli (requires external setup)",
    icon: "🔒",
    docsUrl: "https://docs.openclaw.ai/channels/signal",
    fields: [
      {
        key: "account",
        label: "Phone Number",
        type: "text",
        required: true,
        placeholder: "+1234567890",
        helpText: "The phone number registered with signal-cli",
      },
      {
        key: "dmPolicy",
        label: "DM Policy",
        type: "select",
        options: DM_POLICY_OPTIONS,
      },
    ],
    setupInstructions: [
      "**Prerequisites:** `signal-cli` must be installed and registered on this host.",
      "",
      "1. Install signal-cli: `brew install signal-cli` (macOS) or follow [signal-cli docs](https://github.com/AsamK/signal-cli)",
      "2. Register or link a phone number with `signal-cli register` or `signal-cli link`",
      "3. Enter the phone number above and save",
      "4. The gateway will connect to signal-cli automatically",
    ].join("\n"),
  },
];

/** Look up a template by channel type */
export function findChannelTemplate(id: string): ChannelTemplate | undefined {
  return CHANNEL_TEMPLATES.find((t) => t.id === id);
}
