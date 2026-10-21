"""BM / Manglish rider vocabulary: number words and cost categories (architecture §6.6)."""

UNITS = {"kosong": 0, "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "enam": 6, "tujuh": 7, "lapan": 8,
         "sembilan": 9, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
         "nine": 9}
# "se-" words are complete numbers on their own.
WHOLE = {"sepuluh": 10, "sebelas": 11, "seratus": 100, "seribu": 1000, "ten": 10, "hundred": 100}
CURRENCY = {"rm", "ringgit", "hengget", "henggit", "inggit", "ringit", "rgt", "rm.", "myr"}
CENTS = {"sen", "cent", "cents"}

CATEGORIES = ("minyak", "servis", "ansuran", "makan", "telefon", "parking", "tol", "sewa", "keluarga",
              "motor_tahunan", "lain")

# Checked longest first, so "minyak hitam" (engine oil, a service) beats "minyak" (fuel).
PHRASES = {
    "minyak hitam": "servis", "minyak enjin": "servis", "tukar minyak": "servis", "road tax": "motor_tahunan",
    "cukai jalan": "motor_tahunan", "top up": "telefon", "duit rumah": "keluarga", "hantar duit": "keluarga",
    "kirim duit": "keluarga", "bayar motor": "ansuran", "loan motor": "ansuran", "isi minyak": "minyak",
    "bil fon": "telefon", "bil telefon": "telefon", "rumah sewa": "sewa", "duit mak": "keluarga",
}
WORDS = {
    "minyak": "minyak", "petrol": "minyak", "ron95": "minyak", "ron97": "minyak", "fuel": "minyak", "minyk": "minyak",
    "mnyk": "minyak", "pam": "minyak",
    "servis": "servis", "service": "servis", "svis": "servis", "tayar": "servis", "tyre": "servis", "tire": "servis",
    "brek": "servis", "brake": "servis", "rantai": "servis", "chain": "servis", "sparkplug": "servis",
    "bateri": "servis", "battery": "servis", "baiki": "servis", "repair": "servis", "bengkel": "servis",
    "workshop": "servis", "pancit": "servis", "puncture": "servis",
    "ansuran": "ansuran", "instalment": "ansuran", "installment": "ansuran", "ansurans": "ansuran",
    "makan": "makan", "minum": "makan", "nasi": "makan", "kopi": "makan", "teh": "makan", "roti": "makan",
    "mamak": "makan", "sarapan": "makan", "lunch": "makan", "dinner": "makan", "breakfast": "makan",
    "food": "makan", "makanan": "makan", "mkn": "makan", "air": "makan", "milo": "makan", "maggi": "makan",
    "topup": "telefon", "reload": "telefon", "prepaid": "telefon", "data": "telefon", "telefon": "telefon",
    "phone": "telefon", "fon": "telefon", "internet": "telefon",
    "parking": "parking", "parkir": "parking", "letak": "parking",
    "tol": "tol", "toll": "tol",
    "sewa": "sewa", "rent": "sewa", "bilik": "sewa",
    "mak": "keluarga", "ayah": "keluarga", "abah": "keluarga", "family": "keluarga", "keluarga": "keluarga",
    "kampung": "keluarga", "anak": "keluarga",
    "insurans": "motor_tahunan", "insurance": "motor_tahunan", "roadtax": "motor_tahunan",
}
