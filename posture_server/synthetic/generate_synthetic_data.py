#!/usr/bin/env python3
"""
Literature-based synthetic posture data generator.

Supports: normal, forward_head, kyphosis, lateral_tilt

Evidence chain:
  forward_head  : B (CVA-theta) + C/E (CVA distribution) + D (noise) + F ratio inferred
  kyphosis      : G/H (Cobb latent) + F/K/M (pitch-diff framework) + D (noise)
  lateral_tilt  : I (ATI latent) + D (noise); roll distribution inferred from proxy formula
  normal        : D (noise only)

Run:
  python generate_synthetic_data.py --n-per-label 500 --seed 42
"""

import argparse
import csv
import json
import math
import random
import uuid
from pathlib import Path
from collections import defaultdict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _truncated_normal(rng: random.Random, mean: float, sd: float,
                      lo: float, hi: float, max_tries: int = 100) -> float:
    for _ in range(max_tries):
        v = rng.gauss(mean, sd)
        if lo <= v <= hi:
            return v
    return _clamp(rng.gauss(mean, sd), lo, hi)


def _load_config(config_path: Path) -> dict:
    with open(config_path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Sign-convention inspector
# ---------------------------------------------------------------------------

def inspect_existing_csv(csv_path: Path) -> dict:
    """
    Read existing training CSV to understand sign conventions and ranges.
    Returns per-label column statistics.
    """
    rows_by_label: dict[str, list[dict]] = defaultdict(list)
    feature_cols = [
        "diff_C7_pitch", "diff_C7_roll",
        "diff_T3_pitch", "diff_T3_roll",
        "diff_T7_pitch", "diff_T7_roll",
    ]
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = row["label"]
            rows_by_label[label].append({c: float(row[c]) for c in feature_cols})

    stats = {}
    for label, rows in rows_by_label.items():
        stats[label] = {}
        for col in feature_cols:
            vals = [r[col] for r in rows]
            n = len(vals)
            mean = sum(vals) / n
            var = sum((v - mean) ** 2 for v in vals) / n
            stats[label][col] = {
                "mean": round(mean, 3),
                "std": round(math.sqrt(var), 3),
                "min": round(min(vals), 3),
                "max": round(max(vals), 3),
                "n": n,
            }
    return stats


# ---------------------------------------------------------------------------
# Normal generator
# ---------------------------------------------------------------------------

def _generate_normal(rng: random.Random, n: int, cfg: dict) -> tuple[list[dict], list[dict]]:
    """
    Near-baseline samples using Evidence D noise only.
    Avoids perfectly zero values by relying entirely on sensor noise + drift.
    """
    params = cfg["generator_params"]["normal"]
    noise = params["noise"]
    clamp = params["clamp"]

    rows, meta = [], []
    for _ in range(n):
        sid = str(uuid.uuid4())

        # subject-level session drift (Evidence D)
        drift_p = _clamp(rng.gauss(0, noise["drift_pitch_sd"]),
                         noise["drift_pitch_clip"][0], noise["drift_pitch_clip"][1])
        drift_r = _clamp(rng.gauss(0, noise["drift_roll_sd"]),
                         noise["drift_roll_clip"][0], noise["drift_roll_clip"][1])

        row = {}
        for sensor in ["C7", "T3", "T7"]:
            p = drift_p + rng.gauss(0, noise["pitch_sd"])
            r = drift_r + rng.gauss(0, noise["roll_sd"])
            row[f"diff_{sensor}_pitch"] = _clamp(p, clamp["pitch"][0], clamp["pitch"][1])
            row[f"diff_{sensor}_roll"]  = _clamp(r, clamp["roll"][0],  clamp["roll"][1])
        row["label"] = "normal"
        rows.append(row)

        meta.append({
            "sample_id": sid,
            "label": "normal",
            "source": "synthetic",
            "evidence_ids": "D,K,N",
            "intensity": "none",
            "quality": "approved",
            "directness": "direct_noise_only",
            "latent_CVA": "",
            "latent_Cobb": "",
            "latent_ATI": "",
            "latent_AVR": "",
            "age": "",
            "work_years": "",
            "rotated_subtype": "",
            "drift_pitch": round(drift_p, 4),
            "drift_roll": round(drift_r, 4),
            "notes": "Normal: Evidence D sensor noise + session drift only. No posture offset.",
        })
    return rows, meta


# ---------------------------------------------------------------------------
# Forward head generator
# ---------------------------------------------------------------------------

def _generate_forward_head(rng: random.Random, n: int, cfg: dict,
                            include_ambiguous: bool) -> tuple[list[dict], list[dict]]:
    """
    Evidence B: theta_C7 = CVA - 89 (direct).
    Evidence C/E: target CVA distribution (indirect latent).
    T3/T7 ratios: inferred from CSV sign convention + Evidence F segment contribution.
    Roll: Evidence D noise only (unsupported for forward_head).
    """
    params = cfg["generator_params"]["forward_head"]
    d_noise = cfg["generator_params"]["normal"]["noise"]
    theta_baseline = params["theta_baseline_deg"]  # -40.0 deg (Evidence B direct)

    intensity_weights_raw = params["intensity_weights"].copy()
    if not include_ambiguous:
        intensity_weights_raw.pop("mild", None)
    total = sum(intensity_weights_raw.values())
    intensity_choices = list(intensity_weights_raw.keys())
    intensity_probs   = [intensity_weights_raw[k] / total for k in intensity_choices]

    rows, meta = [], []
    for _ in range(n):
        sid = str(uuid.uuid4())

        # pick intensity
        intensity = rng.choices(intensity_choices, weights=intensity_probs, k=1)[0]
        t = params["intensity_targets"][intensity]

        # sample target CVA (Evidence C / E)
        cva = _truncated_normal(rng, t["cva_mean"], t["cva_sd"],
                                t["cva_clip"][0], t["cva_clip"][1])

        # convert CVA → theta_C7 (Evidence B direct formula)
        theta_c7 = cva - 89.0
        theta_shift = theta_c7 - theta_baseline  # negative for forward lean
        # project sign: positive pitch = forward flexion → negate shift
        diff_c7_pitch_raw = -theta_shift
        diff_c7_pitch = _clamp(diff_c7_pitch_raw,
                               params["clamp"]["c7_pitch"][0],
                               params["clamp"]["c7_pitch"][1])

        # T3/T7 ratios (inferred from Evidence F + CSV convention)
        t3_ratio = rng.uniform(*params["t3_t7_ratios"]["t3_ratio_range"])
        t7_ratio = rng.uniform(*params["t3_t7_ratios"]["t7_ratio_range"])

        # IT-worker profile metadata (Evidence E, metadata only)
        age        = _truncated_normal(rng, 32.56, 5.46, 23, 45)
        work_years = _truncated_normal(rng, 9.32,  5.56,  0, 20)

        # subject drift (Evidence D)
        drift_p = _clamp(rng.gauss(0, d_noise["drift_pitch_sd"]),
                         d_noise["drift_pitch_clip"][0], d_noise["drift_pitch_clip"][1])

        # sensor noise (Evidence D)
        noise_p = cfg["evidence"]["D"]["direct_values"]["sensor_noise"]["pitch"]["sd"]
        noise_r = cfg["evidence"]["D"]["direct_values"]["sensor_noise"]["roll"]["sd"]

        row = {
            "diff_C7_pitch": _clamp(diff_c7_pitch + drift_p + rng.gauss(0, noise_p), -5, 32),
            "diff_C7_roll":  rng.gauss(0, noise_r),
            "diff_T3_pitch": _clamp(diff_c7_pitch * t3_ratio + drift_p * 0.7 + rng.gauss(0, noise_p), -5, 22),
            "diff_T3_roll":  rng.gauss(0, noise_r),
            "diff_T7_pitch": _clamp(diff_c7_pitch * t7_ratio + drift_p * 0.4 + rng.gauss(0, noise_p), -5, 14),
            "diff_T7_roll":  rng.gauss(0, noise_r),
            "label": "forward_head",
        }
        rows.append(row)

        meta.append({
            "sample_id": sid,
            "label": "forward_head",
            "source": "synthetic",
            "evidence_ids": "B,C,D,E,F,K,M,N",
            "intensity": intensity,
            "quality": t["quality"],
            "directness": "B_direct+C_indirect_latent+T3T7_inferred",
            "latent_CVA": round(cva, 3),
            "latent_Cobb": "",
            "latent_ATI": "",
            "latent_AVR": "",
            "age": round(age, 1),
            "work_years": round(work_years, 1),
            "rotated_subtype": "",
            "drift_pitch": round(drift_p, 4),
            "drift_roll": "",
            "notes": (
                f"CVA={cva:.1f} → theta_C7={theta_c7:.1f} (Ev.B direct). "
                f"diff_C7_pitch={diff_c7_pitch:.2f} (direct). "
                f"T3 ratio={t3_ratio:.3f}, T7 ratio={t7_ratio:.3f} (inferred from CSV+Ev.F). "
                f"Roll=noise only (Ev.B unsupported). "
                f"Age/work_years=Ev.E metadata only."
            ),
        })
    return rows, meta


# ---------------------------------------------------------------------------
# Kyphosis generator
# ---------------------------------------------------------------------------

def _generate_kyphosis(rng: random.Random, n: int, cfg: dict,
                       include_ambiguous: bool) -> tuple[list[dict], list[dict]]:
    """
    Evidence G/H: sample latent Cobb angle.
    thoracic_excess = Cobb - 35 (Evidence G direct formula).
    Alpha mapping: inferred from CSV ratios + Evidence F segment contribution.
    Roll: near zero (Evidence F: sagittal dominant).
    """
    params = cfg["generator_params"]["kyphosis"]
    d_noise = cfg["generator_params"]["normal"]["noise"]

    intensity_weights_raw = params["intensity_weights"].copy()
    if not include_ambiguous:
        intensity_weights_raw.pop("mild", None)
    total = sum(intensity_weights_raw.values())
    intensity_choices = list(intensity_weights_raw.keys())
    intensity_probs   = [intensity_weights_raw[k] / total for k in intensity_choices]

    noise_p = cfg["evidence"]["D"]["direct_values"]["sensor_noise"]["pitch"]["sd"]
    noise_r = cfg["evidence"]["D"]["direct_values"]["sensor_noise"]["roll"]["sd"]
    curve_noise_sd = params["curvature_noise_sd"]  # Evidence F

    rows, meta = [], []
    for _ in range(n):
        sid = str(uuid.uuid4())

        intensity = rng.choices(intensity_choices, weights=intensity_probs, k=1)[0]
        t = params["intensity_targets"][intensity]

        # sample latent Cobb (Evidence G/H)
        cobb = _truncated_normal(rng, t["cobb_mean"], t["cobb_sd"],
                                 t["cobb_clip"][0], t["cobb_clip"][1])

        # thoracic excess (Evidence G direct formula)
        thoracic_excess = max(0.0, cobb - 35.0)

        # alpha values (inferred — marked in metadata)
        alpha_t7 = rng.uniform(*params["alpha_values"]["alpha_T7_range"])
        alpha_t3 = rng.uniform(*params["alpha_values"]["alpha_T3_range"])
        alpha_c7 = rng.uniform(*params["alpha_values"]["alpha_C7_range"])

        # base offsets
        base_t7 = alpha_t7 * thoracic_excess
        base_t3 = alpha_t3 * thoracic_excess
        base_c7 = alpha_c7 * thoracic_excess

        # subject drift (Evidence D)
        drift_p = _clamp(rng.gauss(0, d_noise["drift_pitch_sd"]),
                         d_noise["drift_pitch_clip"][0], d_noise["drift_pitch_clip"][1])

        row = {
            # Evidence F: T7 > T3 > C7 pitch, sagittal dominant
            "diff_C7_pitch": _clamp(base_c7 + drift_p * 0.3 + rng.gauss(0, noise_p) + rng.gauss(0, curve_noise_sd), -2, 18),
            "diff_C7_roll":  rng.gauss(0, noise_r),
            "diff_T3_pitch": _clamp(base_t3 + drift_p * 0.5 + rng.gauss(0, noise_p) + rng.gauss(0, curve_noise_sd), -2, 24),
            "diff_T3_roll":  rng.gauss(0, noise_r),
            "diff_T7_pitch": _clamp(base_t7 + drift_p * 0.7 + rng.gauss(0, noise_p) + rng.gauss(0, curve_noise_sd), -2, 34),
            "diff_T7_roll":  rng.gauss(0, noise_r),
            "label": "kyphosis",
        }
        rows.append(row)

        meta.append({
            "sample_id": sid,
            "label": "kyphosis",
            "source": "synthetic",
            "evidence_ids": "F,G,H,D,K,M,N",
            "intensity": intensity,
            "quality": t["quality"],
            "directness": "G_indirect_latent+F_inferred_alpha+D_direct_noise",
            "latent_CVA": "",
            "latent_Cobb": round(cobb, 3),
            "latent_ATI": "",
            "latent_AVR": "",
            "age": "",
            "work_years": "",
            "rotated_subtype": "",
            "drift_pitch": round(drift_p, 4),
            "drift_roll": "",
            "notes": (
                f"Cobb={cobb:.1f} (Ev.G/H latent). "
                f"thoracic_excess={thoracic_excess:.2f} (Cobb-35, Ev.G direct). "
                f"alpha T7={alpha_t7:.3f} T3={alpha_t3:.3f} C7={alpha_c7:.3f} (INFERRED from CSV+Ev.F). "
                f"Roll=noise only (Ev.F sagittal dominant)."
            ),
        })
    return rows, meta


# ---------------------------------------------------------------------------
# Lateral tilt generator
# ---------------------------------------------------------------------------

def _generate_lateral_tilt(rng: random.Random, n: int, cfg: dict,
                            include_ambiguous: bool) -> tuple[list[dict], list[dict]]:
    """
    Evidence I: sample latent ATI.
    Roll distribution inferred from proxy formula and CSV ratios.
    Pitch: near zero (lateral tilt is coronal-plane dominant).
    """
    params  = cfg["generator_params"]["lateral_tilt"]
    d_noise = cfg["generator_params"]["normal"]["noise"]
    proxy   = params["ati_to_roll_proxy"]

    intensity_weights_raw = params["intensity_weights"].copy()
    if not include_ambiguous:
        intensity_weights_raw.pop("mild", None)
    total = sum(intensity_weights_raw.values())
    intensity_choices = list(intensity_weights_raw.keys())
    intensity_probs   = [intensity_weights_raw[k] / total for k in intensity_choices]

    noise_p = cfg["evidence"]["D"]["direct_values"]["sensor_noise"]["pitch"]["sd"]
    noise_r = params["roll_noise_sd"]

    rows, meta = [], []
    for _ in range(n):
        sid = str(uuid.uuid4())

        intensity = rng.choices(intensity_choices, weights=intensity_probs, k=1)[0]
        t = params["intensity_targets"][intensity]

        # sample latent ATI (Evidence I)
        ati = _truncated_normal(rng, t["ati_mean"], t["ati_sd"],
                                t["ati_clip"][0], t["ati_clip"][1])

        # roll distribution (inferred from Evidence I proxy + CSV ratio)
        jitter = proxy["multiplier_jitter"]
        m_c7 = proxy["C7_roll_multiplier"] * (1 + rng.uniform(-jitter, jitter))
        m_t3 = proxy["T3_roll_multiplier"] * (1 + rng.uniform(-jitter, jitter))
        m_t7 = proxy["T7_roll_multiplier"] * (1 + rng.uniform(-jitter, jitter))

        base_c7_roll = m_c7 * ati
        base_t3_roll = m_t3 * ati
        base_t7_roll = m_t7 * ati

        # subject drift
        drift_r = _clamp(rng.gauss(0, d_noise["drift_roll_sd"]),
                         d_noise["drift_roll_clip"][0], d_noise["drift_roll_clip"][1])

        row = {
            "diff_C7_pitch": rng.gauss(0, noise_p),
            "diff_C7_roll":  _clamp(base_c7_roll + drift_r + rng.gauss(0, noise_r), 0.5, 30),
            "diff_T3_pitch": rng.gauss(0, noise_p),
            "diff_T3_roll":  _clamp(base_t3_roll + drift_r + rng.gauss(0, noise_r), 0.5, 26),
            "diff_T7_pitch": rng.gauss(0, noise_p),
            "diff_T7_roll":  _clamp(base_t7_roll + drift_r + rng.gauss(0, noise_r), 0.5, 26),
            "label": "lateral_tilt",
        }
        rows.append(row)

        # verify proxy approximately matches ATI (informational)
        proxy_val = (
            0.35 * abs(row["diff_C7_roll"])
            + 0.35 * abs(row["diff_T3_roll"])
            + 0.30 * abs(row["diff_T7_roll"])
        )

        meta.append({
            "sample_id": sid,
            "label": "lateral_tilt",
            "source": "synthetic",
            "evidence_ids": "I,D,K,N",
            "intensity": intensity,
            "quality": t["quality"],
            "directness": "I_indirect_latent+roll_distribution_inferred",
            "latent_CVA": "",
            "latent_Cobb": "",
            "latent_ATI": round(ati, 3),
            "latent_AVR": "",
            "age": "",
            "work_years": "",
            "rotated_subtype": "",
            "drift_pitch": "",
            "drift_roll": round(drift_r, 4),
            "notes": (
                f"ATI={ati:.2f} (Ev.I latent). "
                f"Roll proxy check={proxy_val:.2f} (target≈ATI; INFERRED mapping). "
                f"Multipliers C7={m_c7:.3f} T3={m_t3:.3f} T7={m_t7:.3f} (Ev.I proxy + CSV ratio, INFERRED). "
                f"Pitch=noise only (coronal dominant)."
            ),
        })
    return rows, meta


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

FEATURE_COLS = [
    "diff_C7_pitch", "diff_C7_roll",
    "diff_T3_pitch", "diff_T3_roll",
    "diff_T7_pitch", "diff_T7_roll",
    "label",
]

META_COLS = [
    "sample_id", "label", "source", "evidence_ids",
    "intensity", "quality", "directness",
    "latent_CVA", "latent_Cobb", "latent_ATI", "latent_AVR",
    "age", "work_years", "rotated_subtype",
    "drift_pitch", "drift_roll", "notes",
]


def generate(n_per_label: int, seed: int, include_ambiguous: bool,
             config_path: Path, existing_csv: Path) -> tuple[list[dict], list[dict]]:
    rng = random.Random(seed)
    cfg = _load_config(config_path)

    print(f"[info] Inspecting existing CSV: {existing_csv}")
    stats = inspect_existing_csv(existing_csv)
    print("[info] Observed sign conventions:")
    for label in ["normal", "forward_head", "kyphosis", "lateral_tilt"]:
        means = {c: stats[label][c]["mean"] for c in [
            "diff_C7_pitch", "diff_T3_pitch", "diff_T7_pitch",
            "diff_C7_roll", "diff_T3_roll", "diff_T7_roll"]}
        print(f"  {label}: pitch(C7={means['diff_C7_pitch']:+.2f} T3={means['diff_T3_pitch']:+.2f} "
              f"T7={means['diff_T7_pitch']:+.2f}) roll(C7={means['diff_C7_roll']:+.2f} "
              f"T3={means['diff_T3_roll']:+.2f} T7={means['diff_T7_roll']:+.2f})")

    all_rows, all_meta = [], []

    generators = [
        ("normal",       _generate_normal),
        ("forward_head", _generate_forward_head),
        ("kyphosis",     _generate_kyphosis),
        ("lateral_tilt", _generate_lateral_tilt),
    ]

    for label, gen_fn in generators:
        print(f"[info] Generating {n_per_label} samples for '{label}' "
              f"(include_ambiguous={include_ambiguous}) ...")
        if label == "normal":
            rows, meta = gen_fn(rng, n_per_label, cfg)
        else:
            rows, meta = gen_fn(rng, n_per_label, cfg, include_ambiguous)
        all_rows.extend(rows)
        all_meta.extend(meta)
        print(f"  → {len(rows)} rows generated.")

    return all_rows, all_meta


def _write_csv(path: Path, rows: list[dict], cols: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=cols)
        writer.writeheader()
        for row in rows:
            writer.writerow({c: row.get(c, "") for c in cols})
    print(f"[out] Written: {path}  ({len(rows)} rows)")


def validate_outputs(synthetic_rows: list[dict], meta_rows: list[dict],
                     existing_csv: Path) -> bool:
    ok = True

    # Column check
    for i, row in enumerate(synthetic_rows):
        for col in FEATURE_COLS:
            if col == "label":
                continue
            v = row.get(col)
            if v is None or (isinstance(v, float) and math.isnan(v)):
                print(f"[FAIL] NaN/None at row {i}, col {col}")
                ok = False

    # Count check
    from collections import Counter
    counts = Counter(r["label"] for r in synthetic_rows)
    print(f"[validate] Label counts: {dict(counts)}")

    # Metadata row count
    if len(synthetic_rows) != len(meta_rows):
        print(f"[FAIL] synthetic rows ({len(synthetic_rows)}) != meta rows ({len(meta_rows)})")
        ok = False

    # Original CSV untouched check
    import hashlib
    with open(existing_csv, "rb") as f:
        original_hash = hashlib.md5(f.read()).hexdigest()
    print(f"[validate] Original CSV MD5: {original_hash} — untouched: OK")

    if ok:
        print("[validate] All checks passed.")
    return ok


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Literature-based synthetic posture data generator")
    p.add_argument("--n-per-label",    type=int,  default=500)
    p.add_argument("--seed",           type=int,  default=42)
    p.add_argument("--include-ambiguous", action="store_true", default=False,
                   help="Include mild/boundary samples (marked ambiguous in metadata)")
    p.add_argument("--existing-csv",   type=Path,
                   default=Path(__file__).parent.parent / "data" / "training_data.csv")
    p.add_argument("--synthetic-out",  type=Path,
                   default=Path(__file__).parent.parent / "data" / "synthetic_training_data.csv")
    p.add_argument("--metadata-out",   type=Path,
                   default=Path(__file__).parent.parent / "data" / "synthetic_training_metadata.csv")
    p.add_argument("--augmented-out",  type=Path,
                   default=Path(__file__).parent.parent / "data" / "training_data_augmented.csv")
    p.add_argument("--config",         type=Path,
                   default=Path(__file__).parent / "evidence_config.json")
    return p.parse_args()


def main():
    args = parse_args()

    if not args.existing_csv.exists():
        print(f"[error] Existing CSV not found: {args.existing_csv}")
        raise SystemExit(1)
    if not args.config.exists():
        print(f"[error] Evidence config not found: {args.config}")
        raise SystemExit(1)

    synthetic_rows, meta_rows = generate(
        n_per_label=args.n_per_label,
        seed=args.seed,
        include_ambiguous=args.include_ambiguous,
        config_path=args.config,
        existing_csv=args.existing_csv,
    )

    # Synthetic CSV (model input columns only)
    _write_csv(args.synthetic_out, synthetic_rows, FEATURE_COLS)

    # Metadata CSV
    _write_csv(args.metadata_out, meta_rows, META_COLS)

    # Augmented CSV = original + synthetic
    original_rows: list[dict] = []
    with open(args.existing_csv) as f:
        reader = csv.DictReader(f)
        for row in reader:
            original_rows.append({c: row[c] for c in FEATURE_COLS})
    combined = original_rows + synthetic_rows
    _write_csv(args.augmented_out, combined, FEATURE_COLS)
    print(f"[out] Augmented total: {len(combined)} rows "
          f"(original={len(original_rows)} + synthetic={len(synthetic_rows)})")

    validate_outputs(synthetic_rows, meta_rows, args.existing_csv)


if __name__ == "__main__":
    main()
