FROM node:24-alpine AS client
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM golang:1.27-alpine AS server
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/*.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /jump .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates sqlite && addgroup -g 10001 jump && adduser -D -u 10001 -G jump jump && mkdir /data && chown jump:jump /data
COPY --from=server /jump /usr/local/bin/jump
COPY --from=client /app/dist /app/dist
USER jump
ENV STATIC_DIR=/app/dist DB_PATH=/data/jump.sqlite LISTEN_ADDR=:8080 PUBLIC_ORIGIN=https://jump.ost.wang
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -q -O - http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["jump"]
