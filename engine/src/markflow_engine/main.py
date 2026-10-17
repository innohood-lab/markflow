import argparse
import multiprocessing
import sys
import uvicorn

from markflow_engine.api import app


def main():
    multiprocessing.freeze_support()

    parser = argparse.ArgumentParser(description="MarkFlow Python Sidecar Conversion Engine")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind the server on (default: 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind on (default: 127.0.0.1)")

    args = parser.parse_args()

    # Always ensure binding is on 127.0.0.1 for local isolation
    host = "127.0.0.1" if args.host not in ("127.0.0.1", "localhost") else args.host

    print(f"[MarkFlow Engine] Starting standalone server on {host}:{args.port}...", flush=True)

    uvicorn.run(
        app,
        host=host,
        port=args.port,
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    main()
