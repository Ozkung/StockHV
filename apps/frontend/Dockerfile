FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
RUN npm ci

COPY . .

WORKDIR /app/apps/frontend
# Rewrites are resolved at build time, so the backend URL must be known here.
ARG API_URL=http://backend:3001
ENV API_URL=$API_URL
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
