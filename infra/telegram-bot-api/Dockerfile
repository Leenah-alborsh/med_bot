FROM debian:bookworm-slim AS builder

ARG TELEGRAM_BOT_API_COMMIT=e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      cmake \
      g++ \
      git \
      gperf \
      make \
      libssl-dev \
      zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src/telegram-bot-api
RUN git init \
    && git remote add origin https://github.com/tdlib/telegram-bot-api.git \
    && git fetch --depth 1 origin "${TELEGRAM_BOT_API_COMMIT}" \
    && git checkout --detach FETCH_HEAD \
    && git submodule update --init --recursive --depth 1

RUN cmake -S . -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/opt/telegram-bot-api \
    && cmake --build build --target install --parallel 2

FROM debian:bookworm-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gosu libssl3 libstdc++6 zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 telegram-bot-api \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin telegram-bot-api \
    && mkdir -p /var/lib/telegram-bot-api/temp \
    && chown -R telegram-bot-api:telegram-bot-api /var/lib/telegram-bot-api

COPY --from=builder /opt/telegram-bot-api/bin/telegram-bot-api /usr/local/bin/telegram-bot-api
COPY entrypoint.sh /usr/local/bin/telegram-bot-api-entrypoint

RUN chmod +x /usr/local/bin/telegram-bot-api-entrypoint

EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/telegram-bot-api-entrypoint"]
