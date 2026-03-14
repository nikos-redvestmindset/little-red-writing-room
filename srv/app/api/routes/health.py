from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {"status": "ok", "service": "little-red-writing-room-api"}


@router.get("/health")
async def health():
    return {"status": "ok"}
