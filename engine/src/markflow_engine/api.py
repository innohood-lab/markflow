import importlib.metadata
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
