import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple


def clean_markdown_text(text: str) -> str:
    """Strip YAML frontmatter and markdown syntax noise for clean similarity matching."""
    if not text:
        return ""
    # Strip frontmatter
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            text = parts[2]

    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", " ", text)
    # Remove inline code
    text = re.sub(r"`[^`]+`", " ", text)
    # Remove images and links [text](url) -> text
    text = re.sub(r"!\[.*?\]\(.*?\)", " ", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    # Remove wiki link brackets [[Target|Alias]] -> Target Alias
    text = re.sub(r"\[\[(.*?)(?:\|(.*?))?\]\]", r"\1 \2", text)
    # Remove markdown header tokens, bullet tokens, emphasis
    text = re.sub(r"[#*_~=\->+]", " ", text)
    # Normalize whitespaces
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def extract_features(text: str) -> Counter:
    """
    Extract word unigrams and character trigrams for robust cross-lingual (Korean + English)
    similarity matching.
    """
    cleaned = clean_markdown_text(text)
    if not cleaned:
        return Counter()

    features = Counter()

    # 1. Word tokens (Korean words + English words)
    words = re.findall(r"[\w가-힣]+", cleaned)
    for w in words:
        if len(w) >= 2:
            features[f"w:{w}"] += 1.5

    # 2. Character trigrams (handles morphology, partial matches and typos)
    # E.g. "인공지능" -> "인공지", "공지능"
    for i in range(len(cleaned) - 2):
        tri = cleaned[i : i + 3]
        if " " not in tri:
            features[f"c:{tri}"] += 1.0

    return features


def cosine_similarity(counter1: Counter, counter2: Counter) -> float:
    """Compute cosine similarity between two feature counters."""
    if not counter1 or not counter2:
        return 0.0

    intersection = set(counter1.keys()) & set(counter2.keys())
    if not intersection:
        return 0.0

    dot_product = sum(counter1[k] * counter2[k] for k in intersection)
    norm1 = math.sqrt(sum(v * v for v in counter1.values()))
    norm2 = math.sqrt(sum(v * v for v in counter2.values()))

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0

    return min(1.0, max(0.0, dot_product / (norm1 * norm2)))


def analyze_recommendations(
    target_text: str,
    target_slug: Optional[str],
    candidates: List[Dict[str, Any]],
    top_k: int = 5,
    duplicate_threshold: float = 0.90,
) -> Dict[str, Any]:
    """
    Analyzes target text against library candidates to produce:
    - Related documents ranking
    - Duplicate detection (similarity >= duplicate_threshold)
    - Suggested group (area/project) with confidence
    - Suggested tags
    """
    target_features = extract_features(target_text)
    if not target_features:
        return {
            "suggested_group": None,
            "group_confidence": 0.0,
            "suggested_tags": [],
            "is_duplicate": False,
            "duplicate_match": None,
            "related_documents": [],
        }

    scored_candidates: List[Tuple[float, Dict[str, Any]]] = []

    for cand in candidates:
        cand_slug = cand.get("slug")
        if target_slug and cand_slug == target_slug:
            continue  # Skip self

        cand_content = cand.get("content") or cand.get("title") or ""
        cand_features = extract_features(cand_content)
        sim = cosine_similarity(target_features, cand_features)

        if sim > 0.05:  # Only consider meaningful non-zero similarity
            scored_candidates.append((sim, cand))

    # Sort descending by similarity score
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    # 1. Duplicate Detection
    is_duplicate = False
    duplicate_match = None
    if scored_candidates and scored_candidates[0][0] >= duplicate_threshold:
        is_duplicate = True
        top_cand = scored_candidates[0][1]
        duplicate_match = {
            "slug": top_cand.get("slug"),
            "title": top_cand.get("title") or top_cand.get("slug"),
            "score": round(scored_candidates[0][0] * 100, 1),
        }

    # 2. Related Documents (Top K)
    related_docs = []
    for score, cand in scored_candidates[:top_k]:
        clean_cand = clean_markdown_text(cand.get("content") or "")
        snippet = clean_cand[:120] + "..." if len(clean_cand) > 120 else clean_cand
        related_docs.append(
            {
                "slug": cand.get("slug"),
                "title": cand.get("title") or cand.get("slug"),
                "score": round(score * 100, 1),
                "snippet": snippet,
                "groups": cand.get("groups") or [],
            }
        )

    # 3. Suggested Group & Tags using Weighted Voting
    group_votes: Dict[str, float] = {}
    tag_votes: Dict[str, float] = {}

    # Weight votes by similarity score for top 5 neighbors
    for score, cand in scored_candidates[:5]:
        groups = cand.get("groups") or []
        for g in groups:
            if g and g.strip():
                group_votes[g.strip()] = group_votes.get(g.strip(), 0.0) + score

        tags = cand.get("tags") or []
        for t in tags:
            if t and t.strip():
                tag_votes[t.strip()] = tag_votes.get(t.strip(), 0.0) + score

    suggested_group = None
    group_confidence = 0.0
    if group_votes:
        sorted_groups = sorted(group_votes.items(), key=lambda x: x[1], reverse=True)
        top_group, total_weight = sorted_groups[0]
        # Normalize confidence (0~100%)
        group_confidence = round(min(99.0, total_weight * 100), 1)
        if group_confidence >= 35.0:  # Only suggest if minimum confidence met
            suggested_group = top_group

    suggested_tags = []
    if tag_votes:
        sorted_tags = sorted(tag_votes.items(), key=lambda x: x[1], reverse=True)
        suggested_tags = [t[0] for t in sorted_tags[:4]]

    return {
        "suggested_group": suggested_group,
        "group_confidence": group_confidence,
        "suggested_tags": suggested_tags,
        "is_duplicate": is_duplicate,
        "duplicate_match": duplicate_match,
        "related_documents": related_docs,
    }
