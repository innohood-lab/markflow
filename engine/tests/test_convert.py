import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from markflow_engine.api import app

client = TestClient(app)

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "samples"


def test_convert_samples_batch(tmp_path):
    """
    Test converting all sample documents in samples/ folder.
    Must have 0 crashes, non-empty outputs, and valid frontmatter.
    """
    library_dir = tmp_path / "TestLibrary"
    library_dir.mkdir(parents=True, exist_ok=True)

    sample_files = [
        f for f in SAMPLES_DIR.iterdir()
        if f.is_file() and f.name != "generate_samples.py"
    ]

    assert len(sample_files) >= 5, "Should have at least 5 sample files"

    supported_count = 0
    unsupported_count = 0

    for file_path in sample_files:
        response = client.post(
            "/convert",
            json={
                "file_path": str(file_path),
                "library_dir": str(library_dir)
            }
        )
        assert response.status_code == 200, f"Convert failed for {file_path.name}"
        data = response.json()

        if file_path.suffix.lower() == ".hwp":
            # Unsupported format test
            assert data["status"] == "unsupported"
            assert "지원하지 않는" in data["message"]
            unsupported_count += 1
        else:
            # Supported format test
            assert data["status"] == "success", f"Expected success for {file_path.name}, got {data}"
            assert len(data["markdown"]) > 0
            assert "title" in data
            assert data["source_file"] == file_path.name
            assert Path(data["library_path"]).exists()

            # Frontmatter checks
            content = data["markdown"]
            assert content.startswith("---")
            assert "title:" in content
            assert "source_file:" in content
            assert "source_type:" in content
            assert "converted_at:" in content
            assert "engine:" in content
            assert "status: \"미분류\"" in content
            supported_count += 1

    assert supported_count >= 8
    assert unsupported_count >= 1


def test_convert_duplicate_slug(tmp_path):
    """
    Ensure duplicate files get distinct names: <slug>.md, <slug>-2.md
    """
    library_dir = tmp_path / "DupLibrary"
    library_dir.mkdir(parents=True, exist_ok=True)

    memo_file = SAMPLES_DIR / "회의록_1017.txt"

    resp1 = client.post("/convert", json={"file_path": str(memo_file), "library_dir": str(library_dir)})
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "success"
    assert data1["slug"] == "회의록_1017"

    resp2 = client.post("/convert", json={"file_path": str(memo_file), "library_dir": str(library_dir)})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "success"
    assert data2["slug"] == "회의록_1017-2"

    assert Path(data1["library_path"]).exists()
    assert Path(data2["library_path"]).exists()
    assert data1["library_path"] != data2["library_path"]


def test_convert_nonexistent_file(tmp_path):
    response = client.post(
        "/convert",
        json={"file_path": "c:/not/real/path/does_not_exist.docx", "library_dir": str(tmp_path)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert "찾을 수 없습니다" in data["message"]
