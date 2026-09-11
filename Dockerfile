# syntax=docker/dockerfile:1
# Dockerfile for the demo app (ddcore framework).
# Works on Railway and with a local Docker run.

FROM alpine:3.21 AS runner

# The framework version comes from .ddcore-version, committed alongside the
# code: a build on Railway does not depend on a platform environment variable,
# and the commit records which ddcore this app was written against.
# --build-arg DDCORE_VERSION=vX.Y.Z overrides it for a one-off test.
ARG DDCORE_VERSION=""

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# The pin alone, ahead of the rest of the code: the binary's layer is only
# invalidated when the version changes, not on every edit to the app.
COPY .ddcore-version ./

# The published binary already carries the desk, so there is nothing to build.
# The install runs in the final image because install.sh picks the archive from
# the `uname` of whoever runs it — that is what guarantees the downloaded binary
# matches the architecture that will run it. `ddcore version` confirms at build
# time that the file executes, and which version it is.
RUN apk add --no-cache --virtual .ddcore-download curl \
    && V="${DDCORE_VERSION:-$(tr -d ' \t\n\r' < .ddcore-version)}" \
    && case "$V" in latest | v*) ;; *) V="v$V" ;; esac \
    && curl -fsSL https://raw.githubusercontent.com/jrvidotti/ddcore/main/install.sh \
       | env VERSION="$V" BIN_DIR=/usr/local/bin sh \
    && apk del .ddcore-download \
    && ddcore version

# Application metadata and code
COPY . .

# Drop any leftovers from local development
RUN rm -rf node_modules .git

# Listening port (Railway sets $PORT on its own)
ENV PORT=8080
EXPOSE 8080

# Start the production server, applying DDL migrations and patches
CMD ["ddcore", "start", "--auto-migrate"]
