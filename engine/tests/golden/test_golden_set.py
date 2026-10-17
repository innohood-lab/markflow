import json
from pathlib import Path
from fastapi.testclient import TestClient
from markflow_engine.api import app

client = TestClient(app)

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "samples"
EXPECTATIONS_FILE = Path(__file__).resolve().parent / "expectations.json"


def test_golden_set_regression(tmp_path):
    """
    Test converting golden set samples and verify they meet all quality expectations.
    """
    assert EXPECTATIONS_FILE.exists(), "expectations.json must exist"
    expectations = json.loads(EXPECTATIONS_FILE.read_text(encoding="utf-8"))

    library_dir = tmp_path / "GoldenLibrary"
    library_dir.mkdir(parents=True, exist_ok=True)

    for filename, criteria in expectations.items():
        sample_path = SAMPLES_DIR / filename
        assert sample_path.exists(), f"Sample file not found: {filename}"

        response = client.post(
            "/convert",
            json={
                "file_path": str(sample_path),
                "library_dir": str(library_dir),
                "profile": "balanced"
            }
        )
        assert response.status_code == 200, f"Conversion failed for {filename}"
        data = response.json()
        assert data["status"] == "success", f"Expected success for {filename}, got {data}"

        markdown = data["markdown"]
        score = data.get("quality_score", 0)

        # 1. Quality score assertion
        min_score = criteria.get("min_quality_score", 70)
        assert score >= min_score, f"Quality score for {filename} was {score}, expected >= {min_score}"

        # 2. Required phrases
        for phrase in criteria.get("required_phrases", []):
            assert phrase in markdown, f"Required phrase '{phrase}' missing from {filename} output"

        # 3. Minimum char count
        min_chars = criteria.get("min_char_count", 10)
        assert len(markdown) >= min_chars, f"Output too short for {filename}"

        # 4. Heading check
        if criteria.get("must_have_headings"):
            assert "#" in markdown, f"Expected headings in {filename}"

        # 5. Table check
        if criteria.get("must_have_tables"):
            assert "|" in markdown, f"Expected markdown table in {filename}"

        # 6. Must NOT contain
        for unwanted in criteria.get("must_not_contain", []):
            assert unwanted not in markdown, f"Unwanted text '{unwanted}' found in {filename}"
