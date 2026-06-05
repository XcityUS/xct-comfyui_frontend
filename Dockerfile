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

RUN pnpm build:cloud

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

ENV PORT=80
EXPOSE 80

CMD ["/docker-start.sh"]
