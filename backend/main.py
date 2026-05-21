import os
import uvicorn
from fastapi import FastAPI
from routers import enhance, health, queue, wizard

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)
app.include_router(enhance.router)
app.include_router(wizard.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
