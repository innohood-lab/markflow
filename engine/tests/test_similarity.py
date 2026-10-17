from fastapi.testclient import TestClient
from markflow_engine.api import app
from markflow_engine.similarity import (
    clean_markdown_text,
    extract_features,
    cosine_similarity,
    analyze_recommendations,
)

client = TestClient(app)


def test_clean_markdown_text():
    raw = """---
title: "Sample"
---
# Header 1
This is **bold** and `inline code` and [[AI Roadmap|인공지능 로드맵]].
```python
print("hello")
```
"""
    cleaned = clean_markdown_text(raw)
    assert "header 1" in cleaned
    assert "bold" in cleaned
    assert "인공지능 로드맵" in cleaned
    assert "print" not in cleaned  # Code block stripped


def test_cosine_similarity_identical_and_different():
    text1 = "인공지능 딥러닝 자연어처리 기술 연구"
    text2 = "인공지능 딥러닝 자연어처리 기술 연구"
    text3 = "완전히 무관한 주방 요리 레시피 김치찌개"

    f1 = extract_features(text1)
    f2 = extract_features(text2)
    f3 = extract_features(text3)

    sim_identical = cosine_similarity(f1, f2)
    sim_different = cosine_similarity(f1, f3)

    assert sim_identical >= 0.99
    assert sim_different < 0.2


def test_analyze_recommendations_duplicate_and_group():
    target = "머신러닝과 딥러닝 신경망 모델 학습 및 최적화 기법에 관한 연구 문서"

    candidates = [
        {
            "slug": "doc-exact",
            "title": "머신러닝 딥러닝 신경망 모델 학습 및 최적화 기법",
            "content": "머신러닝과 딥러닝 신경망 모델 학습 및 최적화 기법에 관한 연구 문서",
            "groups": ["연구/AI"],
            "tags": ["머신러닝", "딥러닝"],
        },
        {
            "slug": "doc-related",
            "title": "파이토치 딥러닝 튜토리얼",
            "content": "딥러닝 신경망 모델을 파이토치로 학습시키는 기초 예제",
            "groups": ["연구/AI"],
            "tags": ["파이토치"],
        },
        {
            "slug": "doc-unrelated",
            "title": "제주도 여행 일정 계획",
            "content": "비행기 예약 및 호텔 숙소 맛집 투어 목록",
            "groups": ["개인/여행"],
            "tags": ["여행"],
        },
    ]

    result = analyze_recommendations(
        target_text=target,
        target_slug="new-doc",
        candidates=candidates,
        top_k=3,
        duplicate_threshold=0.90,
    )

    # 1. Should flag duplicate because doc-exact is >= 90%
    assert result["is_duplicate"] is True
    assert result["duplicate_match"]["slug"] == "doc-exact"

    # 2. Should suggest group "연구/AI"
    assert result["suggested_group"] == "연구/AI"
    assert result["group_confidence"] >= 50.0

    # 3. Related documents should rank doc-exact and doc-related first, not travel
    related = result["related_documents"]
    assert len(related) >= 2
    assert related[0]["slug"] == "doc-exact"
    assert related[1]["slug"] == "doc-related"


def test_api_similarity_recommendations_endpoint():
    payload = {
        "text": "인공지능 모델 배포와 서빙 아키텍처",
        "slug": "deploy-doc",
        "candidates": [
            {
                "slug": "serving-doc",
                "title": "AI 모델 서빙 가이드",
                "content": "인공지능 모델 배포 및 서빙 아키텍처 구축",
                "groups": ["엔지니어링/인프라"],
                "tags": ["서빙", "인프라"],
            }
        ],
    }

    response = client.post("/similarity/recommendations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "suggested_group" in data
    assert data["suggested_group"] == "엔지니어링/인프라"
    assert len(data["related_documents"]) == 1
