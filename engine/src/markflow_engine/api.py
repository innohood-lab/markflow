import importlib.metadata
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from markflow_engine.converter import convert_document

app = FastAPI(
    title="MarkFlow Engine",
    description="Python Sidecar Conversion Engine for MarkFlow",
    version="0.1.0",
)

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
