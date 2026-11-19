FROM postgres:17.7-alpine AS builder
RUN apk add --no-cache build-base git \
 && git clone https://github.com/pgvector/pgvector.git /tmp/pgvector \
 && cd /tmp/pgvector \
 && git checkout f37c13f68b57d2c3472b2214fbcff699d6d34876 \
 && make OPTFLAGS="" with_llvm=no \
 && make install with_llvm=no
FROM postgres:17.7-alpine
COPY --from=builder /usr/local/lib/postgresql/vector.so /usr/local/lib/postgresql/vector.so
COPY --from=builder /usr/local/share/postgresql/extension/vector* /usr/local/share/postgresql/extension/
