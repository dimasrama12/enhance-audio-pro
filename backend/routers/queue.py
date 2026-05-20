from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/queue")


@router.post("/process")
async def process_job() -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={"detail": "Audio processing available in Phase 2."},
    )
