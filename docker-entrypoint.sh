#!/bin/sh
set -e

# unraid convention (and LinuxServer.io-style images): run as nobody:users
# (99:100) by default, overridable with PUID/PGID. Bind mounts like
# /mnt/user/appdata arrive root-owned, so fix ownership before dropping root.
PUID="${PUID:-99}"
PGID="${PGID:-100}"
UMASK="${UMASK:-022}"

umask "$UMASK"

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown -R "$PUID:$PGID" /data
  # Next.js may write runtime cache under .next
  chown -R "$PUID:$PGID" /app/.next
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
fi

exec "$@"
