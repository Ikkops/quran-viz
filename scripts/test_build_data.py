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


def test_group_tafsir_dedups_passages():
    rows = [
        (19, 7, "19:7", "passage"),
        (19, 8, "19:7", "passage"),
        (19, 9, "19:7", "passage"),
        (19, 10, "19:10", "single"),
        (72, 11, "72:11", ""),  # empty note: dropped
        (72, 12, "72:12", " x "),
    ]
    assert bd.group_tafsir(rows) == {
        19: [[7, 9, "passage"], [10, 10, "single"]],
        72: [[12, 12, "x"]],
    }


def test_check_revelation_order_rejects_duplicates():
    import pytest
    good = {i: 115 - i for i in range(1, 115)}
    bd.check_revelation_order(good)
    bad = dict(good)
    bad[2] = bad[1]
    with pytest.raises(SystemExit):
        bd.check_revelation_order(bad)


def test_place_exceptions_file_is_consistent():
    key_to_id = {(s, a): i for i, (s, a) in enumerate(
        [(s, a) for s in range(1, 115) for a in range(1, 300)], 1)}
    surah_type = {s: "Meccan" for s in range(1, 115)}
    for s in (2, 3, 4, 5, 8, 9, 22, 24, 33, 47, 48, 49, 57, 58, 59, 60, 61, 62,
              63, 64, 65, 66, 76, 98, 99, 110, 13, 55):
        surah_type[s] = "Medinan"
    places = bd.load_place_exceptions(key_to_id, surah_type)
    assert key_to_id[(7, 163)] in places and places[key_to_id[(7, 163)]] == "Medinan"
    assert places[key_to_id[(2, 281)]] == "Meccan"
    assert places[key_to_id[(28, 85)]] == "Hijra"
    assert key_to_id[(22, 56)] not in places  # corrected: header says 52-55


def _chrono_fixture():
    import json
    data = json.loads(bd.CHRONOLOGY.read_text(encoding="utf-8"))
    medinan = {2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60,
               61, 62, 63, 64, 65, 66, 76, 98, 99, 110}
    surah_type = {s: "Medinan" if s in medinan else "Meccan" for s in range(1, 115)}
    key_to_id = {(s, a): s * 1000 + a for s in range(1, 115) for a in range(1, 300)}
    return data, surah_type, key_to_id


def test_chronology_file_is_consistent():
    data, surah_type, key_to_id = _chrono_fixture()
    # Treat every ayah as covered: the asbab-coverage rule is tested below.
    bd.check_chronology(data, surah_type, key_to_id, set(key_to_id.values()))
    assert data["surahs"]["8"]["period"] == "y2"
    assert data["surahs"]["2"]["span"] == [1, 10]


def test_chronology_rejects_bad_entries():
    import copy
    import pytest
    data, surah_type, key_to_id = _chrono_fixture()
    every = set(key_to_id.values())
    cases = []
    d = copy.deepcopy(data); del d["surahs"]["114"]; cases.append((d, every))
    d = copy.deepcopy(data); d["surahs"]["1"]["period"] = "x9"; cases.append((d, every))
    d = copy.deepcopy(data); d["surahs"]["96"]["event"] = 99; cases.append((d, every))
    d = copy.deepcopy(data); d["surahs"]["1"]["period"] = "y3"; cases.append((d, every))
    d = copy.deepcopy(data); d["surahs"]["8"]["refs"] = ["7:1"]; cases.append((d, every))
    cases.append((data, set()))  # basis 'asbab' refs not covered
    for d, covered in cases:
        with pytest.raises(SystemExit):
            bd.check_chronology(d, surah_type, key_to_id, covered)


def test_chronology_type_note_allows_phase_mismatch():
    import copy
    data, surah_type, key_to_id = _chrono_fixture()
    d = copy.deepcopy(data)
    d["surahs"]["1"].update(period="y3", typeNote="test")
    bd.check_chronology(d, surah_type, key_to_id, set(key_to_id.values()))
