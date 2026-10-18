import re
from datetime import timedelta

from test_core_loop import THIS_WEEK, demo, log_history, onboard


def test_penyata_locked_until_12_weeks(client):
    demo(client)
    onboard(client)
    log_history(client, [60000] * 8)
    status = client.get("/api/penyata").json()
    assert status == {"weeksLogged": 8, "unlockAt": 12, "unlocked": False, "summary": None}
    r = client.get("/api/penyata.pdf")
    assert r.status_code == 403 and "8/12" in r.json()["error"]["message_en"]
    assert client.post("/api/officer-links", json={"months": 3}).status_code == 403


def test_penyata_pdf_and_summary_label_every_figure(client):
    demo(client)
    onboard(client)
    log_history(client)
    s = client.get("/api/penyata").json()["summary"]
    assert s["weeks"] == 12 and s["source"] == "self" and all(m["source"] == "self" for m in s["monthly"])
    assert s["min_sen"] == 40000 and s["max_sen"] == 95000
    r = client.get("/api/penyata.pdf?months=3&lang=en")
    assert r.status_code == 200 and r.content[:5] == b"%PDF-" and len(r.content) > 2000


def test_officer_link_opens_without_login_and_can_be_revoked(client):
    demo(client)
    onboard(client)
    log_history(client)
    made = client.post("/api/officer-links", json={"months": 6}).json()
    path = made["path"]
    assert re.fullmatch(r"/o/[\w-]{22}", path)
    client.cookies.clear()  # an officer, not signed in
    page = client.get(path)
    assert page.status_code == 200 and "Penyata Pendapatan" in page.text and "bukan skor kredit" in page.text
    assert page.headers["x-robots-tag"].startswith("noindex")
    assert "Dilapor sendiri" in page.text
    demo(client)  # someone else can't revoke it
    assert client.delete(f"/api/officer-links/{made['link']['id']}").status_code == 404
    assert client.get("/o/not-a-real-token").status_code == 404


def test_revoked_link_is_410(client):
    demo(client)
    onboard(client)
    log_history(client)
    made = client.post("/api/officer-links", json={"months": 3}).json()
    client.delete(f"/api/officer-links/{made['link']['id']}")
    assert client.get(made["path"]).status_code == 410
    assert client.get("/api/officer-links").json()["links"][0]["revoked"]


def test_payslip_shows_the_week_and_the_payday_after(client):
    demo(client)
    onboard(client)
    log_history(client)
    last = (THIS_WEEK - timedelta(weeks=1)).isoformat()
    p = client.get(f"/api/payslip/{last}").json()
    assert p["netSen"] == 58000 and p["platforms"][0]["platform"] == "grab"
    assert p["salarySen"] > 0 and p["transfer"] is not None
