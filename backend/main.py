import logging
import logging.handlers
import os
import pathlib
import sys

# Apply torchaudio compatibility shims before any other imports
try:
    sys.path.insert(0, os.path.dirname(__file__))
    import rthooks.pyi_rth_torchaudio_compat
except Exception as e:
    print("Failed to load torchaudio compatibility shim:", e)


def _setup_logging() -> None:
    """Configure root logger: rotating file + stdout, with ISO timestamps."""
    db_path_env = os.environ.get("DATABASE_PATH")
    if db_path_env:
        log_dir = pathlib.Path(db_path_env).parent
    else:
        log_dir = pathlib.Path(os.environ.get("APPDATA", str(pathlib.Path.home()))) / "enhance-audio-pro"

    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "enhance_audio.log"

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    fh = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    fh.setFormatter(fmt)

    sh = logging.StreamHandler()
    sh.setFormatter(fmt)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(fh)
    root.addHandler(sh)

    # Reduce uvicorn noise in log file
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


_setup_logging()

import uvicorn
from fastapi import FastAPI
from routers import convert, enhance, health, manipulate, queue, separate, wizard

logger = logging.getLogger(__name__)

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)
app.include_router(enhance.router)
app.include_router(wizard.router)
app.include_router(separate.router)
app.include_router(convert.router)
app.include_router(manipulate.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    logger.info(f"Starting backend server on port {port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
