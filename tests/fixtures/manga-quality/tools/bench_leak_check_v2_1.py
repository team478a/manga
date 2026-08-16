#!/usr/bin/env python3
"""
MANGAI R4-3 Benchmark v2.1 leak / shortcut acceptance checker.

Purpose
-------
Detect label leakage and low-level shortcuts that allow a classifier to predict
"good" vs "bad" without understanding manga quality.

v2.1 canonical package structure
--------------------------------
ROOT/
  manifest.json
  cases.json                # safe-to-pass inputs only; MUST NOT contain verdict/defects
  labels.private.json       # evaluator-only ground truth
  images/img_0001.png ...
  refs/ ...
  intended/ ...

Final acceptance should be run by the evaluator with a private holdout package:
  python bench_leak_check_v2_1.py DEV_ROOT --holdout-root HOLDOUT_ROOT --json result.json

The threshold-tuning / Visual Judge implementation team should not receive the
private holdout labels.

Legacy negative-control mode:
  python bench_leak_check_v2_1.py V1_ROOT --legacy-v1

Dependencies:
  pillow, numpy, scikit-learn
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import balanced_accuracy_score
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

AUC_MAX = 0.65
BASELINE_BAL_ACC_MAX = 0.60
PROFILE_COUNT_TOLERANCE = 1
SHARPNESS_DIFF_WARN = 0.20
FILESIZE_DIFF_WARN = 0.20
FILENAME_RE = re.compile(r"^img_\d{4}\.png$")
LABEL_WORDS = ("good", "bad", "borderline", "ng", "ok", "fail", "pass", "error")
FORBIDDEN_PUBLIC_KEYS = {
    "label", "verdict", "defect", "defects", "severity", "note", "notes",
    "reviewed_by", "reviewed_at", "ground_truth", "expected_verdict",
}
PNG_TEXT_KEYS = {
    "comment", "description", "software", "parameters", "prompt", "workflow",
    "negative_prompt", "generation_data", "exif",
}

@dataclass
class Sample:
    sample_id: str
    path: Path
    rel: str
    label: int  # 1 bad, 0 good
    profile_id: str | None = None
    feats: dict[str, float] = field(default_factory=dict)
    sha256: str = ""
    metadata_keys: list[str] = field(default_factory=list)


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _walk_forbidden_public(obj: Any, path: str = "$") -> list[str]:
    hits: list[str] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            k = str(key).lower()
            if k in FORBIDDEN_PUBLIC_KEYS or any(k.startswith(x + "_") for x in FORBIDDEN_PUBLIC_KEYS):
                hits.append(f"{path}.{key} (forbidden key)")
            hits.extend(_walk_forbidden_public(value, f"{path}.{key}"))
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            hits.extend(_walk_forbidden_public(value, f"{path}[{i}]") )
    elif isinstance(obj, str):
        low = obj.lower()
        if low in LABEL_WORDS:
            hits.append(f"{path}={obj!r} (label-like value)")
    return hits


def load_v21(root: Path, suite: str = "candidate") -> tuple[list[Sample], dict[str, Any], list[str]]:
    required = [root / "manifest.json", root / "cases.json", root / "labels.private.json", root / "images"]
    missing = [str(p.name) for p in required if not p.exists()]
    if missing:
        raise ValueError(f"v2.1 required files missing: {', '.join(missing)}")

    manifest = _read_json(root / "manifest.json")
    cases_raw = _read_json(root / "cases.json")
    labels_raw = _read_json(root / "labels.private.json")
    if not isinstance(cases_raw, list) or not isinstance(labels_raw, list):
        raise ValueError("cases.json and labels.private.json must be JSON arrays")

    public_leaks = _walk_forbidden_public(cases_raw)
    case_by_id = {str(r["id"]): r for r in cases_raw if isinstance(r, dict) and "id" in r}
    label_by_id = {str(r["id"]): r for r in labels_raw if isinstance(r, dict) and "id" in r}

    if len(case_by_id) != len(cases_raw):
        public_leaks.append("cases.json contains duplicate or missing ids")
    if len(label_by_id) != len(labels_raw):
        public_leaks.append("labels.private.json contains duplicate or missing ids")

    samples: list[Sample] = []
    for sample_id, case in case_by_id.items():
        if case.get("suite", "candidate") != suite:
            continue
        gt = label_by_id.get(sample_id)
        if gt is None:
            public_leaks.append(f"ground truth missing for {sample_id}")
            continue
        verdict = gt.get("verdict")
        if verdict not in ("good", "bad"):
            continue  # borderline excluded from binary shortcut tests
        rel = str(case.get("file", ""))
        p = root / rel
        if not p.exists():
            public_leaks.append(f"image missing: {rel}")
            continue
        samples.append(Sample(
            sample_id=sample_id,
            path=p,
            rel=rel,
            label=1 if verdict == "bad" else 0,
            profile_id=case.get("image_profile_id"),
        ))
    return samples, manifest, public_leaks


def load_legacy_v1(root: Path) -> tuple[list[Sample], dict[str, Any], list[str]]:
    samples: list[Sample] = []
    for p in sorted(root.rglob("*.png")):
        rel = p.relative_to(root).as_posix()
        if rel.startswith("good/"):
            samples.append(Sample(p.stem, p, rel, 0, None))
        elif rel.startswith("bad/"):
            samples.append(Sample(p.stem, p, rel, 1, None))
    return samples, {}, []


_LAPLACIAN = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=float)


def _sliding_conv(gray: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    from numpy.lib.stride_tricks import sliding_window_view
    if gray.shape[0] < kernel.shape[0] or gray.shape[1] < kernel.shape[1]:
        return np.zeros((1, 1), dtype=float)
    win = sliding_window_view(gray, kernel.shape)
    return (win * kernel).sum(axis=(-1, -2))


def _corner_stats(rgb: np.ndarray, prefix: str) -> dict[str, float]:
    h, w, _ = rgb.shape
    ch, cw = max(1, int(h * 0.12)), max(1, int(w * 0.12))
    corners = {
        "tl": rgb[:ch, :cw], "tr": rgb[:ch, -cw:],
        "bl": rgb[-ch:, :cw], "br": rgb[-ch:, -cw:],
    }
    out: dict[str, float] = {}
    for name, patch in corners.items():
        flat = patch.reshape(-1, 3).astype(float)
        r, g, b = flat.mean(axis=0)
        mx, mn = flat.max(axis=1), flat.min(axis=1)
        sat = float(np.mean((mx - mn) / np.maximum(mx, 1.0)))
        out[f"{prefix}_{name}_redness"] = float(r - (g + b) / 2)
        out[f"{prefix}_{name}_greenness"] = float(g - (r + b) / 2)
        out[f"{prefix}_{name}_saturation"] = sat
    return out


def _gradient_edge_density(gray: np.ndarray) -> float:
    if gray.shape[0] < 2 or gray.shape[1] < 2:
        return 0.0
    gx = np.abs(np.diff(gray, axis=1))[:-1, :]
    gy = np.abs(np.diff(gray, axis=0))[:, :-1]
    mag = np.hypot(gx, gy)
    return float((mag > 32).mean())


def extract(sample: Sample) -> None:
    raw = sample.path.read_bytes()
    sample.sha256 = hashlib.sha256(raw).hexdigest()
    with Image.open(sample.path) as im0:
        sample.metadata_keys = sorted(str(k) for k in im0.info.keys())
        im = im0.convert("RGB")
    w, h = im.size
    rgb = np.asarray(im)
    gray = np.asarray(im.convert("L"), dtype=float)
    feats: dict[str, float] = {
        "aspect_ratio": w / h,
        "width": float(w),
        "height": float(h),
        "short_side": float(min(w, h)),
        "pixel_count": float(w * h),
        "filesize_bytes": float(len(raw)),
        "sharpness": float(_sliding_conv(gray, _LAPLACIAN).var()),
        "mean_luma": float(gray.mean()),
        "std_luma": float(gray.std()),
        "gradient_edge_density": _gradient_edge_density(gray),
    }
    feats.update(_corner_stats(rgb, "corner"))
    sample.feats = feats


def auc(scores: np.ndarray, labels: np.ndarray) -> float:
    order = np.argsort(scores, kind="mergesort")
    ranks = np.empty(len(scores), dtype=float)
    ranks[order] = np.arange(1, len(scores) + 1)
    s_sorted = scores[order]
    i = 0
    while i < len(s_sorted):
        j = i
        while j + 1 < len(s_sorted) and s_sorted[j + 1] == s_sorted[i]:
            j += 1
        if j > i:
            ranks[order[i:j+1]] = (i + j + 2) / 2
        i = j + 1
    n_pos = int(labels.sum())
    n_neg = len(labels) - n_pos
    if n_pos == 0 or n_neg == 0:
        return 0.5
    r_pos = ranks[labels == 1].sum()
    a = (r_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)
    return max(float(a), float(1 - a))


def rel_diff(a: float, b: float) -> float:
    return abs(a - b) / max(abs(a), abs(b), 1e-9)


def check_public_leakage(public_leaks: list[str]) -> tuple[bool, list[str]]:
    lines = ["", "── Public contract leakage"]
    if public_leaks:
        lines.append(f"  [NG] {len(public_leaks)} issue(s)")
        lines.extend(f"       {x}" for x in public_leaks[:12])
        return False, lines
    lines.append("  [ok] cases.json does not expose evaluator labels")
    return True, lines


def check_paths(samples: list[Sample], v21: bool) -> tuple[bool, list[str]]:
    lines = ["", "── Path / filename leakage"]
    bad: list[str] = []
    for s in samples:
        low = s.rel.lower()
        if any(word in low for word in LABEL_WORDS):
            bad.append(s.rel)
        elif v21 and (not s.rel.startswith("images/") or not FILENAME_RE.match(Path(s.rel).name)):
            bad.append(s.rel)
    if bad:
        lines.append(f"  [NG] {len(bad)} unsafe path(s)")
        lines.extend(f"       {p}" for p in bad[:10])
        return False, lines
    lines.append("  [ok] image paths are label-neutral")
    return True, lines


def check_metadata(samples: list[Sample]) -> tuple[bool, list[str]]:
    lines = ["", "── Embedded metadata"]
    bad: list[str] = []
    for s in samples:
        suspicious = [k for k in s.metadata_keys if k.lower() in PNG_TEXT_KEYS]
        if suspicious:
            bad.append(f"{s.rel}: {', '.join(suspicious)}")
    if bad:
        lines.append(f"  [NG] textual/generation metadata found in {len(bad)} image(s)")
        lines.extend(f"       {x}" for x in bad[:10])
        return False, lines
    lines.append("  [ok] no forbidden textual generation metadata detected")
    return True, lines


def check_duplicates(samples: list[Sample]) -> tuple[bool, list[str]]:
    lines = ["", "── Exact duplicate / conflicting-label check"]
    by_hash: dict[str, list[Sample]] = {}
    for s in samples:
        by_hash.setdefault(s.sha256, []).append(s)
    conflicts: list[str] = []
    dupes: list[str] = []
    for h, group in by_hash.items():
        if len(group) <= 1:
            continue
        labels = {g.label for g in group}
        msg = f"{h[:12]}: " + ", ".join(g.rel for g in group)
        if len(labels) > 1:
            conflicts.append(msg)
        else:
            dupes.append(msg)
    if conflicts:
        lines.append(f"  [NG] {len(conflicts)} exact duplicate(s) have conflicting labels")
        lines.extend(f"       {x}" for x in conflicts[:10])
        return False, lines
    lines.append("  [ok] no cross-label exact duplicates")
    if dupes:
        lines.append(f"  [warn] {len(dupes)} same-label duplicate group(s); diversity may be reduced")
    return True, lines


def check_profiles(samples: list[Sample], manifest: dict[str, Any], v21: bool) -> tuple[bool, list[str]]:
    lines = ["", "── Production-native image profile consistency"]
    if not v21:
        lines.append("  [skip] legacy v1 has no manifest image profiles")
        return True, lines
    profiles = {str(p["id"]): p for p in manifest.get("image_profiles", []) if isinstance(p, dict) and "id" in p}
    if not profiles:
        lines.append("  [NG] manifest.image_profiles is required in v2.1")
        return False, lines
    ok = True
    counts: dict[str, list[int]] = {}
    for s in samples:
        if not s.profile_id or s.profile_id not in profiles:
            lines.append(f"  [NG] {s.rel}: missing/unknown image_profile_id={s.profile_id!r}")
            ok = False
            continue
        p = profiles[s.profile_id]
        w, h = int(s.feats["width"]), int(s.feats["height"])
        if w != int(p["width"]) or h != int(p["height"]):
            lines.append(f"  [NG] {s.rel}: actual {w}x{h}, profile {s.profile_id} expects {p['width']}x{p['height']}")
            ok = False
        bucket = counts.setdefault(s.profile_id, [0, 0])
        bucket[s.label] += 1
    for pid, (good_n, bad_n) in sorted(counts.items()):
        diff = abs(good_n - bad_n)
        mark = "NG" if diff > PROFILE_COUNT_TOLERANCE else "ok"
        lines.append(f"  [{mark}] {pid}: good={good_n} bad={bad_n} diff={diff}")
        if diff > PROFILE_COUNT_TOLERANCE:
            ok = False
    if ok:
        lines.append("  [ok] image dimensions match manifest and profile counts are balanced")
    return ok, lines


def check_class_balance(samples: list[Sample], name: str) -> tuple[bool, list[str]]:
    lines = ["", f"── {name} class balance"]
    good = sum(1 for s in samples if s.label == 0)
    bad = len(samples) - good
    if good < 2 or bad < 2:
        lines.append(f"  [NG] insufficient classes: good={good} bad={bad}")
        return False, lines
    if abs(good - bad) > 1:
        lines.append(f"  [NG] binary leakage suite must be balanced: good={good} bad={bad}")
        return False, lines
    lines.append(f"  [ok] good={good} bad={bad}")
    return True, lines


def check_univariate(samples: list[Sample], name: str) -> tuple[bool, list[str], dict[str, float]]:
    labels = np.array([s.label for s in samples])
    keys = sorted(samples[0].feats.keys())
    rows: list[tuple[str, float]] = []
    for key in keys:
        vals = np.array([s.feats[key] for s in samples], dtype=float)
        rows.append((key, auc(vals, labels)))
    rows.sort(key=lambda x: -x[1])
    lines = ["", f"── {name} univariate leakage (AUC < {AUC_MAX:.2f})"]
    failed = []
    result: dict[str, float] = {}
    for key, a in rows:
        result[key] = a
        mark = "NG" if a >= AUC_MAX else "ok"
        lines.append(f"  [{mark}] {key:<30} AUC={a:.3f}")
        if a >= AUC_MAX:
            failed.append(key)
    if failed:
        lines.append(f"  → fail: {len(failed)} low-level feature(s) separate labels")
    return not failed, lines, result


def _feature_matrix(samples: list[Sample]) -> tuple[np.ndarray, np.ndarray, list[str]]:
    keys = sorted(samples[0].feats.keys())
    X = np.array([[s.feats[k] for k in keys] for s in samples], dtype=float)
    y = np.array([s.label for s in samples], dtype=int)
    return X, y, keys


def check_baseline(dev: list[Sample], holdout: list[Sample] | None) -> tuple[bool, list[str], dict[str, float | None]]:
    lines = ["", f"── Shortcut baseline (balanced accuracy <= {BASELINE_BAL_ACC_MAX:.0%})"]
    metrics: dict[str, float | None] = {"dev_cv_balanced_accuracy": None, "holdout_balanced_accuracy": None}
    if not HAS_SKLEARN:
        lines.append("  [NG] scikit-learn is required for final acceptance")
        return False, lines, metrics
    X, y, _ = _feature_matrix(dev)
    n_splits = min(5, int(np.bincount(y).min()))
    if n_splits < 2:
        lines.append("  [NG] insufficient samples per class for CV")
        return False, lines, metrics
    clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, class_weight="balanced"))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=20260816)
    cv_scores = cross_val_score(clf, X, y, cv=cv, scoring="balanced_accuracy")
    cv_mean = float(cv_scores.mean())
    metrics["dev_cv_balanced_accuracy"] = cv_mean
    mark = "NG" if cv_mean > BASELINE_BAL_ACC_MAX else "ok"
    lines.append(f"  [{mark}] dev CV balanced accuracy = {cv_mean:.1%}")
    ok = cv_mean <= BASELINE_BAL_ACC_MAX

    if holdout is None:
        lines.append("  [warn] private holdout not supplied; final acceptance is incomplete")
        return False, lines, metrics
    Xh, yh, _ = _feature_matrix(holdout)
    clf.fit(X, y)
    pred = clf.predict(Xh)
    hold_bal = float(balanced_accuracy_score(yh, pred))
    metrics["holdout_balanced_accuracy"] = hold_bal
    mark = "NG" if hold_bal > BASELINE_BAL_ACC_MAX else "ok"
    lines.append(f"  [{mark}] private holdout balanced accuracy = {hold_bal:.1%}")
    ok = ok and hold_bal <= BASELINE_BAL_ACC_MAX
    return ok, lines, metrics


def check_distribution_warnings(samples: list[Sample], name: str) -> tuple[bool, list[str]]:
    lines = ["", f"── {name} distribution warnings (not hard gates)"]
    good = [s for s in samples if s.label == 0]
    bad = [s for s in samples if s.label == 1]
    for key, limit, label in (
        ("sharpness", SHARPNESS_DIFF_WARN, "sharpness"),
        ("filesize_bytes", FILESIZE_DIFF_WARN, "file size"),
    ):
        g = float(np.mean([s.feats[key] for s in good]))
        b = float(np.mean([s.feats[key] for s in bad]))
        d = rel_diff(g, b)
        mark = "warn" if d > limit else "ok"
        lines.append(f"  [{mark}] {label} mean relative difference = {d:.1%} (guide {limit:.0%})")
    return True, lines


def run_checks(root: Path, legacy_v1: bool, suite: str) -> tuple[list[Sample], dict[str, Any], list[str], bool]:
    if legacy_v1:
        samples, manifest, public_leaks = load_legacy_v1(root)
        v21 = False
    else:
        samples, manifest, public_leaks = load_v21(root, suite=suite)
        v21 = True
    if len(samples) < 4:
        raise ValueError("need at least 4 good/bad samples")
    for s in samples:
        extract(s)
    return samples, manifest, public_leaks, v21


def main() -> int:
    ap = argparse.ArgumentParser(description="MANGAI benchmark v2.1 label-leak checker")
    ap.add_argument("root", type=Path, help="development benchmark root")
    ap.add_argument("--holdout-root", type=Path, default=None, help="private holdout benchmark root")
    ap.add_argument("--suite", default="candidate", choices=["candidate", "page"], help="suite to inspect")
    ap.add_argument("--legacy-v1", action="store_true", help="treat root as legacy good/bad v1 negative control")
    ap.add_argument("--json", type=Path, default=None, help="write machine-readable result JSON")
    args = ap.parse_args()

    try:
        dev, dev_manifest, dev_public_leaks, dev_v21 = run_checks(args.root, args.legacy_v1, args.suite)
        hold = None
        hold_manifest: dict[str, Any] = {}
        hold_public_leaks: list[str] = []
        hold_v21 = False
        if args.holdout_root:
            hold, hold_manifest, hold_public_leaks, hold_v21 = run_checks(args.holdout_root, False, args.suite)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    lines: list[str] = []
    results: dict[str, bool] = {}
    metrics: dict[str, Any] = {}

    def add(name: str, result: tuple[bool, list[str]]) -> None:
        passed, ls = result
        results[name] = passed
        lines.extend(ls)

    add("dev_public_contract", check_public_leakage(dev_public_leaks))
    add("dev_paths", check_paths(dev, dev_v21))
    add("dev_metadata", check_metadata(dev))
    add("dev_duplicates", check_duplicates(dev))
    add("dev_profiles", check_profiles(dev, dev_manifest, dev_v21))
    add("dev_class_balance", check_class_balance(dev, "dev"))
    p, ls, a = check_univariate(dev, "dev")
    results["dev_univariate"] = p; lines.extend(ls); metrics["dev_auc"] = a
    add("dev_distribution_warning", check_distribution_warnings(dev, "dev"))

    if hold is not None:
        add("holdout_public_contract", check_public_leakage(hold_public_leaks))
        add("holdout_paths", check_paths(hold, hold_v21))
        add("holdout_metadata", check_metadata(hold))
        add("holdout_duplicates", check_duplicates(hold))
        add("holdout_profiles", check_profiles(hold, hold_manifest, hold_v21))
        add("holdout_class_balance", check_class_balance(hold, "holdout"))
        p, ls, a = check_univariate(hold, "holdout")
        results["holdout_univariate"] = p; lines.extend(ls); metrics["holdout_auc"] = a
        add("holdout_distribution_warning", check_distribution_warnings(hold, "holdout"))

        # Cross-package exact duplicates can leak examples from dev into holdout.
        overlap = sorted({s.sha256 for s in dev} & {s.sha256 for s in hold})
        lines.extend(["", "── Dev / holdout exact-image separation"])
        if overlap:
            results["dev_holdout_separation"] = False
            lines.append(f"  [NG] {len(overlap)} exact image hash(es) appear in both dev and holdout")
        else:
            results["dev_holdout_separation"] = True
            lines.append("  [ok] no exact image overlap between dev and holdout")
    else:
        results["holdout_required"] = False
        lines.extend(["", "── Private holdout", "  [NG] --holdout-root is required for final v2.1 acceptance"])

    baseline_ok, baseline_lines, baseline_metrics = check_baseline(dev, hold)
    results["baseline"] = baseline_ok
    lines.extend(baseline_lines)
    metrics.update(baseline_metrics)

    print(f"suite={args.suite} dev={len(dev)} samples" + (f" holdout={len(hold)}" if hold else ""))
    print("\n".join(lines))
    overall = all(results.values())
    print("\n" + "=" * 72)
    print("PASS: benchmark shortcut/leak gates satisfied" if overall else "FAIL: benchmark must not be used for Visual Judge acceptance")
    print("=" * 72)

    payload = {
        "suite": args.suite,
        "dev_root": str(args.root),
        "holdout_root": str(args.holdout_root) if args.holdout_root else None,
        "results": results,
        "metrics": metrics,
        "overall": overall,
        "note": "Human dual review and benchmark semantic-label audit remain mandatory.",
    }
    if args.json:
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote: {args.json}")
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())
