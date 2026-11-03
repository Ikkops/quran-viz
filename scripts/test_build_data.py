"""Tests for the pure helper functions in build_data.

Run:  python3 -m pytest scripts/test_build_data.py
"""
import sys
from pathlib import Path

# Make build_data.py importable without invoking its main().
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402


def test_count_words():
    assert bd.count_words("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ") == 4
    assert bd.count_words("") == 0
    assert bd.count_words("one two three") == 3


def test_count_letters_strips_diacritics():
    # "بسم" = 3 letters; diacritics ignored.
    assert bd.count_letters("بِسْمِ") == 3
    # Al-Fatiha 1:1 basmala = 19 letters (documented sanity check).
    assert bd.count_letters("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ") == 19


def test_bw_to_arabic():
    assert bd.bw_to_arabic("ktb") == "كتب"
    assert bd.bw_to_arabic("Allh") == "الله"
    # unknown chars pass through unchanged
    assert bd.bw_to_arabic("r1b") == "ر1ب"


def test_bare_normalises_alef_variants():
    assert bd._bare("ٱللَّهِ") == "الله"
    assert bd._bare("أَنْ إِنَّ") == "ان ان"
    # tatweel removed
    assert bd._bare("الـرَّحْمَٰن") == "الرحمن"


def test_strip_leading_basmala_removes_it():
    text = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ٱلرَّ ۚ ذَٰلِكَ ٱلْكِتَٰبُ"
    stripped = bd.strip_leading_basmala(text)
    assert stripped != text
    assert not stripped.startswith("بِسْمِ")


def test_strip_leading_basmala_leaves_non_basmala_unchanged():
    text = "الٓمٓ ۚ ذَٰلِكَ ٱلْكِتَٰبُ"
    assert bd.strip_leading_basmala(text) == text


def test_tajweed_tag_pattern_mirrors_client():
    # The Python TAJWEED_TAG strips markup; the client TAG parses it. Both
    # must agree on the `[code:n[...]` shape. This guards the cross-reference.
    import re

    sample = "بِسْمِ [h:1[ٱ]للَّهِ [n[ـٰ]نِ"
    stripped = bd.TAJWEED_TAG.sub("", sample)
    assert "[" not in stripped and "]" not in stripped


def test_parse_verse_mapping():
    assert bd.parse_verse_mapping('{"1":"1-7","2":"1-5"}') == [(1, 1, 7), (2, 1, 5)]
    # single-ayah ranges have no dash
    assert bd.parse_verse_mapping('{"108":"3"}') == [(108, 3, 3)]


def test_clean_footnotes_strips_residue_only():
    assert bd.clean_footnotes("Segala puji30993>1 bagi Allah, Tuhan3 semesta alam.") == (
        "Segala puji bagi Allah, Tuhan semesta alam."
    )
    assert bd.clean_footnotes("naik kepada-Nya(656) dalam") == "naik kepada-Nya dalam"
    assert bd.clean_footnotes("* Dan (malaikat-malaikat) yang") == "Dan (malaikat-malaikat) yang"
    # parenthesised words are kept
    assert bd.clean_footnotes("kemudian (urusan) itu") == "kemudian (urusan) itu"


def test_pair_wbw_drops_pause_marks_and_ayah_number():
    pairs = bd.pair_wbw("لَا رَيْبَ ۛ فِيهِ", ["tidak ada", "keraguan", "didalamnya", "(2)"])
    assert pairs == [["لَا", "tidak ada"], ["رَيْبَ", "keraguan"], ["فِيهِ", "didalamnya"]]


def test_pair_wbw_joins_surplus_arabic_into_last_word():
    pairs = bd.pair_wbw("سَلَٰمٌ عَلَىٰٓ إِلْ يَاسِينَ", ["kesejahteraan", "atas", "Ilyas"])
    assert pairs[-1] == ["إِلْ يَاسِينَ", "Ilyas"]
