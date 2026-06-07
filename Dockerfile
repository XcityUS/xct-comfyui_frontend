FROM node:25-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.3.0

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/

COPY . .

RUN pnpm install --frozen-lockfile

ENV DISTRIBUTION=cloud
ENV GENERATE_SOURCEMAP=false
ENV ENABLE_MINIFY=true

# Vite bakes import.meta.env.VITE_* at build time. Railway supplies a matching
# build arg for each service variable, so declare them and promote to ENV so
# `pnpm build:cloud` sees them in process.env.
ARG VITE_XCITY_APP
ARG VITE_XCITY_HOME_URL
ENV VITE_XCITY_APP=$VITE_XCITY_APP
ENV VITE_XCITY_HOME_URL=$VITE_XCITY_HOME_URL

RUN pnpm build:cloud

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

ENV PORT=80
EXPOSE 80

CMD ["/docker-start.sh"]
