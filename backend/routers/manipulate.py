import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


class ExportVolumeRequest(BaseModel):
    input_path: str
    output_path: str
    db_gain: float


@router.post("/export_volume")
async def export_volume(req: ExportVolumeRequest) -> JSONResponse:
    from processors.manipulate_audio import volume_audio
    try:
        def _dummy_cb(pct: int) -> None:
            pass
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: volume_audio(req.input_path, req.output_path, req.db_gain, _dummy_cb))
        return JSONResponse(status_code=200, content={"success": True})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
