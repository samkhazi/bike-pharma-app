#!/usr/bin/env bash
# The moved start on a server without a pm2 for the whole server (the first version installed its own), and with no pm2
# command working when the new setup runs: the setup must stop the old app by its process, and only that.
HIDE_PM2=1 exec bash "$(dirname "$0")/moved.sh"
