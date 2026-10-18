from datetime import timedelta

from app.engine.calendar import today_kl, week_start
from app.services.pots import allocate

THIS_WEEK = week_start(today_kl())
NETS = [62000, 48000, 91000, 55000, 40000, 73000, 95000, 52000, 61000, 44000, 80000, 58000]


def demo(client):
    assert client.post("/api/auth/demo").status_code == 204


def onboard(client):
    res = client.patch("/api/me", json={"platforms": ["grab", "foodpanda"], "city": "Ipoh", "defaultHours": 45,
                                        "essentialsWeekSen": 45000, "paydayWeekday": 0, "onboarded": True})
    assert res.status_code == 200, res.text
    return res.json()["user"]


def log_history(client, nets=NETS):
    weeks = [{"weekStart": (THIS_WEEK - timedelta(weeks=len(nets) - i)).isoformat(),
              "platforms": [{"platform": "grab", "grossSen": n, "hoursOnline": 45, "source": "history"}]}
             for i, n in enumerate(nets)]
    res = client.post("/api/weeks/confirm", json={"weeks": weeks})
    assert res.status_code == 200, res.text


def test_onboarding_saves_profile_and_consent(client):
    demo(client)
    user = onboard(client)
    assert user["onboarded"] and user["platforms"] == ["grab", "foodpanda"] and user["essentialsWeekSen"] == 45000
    res = client.post("/api/consents", json={"kind": "privacy", "version": "2026-10", "granted": True})
    assert res.json()["user"]["consents"]["privacy"] == {"granted": True, "version": "2026-10"}
    assert client.get("/api/auth/me").json()["user"]["onboarded"]


def test_home_is_empty_before_any_week(client):
    demo(client)
    onboard(client)
    home = client.get("/api/home").json()
    assert home["salary"] is None and home["needsSnap"] and home["weeksLogged"] == 0


def test_confirming_weeks_gives_a_salary_and_a_transfer(client):
    demo(client)
    onboard(client)
    log_history(client)
    home = client.get("/api/home").json()
    s = home["salary"]
    assert s["weekStart"] == THIS_WEEK.isoformat()
    assert s["salarySen"] > 0 and s["salarySen"] % 100 == 0 and s["risk"] == "selamat"
    assert s["buildUp"]["targetSen"] == 90000  # no buffer yet: 2 weeks of essentials
    assert not home["needsSnap"]
    t = home["transfer"]
    signed = t["amountSen"] if t["direction"] == "in" else -t["amountSen"]
    assert signed == NETS[-1] - s["salarySen"] - s["billsThisWeekSen"]


def test_dah_pindah_moves_the_buffer_and_partial_is_tracked(client):
    demo(client)
    onboard(client)
    log_history(client, [90000] * 6)  # steady good weeks: money goes in
    t = client.get("/api/home").json()["transfer"]
    assert t["direction"] == "in" and t["status"] == "pending"
    half = t["amountSen"] // 2
    res = client.post(f"/api/transfers/{t['id']}/confirm", json={"amountSen": half})
    assert res.json()["transfer"]["status"] == "partial"
    sick = t["allocation"]["cuti"]  # the sick-day reserve is filled first
    pots = {p["kind"]: p for p in client.get("/api/pots").json()["pots"]}
    assert pots["cuti"]["balanceSen"] == sick and pots["penampan"]["balanceSen"] == half - sick
    client.post(f"/api/transfers/{t['id']}/confirm", json={})  # then the rest: replaces, never double counts
    pots = {p["kind"]: p for p in client.get("/api/pots").json()["pots"]}
    assert pots["cuti"]["balanceSen"] == sick and pots["penampan"]["balanceSen"] == t["amountSen"] - sick


def test_a_bill_lowers_the_salary(client):
    demo(client)
    onboard(client)
    log_history(client)
    before = client.get("/api/home").json()["salary"]["salarySen"]
    due = (THIS_WEEK + timedelta(days=9)).day
    res = client.post("/api/bills", json={"name": "Ansuran motor", "amountSen": 28000, "frequency": "monthly",
                                          "dueDay": due})
    assert res.status_code == 201, res.text
    after = client.get("/api/home").json()["salary"]
    assert after["salarySen"] < before


def test_bad_input_is_refused(client):
    demo(client)
    bad_week = {"weeks": [{"weekStart": (THIS_WEEK + timedelta(days=1)).isoformat(),
                           "platforms": [{"platform": "grab", "grossSen": 100}]}]}
    assert client.post("/api/weeks/confirm", json=bad_week).status_code == 422
    future = {"weeks": [{"weekStart": (THIS_WEEK + timedelta(weeks=1)).isoformat(),
                         "platforms": [{"platform": "grab", "grossSen": 100}]}]}
    assert client.post("/api/weeks/confirm", json=future).status_code == 422
    negative = {"weeks": [{"weekStart": THIS_WEEK.isoformat(), "platforms": [{"platform": "grab", "grossSen": -5}]}]}
    assert client.post("/api/weeks/confirm", json=negative).status_code == 422
    assert client.post("/api/bills", json={"name": "x", "amountSen": 100, "frequency": "monthly"}).status_code == 422


def test_another_riders_data_is_404(client):
    demo(client)
    onboard(client)
    log_history(client)
    t_id = client.get("/api/home").json()["transfer"]["id"]
    bill_id = client.post("/api/bills", json={"name": "Telefon", "amountSen": 5000, "frequency": "monthly",
                                              "dueDay": 5}).json()["bill"]["id"]
    earning_id = client.get("/api/weeks").json()["weeks"][0]["platforms"][0]["id"]
    client.cookies.clear()
    demo(client)  # a different rider
    assert client.post(f"/api/transfers/{t_id}/confirm", json={}).status_code == 404
    assert client.delete(f"/api/bills/{bill_id}").status_code == 404
    assert client.delete(f"/api/earnings/{earning_id}").status_code == 404
    assert client.get("/api/weeks").json()["weeks"] == []


def test_allocation_fills_plans_first_and_always_adds_up():
    alloc = {"cuti": 10000, "isaraan": 5000, "penampan": 20000}
    assert allocate(alloc, 35000, 35000) == alloc
    assert allocate(alloc, 35000, 12000) == {"cuti": 10000, "isaraan": 2000}
    assert allocate(alloc, 35000, 50000) == {"cuti": 10000, "isaraan": 5000, "penampan": 35000}
    out = allocate({"cuti": -30000, "penampan": -10000}, -40000, -20000)
    assert out == {"cuti": -15000, "penampan": -5000} and sum(out.values()) == -20000


def test_jurang_options_are_simulated(client):
    demo(client)
    onboard(client)
    client.patch("/api/me", json={"essentialsWeekSen": 80000, "defaultHours": 35})  # costs above what's safe
    log_history(client, [50000] * 10)
    j = client.get("/api/jurang").json()
    assert j["active"] and j["gapSen"] == 80000 - j["salarySen"] > 0
    h = j["hours"]
    assert h["hours"] > h["plannedHours"] and h["salarySen"] >= j["salarySen"]
    assert h["fatigue"] == (h["hours"] > 60)
    if h["closesGap"]:
        assert h["salarySen"] >= 80000


def test_no_jurang_when_salary_covers_essentials(client):
    demo(client)
    onboard(client)
    log_history(client, [90000] * 10)
    assert client.get("/api/jurang").json() == {"active": False}
