# Synthetic Posture Data Generator

Generates literature-based synthetic training data for the C7AI posture classifier.

## What it does

Produces synthetic rows of the same 7-column format used for model training:

```
diff_C7_pitch, diff_C7_roll, diff_T3_pitch, diff_T3_roll, diff_T7_pitch, diff_T7_roll, label
```

Metadata (latent variables, evidence provenance, quality flags) goes to a separate CSV
so the model training input remains clean.

---

## Evidence → label mapping

| Label | Evidence used | Directness |
|-------|--------------|-----------|
| `normal` | D (IMU noise/drift) | Direct |
| `forward_head` | B (CVA↔theta formula, direct) + C/E (CVA distribution, latent) + F (T3/T7 ratios, **inferred**) | Mixed |
| `kyphosis` | G/H (Cobb latent target) + F/K/M (pitch-diff structure, **inferred alpha**) + D (noise) | Mixed |
| `lateral_tilt` | I (ATI latent target) + D (noise); roll distribution **inferred** from proxy formula + CSV ratios | Inferred |

### forward_head

CVA (craniovertebral angle) is sampled from Evidence C/E distributions.
Converted to C7 theta via Evidence B's direct formula: `theta_C7 = CVA - 89`.
`diff_C7_pitch = -(theta_C7 - baseline_theta)` — positive = forward flexion, consistent with
the project's existing CSV sign convention.

**T3/T7 pitch contributions are inferred** (no direct IMU paper covers these for FHP).
Ratios are drawn from Evidence F's segment contribution prior and cross-checked against
the observed CSV means.

### kyphosis

A latent Cobb angle is sampled from Evidence G (hyperkyphosis thresholds) and H (normal range).
`thoracic_excess = Cobb - 35` (Evidence G direct formula) drives the pitch offsets.
Alpha scaling factors (T7 > T3 > C7) are **inferred** from the existing CSV's observed ratios
and Evidence F's segment contribution guidance. They are stored in metadata as `inferred`.

### lateral_tilt

A latent ATI (angle of trunk inclination) is sampled from Evidence I's distribution.
Roll values are distributed across C7/T3/T7 using an **inferred** formula derived from:
- Evidence I's proxy: `0.35·|C7_roll| + 0.35·|T3_roll| + 0.30·|T7_roll| ≈ ATI`
- The CSV-observed roll ratio (C7:T3:T7 ≈ 1.0:0.815:0.777)

The resulting scale factor and per-sensor multipliers are marked `inferred` in metadata.

---

## Direct vs inferred

| Parameter | Status | Evidence |
|-----------|--------|---------|
| `CVA = theta_C7 + 89` | **Direct** | B |
| `good_theta_c7 = -40°` | **Direct** | B |
| `CVA distributions (normal/severe FHP)` | **Direct** | C |
| `IMU noise: pitch sd=0.8, roll sd=1.0` | **Direct** | D |
| `Session drift: pitch sd=2.0, roll sd=1.5` | **Direct** | D |
| `ATI screening cutoffs (5°, 7°)` | **Direct** | I |
| `ATI proxy formula weights` | **Direct** | I |
| `Cobb thresholds (40/50°)` | **Direct** | G |
| `thoracic_excess = Cobb - 35` | **Direct** | G |
| T3/T7 pitch ratios for forward_head | **Inferred** | F + CSV |
| Alpha scaling for kyphosis pitch | **Inferred** | F + CSV |
| Roll multipliers for lateral_tilt | **Inferred** | I proxy + CSV |

---

## Why metadata is separated from model input

The model (RandomForestClassifier) must train on the same 7 features that the real ESP32
sensors produce at inference time. Latent variables (CVA, Cobb, ATI, age, etc.) do not
correspond to any real sensor output. Mixing them into the training CSV would train the
model on features that do not exist at prediction time.

---

## Why synthetic data must not replace real data

Per Evidence N (systematic review) and Evidence L (protocol guidance):

- Synthetic data has **domain gap**: it is generated from photogrammetry/X-ray/scoliometer
  papers, not actual C7/T3/T7 IMU measurements.
- **Subject-wise generalization drops** significantly (Evidence L: worst k-fold fold = 0.34).
- Use synthetic data for **distribution broadening / pretraining only**.
- **Validate and fine-tune on admin-collected real sensor data** from the `/pose-calibration`
  endpoint in `3_server.py`.

---

## Output files

| File | Contents |
|------|----------|
| `data/synthetic_training_data.csv` | Synthetic samples only — 7 columns, model-ready |
| `data/synthetic_training_metadata.csv` | Latent variables, quality flags, evidence provenance |
| `data/training_data_augmented.csv` | Original + synthetic combined — 7 columns, model-ready |

`data/training_data.csv` (original) is **never modified**.

---

## How to run

```bash
cd posture_server

# Default: 500 samples per label, seed=42, no ambiguous samples
python synthetic/generate_synthetic_data.py

# Custom options
python synthetic/generate_synthetic_data.py \
  --n-per-label 1000 \
  --seed 123 \
  --include-ambiguous \
  --synthetic-out data/synthetic_training_data.csv \
  --metadata-out  data/synthetic_training_metadata.csv \
  --augmented-out data/training_data_augmented.csv

# Use augmented CSV for training (does not overwrite models/default/)
python 2_train_model.py --csv-path data/training_data_augmented.csv --dry-run
```

### CLI options

| Option | Default | Description |
|--------|---------|-------------|
| `--n-per-label` | 500 | Samples per label |
| `--seed` | 42 | RNG seed for reproducibility |
| `--include-ambiguous` | false | Include mild/boundary samples (marked `ambiguous` in metadata) |
| `--existing-csv` | `data/training_data.csv` | Used for sign-convention inspection and augmented output |
| `--synthetic-out` | `data/synthetic_training_data.csv` | Synthetic-only output |
| `--metadata-out` | `data/synthetic_training_metadata.csv` | Metadata output |
| `--augmented-out` | `data/training_data_augmented.csv` | Combined output |
| `--config` | `synthetic/evidence_config.json` | Evidence config file |
