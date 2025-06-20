
# Estágio de dependências
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Estágio de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Estágio de produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Crie um usuário e grupo não-root
RUN addgroup --system --gid 1001 nodejsuser
RUN adduser --system --uid 1001 nextjsuser

# Copie os artefatos de build do estágio builder
# Se você habilitar output: 'standalone' no next.config.ts, as linhas abaixo seriam diferentes
# Para o 'next start' padrão, precisamos do .next, public, node_modules e package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Defina o usuário não-root
USER nextjsuser

EXPOSE 3000
ENV PORT 3000

CMD ["npm", "run", "start"]
