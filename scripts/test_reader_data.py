"""Tests for scripts/reader_data.py (run with pytest from quran-viz/)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import reader_data as rd  # noqa: E402


def test_split_words_joins_marks():
    assert rd.split_words("ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى") == [
        "ذَٰلِكَ", "ٱلْكِتَٰبُ", "لَا", "رَيْبَ ۛ", "فِيهِ ۛ", "هُدًى",
    ]
    assert rd.split_words("۞ إِنَّ ٱللَّهَ") == ["۞ إِنَّ", "ٱللَّهَ"]


def test_qc_word_map_splits_badama():
    # quran.com counts بَعْدَ مَا as two words where the app has one.
    m = rd.qc_word_map("فَمَنۢ بَدَّلَهُۥ بَعْدَمَا سَمِعَهُۥ")
    assert m == [0, 1, 2, 3, 3, 4]


def test_place_notes_exact_and_shifted():
    placed, same = rd.place_notes("salat,<sup foot_note=7>1</sup> dan zakat", "salat, dan zakat")
    assert same and placed == [(6, "7")]
    # A small difference in wording still finds the spot.
    placed, same = rd.place_notes(
        "Kitab (Alquran)<sup foot_note=9>1</sup> ini", "Kitab (Al-Qur`an) ini"
    )
    assert not same and placed[0][1] == "9"
    assert "Kitab (Al-Qur`an)"[: placed[0][0]].endswith(")")


def test_build_layout_names_and_basmalas():
    verses = [
        {"id": 1, "s": 1, "a": 1, "ar": "أ ب"},
        {"id": 2, "s": 2, "a": 1, "ar": "ج د"},
    ]
    snap = {"pages": 2, "lines": 3, "starts": [[1, 2, 1, 1, 1], [2, 2, 2, 1, 1]]}
    lay = rd.build_layout(snap, verses, basmala={2})
    # The empty last line of page 1 and the first of page 2 are surah 2's
    # name and basmala: the walk back crosses the page break.
    assert lay["page"][0] == [["s", 1], [1, 1], ["s", 2]]
    assert lay["page"][1] == [["b"], [2, 1]]


def test_build_layout_one_line_and_no_line_headers():
    verses = [
        {"id": 1, "s": 1, "a": 1, "ar": "أ ب"},
        {"id": 2, "s": 2, "a": 1, "ar": "ج د"},
        {"id": 3, "s": 3, "a": 1, "ar": "ه و"},
    ]
    snap = {"pages": 1, "lines": 4, "starts": [[1, 1, 1, 1, 1], [1, 3, 2, 1, 1], [1, 4, 3, 1, 1]]}
    lay = rd.build_layout(snap, verses, basmala={2, 3})
    # Surah 1 has no room (a name line is added), surah 2 one line (name and
    # basmala together), surah 3 none either.
    assert lay["page"][0] == [["s", 1], [1, 1], ["sb", 2], [2, 1], ["sb", 3], [3, 1]]


def test_build_layout_splits_a_line_where_a_surah_starts():
    verses = [
        {"id": 1, "s": 1, "a": 1, "ar": "أ ب"},
        {"id": 2, "s": 2, "a": 1, "ar": "ج د"},
    ]
    # Surah 2 begins on the line that starts with surah 1.
    snap = {"pages": 1, "lines": 2, "starts": [[1, 2, 1, 1, 1]]}
    lay = rd.build_layout(snap, verses, basmala={2})
    assert lay["page"][0] == [["s", 1], [1, 1], ["sb", 2], [2, 1]]
