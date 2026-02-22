"""Market-level information susceptibility / leak plausibility scoring."""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Any

import pandas as pd

YEAR_RE = re.compile(r"\b(20\d{2})\b")
PRICE_TARGET_RE = re.compile(r"\breach\s*\$?\d", flags=re.IGNORECASE)

DECISION_VERBS = (
    "nominate",
    "pardon",
    "acquire",
    "force",
    "charged",
    "indicted",
    "sentenced",
    "approve",
    "ban",
    "sign",
    "signed",
    "agreement",
    "deal",
    "strike",
    "attack",
    "invade",
    "release",
    "launched",
    "announced",
    "ruling",
    "verdict",
    "seen in public",
    "out as",
    "enter",
)
INSTITUTIONS = (
    "supreme court",
    "court",
    "doj",
    "sec",
    "fda",
    "ftc",
    "fed",
    "white house",
    "senate",
    "prosecutor",
    "department",
    "ministry",
    "idf",
    "military",
    "central bank",
    "regulator",
    "supreme leader",
    "border patrol",
)
LONG_HORIZON_POLITICS_TERMS = ("nomination", "primary", "election", "candidate", "democratic", "republican")
REGIME_TERMS = ("regime", "fall", "collapse", "civil war")
EMBARGO_CUES = ("sec", "fda", "court", "approval", "listing", "ruling")
PRICE_TARGET_TERMS = ("reach $", "price", "above $", "market cap")
FED_POLICY_TERMS = (
    "fed",
    "federal reserve",
    "rate cut",
    "rate cuts",
    "interest rate",
    "interest rates",
    "bps",
    "fomc",
    "federal open market committee",
    "fed chair",
    "chair of the fed",
)
AWARD_TERMS = ("best picture", "academy awards", "oscar")
GEO_ENTITY_TERMS = ("iran", "israel", "greenland", "denmark", "sloviansk")
GEO_EVENT_TERMS = (
    "ceasefire",
    "missile",
    "troops",
    "airstrike",
    "war",
    "invasion",
    "diplomatic",
    "peace deal",
    "nato",
)
EXECUTIVE_POLICY_TERMS = ("deport", "deportation", "immigration policy", "asylum", "border policy")

_PROFILE = os.getenv("ML_INSIDER_PLAUSIBILITY_PROFILE", "entity_aware").strip().lower() or "entity_aware"
if _PROFILE not in ("entity_aware", "generalized"):
    _PROFILE = "entity_aware"
_MAX_RULE_UPLIFT_ENV = os.getenv("ML_INSIDER_PLAUSIBILITY_MAX_RULE_UPLIFT", "").strip()
if _MAX_RULE_UPLIFT_ENV:
    try:
        _MAX_RULE_UPLIFT = max(0.0, float(_MAX_RULE_UPLIFT_ENV))
    except Exception:
        _MAX_RULE_UPLIFT = 0.35
else:
    _MAX_RULE_UPLIFT = 0.35 if _PROFILE == "entity_aware" else 0.25


def _clip01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


@lru_cache(maxsize=512)
def _term_regex(term: str) -> re.Pattern[str]:
    # Whole-term matching to avoid accidental substring hits (e.g., "ban" inside other words).
    escaped = re.escape(term.strip().lower())
    escaped = escaped.replace(r"\ ", r"\s+")
    pattern = r"(?<!\w)" + escaped + r"(?!\w)"
    return re.compile(pattern)


def _contains_term(text: str, term: str) -> bool:
    return _term_regex(term).search(text) is not None


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(_contains_term(text, term) for term in terms)


def _coerce_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        num = float(value)
        if pd.isna(num):
            return None
        return num
    except Exception:
        return None


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    return str(value).strip()


def _unique_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def get_plausibility_config() -> dict[str, float | str]:
    return {
        "profile": _PROFILE,
        "max_rule_uplift": float(_MAX_RULE_UPLIFT),
    }


def compute_leak_plausibility(
    title: str,
    description: str | None = None,
    category: str | None = None,
    time_to_resolution_hours: float | None = None,
    platform: str | None = None,
) -> tuple[float, str, list[str]]:
    """Return (score, bucket, reasons) for market information susceptibility."""
    title_text = _to_text(title)
    desc_text = _to_text(description)
    category_text = _to_text(category)
    _ = platform  # currently unused; kept for stable API.

    text = " ".join([title_text, desc_text, category_text]).lower()
    title_l = title_text.lower()
    reasons: list[str] = []

    # A) Horizon factor.
    ttr = _coerce_float(time_to_resolution_hours)
    if ttr is None:
        horizon_factor = 0.50
        reasons.append("missing_time_to_resolution")
    elif ttr > 720:
        horizon_factor = 0.10
    elif ttr > 168:
        horizon_factor = 0.30
    elif ttr > 72:
        horizon_factor = 0.60
    else:
        horizon_factor = 1.00

    # B) Institutional / embargo keyword factor.
    keyword_factor = 0.50
    decision_event = _contains_any(text, DECISION_VERBS)
    institution_event = _contains_any(text, INSTITUTIONS)
    fed_policy_event = _contains_any(text, FED_POLICY_TERMS)
    award_event = _contains_any(text, AWARD_TERMS)
    geo_event_terms = _contains_any(text, GEO_EVENT_TERMS)
    geo_entity_terms = _contains_any(text, GEO_ENTITY_TERMS)
    if _PROFILE == "generalized":
        geo_diplomacy_event = bool(geo_event_terms and (decision_event or institution_event))
    else:
        geo_diplomacy_event = bool(geo_event_terms or geo_entity_terms)
    executive_policy_event = _contains_any(text, EXECUTIVE_POLICY_TERMS)

    if decision_event:
        keyword_factor = max(keyword_factor, 0.80)
        reasons.append("decision_action_event")
    if institution_event:
        keyword_factor = max(keyword_factor, 0.80)
        reasons.append("institution_controlled")

    # C) Nonsense / long-horizon politics downweight.
    years = [int(m.group(1)) for m in YEAR_RE.finditer(text)]
    max_year = max(years) if years else None
    if max_year is not None and max_year >= 2027 and _contains_any(text, LONG_HORIZON_POLITICS_TERMS):
        keyword_factor = min(keyword_factor, 0.05)
        reasons.append("long_horizon_nomination_or_election")

    # D) Speculative price-target penalty, unless discrete catalyst exists.
    has_price_target = (
        PRICE_TARGET_RE.search(title_l) is not None
        or _contains_any(title_l, PRICE_TARGET_TERMS)
    )
    if has_price_target and not _contains_any(text, EMBARGO_CUES):
        keyword_factor = min(keyword_factor, 0.30)
        reasons.append("speculative_price_target")

    # E) Long-horizon regime/broad forecast penalty.
    if ttr is not None and ttr > 720 and _contains_any(text, REGIME_TERMS):
        keyword_factor = min(keyword_factor, 0.25)
        reasons.append("long_horizon_regime_forecast")

    base_plausibility = _clip01(horizon_factor * keyword_factor)
    plausibility_score = base_plausibility

    # Additional precision-first uplift for clearly discrete institutional events.
    if decision_event and institution_event and not has_price_target:
        if ttr is None:
            floor = 0.70
        elif ttr <= 720:
            floor = 0.80
        elif ttr <= 24 * 180:
            floor = 0.75
        elif ttr <= 24 * 365:
            floor = 0.70
        else:
            floor = 0.50
        if plausibility_score < floor:
            plausibility_score = floor
            reasons.append("discrete_institutional_event_floor")

    if decision_event and geo_diplomacy_event and not has_price_target:
        if _PROFILE == "generalized":
            if ttr is not None and ttr <= 24 * 120 and plausibility_score < 0.70:
                plausibility_score = 0.70
                reasons.append("geopolitical_decision_event_floor")
            elif ttr is not None and ttr <= 24 * 180 and plausibility_score < 0.65:
                plausibility_score = 0.65
                reasons.append("geopolitical_decision_event_floor")
        else:
            if ttr is not None and ttr <= 24 * 120 and plausibility_score < 0.85:
                plausibility_score = 0.85
                reasons.append("geopolitical_decision_event_floor")
            elif ttr is not None and ttr <= 24 * 180 and plausibility_score < 0.80:
                plausibility_score = 0.80
                reasons.append("geopolitical_decision_event_floor")

    if fed_policy_event and not has_price_target:
        if ttr is not None and ttr <= 24 * 120 and plausibility_score < 0.80:
            plausibility_score = 0.80
            reasons.append("fed_policy_event_floor")
        elif ttr is not None and ttr <= 24 * 365 and plausibility_score < 0.70:
            plausibility_score = 0.70
            reasons.append("fed_policy_event_floor")

    if award_event and not has_price_target:
        if ttr is not None and ttr <= 24 * 365 and plausibility_score < 0.70:
            plausibility_score = 0.70
            reasons.append("award_decision_event_floor")

    if executive_policy_event and not has_price_target:
        if _PROFILE == "generalized":
            if ttr is not None and ttr <= 24 * 730 and plausibility_score < 0.45:
                plausibility_score = 0.45
                reasons.append("executive_policy_event_floor")
            elif ttr is None and plausibility_score < 0.40:
                plausibility_score = 0.40
                reasons.append("executive_policy_event_floor")
        else:
            if ttr is not None and ttr <= 24 * 730 and plausibility_score < 0.54:
                plausibility_score = 0.54
                reasons.append("executive_policy_event_floor")
            elif ttr is None and plausibility_score < 0.50:
                plausibility_score = 0.50
                reasons.append("executive_policy_event_floor")

    # Bias guardrail: cap total uplift over base score so one rule set cannot dominate.
    uplift_cap = _clip01(base_plausibility + _MAX_RULE_UPLIFT)
    if plausibility_score > uplift_cap:
        plausibility_score = uplift_cap
        reasons.append("uplift_cap_applied")

    if plausibility_score < 0.20:
        bucket = "LOW"
    elif plausibility_score <= 0.60:
        bucket = "MED"
    else:
        bucket = "HIGH"
    return plausibility_score, bucket, _unique_preserve_order(reasons)


def add_leak_plausibility(df: pd.DataFrame) -> pd.DataFrame:
    if "market_title" not in df.columns:
        raise ValueError("market_title column missing. Please tell me which field should be used as title.")
    if df["market_title"].fillna("").astype(str).str.strip().eq("").all():
        raise ValueError("market_title is empty for all rows. Please tell me which title column to use.")

    out = df.copy()
    if "market_description" not in out.columns:
        out["market_description"] = ""
    if "market_category" not in out.columns:
        out["market_category"] = ""

    rows = zip(
        out["market_title"],
        out["market_description"],
        out["market_category"],
        out.get("time_to_resolution_hours", pd.Series([None] * len(out))),
        out.get("platform", pd.Series([None] * len(out))),
    )
    scored = [compute_leak_plausibility(t, d, c, h, p) for t, d, c, h, p in rows]
    out["info_susceptibility_score"] = [s for s, _, _ in scored]
    out["info_susceptibility_bucket"] = [b for _, b, _ in scored]
    out["info_susceptibility_reasons"] = [json.dumps(r) for _, _, r in scored]
    return out


def _smoke_test() -> None:
    print("Plausibility config:", json.dumps(get_plausibility_config()))
    examples = [
        # User-provided 11 examples:
        {
            "title": "Zhang Youxia seen in public by February 28?",
            "description": "State military announcement/visibility event.",
            "category": "geopolitics",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Khamenei out as Supreme Leader of Iran by February 28?",
            "description": "Leadership change announced by state ministry.",
            "category": "geopolitics",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Will the Iranian regime fall before 2027?",
            "description": "",
            "category": "geopolitics",
            "ttr": 24 * 500,
            "expect_max": 0.30,
        },
        {
            "title": "Will Trump pardon Ghislaine Maxwell by end of 2026?",
            "description": "Potential White House executive action.",
            "category": "politics",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Minneapolis Border Patrol shooter charged?",
            "description": "Prosecutor charging decision.",
            "category": "crime",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Israel strikes Iran by March 31, 2026?",
            "description": "Military operation decision.",
            "category": "geopolitics",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "GTA VI released before June 2026?",
            "description": "Corporate release timing and announcement.",
            "category": "entertainment",
            "ttr": 120,
            "expect_min": 0.40,
        },
        {
            "title": "Trump-Denmark Greenland deal signed by March 31?",
            "description": "Diplomatic agreement could be known before announcement.",
            "category": "politics",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Will Trump nominate Jerome Powell as the next Fed chair?",
            "description": "White House and Fed vetting process.",
            "category": "macro",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Will XRP reach $4.00 in February?",
            "description": "",
            "category": "crypto",
            "ttr": 48,
            "expect_max": 0.30,
        },
        {
            "title": "Will Trump nominate Michelle Bowman as the next Fed chair?",
            "description": "White House and Fed vetting process.",
            "category": "macro",
            "ttr": 48,
            "expect_min": 0.70,
        },
        {
            "title": "Will Trump deport 2,000,000 or more people?",
            "description": "Executive branch immigration policy target.",
            "category": "politics",
            "ttr": 24 * 365,
            "expect_min": 0.30 if _PROFILE == "generalized" else 0.39,
        },
        # Explicit long-horizon nomination/election check required by prompt:
        {
            "title": "Will someone win the 2028 Democratic nomination?",
            "description": "",
            "category": "politics",
            "ttr": 24 * 365,
            "expect_max": 0.10,
        },
    ]

    print("Leak plausibility smoke test")
    for ex in examples:
        score, bucket, reasons = compute_leak_plausibility(
            ex["title"],
            ex["description"],
            ex["category"],
            ex["ttr"],
            "polymarket",
        )
        print(f"- {ex['title']!r}: score={score:.3f}, bucket={bucket}, reasons={json.dumps(reasons)}")
        if "expect_min" in ex:
            assert score >= ex["expect_min"], f"Expected >= {ex['expect_min']}: {ex['title']}"
        if "expect_max" in ex:
            assert score <= ex["expect_max"], f"Expected <= {ex['expect_max']}: {ex['title']}"
    print("Smoke test passed")


if __name__ == "__main__":
    _smoke_test()
