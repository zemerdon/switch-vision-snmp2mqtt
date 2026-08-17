FROM node:lts-alpine3.22@sha256:191c9f0080fcbbc6547a85dc0ff7988072214a355aabdc1d2ec55a7dae5eea8a AS base
FROM base AS builder

WORKDIR /app

COPY package.json /app
COPY tsconfig.json /app
COPY yarn.lock /app
COPY src /app/src
COPY tests /app/tests

RUN yarn install --frozen-lockfile
RUN yarn build
RUN node tests/config-schema-test.js
RUN node tests/config-semantics-test.js
RUN node tests/snmp-version-test.js
RUN node tests/transform-test.js
RUN node tests/interface-resolution-test.js
RUN node tests/snmp-runtime-test.js
RUN node tests/mqtt-runtime-test.js
RUN node tests/test_shutdown_signals.js

RUN mv /app/node_modules /app/node_modules_dev
RUN yarn install --frozen-lockfile --production

FROM base
STOPSIGNAL SIGINT
WORKDIR /app

# Add Label
LABEL \
  description="Expose SNMP sensors to MQTT" \
  maintainer="Andrew J.Swan" \
  org.opencontainers.image.title=snmp2mqtt \
  org.opencontainers.image.description="Expose SNMP sensors to MQTT"

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json

CMD [ "node", "/app/dist/index.js" ]
