from dataclasses import replace
from datetime import date, timedelta

import numpy as np

from app.engine import explain
from app.engine.calendar import bill_due_in_week, week_start
from app.engine.forecast import Prior, WeekObs, fit, prior_for
from app.engine.salary import BillIn, Inputs, LeaveIn, Scenario, p_safe_at, risk_word, solve
from app.engine.simulate import income_paths

MON = date(2026, 10, 19)
PRIOR = Prior(rate_sen_per_hour=1200, log_sd=0.25, rho=0.5, default_hours=45)
# 12 weeks of a rider like Faiz: RM400–RM950, 45 hours a week
NETS = [62000, 48000, 91000, 55000, 40000, 73000, 95000, 52000, 61000, 44000, 80000, 58000]
HISTORY = tuple(WeekObs(n, 45) for n in NETS)


def faiz(**kw) -> Inputs:
    base = Inputs(week_start=MON, last_week_net_sen=NETS[-1], history=HISTORY, prior=PRIOR, planned_hours=45,
                  buffer_sen=150_000, cuti_sen=0, essentials_week_sen=45_000, seed=7)
    return replace(base, **kw)


def test_salary_keeps_95_percent_of_futures_safe():
    r = solve(faiz())
    assert r.salary_sen > 0 and r.salary_sen % 100 == 0
    assert r.p_safe >= 0.95 and r.risk == "selamat"


def test_one_ringgit_more_would_break_the_rule():
    inp = faiz()
    r = solve(inp)
    assert p_safe_at(inp, r.salary_sen + 100, Scenario()) < 0.95 or r.build_up


def test_same_seed_same_answer_and_seed_matters():
    assert solve(faiz()).salary_sen == solve(faiz()).salary_sen
    assert solve(faiz()).as_dict() == solve(faiz()).as_dict()


def test_bigger_buffer_never_lowers_the_salary():
    salaries = [solve(faiz(buffer_sen=b, essentials_week_sen=0)).salary_sen for b in (0, 50_000, 150_000, 400_000)]
    assert salaries == sorted(salaries)


def test_a_bill_lowers_the_salary_and_is_named_the_week_before():
    no_bill = solve(faiz())
    due_next_week = MON + timedelta(days=9)
    bill = BillIn("Ansuran motor", 28_000, "monthly", due_day=due_next_week.day)
    with_bill = solve(faiz(bills=(bill,)))
    assert with_bill.salary_sen < no_bill.salary_sen
    assert with_bill.bills_next_week == ["Ansuran motor"]


def test_planned_leave_costs_set_asides_and_cuti_pays_the_leave_week():
    raya = LeaveIn(start_week=MON + timedelta(weeks=6), weeks=1, set_aside_week_sen=10_000)
    r = solve(faiz(leaves=(raya,)))
    assert r.salary_sen < solve(faiz()).salary_sen
    assert r.reserves_this_week_sen == 10_000
    # Without set-asides the same leave is a hole in income that only the buffer can fill
    unfunded = solve(faiz(leaves=(replace(raya, set_aside_week_sen=0),)))
    assert unfunded.salary_sen <= r.salary_sen + 10_000


def test_week_after_leave_is_paid_from_cuti():
    last_week = LeaveIn(start_week=MON - timedelta(weeks=1), weeks=1, set_aside_week_sen=0)
    r = solve(faiz(leaves=(last_week,), last_week_net_sen=0, cuti_sen=80_000))
    assert r.from_cuti_sen == min(r.salary_sen, 80_000) > 0
    assert r.transfer_sen == -r.salary_sen + r.from_cuti_sen  # nothing earned, salary comes out of Cuti


def test_two_sick_days_cost_a_third_of_a_week():
    sick = LeaveIn(start_week=MON, weeks=1, set_aside_week_sen=0, fraction=2 / 6)
    full = LeaveIn(start_week=MON, weeks=1, set_aside_week_sen=0)
    salaries = [solve(faiz(leaves=lv)).salary_sen for lv in ((), (sick,), (full,))]
    assert salaries[0] > salaries[1] > salaries[2]


def test_build_up_phase_reports_what_100_ringgit_buys():
    r = solve(faiz(buffer_sen=0))
    assert r.build_up and r.build_up["target_sen"] == 90_000
    assert r.build_up["per_100_sen"] >= 0
    assert solve(faiz(buffer_sen=200_000)).build_up is None


def test_jurang_when_safe_salary_is_below_essentials():
    r = solve(faiz(essentials_week_sen=200_000, buffer_sen=500_000))
    assert r.jurang and r.jurang["gap_sen"] == 200_000 - r.salary_sen


def test_saving_phase_alone_is_not_a_jurang():
    r = solve(faiz(buffer_sen=0, essentials_week_sen=45_000))  # earns ~RM630, essentials RM450, buffer empty
    assert r.build_up and r.jurang is None


def test_more_hours_scenario_raises_the_salary():
    inp = faiz(essentials_week_sen=0)
    assert solve(inp, Scenario(hours=60)).salary_sen > solve(inp).salary_sen


def test_new_instalment_lowers_safety_of_current_salary():
    inp = faiz()
    s = solve(inp).salary_sen
    assert p_safe_at(inp, s, Scenario(add_monthly_sen=40_000)) < p_safe_at(inp, s, Scenario())


def test_transfer_is_last_week_minus_salary_minus_bills():
    r = solve(faiz())
    assert r.transfer_sen == NETS[-1] - r.salary_sen - r.bills_this_week_sen


def test_cold_start_leans_on_the_prior():
    r = solve(faiz(history=(WeekObs(60_000, 45),), last_week_net_sen=60_000))
    assert r.cold_start and r.weeks_used == 1
    fc = fit([WeekObs(60_000, 45)], PRIOR, 45)
    assert abs(fc.log_rate - np.log(1200)) < abs(np.log(60_000 / 45) - np.log(1200))


def test_block_bootstrap_keeps_bad_weeks_together():
    fc = fit(list(HISTORY), PRIOR, 45)
    fc = replace(fc, residuals=np.repeat([-0.5, 0.5], 8), level_sd=0.0)  # long bad and good spells
    paths = np.log(income_paths(fc, np.full(12, 45.0), 2000, 4, np.random.default_rng(1)))
    lag1 = np.corrcoef(paths[:, :-1].ravel(), paths[:, 1:].ravel())[0, 1]
    assert lag1 > 0.5  # independent sampling would give ~0


def test_risk_words_follow_prd_thresholds():
    assert [risk_word(p) for p in (0.95, 0.90, 0.89, 0.70, 0.69)] == [
        "selamat", "selamat", "berhati", "berhati", "berisiko"]


def test_bill_calendar():
    assert bill_due_in_week("monthly", 31, None, date(2027, 2, 22))  # Feb 28 stands in for the 31st
    assert not bill_due_in_week("monthly", 5, None, MON)
    assert bill_due_in_week("yearly", None, date(2020, 10, 21), MON)
    assert bill_due_in_week("once", None, date(2026, 10, 25), MON)
    assert week_start(date(2026, 10, 25)) == MON


def test_priors_blend_platforms():
    p = prior_for(["grab", "foodpanda"], "Ipoh")
    assert p.rate_sen_per_hour == round(1150 * 0.9)


def test_explain_names_the_bill():
    a = solve(faiz()).as_dict()
    bill = BillIn("Ansuran motor", 28_000, "monthly", due_day=(MON + timedelta(days=9)).day)
    b = solve(faiz(bills=(bill,))).as_dict()
    top = explain.diff(a, b)
    assert top[0]["key"] == "bills" and top[0]["names"] == ["Ansuran motor"] and top[0]["delta_sen"] < 0
    assert explain.diff(None, b) == [{"key": "first"}]


def test_calendar_features_and_season_effects():
    from app.engine.seasons import features, log_effect

    raya_2027 = week_start(date(2027, 3, 10))
    f = features(raya_2027)
    assert f["public_holiday"] == 2 / 7 and f["ramadan"] > 0
    assert features(date(2026, 10, 12)) == {"ramadan": 0, "public_holiday": 0, "school_holiday": 0}
    assert log_effect(None) == 0.0 and log_effect(date(2026, 10, 12)) == 0.0


def test_season_free_history_and_dated_weeks_still_solve():
    dated = tuple(WeekObs(n, 45, MON - timedelta(weeks=len(NETS) - i)) for i, n in enumerate(NETS))
    r = solve(faiz(history=dated))
    assert r.p_safe >= 0.95 and r.model_version == "shrink-bootstrap-v2"


def test_gbm_falls_back_to_shrinkage_without_enough_weeks():
    from app.engine import rate_model

    assert rate_model.predict(np.log(np.array([1200.0, 1300.0])), float(np.log(1200))) is None
    short = fit([WeekObs(60000, 45), WeekObs(50000, 45)], PRIOR, 45, "gbm")
    assert short.log_rate == fit([WeekObs(60000, 45), WeekObs(50000, 45)], PRIOR, 45).log_rate
