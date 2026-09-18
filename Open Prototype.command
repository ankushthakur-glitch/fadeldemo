#!/bin/bash
# ===========================================================================
#  MediNova EHR prototype — double-click this file to view it (macOS / Linux).
#
#  Why a server is needed at all: the components are ES modules, and every
#  browser refuses to load those from a file:// page. Opened straight off the
#  disk, every screen still draws its static shell — the header, the empty
#  table, the tab strip — while none of the data arrives, because the modules
#  that fetch and render it never ran. The result reads as "the page is
#  broken and the data has vanished", which is exactly what it is.
#
#  The companion to "Open Prototype.cmd", which does the same job on Windows.
#  This one prefers python3, which ships with macOS, so the prototype opens on
#  a machine with no node and no npm install — the situation this file was
#  written for. If node happens to be there, http-server is used instead
#  because it sends no-cache headers and so survives an edit-and-refresh.
#
#  Close this window (or press Ctrl-C) to stop the server.
# ===========================================================================

cd "$(dirname "$0")" || exit 1

PORT=4173
URL="http://127.0.0.1:$PORT/"

echo "Starting the MediNova prototype..."
echo
echo "  Start here          $URL          (sign in, then the schedule)"
echo "  Component gallery   ${URL}gallery.html"
echo "  Patient portal      ${URL}patient/"
echo
echo "Keep this window open. Close it to stop the server."
echo

# Give the server a moment to bind before the browser opens.
( sleep 2; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null ) &

if command -v npx >/dev/null 2>&1; then
  exec npx --yes http-server . -p "$PORT" -c-1
elif command -v python3 >/dev/null 2>&1; then
  # Serve with caching switched OFF, which is what `http-server -c-1` does on
  # the Windows side. Plain `python3 -m http.server` answers a second request
  # with 304 Not Modified, so a browser that loaded this prototype earlier —
  # or loaded it once over file:// — keeps handing back the JavaScript it
  # already had, and an edit does not show up until a hard reload. A prototype
  # that has to be hard-reloaded to be believed is worse than no server.
  exec python3 -c '
import functools, http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, key, value):
        # Suppress the validators that let a browser ask "still fresh?" at all.
        if key.lower() in ("last-modified", "etag"):
            return
        super().send_header(key, value)

    def send_head(self):
        # A browser that cached this prototype before still sends the
        # conditional header, and the stock handler answers 304 off the file
        # mtime whatever the response headers said. Drop the question so every
        # answer is the file itself.
        if "If-Modified-Since" in self.headers:
            del self.headers["If-Modified-Since"]
        if "If-None-Match" in self.headers:
            del self.headers["If-None-Match"]
        return super().send_head()

http.server.test(HandlerClass=NoCache, port=int(sys.argv[1]), bind="127.0.0.1")
' "$PORT"
else
  echo "Neither node/npx nor python3 was found on this machine."
  echo "Install either one, or serve this folder with any static web server"
  echo "and open $URL"
  read -r -p "Press Return to close."
  exit 1
fi
