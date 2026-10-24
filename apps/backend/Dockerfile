FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
RUN npm ci

COPY . .

WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
