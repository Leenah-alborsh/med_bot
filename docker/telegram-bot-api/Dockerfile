FROM debian:bookworm-slim AS build
ARG TELEGRAM_BOT_API_REF=e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git cmake g++ make gperf libssl-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/tdlib/telegram-bot-api.git /src \
    && cd /src && git checkout "$TELEGRAM_BOT_API_REF" \
    && git submodule update --init --recursive
RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /build --target telegram-bot-api -j2

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/telegram-bot-api /tmp/telegram-bot-api
COPY --from=build /build/telegram-bot-api/telegram-bot-api /usr/local/bin/telegram-bot-api
EXPOSE 8081
ENTRYPOINT ["telegram-bot-api"]
CMD ["--local", "--http-port=8081", "--http-ip-address=0.0.0.0", "--dir=/var/lib/telegram-bot-api", "--temp-dir=/tmp/telegram-bot-api"]
