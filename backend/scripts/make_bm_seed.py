"""Writes data/bm_phrases_train.csv: a SYNTHETIC seed set so the classifier works before real phrases exist.

Every row is marked source=synthetic_seed. Replace or extend it with team-labelled real rider phrases from the
interviews (decisions.md E1/E4); the held-out test set (data/bm_phrases_test.csv) must be real phrases only.

    uv run --directory backend python scripts/make_bm_seed.py
"""

import csv
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "bm_phrases_train.csv"
rng = random.Random(20261019)

# Words beyond the rules lexicon on purpose: the classifier is only asked when the lexicon misses.
VOCAB = {
    "minyak": ["shell", "petronas", "caltex", "bhp", "petron", "isi tangki", "minyak penuh", "ron95", "isi petrol",
               "minyak motor", "pump minyak", "minyak moto", "isi full tank", "gas motor"],
    "servis": ["kedai motor", "clutch", "sproket", "absorber", "pad brek", "lampu depan", "cermin sisi",
               "tukar tayar belakang", "tampal tayar", "servis kecil", "servis besar", "minyak hitam", "plug",
               "cable minyak", "betulkan motor", "spare part"],
    "ansuran": ["bank motor", "aeon credit", "bayaran bulanan motor", "hutang motor", "loan moto", "ansuran bulan ni",
                "bayar ansuran", "instalment motor", "monthly motor"],
    "makan": ["nasi lemak", "char kuey teow", "roti canai", "teh tarik", "ayam goreng", "mcd", "kfc", "nasi campur",
              "mee goreng", "kedai makan", "makan tengahari", "air kotak", "bungkus nasi", "makan malam", "nescafe"],
    "telefon": ["celcom", "maxis", "digi", "umobile", "unifi", "hotlink", "xpax", "kredit fon", "bil maxis",
                "reload data", "topup prepaid", "pakej internet"],
    "parking": ["meter parking", "kupon parking", "parking mall", "parkir motor", "bayar parking"],
    "tol": ["plus", "lebuhraya", "smart tag", "tol duke", "tol karak", "bayar tol"],
    "sewa": ["bilik sewa", "sewa rumah", "flat", "sewa bulan", "rumah bujang", "sewa bilik"],
    "keluarga": ["duit belanja anak", "bagi mak", "kirim kampung", "isteri", "adik sekolah", "duit ayah",
                 "hantar duit mak", "nafkah"],
    "motor_tahunan": ["insurans motor", "renew roadtax", "cukai jalan", "takaful motor", "jpj", "renew insurans"],
    "lain": ["rokok", "baju", "ubat", "klinik", "saman", "dobi", "potong rambut", "sabun", "barang dapur", "kasut",
             "beg delivery", "jaket hujan", "helmet baru"],
}
NUMBER_WORDS = ["lima", "sepuluh", "dua puluh", "tiga puluh", "empat puluh", "lima puluh", "seratus",
                "seratus lima puluh", "dua ratus"]
SHAPES = ["{w} {n}", "{w} rm{n}", "rm{n} {w}", "{n} {w}", "{w} {n} hengget", "bayar {w} {n}", "{w} tadi {n}",
          "{w}", "{w} {nw}", "{w} {nw} ringgit", "semalam {w} {n}", "{w} rm {n}"]


def typo(s: str) -> str:
    """Riders type fast: drop a vowel now and then ("minyak" → "mnyak")."""
    if rng.random() < 0.25 and len(s) > 4:
        i = rng.choice([i for i, c in enumerate(s) if c in "aeiou"] or [0])
        return s[:i] + s[i + 1:]
    return s


def main() -> None:
    rows = []
    for cat, words in VOCAB.items():
        for _ in range(70):
            w = typo(rng.choice(words))
            text = rng.choice(SHAPES).format(w=w, n=rng.choice([3, 5, 8, 10, 12, 20, 35, 40, 50, 80, 120, 280]),
                                             nw=rng.choice(NUMBER_WORDS))
            rows.append({"text": text.lower() if rng.random() < 0.8 else text.upper(), "category": cat,
                         "source": "synthetic_seed"})
    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["text", "category", "source"])
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} synthetic seed phrases to {OUT}")


if __name__ == "__main__":
    main()
