import os
import sys

# Apply torchaudio compatibility shims before any other imports
try:
    sys.path.insert(0, os.path.dirname(__file__))
    import rthooks.pyi_rth_torchaudio_compat
except Exception as e:
    print("Failed to load torchaudio compatibility shim:", e)

import uvicorn
from fastapi import FastAPI
from routers import convert, enhance, health, manipulate, queue, separate, wizard


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
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
