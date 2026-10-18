"""What moved the salary since last week (FR-ENG-6): the top 2 changes, as keys the app turns into a sentence."""


def diff(prev: dict | None, cur: dict) -> list[dict]:
    """prev and cur are Result.as_dict() plus salary_sen. Each factor's delta_sen is its push on the salary:
    negative pulls it down. The UI words it: "Turun RM30: ansuran motor minggu depan"."""
    if prev is None:
        return [{"key": "first"}]
    factors = [
        # More bills soon means less to spend now, so the sign flips.
        {"key": "bills", "delta_sen": prev["bills_4w_sen"] - cur["bills_4w_sen"], "names": cur["bills_next_week"]},
        {"key": "leave", "delta_sen": prev["set_aside_4w_sen"] - cur["set_aside_4w_sen"]},
        {"key": "buffer", "delta_sen": (cur["build_up"] or {}).get("buffer_sen", 0)
         - (prev["build_up"] or {}).get("buffer_sen", 0) if cur["build_up"] and prev["build_up"] else 0},
        {"key": "forecast", "delta_sen": cur["band"]["mid"] - prev["band"]["mid"]},
    ]
    moved = cur["salary_sen"] - prev["salary_sen"]
    same_way = [f for f in factors if f["delta_sen"] and (f["delta_sen"] > 0) == (moved > 0)]
    top = sorted(same_way, key=lambda f: -abs(f["delta_sen"]))[:2]
    return top or [{"key": "steady" if moved == 0 else "mixed"}]
