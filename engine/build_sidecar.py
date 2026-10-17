import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def build():
    engine_root = Path(__file__).resolve().parent
    entrypoint = engine_root / "src" / "markflow_engine" / "main.py"
    dist_dir = engine_root / "dist" / "engine"
    build_dir = engine_root / "build"

    if not entrypoint.exists():
        print(f"[Error] Entrypoint not found: {entrypoint}", file=sys.stderr)
        sys.exit(1)

    print(f"[Build] Target entrypoint: {entrypoint}")
    print(f"[Build] Distribution directory: {dist_dir}")

    # Ensure clean output directory
    dist_dir.mkdir(parents=True, exist_ok=True)

    is_win = platform.system() == "Windows"
    binary_name = "markflow-engine.exe" if is_win else "markflow-engine"

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=markflow-engine",
        "--onefile",
        "--clean",
        "--noconfirm",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir / 'work'}",
        f"--specpath={build_dir / 'spec'}",
        "--collect-all=markitdown",
        "--collect-all=markflow_engine",
        "--hidden-import=uvicorn",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.lifespans",
        "--hidden-import=uvicorn.lifespans.on",
        "--hidden-import=uvicorn.lifespans.off",
        "--hidden-import=fastapi",
        "--hidden-import=pypdf",
        "--hidden-import=readability",
        "--hidden-import=lxml",
        str(entrypoint),
    ]

    print(f"[Build] Executing command: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(engine_root))

    if result.returncode != 0:
        print("[Build] PyInstaller build failed!", file=sys.stderr)
        sys.exit(result.returncode)

    target_binary = dist_dir / binary_name
    if not target_binary.exists():
        print(f"[Build Error] Expected binary not found: {target_binary}", file=sys.stderr)
        sys.exit(1)

    size_mb = target_binary.stat().st_size / (1024 * 1024)
    print(f"[Build Success] Standalone sidecar binary generated: {target_binary} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    build()
