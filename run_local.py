"""Serve the static demo on this computer. Python 3, no extra dependencies."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Chay demo Thanh Lan tren may.")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    public_dir = Path(__file__).resolve().parent / "dist"
    if not (public_dir / "index.html").is_file():
        parser.error("Missing dist/index.html. Extract the complete ZIP first.")
    handler = partial(SimpleHTTPRequestHandler, directory=str(public_dir))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as exc:
        parser.exit(1, f"Cannot start server: {exc}\nTry a different --port.\n")
    print(f"Thanh Lan demo: http://localhost:{args.port}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
