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


def test_collapse_runs_groups_repeated_notes_within_a_surah():
    texts = ["a", "b", "b", "b", "c", "c", "d"]
    # surah 1 = a b b b, surah 2 = c c d
    assert bd.collapse_runs(texts, [4, 3]) == {
        1: [[1, 1, "a"], [2, 4, "b"]],
        2: [[1, 2, "c"], [3, 3, "d"]],
    }
    # the same note ending one surah and opening the next stays two passages
    assert bd.collapse_runs(["x", "x"], [1, 1]) == {1: [[1, 1, "x"]], 2: [[1, 1, "x"]]}
    # non-adjacent repeats are separate passages
    assert bd.collapse_runs(["x", "y", "x"], [3]) == {
        1: [[1, 1, "x"], [2, 2, "y"], [3, 3, "x"]]}
    import pytest
    with pytest.raises(ValueError):
        bd.collapse_runs(["x"], [2])


def test_clean_scraped_strips_crawl_residue():
    css = ("Normal\n 0\n\n\n false\n /* Style Definitions */\n table.MsoNormalTable\n"
           "\t{mso-style-name:\"Table Normal\";\n\tmso-bidi-theme-font:minor-bidi;}\n\n\n"
           "Apa yang dijelaskan di atas.")
    assert bd.clean_scraped(css) == "Apa yang dijelaskan di atas."
    after = "jalan keluar.\n\n\n  " + css.split("\n\n\nApa")[0]
    assert bd.clean_scraped(after) == "jalan keluar."
    assert bd.clean_scraped("mengingin\\ kan kematian") == "menginginkan kematian"
    assert bd.clean_scraped("Al-Qur\\'an, bertanya, \\\\\"Apa") == "Al-Qur'an, bertanya, \"Apa"
    assert bd.clean_scraped("yang terbaik.”[]") == "yang terbaik.”"
    assert bd.clean_scraped("Surah a€li Imra\xa0n/3: 134") == "Surah Ali 'Imran/3: 134"
    assert bd.clean_scraped("kaum 'a€d, kaum Å\xa0amud,") == "kaum 'Ad, kaum Šamud,"
    assert bd.clean_scraped("bagimu ¦\" (al-A'raf/7: 59) ila'ï€ª)") == "bagimu …\" (al-A'raf/7: 59) ila')"
    assert bd.clean_scraped("Lauá¸¥ Maá¸¥fudh, Surah Ä€li 'Imran") == "Lauḥ Maḥfudh, Surah Āli 'Imran"
    assert bd.clean_scraped("disebut 'Ä€d al-Â¸la") == "disebut 'Ād al-Ula"
    assert bd.clean_scraped("Hà Mìm. Café – ok") == "Hà Mìm. Café – ok"
    assert bd.clean_scraped("Surah Luqma\xa0n/31: 13, ar-Rahma\xa0n") == "Surah Luqman/31: 13, ar-Rahman"
    assert bd.clean_scraped("di\xa0alam  semesta\n\n\n\nlagi") == "di alam semesta\n\nlagi"
    # clean text is left alone
    clean = "Pada ayat ini, Allah menyuruh.\n\nMaha Esa (Yasin/36 : 82)"
    assert bd.clean_scraped(clean) == clean


def test_surah_names_id_file_is_valid(tmp_path):
    import pytest
    names = bd.load_surah_names_id(bd.SURAH_NAMES_ID)
    assert len(names) == 114
    assert names[0] == "Al-Fatihah" and names[2] == "Ali 'Imran" and names[113] == "An-Nas"
    bad = tmp_path / "names.json"
    for data in (names[:113], names[:113] + [""], names[:113] + [names[0]], {"1": "x"}):
        bad.write_text(__import__("json").dumps(data), encoding="utf-8")
        with pytest.raises(SystemExit):
            bd.load_surah_names_id(bad)


def test_tafsir_snapshots_are_complete():
    for name in bd.LOCAL_TAFSIRS:
        texts = bd.load_snapshot(name)
        assert len(texts) == 6236
        assert all(bd.clean_scraped(t) for t in texts)


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


def test_dagger_alif_replaces_wavy_hamza_alef():
    assert bd.dagger_alif("ذَٲلِكَ") == "ذَٰلِكَ"
    assert bd.dagger_alif("ٱلصَّلَوٲةَ") == "ٱلصَّلَوٰةَ"
    assert bd.dagger_alif("أَإِ") == "أَإِ"  # other hamza seats untouched


def test_fix_uthmani_marks_drops_non_iqlab_small_meem():
    assert bd.fix_uthmani_marks("هُدًۭى لِّلْمُتَّقِينَ") == "هُدًى لِّلْمُتَّقِينَ"
    assert bd.fix_uthmani_marks("مَثَلًۭا مَّا") == "مَثَلًا مَّا"
    # iqlab (next letter ب), also across a pause mark or into the next ayah
    assert bd.fix_uthmani_marks("أَلِيمٌۢ بِمَا") == "أَلِيمٌۢ بِمَا"
    assert bd.fix_uthmani_marks("عَلِيمٌۢ ۚ بِ") == "عَلِيمٌۢ ۚ بِ"
    assert bd.fix_uthmani_marks("عَلِيمٌۢ", "بِسْمِ") == "عَلِيمٌۢ"
    assert bd.fix_uthmani_marks("عَلِيمٌۢ", "وَ") == "عَلِيمٌ"
    # nun + small meem is always iqlab
    assert bd.fix_uthmani_marks("مِنۢ بَعْدِ") == "مِنۢ بَعْدِ"


def test_fix_uthmani_marks_joins_mid_word_small_yeh():
    assert bd.fix_uthmani_marks("إِبْرَٰهِۦمَ") == "إِبْرَٰهِـۧمَ"
    assert bd.fix_uthmani_marks("ٱلنَّبِيِّۦنَ") == "ٱلنَّبِيِّـۧنَ"
    # word-final small yeh stays (nothing to join)
    assert bd.fix_uthmani_marks("بِهِۦ وَ") == "بِهِۦ وَ"


def test_flatten_tajweed():
    ok = "بِسْمِ [h:1[ٱ]للَّهِ"
    assert bd.flatten_tajweed(ok) == ok
    assert bd.flatten_tajweed("تَعْتَد[o[ُوٓ[s[اْ]\u200cۚ] إِ") == (
        "تَعْتَد[o[ُوٓ][s[اْ][o[\u200cۚ] إِ")
    assert bd.flatten_tajweed("ٱفْتَرَ[ٮٰ]هُ") == "ٱفْتَرَٮٰهُ"
    assert bd.flatten_tajweed("[u:2334[[g[مّ]ٍ ل]") == "[g[مّ][u:2334[ٍ ل]"


# --- Topic tree (scripts/topics.py) -----------------------------------------
import pytest  # noqa: E402
import topics as tp  # noqa: E402


def _t(i, name, ayahs=(), **kw):
    return tp.RawTopic(id=i, name=name, ayahs=frozenset(ayahs), **kw)


def test_cluster_topics_merges_duplicates_by_arabic_name_and_plural():
    raw = [
        _t(20, "Musa", [(2, 51)], ar="موسى", ontology=True),
        _t(967, "Moses", [(2, 51), (20, 9)], ar="موسى", thematic=True),
        _t(1608, "Moosa", [(7, 104)], ar="موسى"),
        _t(140, "Dog", [(18, 18)]),
        _t(602, "Dogs", [(7, 176)]),
    ]
    cl = tp.cluster_topics(raw)
    assert sorted(cl) == [20, 140]
    assert cl[20].name == "Moses"  # the thematic spelling wins
    assert cl[20].ayahs == {(2, 51), (20, 9), (7, 104)}
    assert cl[140].members == [140, 602]


def test_cluster_topics_keeps_same_named_subentries_apart():
    raw = [
        _t(1, "Hud", [(11, 50)]),
        _t(2, "Salih", [(11, 61)]),
        _t(3, "with his people", [(11, 52)], tparent=1),
        _t(4, "with his people", [(11, 62)], tparent=2),
    ]
    cl = tp.cluster_topics(raw)
    assert cl[3].parent == 1 and cl[4].parent == 2


def test_cluster_topics_keeps_empty_headings_of_subentries():
    raw = [_t(832, "Day", [(1, 4)]), _t(837, "earth", parent=832),
           _t(840, "riven asunder", [(99, 1)], parent=837)]
    cl = tp.cluster_topics(raw)
    assert cl[840].parent == 837 and cl[837].parent == 832
    assert not cl[837].ayahs


def test_build_tree_places_flattens_and_names():
    raw = [
        _t(1883, "Stories"),
        _t(2284, "Prophets", tparent=1883),
        _t(20, "Moses", [(2, 51)], tparent=2284),
        _t(2334, "childhood", [(28, 7)], tparent=20),
        _t(1038, "Prayer", [(2, 3)]),
    ]
    cl = tp.cluster_topics(raw)
    tax = [{"k": "sejarah", "en": "Stories", "id": "Kisah", "t": [2284]},
           {"k": "ibadah", "en": "Worship", "id": "Ibadah", "t": [1038]}]
    names = {20: "Musa", 2334: "Masa kecil"}
    nodes = tp.build_tree(cl, tax, names, flatten=[2284, 1038],
                          names_en={2334: "Childhood"})
    keys = [n["k"] for n in nodes]
    assert keys == ["sejarah", "t20", "t2334", "ibadah"]
    assert nodes[1]["p"] == 0 and nodes[2]["p"] == 1
    assert nodes[2]["en"] == "Childhood" and nodes[2]["id"] == "Masa kecil"
    # The flattened Prayer cluster hands its ayahs to its category.
    assert nodes[3]["v"] == [(2, 3)]


def test_build_tree_rejects_unplaced_and_unnamed_topics():
    cl = tp.cluster_topics([_t(1, "Orphan", [(1, 1)]), _t(2, "Placed", [(1, 2)])])
    tax = [{"k": "a", "en": "A", "id": "A", "t": [2]}]
    with pytest.raises(tp.TaxonomyError, match="reach no category"):
        tp.build_tree(cl, tax, {1: "x", 2: "y"})
    tax[0]["t"] = [1, 2]
    with pytest.raises(tp.TaxonomyError, match="lack an Indonesian name"):
        tp.build_tree(cl, tax, {2: "y"})
    with pytest.raises(tp.TaxonomyError, match="placed twice"):
        tp.build_tree(cl, [{"k": "a", "en": "A", "id": "A", "t": [1, 2]},
                           {"k": "b", "en": "B", "id": "B", "t": [2]}], {1: "x", 2: "y"})


def test_load_topic_names(tmp_path):
    f = tmp_path / "names.tsv"
    f.write_text("# comment\n20\tMusa\tMoses\n1038\tSalat\n1380\tFatwa\t\tالفتوى\n",
                 encoding="utf-8")
    assert bd.load_topic_names(f) == (
        {20: "Musa", 1038: "Salat", 1380: "Fatwa"}, {20: "Moses"}, {1380: "الفتوى"})


def test_adjust_verses_fixes_mistags():
    cl = tp.cluster_topics([_t(953, "molten copper", [(34, 2)])])
    tp.adjust_verses(cl, {"remove": {"953": ["34:2"]}, "add": {"953": ["34:12"]}})
    assert cl[953].ayahs == {(34, 12)}
    with pytest.raises(tp.TaxonomyError, match="has no"):
        tp.adjust_verses(cl, {"remove": {"953": ["1:1"]}})


def test_split_carves_a_new_topic_or_moves_into_one():
    cl = tp.cluster_topics([_t(1864, "Wisdom", [(2, 32), (2, 269), (76, 30)]),
                            _t(5, "Names of Allah", [(1, 1)])])
    tp.split_clusters(cl, [
        {"from": 1864, "id": 9001, "en": "All-Wise", "ar": "الحكيم", "under": 5,
         "verses": ["2:32"]},
        {"from": 1864, "to": 5, "verses": ["76:30"]},
    ])
    assert cl[1864].ayahs == {(2, 269)}
    assert cl[9001].ayahs == {(2, 32)} and cl[9001].parent == 5
    assert cl[5].ayahs == {(1, 1), (76, 30)}
    tree = tp.build_tree(cl, [{"k": "aqidah", "en": "Creed", "id": "Akidah",
                               "t": [5, 1864]}],
                         {5: "Asmaul Husna", 1864: "Hikmah", 9001: "Al-Hakim"})
    assert [n["k"] for n in tree] == ["aqidah", "t5", "t9001", "t1864"]
    with pytest.raises(tp.TaxonomyError, match="has no"):
        tp.split_clusters(cl, [{"from": 1864, "to": 5, "verses": ["2:32"]}])
    with pytest.raises(tp.TaxonomyError, match="fresh number"):
        tp.split_clusters(cl, [{"from": 1864, "id": 7, "en": "x", "verses": ["2:269"]}])


@pytest.mark.skipif(not bd.QUL_DB.exists(), reason="needs reference/quran-refs/qul.db")
def test_curated_topic_tree_builds_from_qul():
    import sqlite3
    qul = sqlite3.connect(f"file:{bd.QUL_DB}?mode=ro", uri=True)
    nodes = bd.build_topic_tree(qul)
    tops = [n for n in nodes if n["p"] == -1]
    assert len(tops) == 11
    assert all(n["id"].strip() and n["en"].strip() for n in nodes)
    assert all(n["p"] < i for i, n in enumerate(nodes))
    # Moses / Musa / Moosa are one topic under Kisah Para Nabi.
    moses = [n for n in nodes if n["en"] == "Moses"]
    assert len(moses) == 1 and nodes[moses[0]["p"]]["k"] == "sejarah.nabi"
    # Split topics: the name al-Hakim leaves "Wisdom"; 2:269 stays.
    by_k = {n["k"]: n for n in nodes}
    hakim, wisdom = by_k["t9001"], by_k["t1864"]
    assert nodes[hakim["p"]]["k"] == "t1268"
    assert (2, 32) in hakim["v"] and (2, 32) not in wisdom["v"]
    assert (2, 269) in wisdom["v"]
