"""Topic clustering and the curated topic tree (Topic explorer).

QUL's `topics` table merges three sources: a thematic tree, the Quranic Arabic
Corpus ontology, and a flat English index whose sub-entries ("of Moses",
"valley of") hang off their heading through `parent_id`. The same concept
therefore appears several times (Moses / Musa / Moosa; Prayer / Salat / Namaz).

`cluster_topics` folds those duplicates together; `build_tree` hangs every
cluster on the curated taxonomy (`data/topic_taxonomy.json`) and names it in
Indonesian (`data/topic_names_id.json`). Both are pure so the ETL test can
exercise them without the database.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class RawTopic:
    id: int
    name: str
    ar: str = ""
    desc: str = ""
    parent: int | None = None       # index heading (`parent_id`)
    tparent: int | None = None      # thematic parent
    oparent: int | None = None      # ontology parent
    thematic: bool = False
    ontology: bool = False
    ayahs: frozenset = frozenset()  # (surah, ayah) pairs


@dataclass
class Cluster:
    key: int                         # smallest QUL topic id in the cluster
    members: list[int]
    name: str                        # best English name
    ar: str
    desc: str
    ayahs: frozenset
    parent: int | None = None        # key of the cluster it hangs under, if any
    fragment: bool = False           # an index sub-entry ("of Moses")
    children: list[int] = field(default_factory=list)


def clean_name(name: str) -> str:
    """Collapse the tabs/newlines QUL leaves inside some index entries."""
    return re.sub(r"\s+", " ", name or "").strip()


def name_key(name: str) -> str:
    """Case-, article-, parenthesis- and plural-insensitive key, so roots
    "Dogs" / "Dog" and "Bees" / "bees (insects)" meet."""
    n = re.sub(r"\(.*?\)", "", clean_name(name).lower()).strip()
    n = re.sub(r"^(the|al)[ -]", "", n)
    if n.endswith("ies") and len(n) > 4:
        n = n[:-3] + "y"
    elif n.endswith("s") and not n.endswith("ss") and len(n) > 3:
        n = n[:-1]
    return n


def _name_rank(t: RawTopic) -> tuple:
    # Prefer the curated thematic/ontology spelling ("Moses" over "Moosa"),
    # then names that are not all-lowercase index phrases, then shorter.
    n = clean_name(t.name)
    return (not t.thematic, not t.ontology, n[:1].islower(), len(n), t.id)


def cluster_topics(raw: list[RawTopic], aliases: list[list[int]] = ()) -> dict[int, Cluster]:
    """Merge duplicate topics. Headings (topics without an index parent) merge
    when they tag the identical ayah set or share an Arabic name; roots also
    merge on an English name ignoring case. Everything else merges only with
    siblings, so "of soul" under Resurrection never swallows an unrelated
    "of soul" elsewhere. `aliases` adds hand-picked merges."""
    by_id = {t.id: t for t in raw if t.ayahs}
    # Ancestors that tag no ayah themselves ("Contract Law", "earth" under
    # "Judgment day", the ontology's "Astronomical Body") are kept as empty
    # clusters, so "riven asunder" still reads under its heading. Unused ones
    # are pruned by build_tree.
    all_ids = {t.id: t for t in raw}
    stack = list(by_id.values())
    while stack:
        t = stack.pop()
        for p in (t.parent, t.tparent, t.oparent):
            if p and p in all_ids and p not in by_id:
                by_id[p] = all_ids[p]
                stack.append(all_ids[p])
    up = {i: i for i in by_id}

    def find(x: int) -> int:
        while up[x] != x:
            up[x] = up[up[x]]
            x = up[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            up[max(ra, rb)] = min(ra, rb)

    def merge_groups(key_fn) -> None:
        groups: dict = {}
        for t in by_id.values():
            k = key_fn(t)
            if k is not None:
                groups.setdefault(k, []).append(t.id)
        for ids in groups.values():
            for i in ids[1:]:
                union(ids[0], i)

    def heading(t: RawTopic) -> bool:
        """Not an index sub-entry."""
        return not t.parent or t.parent not in by_id

    def up_link(t: RawTopic) -> int | None:
        return next((p for p in (t.parent, t.tparent, t.oparent) if p in by_id), None)

    def root(t: RawTopic) -> bool:
        return up_link(t) is None

    # Concepts merge globally: same ayah set (a single shared ayah only for
    # roots, so two one-ayah story beats don't fuse) and same Arabic name.
    merge_groups(lambda t: ("set", t.ayahs) if heading(t) and t.ayahs and
                 (len(t.ayahs) > 1 or root(t)) else None)
    merge_groups(lambda t: ("ar", t.ar.strip()) if heading(t) and t.ar.strip() else None)
    # English names merge globally only between roots; elsewhere only between
    # siblings, so "with his people" under Hud and under Salih stay apart.
    merge_groups(lambda t: ("en", name_key(t.name)) if root(t) else None)
    merge_groups(lambda t: None if root(t) else
                 ("sen", find(up_link(t)), clean_name(t.name).lower()))
    merge_groups(lambda t: None if heading(t) or not t.ayahs else
                 ("sset", find(t.parent), t.ayahs))
    for group in aliases:
        present = [i for i in group if i in by_id]
        for i in present[1:]:
            union(present[0], i)

    members: dict[int, list[int]] = {}
    for i in sorted(by_id):
        members.setdefault(find(i), []).append(i)

    clusters: dict[int, Cluster] = {}
    for key, ids in members.items():
        ts = [by_id[i] for i in ids]
        best = min(ts, key=_name_rank)
        ar = next((t.ar.strip() for t in sorted(ts, key=_name_rank) if t.ar.strip()), "")
        desc = next((t.desc.strip() for t in sorted(ts, key=_name_rank) if t.desc and t.desc.strip()), "")
        clusters[key] = Cluster(
            key=key, members=ids, name=clean_name(best.name), ar=ar, desc=desc,
            ayahs=frozenset().union(*(t.ayahs for t in ts)),
            fragment=all(not heading(t) for t in ts))

    # Natural parent: the first member link (index, thematic, ontology) that
    # lands in another cluster.
    for c in clusters.values():
        for i in c.members:
            t = by_id[i]
            for p in (t.parent, t.tparent, t.oparent):
                if p in by_id and find(p) != c.key:
                    c.parent = find(p)
                    break
            if c.parent is not None:
                break
    # Break cycles (A under B under A) by cutting the link at the larger key.
    for c in clusters.values():
        seen, cur = set(), c.key
        while cur is not None and cur not in seen:
            seen.add(cur)
            cur = clusters[cur].parent
        if cur is not None:
            loop, x = [], cur
            while True:
                loop.append(x)
                x = clusters[x].parent
                if x == cur:
                    break
            clusters[max(loop)].parent = None
    return clusters


class TaxonomyError(ValueError):
    pass


def adjust_verses(clusters: dict[int, Cluster], fixes: dict) -> None:
    """Correct QUL mis-tags in place: fixes = {"remove": {QUL id: ["s:a", ...]},
    "add": {...}}. Used where a topic's ayah is off by one or is a false word
    match (لَهُوَ "indeed He" tagged as لهو "diversion")."""
    of = {m: c.key for c in clusters.values() for m in c.members}
    for op in ("remove", "add"):
        for tid, refs in fixes.get(op, {}).items():
            key = of.get(int(tid))
            if key is None:
                raise TaxonomyError(f"verses.{op}: QUL topic {tid} is not in any cluster")
            pairs = set()
            for ref in refs:
                s, _, a = ref.partition(":")
                pairs.add((int(s), int(a)))
            c = clusters[key]
            if op == "remove":
                missing = pairs - c.ayahs
                if missing:
                    raise TaxonomyError(f"verses.remove: topic {tid} has no {sorted(missing)}")
                c.ayahs = c.ayahs - pairs
            else:
                c.ayahs = c.ayahs | pairs


def split_clusters(clusters: dict[int, Cluster], splits: list[dict]) -> None:
    """Carve verses out of a topic that mixes meanings, in place.

    Each split is {"from": QUL id, "verses": ["s:a", ...]} plus either
    "to": QUL id (move them into that existing topic) or "id": a new id above
    every QUL id with "en" (and optional "ar", "under": QUL id of the cluster
    it hangs under). A new topic is placed and named like any QUL topic: via a
    category's "t" or "under", and a line in the names file."""
    def of() -> dict[int, int]:
        return {m: c.key for c in clusters.values() for m in c.members}

    top = max((m for c in clusters.values() for m in c.members), default=0)
    for sp in splits:
        o = of()
        src = o.get(sp.get("from"))
        if src is None:
            raise TaxonomyError(f"split: QUL topic {sp.get('from')} is not in any cluster")
        pairs = set()
        for ref in sp.get("verses", []):
            s, _, a = ref.partition(":")
            pairs.add((int(s), int(a)))
        if not pairs:
            raise TaxonomyError(f"split from {sp['from']}: no verses")
        missing = pairs - clusters[src].ayahs
        if missing:
            raise TaxonomyError(f"split from {sp['from']}: topic has no {sorted(missing)}")
        clusters[src].ayahs = clusters[src].ayahs - pairs
        if "to" in sp:
            dst = o.get(sp["to"])
            if dst is None:
                raise TaxonomyError(f"split to {sp['to']}: not in any cluster")
            clusters[dst].ayahs = clusters[dst].ayahs | pairs
            continue
        new = sp.get("id")
        if not isinstance(new, int) or new <= top or new in o:
            raise TaxonomyError(f"split from {sp['from']}: new id {new!r} must be a "
                                f"fresh number above {top}")
        if not sp.get("en"):
            raise TaxonomyError(f"split {new}: needs an English name")
        parent = None
        if "under" in sp:
            parent = o.get(sp["under"])
            if parent is None:
                raise TaxonomyError(f"split {new}: under {sp['under']} is not in any cluster")
        clusters[new] = Cluster(new, [new], sp["en"], sp.get("ar", ""), "",
                                frozenset(pairs), parent)


def build_tree(clusters: dict[int, Cluster], taxonomy: list[dict],
               names_id: dict[int, str], flatten: list[int] = (),
               names_en: dict[int, str] | None = None,
               names_ar: dict[int, str] | None = None) -> list[dict]:
    """Return the flat node list for topics.json, parents before children.

    taxonomy — nested category nodes {"k", "en", "id", "t": [QUL ids],
               "children": [...]}. `t` places those topics' clusters directly
               under the category, in that order. A cluster that is not placed
               hangs under its natural parent cluster.
    names_id — QUL id -> Indonesian name; one per emitted cluster.
    names_en — QUL id -> English name replacing QUL's (typos, index stubs).
    names_ar — QUL id -> Arabic name replacing QUL's (e.g. الفتوة for الفتوى).
    flatten  — QUL ids of clusters to dissolve into the node they would hang
               under: their ayahs and children move up to it. Use it for
               grouping nodes ("Stories") and for a cluster that duplicates
               its category ("Prayer" placed in the Salat category).

    A cluster with no ayahs and no surviving children is dropped. Node:
    {"k", "en", "id", "p": parent index or -1, "ar"?, "desc"?,
     "v"?: sorted (surah, ayah) pairs it tags itself}. Category keys are their
    taxonomy key; cluster keys are "t<QUL id>"."""
    of = {m: c.key for c in clusters.values() for m in c.members}

    def resolve(i: int, what: str) -> int:
        if i not in of:
            raise TaxonomyError(f"{what}: QUL topic {i} is not in any cluster")
        return of[i]

    cats: dict[str, dict] = {}
    placement: dict[int, tuple[str, int]] = {}

    def walk(n: dict, parent: str | None) -> None:
        k = n.get("k")
        if not k or k in cats:
            raise TaxonomyError(f"missing or duplicate taxonomy key {k!r}")
        if not n.get("en") or not n.get("id"):
            raise TaxonomyError(f"taxonomy node {k} needs en and id names")
        cats[k] = {"node": n, "parent": parent}
        for pos, i in enumerate(n.get("t", [])):
            key = resolve(i, f"category {k}")
            if key in placement:
                raise TaxonomyError(
                    f"cluster {key} ({clusters[key].name}) placed twice: "
                    f"{placement[key][0]} and {k}")
            placement[key] = (k, pos)
        for ch in n.get("children", []):
            walk(ch, k)

    for top in taxonomy:
        walk(top, None)
    flat = {resolve(i, "flatten") for i in flatten}

    names: dict[int, str] = {}
    for i, name in names_id.items():
        key = resolve(i, "names")
        if key in names and names[key] != name:
            raise TaxonomyError(f"cluster {key} named twice: {names[key]!r} / {name!r}")
        names[key] = name.strip()
    en_over = {resolve(i, "names_en"): n.strip() for i, n in (names_en or {}).items()}
    ar_over = {resolve(i, "names_ar"): n.strip() for i, n in (names_ar or {}).items()}

    def anchor(key: int) -> str | None:
        """Parent node key ("cat" or "t<id>") after flattening, or None."""
        seen = set()
        while key not in seen:
            seen.add(key)
            if key in placement:
                a = placement[key][0]
            elif clusters[key].parent is not None:
                a = f"t{clusters[key].parent}"
            else:
                return None
            if a.startswith("t") and a[1:].isdigit() and int(a[1:]) in flat:
                key = int(a[1:])
                continue
            return a
        return None

    kids: dict[str, list[int]] = {}
    absorbed: dict[str, set] = {}
    for key in clusters:
        a = anchor(key)
        if key in flat:
            absorbed.setdefault(a, set()).update(clusters[key].ayahs)
        else:
            kids.setdefault(a, []).append(key)
    if absorbed.get(None):
        raise TaxonomyError("a flattened cluster with ayahs reaches no category")

    live: dict[int, bool] = {}

    def is_live(key: int) -> bool:
        if key not in live:
            live[key] = False  # guards cycles
            live[key] = bool(clusters[key].ayahs or absorbed.get(f"t{key}")) or any(
                is_live(ch) for ch in kids.get(f"t{key}", []))
        return live[key]

    lost = sorted(k for k in kids.get(None, []) if is_live(k))
    if lost:
        raise TaxonomyError(f"{len(lost)} clusters reach no category, e.g. "
                            f"{[(k, clusters[k].name) for k in lost[:12]]}")
    unnamed = sorted(k for a, ks in kids.items() if a is not None
                     for k in ks if is_live(k) and k not in names)
    if unnamed:
        raise TaxonomyError(f"{len(unnamed)} clusters lack an Indonesian name, e.g. "
                            f"{[(k, clusters[k].name) for k in unnamed[:12]]}")

    nodes: list[dict] = []

    def first(k: int) -> tuple:
        own = clusters[k].ayahs | absorbed.get(f"t{k}", set())
        if own:
            return min(own)
        return min((first(ch) for ch in kids.get(f"t{k}", []) if is_live(ch)),
                   default=(999, 0))

    def order(parent: str, keys: list[int]) -> list[int]:
        """Placed clusters in taxonomy order, then the rest: under a category
        the biggest first, under a cluster in mushaf order (story beats of
        Yusuf read in sequence)."""
        live_keys = [k for k in keys if is_live(k)]
        if parent.startswith("t") and parent[1:].isdigit():
            return sorted(live_keys, key=lambda k: (first(k), k))
        return sorted(live_keys, key=lambda k: (
            placement[k][1] if k in placement and placement[k][0] == parent else 10**6,
            -len(clusters[k].ayahs | absorbed.get(f"t{k}", set())), k))

    def emit_cluster(key: int, parent: int) -> None:
        c = clusters[key]
        node = {"k": f"t{key}", "en": en_over.get(key, c.name), "id": names[key],
                "p": parent}
        ar = ar_over.get(key, c.ar)
        if ar:
            node["ar"] = ar
        if c.desc:
            node["desc"] = c.desc
        own = c.ayahs | absorbed.get(f"t{key}", set())
        if own:
            node["v"] = sorted(own)
        nodes.append(node)
        me = len(nodes) - 1
        for ch in order(f"t{key}", kids.get(f"t{key}", [])):
            emit_cluster(ch, me)

    empty = []

    def emit_cat(n: dict, parent: int) -> None:
        node = {"k": n["k"], "en": n["en"], "id": n["id"], "p": parent}
        if absorbed.get(n["k"]):
            node["v"] = sorted(absorbed[n["k"]])
        nodes.append(node)
        me = len(nodes) - 1
        for ch in n.get("children", []):
            emit_cat(ch, me)
        for key in order(n["k"], kids.get(n["k"], [])):
            emit_cluster(key, me)
        if len(nodes) == me + 1 and "v" not in node:
            empty.append(n["k"])

    for top in taxonomy:
        emit_cat(top, -1)
    if empty:
        raise TaxonomyError(f"empty categories: {empty}")
    return nodes
