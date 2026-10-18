import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def build():
    engine_root = Path(__file__).resolve().parent
    entrypoint = engine_root / "src" / "markflow_engine" / "main.py"
    dist_root = engine_root / "dist"
    dist_dir = dist_root / "engine"
    pyi_out_dir = dist_root / "markflow-engine"
    build_dir = engine_root / "build"

    if not entrypoint.exists():
        print(f"[Error] Entrypoint not found: {entrypoint}", file=sys.stderr)
        sys.exit(1)

    print(f"[Build] Target entrypoint: {entrypoint}")
    print(f"[Build] Distribution directory: {dist_dir}")

    # Clean previous dist directories
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    if pyi_out_dir.exists():
        shutil.rmtree(pyi_out_dir)
    dist_root.mkdir(parents=True, exist_ok=True)

    is_win = platform.system() == "Windows"
    binary_name = "markflow-engine.exe" if is_win else "markflow-engine"

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=markflow-engine",
        "--onedir",
        "--clean",
        "--noconfirm",
        f"--distpath={dist_root}",
        f"--workpath={build_dir / 'work'}",
        f"--specpath={build_dir / 'spec'}",
        "--collect-all=markitdown",
        "--collect-all=markitdown_ocr",
        "--collect-all=magika",
        "--collect-all=markflow_engine",
        "--hidden-import=uvicorn",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=uvicorn.lifespan.off",
        "--hidden-import=fastapi",
        "--hidden-import=pypdf",
        "--hidden-import=readability",
        "--hidden-import=lxml",
        "--hidden-import=PIL",
        "--hidden-import=docx",
        "--hidden-import=pptx",
        "--hidden-import=openpyxl",
        "--hidden-import=xlrd",
        "--hidden-import=bs4",
        "--hidden-import=chardet",
        "--hidden-import=mammoth",
        "--hidden-import=pdfminer",
        str(entrypoint),
    ]

    env = os.environ.copy()
    env["PYINSTALLER_CONFIG_DIR"] = str(build_dir / "pyinstaller-cache")

    print(f"[Build] Executing command: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(engine_root), env=env)

    if result.returncode != 0:
        print("[Build] PyInstaller build failed!", file=sys.stderr)
        sys.exit(result.returncode)

    if pyi_out_dir.exists():
        shutil.move(str(pyi_out_dir), str(dist_dir))

    target_binary = dist_dir / binary_name
    if not target_binary.exists():
        print(f"[Build Error] Expected binary not found: {target_binary}", file=sys.stderr)
        sys.exit(1)

    size_mb = target_binary.stat().st_size / (1024 * 1024)
    print(f"[Build Success] Standalone sidecar binary generated: {target_binary} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    build()

