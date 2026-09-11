#!/bin/sh
# Installs into .ddcore/bin/ddcore the ddcore pinned in .ddcore-version.
# Without .ddcore-version, installs the latest release and pins the project to it.
set -e

ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
VERSION_FILE="$ROOT/.ddcore-version"
BIN_DIR="$ROOT/.ddcore/bin"
BIN="$BIN_DIR/ddcore"
INSTALL_URL="https://raw.githubusercontent.com/jrvidotti/ddcore/main/install.sh"

command -v curl >/dev/null 2>&1 || {
	echo "Error: curl is required to download the ddcore installer." >&2
	exit 1
}

if [ -s "$VERSION_FILE" ]; then
	VERSION="$(tr -d ' \t\n\r' < "$VERSION_FILE")"
	PIN=0
	echo "==> version pinned in .ddcore-version: $VERSION"
else
	VERSION="latest"
	PIN=1
	echo "==> .ddcore-version missing: installing the latest release to pin it"
fi

# install.sh expects the release tag (vX.Y.Z); the file may omit the "v".
TAG="$VERSION"
case "$TAG" in latest | v*) ;; *) TAG="v$TAG" ;; esac

curl -fsSL "$INSTALL_URL" | env VERSION="$TAG" BIN_DIR="$BIN_DIR" sh

INSTALLED="$("$BIN" version | sed -n 's/.*ddcore v\{0,1\}\([0-9][^ ]*\).*/\1/p')"
if [ -z "$INSTALLED" ]; then
	echo "Error: could not read the version from '$BIN version'." >&2
	exit 1
fi

if [ "$PIN" -eq 1 ]; then
	printf '%s\n' "$INSTALLED" > "$VERSION_FILE"
	echo "==> version $INSTALLED pinned in .ddcore-version"
elif [ "$INSTALLED" != "${VERSION#v}" ]; then
	echo "Warning: .ddcore-version asks for $VERSION, but the installed binary is $INSTALLED." >&2
fi

echo "==> $BIN ($INSTALLED)"
echo "use: make DDCORE=$BIN <target>"
