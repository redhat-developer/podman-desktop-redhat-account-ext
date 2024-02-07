FROM node:17.7-alpine3.14 AS extension-builder
WORKDIR /
# cache packages in layer
COPY  . .

RUN ls -la

RUN yarn config set cache-folder /usr/local/share/.cache/yarn
RUN yarn config set network-timeout 120000
# install
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn yarn global add rollup
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn yarn install
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn yarn run build 

FROM scratch as podman-extension
LABEL org.opencontainers.image.title="Red Hat SSO Authentication Provider Extension for Podman Desktop" \
    org.opencontainers.image.description="Official Red Hat SSO Integration for Podman Desktop" \
    org.opencontainers.image.vendor="Red Hat Inc." \
    io.podman-desktop.api.version=">= 0.2.0"

COPY --from=extension-builder /dist /dist
COPY --from=extension-builder /package.json /package.json
