from datetime import timedelta

from test_core_loop import THIS_WEEK, demo, log_history, onboard

from app.config import settings


def setup(client, nets=None):
    demo(client)
    onboard(client)
    log_history(client, nets or [70000] * 12)


def test_leave_preview_then_plan_sets_aside_into_cuti(client):
    setup(client)
    before = client.get("/api/home").json()
    raya = {"label": "Cuti Raya", "startWeek": (THIS_WEEK + timedelta(weeks=5)).isoformat(), "weeks": 1}
    p = client.post("/api/leave/preview", json=raya).json()
    assert p["weeksUntil"] == 5 and p["setAsideWeekSen"] > 0 and p["setAsideWeekSen"] % 100 == 0
    assert p["salarySen"] < before["salary"]["salarySen"] and p["salaryDeltaSen"] < 0
    assert p["risk"] in ("selamat", "berhati", "berisiko")
    assert client.post("/api/leave", json=raya).status_code == 201
    after = client.get("/api/home").json()
    assert after["salary"]["salarySen"] == p["salarySen"]
    sick_reserve = before["transfer"]["allocation"].get("cuti", 0)
    assert after["transfer"]["allocation"]["cuti"] == sick_reserve + p["setAsideWeekSen"]
    leave_id = client.get("/api/leave").json()["leave"][0]["id"]
    client.delete(f"/api/leave/{leave_id}")
    assert client.get("/api/home").json()["salary"]["salarySen"] == before["salary"]["salarySen"]


def test_leave_must_be_planned_ahead(client):
    setup(client)
    now = {"startWeek": THIS_WEEK.isoformat(), "weeks": 1}
    assert client.post("/api/leave/preview", json=now).status_code == 422
    assert client.post("/api/leave/preview", json={**now, "weeks": 9}).status_code == 422


def test_sick_week_is_counted_and_freezes_the_streak(client):
    setup(client)
    assert client.post("/api/leave/sick", json={"days": 2}).status_code == 201
    status = client.get("/api/leave").json()["sick"]
    assert status == {"daysCovered": 3, "daysUsed": 2}
    s = client.get("/api/streak").json()
    assert s["frozenThisWeek"] and s["weeks"] == 12


def test_isaraan_match_is_capped_per_year(client, monkeypatch):
    setup(client)
    monkeypatch.setattr(settings, "isaraan_match_cap_sen", 50_000)
    r = client.post("/api/caruman/isaraan", json={"amountSen": 100_000}).json()
    assert r["matchSen"] == 20_000 and r["governmentClaimedSen"] == 20_000
    r = client.post("/api/caruman/isaraan", json={"amountSen": 200_000}).json()
    assert r["matchSen"] == 30_000  # only what's left of the RM500 cap
    r = client.post("/api/caruman/isaraan", json={"amountSen": 100_000}).json()
    assert r["matchSen"] == 0 and r["isaraan"]["matchYearSen"] == 50_000


def test_checkin_is_due_after_a_salary_week(client):
    setup(client)
    assert client.get("/api/home").json()["checkinDue"] is None  # salary is for this week, nothing to ask yet
    last_week = (THIS_WEEK - timedelta(weeks=1)).isoformat()
    from app.db import SessionLocal
    from app.models import Transfer
    with SessionLocal() as db:  # pretend last week had a salary too
        t = db.query(Transfer).one()
        db.add(Transfer(user_id=t.user_id, week_start=THIS_WEEK - timedelta(weeks=1), direction="in",
                        amount_sen=100, allocation={"penampan": 100}))
        db.commit()
    assert client.get("/api/home").json()["checkinDue"] == last_week
    client.post("/api/checkins", json={"weekStart": last_week, "answer": "ya"})
    assert client.get("/api/home").json()["checkinDue"] is None
    assert client.get("/api/streak").json()["gajiKept"] == 1


def test_streak_counts_back_and_survives_a_frozen_gap(client):
    demo(client)
    onboard(client)
    weeks = lambda ago: {"weekStart": (THIS_WEEK - timedelta(weeks=ago)).isoformat(),  # noqa: E731
                         "platforms": [{"platform": "grab", "grossSen": 60000}]}
    client.post("/api/weeks/confirm", json={"weeks": [weeks(a) for a in (1, 2, 4, 5, 6)]})
    assert client.get("/api/streak").json()["weeks"] == 2  # week 3 ago is missing
    client.post("/api/streak/freeze", json={"weekStart": (THIS_WEEK - timedelta(weeks=1)).isoformat()})
    from app.db import SessionLocal
    from app.models import StreakFreeze, User
    with SessionLocal() as db:  # an older freeze, e.g. last month's Raya
        uid = db.query(User).order_by(User.id.desc()).first().id
        db.add(StreakFreeze(user_id=uid, week_start=THIS_WEEK - timedelta(weeks=3)))
        db.commit()
    s = client.get("/api/streak").json()
    assert s["weeks"] == 5 and s["level"] == 1 and s["accents"] == ["lime", "aqua"]


def test_streak_at_risk_when_last_week_missing(client):
    demo(client)
    onboard(client)
    client.post("/api/weeks/confirm", json={"weeks": [
        {"weekStart": (THIS_WEEK - timedelta(weeks=a)).isoformat(), "platforms": [{"platform": "grab", "grossSen": 1}]}
        for a in (2, 3)]})
    s = client.get("/api/streak").json()
    assert s["weeks"] == 2 and s["atRisk"]


def test_manual_freezes_are_limited(client):
    setup(client)
    for ago in (0, 1):
        assert client.post("/api/streak/freeze", json={"weekStart": (THIS_WEEK - timedelta(weeks=ago)).isoformat()}
                           ).status_code == 201
    left = client.get("/api/streak").json()["freezesLeft"]
    if left == 0:  # both freezes fell in this quarter
        r = client.post("/api/streak/freeze", json={"weekStart": THIS_WEEK.isoformat()})
        assert r.status_code == 422 and r.json()["error"]["code"] == "no_freezes"


def test_badges_come_from_real_progress(client):
    setup(client, [90000] * 12)
    kinds = {b["kind"] for b in client.get("/api/streak").json()["badges"]}
    assert {"minggu_pertama", "konsisten_4", "konsisten_12"} <= kinds and "pindah_pertama" not in kinds
    t = client.get("/api/home").json()["transfer"]
    client.post(f"/api/transfers/{t['id']}/confirm", json={})
    kinds = {b["kind"] for b in client.get("/api/streak").json()["badges"]}
    assert "pindah_pertama" in kinds


def test_accent_must_be_unlocked(client):
    demo(client)
    onboard(client)
    r = client.patch("/api/me", json={"accent": "sky"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "accent_locked"
    assert client.patch("/api/me", json={"accent": "lime"}).status_code == 200
