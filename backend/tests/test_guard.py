from app.llm.guard import allowed_values, check, extract

TOOL = '{"salary_sen": 61740, "salary_rm": 617.4, "p_safe": 0.953, "risk": "selamat", "buffer_rm": 1250}'


def test_made_up_amount_is_blocked():
    assert check("Gaji anda RM650 minggu ini.", allowed_values(TOOL)) == [650]


def test_rounded_tool_numbers_pass():
    allowed = allowed_values(TOOL)
    assert check("Selamat. Gaji anda RM617 minggu ini, 95% selamat.", allowed) == []
    assert check("Gaji anda RM617.40.", allowed) == []
    assert check("Penampan anda RM1,250.", allowed) == []


def test_bm_percent_and_words_are_normalised():
    allowed = allowed_values(TOOL)
    assert check("Kira-kira 95 peratus selamat.", allowed) == []
    assert check("Anda boleh belanja empat puluh ringgit.", allowed) == [40]
    assert check("Anda boleh belanja empat puluh ringgit.", allowed_values(TOOL, "kalau saya beli 40 ringgit")) == []


def test_numbers_from_the_riders_message_pass():
    allowed = allowed_values(TOOL, "Boleh tak saya beli telefon RM1.2k?")
    assert check("Telefon RM1,200 itu berisiko untuk anda.", allowed) == []


def test_small_counts_with_units_are_structural():
    allowed = allowed_values(TOOL)
    assert check("Ini 3 pilihan untuk anda dalam 2 minggu.", allowed) == []
    assert check("Simpan 3 ringgit.", allowed) == [3]  # money, even if small


def test_extract_reads_k_and_decimals():
    values = [v for v, _, _ in extract("RM1.5k, 12.50, 1,234 dan dua ratus lima puluh")]
    assert values == [1500, 12.5, 1234, 250]
