import importlib.metadata
import os
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from markflow_engine.converter import convert_document
from markflow_engine.similarity import analyze_recommendations

app = FastAPI(
    title="MarkFlow Engine",
    description="Python Sidecar Conversion Engine for MarkFlow",
    version="0.1.0",
)

# Optional security token passed from Electron main process
ENGINE_SECRET: Optional[str] = os.environ.get("MARKFLOW_ENGINE_SECRET", None)


@app.middleware("http")
async def verify_engine_secret_middleware(request: Request, call_next):
    # Allow health check without token
    if request.url.path == "/health":
        return await call_next(request)

    # If secret is configured, require valid X-Engine-Secret header
    if ENGINE_SECRET:
        req_secret = request.headers.get("X-Engine-Secret")
        if not req_secret or req_secret != ENGINE_SECRET:
            return JSONResponse(
                status_code=403,
                content={"status": "error", "message": "Unauthorized engine access (Invalid X-Engine-Secret)"},
            )

    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConvertRequest(BaseModel):
    file_path: str
    library_dir: Optional[str] = None
    profile: Optional[str] = "balanced"
    llm_config: Optional[dict] = None


class RecommendationRequest(BaseModel):
    text: str
    slug: Optional[str] = None
    candidates: List[Dict[str, Any]] = []
    top_k: Optional[int] = 5
    duplicate_threshold: Optional[float] = 0.90


def get_markitdown_version() -> str:
    try:
        import markitdown

        return getattr(markitdown, "__version__", None) or importlib.metadata.version("markitdown")
    except Exception:
        try:
            return importlib.metadata.version("markitdown")
        except Exception:
            return "unknown"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "markitdown_version": get_markitdown_version(),
    }


@app.post("/convert")
def convert(request: ConvertRequest):
    return convert_document(
        file_path=request.file_path,
        library_dir_str=request.library_dir,
        profile=request.profile or "balanced",
        llm_config_dict=request.llm_config,
    )


@app.post("/similarity/recommendations")
def recommendations(request: RecommendationRequest):
    return analyze_recommendations(
        target_text=request.text,
        target_slug=request.slug,
        candidates=request.candidates,
        top_k=request.top_k or 5,
        duplicate_threshold=request.duplicate_threshold or 0.90,
    )

