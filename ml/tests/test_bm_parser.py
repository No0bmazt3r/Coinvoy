import pytest

from app.nlp.bm_parser import lexicon_category, parse_amount, rules, words_to_number


@pytest.mark.parametrize(("words", "n"), [
    ("lima", 5), ("sepuluh", 10), ("sebelas", 11), ("dua belas", 12), ("empat puluh", 40), ("empat puluh lima", 45),
    ("seratus", 100), ("seratus lima puluh", 150), ("dua ratus lima puluh", 250), ("seribu", 1000),
    ("seribu dua ratus", 1200), ("dua ribu lima ratus", 2500), ("tiga ribu dua ratus empat puluh", 3240),
])
def test_bm_number_words(words, n):
    assert words_to_number(words.split()) == n


@pytest.mark.parametrize(("text", "sen"), [
    ("minyak 40", 4000), ("isi minyak rm40", 4000), ("RM 12.50 makan", 1250), ("40 hengget minyak", 4000),
    ("servis motor seratus", 10000), ("ansuran 280", 28000), ("tayar 1.5k", 150000),
    ("parking 3", 300),
    ("minyak empat puluh ringgit", 4000), ("makan dua belas ringgit lima puluh sen", 1250),
    ("roadtax 1,200", 120000), ("kopi 4,50", 450), ("40ringgit minyak", 4000), ("40 kopi", 4000),
    ("lima puluh sen tol", 50),
])
def test_amounts(text, sen):
    assert parse_amount(text) == sen


def test_no_amount():
    assert parse_amount("minyak") is None
    assert parse_amount("") is None


@pytest.mark.parametrize(("text", "cat"), [
    ("isi minyak 40", "minyak"), ("minyak hitam 35", "servis"), ("tukar minyak enjin", "servis"),
    ("ansuran motor 280", "ansuran"), ("bayar motor", "ansuran"), ("nasi lemak 5", "makan"), ("top up 30", "telefon"),
    ("tol 2.10", "tol"), ("hantar duit mak 200", "keluarga"), ("road tax 120", "motor_tahunan"),
    ("mnyk 20", "minyak"), ("svis 80", "servis"),
])
def test_categories(text, cat):
    assert lexicon_category(text) == cat


def test_rules_tier_needs_both():
    assert rules("minyak 40").tier == "rules"
    assert rules("benda tu 40").tier == "none" and rules("benda tu 40").amount_sen == 4000


def test_classifier_catches_what_the_lexicon_misses():
    from app.nlp.bm_parser import parse
    p = parse("shell 30", threshold=0.5)
    assert p.tier == "classifier" and p.category == "minyak" and p.amount_sen == 3000
    p = parse("hotlink 10", threshold=0.5)
    assert p.category == "telefon"


def test_llm_only_fills_what_is_missing():
    from app.nlp.bm_parser import parse
    calls = []

    def llm(text):
        calls.append(text)
        return 99999, "lain"

    p = parse("zxqv 40", threshold=1.01, llm=llm)  # nothing the rules or model are sure of
    assert p.tier == "llm" and p.amount_sen == 4000 and p.category == "lain"  # the parsed 40 wins over 99999
    assert parse("minyak 40", threshold=1.01, llm=llm).tier == "rules" and len(calls) == 1

