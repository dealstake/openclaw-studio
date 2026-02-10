FROM node:22-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js inlines NEXT_PUBLIC_* at build time
ARG NEXT_PUBLIC_GATEWAY_URL=wss://gateway.tridentfundingsolutions.com
ARG NEXT_PUBLIC_GATEWAY_TOKEN
ARG NEXT_PUBLIC_SSO_GOOGLE_ENABLED=true
ARG NEXT_PUBLIC_SSO_MICROSOFT_ENABLED=false
ARG NEXT_PUBLIC_EMAIL_AUTH_ENABLED=false
ARG NEXT_PUBLIC_CF_TEAM_DOMAIN=tridentfundingsolutions.cloudflareaccess.com
ARG NEXT_PUBLIC_CF_GOOGLE_IDP_ID
ARG NEXT_PUBLIC_CF_MICROSOFT_IDP_ID
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_GATEWAY_TOKEN=$NEXT_PUBLIC_GATEWAY_TOKEN
ENV NEXT_PUBLIC_SSO_GOOGLE_ENABLED=$NEXT_PUBLIC_SSO_GOOGLE_ENABLED
ENV NEXT_PUBLIC_SSO_MICROSOFT_ENABLED=$NEXT_PUBLIC_SSO_MICROSOFT_ENABLED
ENV NEXT_PUBLIC_EMAIL_AUTH_ENABLED=$NEXT_PUBLIC_EMAIL_AUTH_ENABLED
ENV NEXT_PUBLIC_CF_TEAM_DOMAIN=$NEXT_PUBLIC_CF_TEAM_DOMAIN
ENV NEXT_PUBLIC_CF_GOOGLE_IDP_ID=$NEXT_PUBLIC_CF_GOOGLE_IDP_ID
ENV NEXT_PUBLIC_CF_MICROSOFT_IDP_ID=$NEXT_PUBLIC_CF_MICROSOFT_IDP_ID

RUN npm run build

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
