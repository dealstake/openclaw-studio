/**
 * Credential Vault — Pre-built templates for common services.
 */

import type { CredentialTemplate } from "./types";

export const CREDENTIAL_TEMPLATES: CredentialTemplate[] = [
  {
    key: "elevenlabs",
    serviceName: "ElevenLabs",
    type: "api_key",
    category: "ai",
    serviceUrl: "https://elevenlabs.io",
    apiKeyPageUrl: "https://elevenlabs.io/subscription",
    powersDescription: "Powers text-to-speech for voice replies",
    instructions: [
      "1. Go to [elevenlabs.io/subscription](https://elevenlabs.io/subscription)",
      "2. Sign in to your account",
      "3. Copy your **API Key** from the profile menu",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk_...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.sag.apiKey", "talk.apiKey"],
    },
    requiredSkills: ["sag"],
    testConfig: { handler: "elevenlabs" },
    suggestedTasks: [
      {
        name: "Voice Briefing",
        description: "Read your morning digest aloud",
        templatePrompt:
          "Create a task that generates a spoken morning briefing using ElevenLabs text-to-speech.",
      },
    ],
  },
  {
    key: "gemini",
    serviceName: "Google Gemini",
    type: "api_key",
    category: "ai",
    serviceUrl: "https://ai.google.dev",
    apiKeyPageUrl: "https://aistudio.google.com/apikey",
    powersDescription: "Powers image generation via Nano Banana Pro",
    instructions: [
      "1. Go to [AI Studio](https://aistudio.google.com/apikey)",
      "2. Click **Create API Key**",
      "3. Copy the generated key",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "AIzaSy...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.nano-banana-pro.apiKey"],
    },
  },
  {
    key: "notion",
    serviceName: "Notion",
    type: "api_key",
    category: "productivity",
    serviceUrl: "https://www.notion.so",
    apiKeyPageUrl: "https://www.notion.so/my-integrations",
    powersDescription: "Powers Notion workspace integration",
    instructions: [
      "1. Go to [My Integrations](https://www.notion.so/my-integrations)",
      "2. Click **New Integration**",
      "3. Copy the **Internal Integration Secret**",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "Integration Secret",
        placeholder: "ntn_...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.notion.apiKey"],
    },
    requiredSkills: ["notion"],
    testConfig: { handler: "notion" },
    suggestedTasks: [
      {
        name: "Meeting Notes Sync",
        description: "Auto-create Notion pages from meeting transcripts",
        templatePrompt:
          "Create a task that monitors for new meetings and creates structured Notion pages with key takeaways and action items.",
      },
    ],
  },
  {
    key: "openai",
    serviceName: "OpenAI",
    type: "api_key",
    category: "ai",
    serviceUrl: "https://platform.openai.com",
    apiKeyPageUrl: "https://platform.openai.com/api-keys",
    powersDescription: "Powers OpenAI model access and Codex agent",
    instructions: [
      "1. Go to [API Keys](https://platform.openai.com/api-keys)",
      "2. Click **Create new secret key**",
      "3. Copy the key (it won't be shown again)",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.openai.apiKey"],
    },
    testConfig: { handler: "openai" },
  },
  {
    key: "brave_search",
    serviceName: "Brave Search",
    type: "api_key",
    category: "development",
    serviceUrl: "https://brave.com/search/api",
    apiKeyPageUrl: "https://api.search.brave.com/app/keys",
    powersDescription: "Powers web search across all agents",
    instructions: [
      "1. Go to [Brave Search API](https://api.search.brave.com/app/keys)",
      "2. Sign up or sign in",
      "3. Copy your **API Key**",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "BSA...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["tools.web.search.apiKey"],
    },
    testConfig: { handler: "brave_search" },
  },
  {
    key: "twilio",
    serviceName: "Twilio",
    type: "api_key_pair",
    category: "communication",
    serviceUrl: "https://www.twilio.com",
    apiKeyPageUrl: "https://console.twilio.com",
    powersDescription: "Powers SMS and voice call capabilities",
    instructions: [
      "1. Go to [Twilio Console](https://console.twilio.com)",
      "2. Copy your **Account SID** and **Auth Token** from the dashboard",
    ].join("\n"),
    fields: [
      {
        id: "accountSid",
        label: "Account SID",
        placeholder: "AC...",
        type: "text",
        required: true,
      },
      {
        id: "authToken",
        label: "Auth Token",
        placeholder: "your auth token",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      accountSid: ["skills.entries.twilio.env.TWILIO_ACCOUNT_SID"],
      authToken: ["skills.entries.twilio.env.TWILIO_AUTH_TOKEN"],
    },
  },
  {
    key: "telnyx",
    serviceName: "Telnyx",
    type: "api_key",
    category: "communication",
    serviceUrl: "https://telnyx.com",
    apiKeyPageUrl: "https://portal.telnyx.com/#/app/api-keys",
    powersDescription: "Powers telephony and messaging via Telnyx",
    instructions: [
      "1. Go to [Telnyx Portal](https://portal.telnyx.com/#/app/api-keys)",
      "2. Create or copy your **API Key**",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "KEY...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.telnyx.env.TELNYX_API_KEY"],
    },
  },
  {
    key: "gmail",
    serviceName: "Gmail",
    type: "login",
    category: "communication",
    serviceUrl: "https://mail.google.com",
    apiKeyPageUrl: "https://myaccount.google.com/apppasswords",
    powersDescription: "Powers email reading and sending via Gmail",
    instructions: [
      "1. Go to [App Passwords](https://myaccount.google.com/apppasswords)",
      "2. Select **Mail** and your device",
      "3. Generate and copy the **App Password**",
      "",
      "⚠️ Requires 2-Step Verification enabled on the Google account.",
    ].join("\n"),
    fields: [
      {
        id: "username",
        label: "Gmail Address",
        placeholder: "you@gmail.com",
        type: "text",
        required: true,
      },
      {
        id: "password",
        label: "App Password",
        placeholder: "xxxx xxxx xxxx xxxx",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      username: ["skills.entries.himalaya.env.GMAIL_USERNAME"],
      password: ["skills.entries.himalaya.env.GMAIL_APP_PASSWORD"],
    },
    requiredSkills: ["himalaya"],
    testConfig: { handler: "gmail" },
    suggestedTasks: [
      {
        name: "Morning Email Digest",
        description: "Summarize unread emails every weekday at 8am",
        templatePrompt:
          "Create a scheduled task that runs every weekday at 8am to summarize my unread Gmail emails from the last 24 hours.",
        suggestedSchedule: "0 8 * * 1-5",
      },
      {
        name: "Auto-Reply Draft",
        description: "Draft replies to important emails",
        templatePrompt:
          "Create a task that checks my Gmail every hour for emails from key contacts and drafts reply suggestions.",
      },
    ],
  },
  {
    key: "github",
    serviceName: "GitHub",
    type: "api_key",
    category: "development",
    serviceUrl: "https://github.com",
    apiKeyPageUrl: "https://github.com/settings/tokens",
    powersDescription: "Powers GitHub issue tracking and PR management",
    instructions: [
      "1. Go to [Personal Access Tokens](https://github.com/settings/tokens)",
      "2. Click **Generate new token (classic)** or use fine-grained tokens",
      "3. Select required scopes and generate",
      "4. Copy the token",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "Personal Access Token",
        placeholder: "ghp_...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.github.env.GITHUB_TOKEN"],
    },
    requiredSkills: ["github"],
    testConfig: { handler: "github" },
    suggestedTasks: [
      {
        name: "PR Review Bot",
        description: "Auto-review new pull requests",
        templatePrompt:
          "Create a task that checks my GitHub repos every 30 minutes for new PRs and posts code review comments.",
      },
      {
        name: "Issue Triage",
        description: "Categorize and prioritize new issues",
        templatePrompt:
          "Create a task that monitors GitHub issues and auto-labels and prioritizes them.",
      },
    ],
  },
  {
    key: "google_places",
    serviceName: "Google Places",
    type: "api_key",
    category: "productivity",
    serviceUrl: "https://developers.google.com/maps/documentation/places",
    apiKeyPageUrl: "https://console.cloud.google.com/apis/credentials",
    powersDescription: "Powers location search and place details",
    instructions: [
      "1. Go to [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials)",
      "2. Click **Create Credentials → API Key**",
      "3. Enable the **Places API (New)** in your project",
      "4. Copy the API key",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "AIzaSy...",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: [
        "skills.entries.goplaces.apiKey",
        "skills.entries.local-places.apiKey",
      ],
    },
    testConfig: { handler: "google_places" },
  },
  {
    key: "eightctl",
    serviceName: "Eight Sleep",
    type: "login",
    category: "iot",
    serviceUrl: "https://www.eightsleep.com",
    apiKeyPageUrl: "https://www.eightsleep.com",
    powersDescription: "Powers smart mattress temperature and sleep tracking",
    instructions: [
      "Enter your Eight Sleep account credentials.",
      "These are the same email and password you use in the Eight Sleep app.",
    ].join("\n"),
    fields: [
      {
        id: "email",
        label: "Email",
        placeholder: "you@example.com",
        type: "text",
        required: true,
      },
      {
        id: "password",
        label: "Password",
        placeholder: "your password",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      email: ["skills.entries.eightctl.env.EIGHT_EMAIL"],
      password: ["skills.entries.eightctl.env.EIGHT_PASSWORD"],
    },
  },
  {
    key: "openhue",
    serviceName: "Philips Hue",
    type: "api_key",
    category: "iot",
    serviceUrl: "https://developers.meethue.com",
    apiKeyPageUrl: "https://developers.meethue.com",
    powersDescription: "Powers smart lighting control via Hue Bridge",
    instructions: [
      "1. Press the **link button** on your Hue Bridge",
      "2. Run `openhue setup` in your terminal within 30 seconds",
      "3. Copy the generated **API Key**",
    ].join("\n"),
    fields: [
      {
        id: "apiKey",
        label: "Hue API Key",
        placeholder: "your-hue-api-key",
        type: "password",
        required: true,
      },
    ],
    configPathMap: {
      apiKey: ["skills.entries.openhue.env.HUE_API_KEY"],
    },
  },
];

/** Look up a template by key */
export function findTemplate(key: string): CredentialTemplate | undefined {
  return CREDENTIAL_TEMPLATES.find((t) => t.key === key);
}

/** Find templates matching a config path (for auto-detecting unmanaged credentials) */
export function findTemplateByConfigPath(
  configPath: string,
): CredentialTemplate | undefined {
  return CREDENTIAL_TEMPLATES.find((t) =>
    Object.values(t.configPathMap)
      .flat()
      .includes(configPath),
  );
}

/** Find a credential template that powers a given skill key.
 *  Matches when any configPathMap value includes `skills.entries.<skillKey>.` */
/** Custom credential template for arbitrary services. */
export const CUSTOM_TEMPLATE: CredentialTemplate = {
  key: "custom",
  serviceName: "Custom Service",
  type: "api_key",
  category: "custom",
  serviceUrl: "",
  apiKeyPageUrl: "",
  instructions: "Enter the API key or secret for your custom service.",
  fields: [
    {
      id: "apiKey",
      label: "API Key / Secret",
      placeholder: "paste your key here",
      type: "password",
      required: true,
    },
  ],
  configPathMap: {
    apiKey: [],
  },
};

export function findTemplateForSkillKey(
  skillKey: string,
): CredentialTemplate | undefined {
  const prefix = `skills.entries.${skillKey}.`;
  return CREDENTIAL_TEMPLATES.find((t) =>
    Object.values(t.configPathMap)
      .flat()
      .some((path) => path.startsWith(prefix)),
  );
}
