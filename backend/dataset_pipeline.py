"""Explicit, validated CSV ingestion for compatible crop datasets."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml

FEATURES = ["nitrogen", "phosphorus", "potassium", "temperature", "humidity", "ph"]
INPUT_UNITS = {
    "nitrogen": "kaggle_source_scale", "phosphorus": "kaggle_source_scale", "potassium": "kaggle_source_scale",
    "temperature": "C", "humidity": "%", "ph": "pH",
}


class DatasetError(ValueError):
    pass


def load_sources(manifest_path: Path, root: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    try:
        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        raise DatasetError(f"Could not read dataset manifest {manifest_path}: {exc}") from exc
    if not isinstance(manifest, dict):
        raise DatasetError("Dataset manifest must contain a YAML mapping with a sources list.")
    sources = manifest.get("sources", [])
    if not sources:
        raise DatasetError("No datasets are configured in datasets/manifest.yaml.")
    if not isinstance(sources, list) or any(not isinstance(source, dict) for source in sources):
        raise DatasetError("Manifest 'sources' must be a list of source mappings.")
    if any("enabled" in source and not isinstance(source["enabled"], bool) for source in sources):
        raise DatasetError("Manifest source 'enabled' values must be booleans.")
    enabled_sources = [source for source in sources if source.get("enabled", True)]
    if len(enabled_sources) > 1 and any("label_policy" not in source for source in enabled_sources):
        raise DatasetError("When merging multiple datasets, declare label_policy: identity or a raw-to-canonical label mapping for every source.")

    frames: list[pd.DataFrame] = []
    audits: list[dict[str, Any]] = []
    expected_units: dict[str, str] | None = None
    target_name: str | None = None
    schema_signature: tuple[str, ...] | None = None
    for source in enabled_sources:
        source_path = source.get("path")
        if not isinstance(source_path, str) or not source_path.strip():
            raise DatasetError("Every enabled dataset source needs a non-empty relative path.")
        path = (root / source_path).resolve()
        if not path.is_relative_to(root.resolve()):
            raise DatasetError(f"Dataset path escapes project directory: {source_path}")
        if not path.is_file():
            raise DatasetError(f"Dataset file not found: {source_path}")
        mapping = source.get("columns", {})
        target = source.get("target")
        target_column = source.get("target_column")
        units = source.get("units", {})
        if not isinstance(mapping, dict) or not isinstance(units, dict):
            raise DatasetError(f"{source_path}: columns and units must be mappings.")
        missing_mapping = [name for name in FEATURES if name not in mapping]
        if missing_mapping or target != "crop" or not isinstance(target_column, str) or not target_column:
            raise DatasetError(f"{source_path}: map all required features and map the source label column to canonical target 'crop'; missing {missing_mapping}.")
        mapped_columns = list(mapping.values())
        if any(not isinstance(column, str) or not column.strip() for column in mapped_columns):
            raise DatasetError(f"{source_path}: mapped source column names must be non-empty strings.")
        if len(set(mapped_columns)) != len(mapped_columns) or target_column in mapped_columns:
            raise DatasetError(f"{source_path}: each model feature and the crop target must map to a distinct source column.")
        canonical_units = {key: units.get(key) for key in FEATURES}
        if canonical_units != INPUT_UNITS:
            raise DatasetError(f"{source_path}: units must match canonical units {INPUT_UNITS}; convert the source explicitly before combining.")
        if expected_units is not None and (canonical_units != expected_units or target != target_name or tuple(FEATURES) != schema_signature):
            raise DatasetError(f"Incompatible dataset schema or units in {source_path}; sources are not merged.")
        expected_units, target_name, schema_signature = canonical_units, target, tuple(FEATURES)

        label_policy = source.get("label_policy", "identity")
        if label_policy != "identity" and not isinstance(label_policy, dict):
            raise DatasetError(f"{source_path}: label_policy must be 'identity' or an explicit raw-to-canonical label mapping.")
        if isinstance(label_policy, dict):
            if any(not isinstance(key, str) or not isinstance(value, str) for key, value in label_policy.items()):
                raise DatasetError(f"{source_path}: label mapping keys and values must be strings.")
            label_policy = {key.strip().lower(): value.strip().lower() for key, value in label_policy.items()}
            if not label_policy or any(not key or not value for key, value in label_policy.items()):
                raise DatasetError(f"{source_path}: label mapping keys and values must be non-empty.")

        try:
            raw = pd.read_csv(path)
        except Exception as exc:
            raise DatasetError(f"Could not read {source_path}: {exc}") from exc
        required_columns = [*mapping.values(), target_column]
        absent = [column for column in required_columns if column not in raw.columns]
        if absent:
            raise DatasetError(f"{source_path}: mapped source columns are missing: {absent}")
        frame = raw[[*(mapping[name] for name in FEATURES), target_column]].copy()
        frame.columns = [*FEATURES, "crop"]
        for feature in FEATURES:
            original_nonempty = frame[feature].notna()
            frame[feature] = pd.to_numeric(frame[feature], errors="coerce")
            if (original_nonempty & frame[feature].isna()).any():
                raise DatasetError(f"{source['path']}: non-numeric values found in {mapping[feature]}.")
            if np.isinf(frame[feature].dropna().to_numpy(dtype=float)).any():
                raise DatasetError(f"{source_path}: infinite values found in {mapping[feature]}.")
        frame["crop"] = frame["crop"].astype("string").str.strip().str.lower()
        frame.loc[frame["crop"] == "", "crop"] = pd.NA
        invalid_label_rows = int(frame["crop"].isna().sum())
        frame = frame.dropna(subset=["crop"])
        if isinstance(label_policy, dict):
            unmapped_labels = sorted(set(frame["crop"].astype(str)) - set(label_policy))
            if unmapped_labels:
                raise DatasetError(f"{source_path}: crop labels lack explicit canonical mappings: {unmapped_labels[:10]}")
            frame["crop"] = frame["crop"].map(label_policy)
        if frame[FEATURES].isna().all(axis=1).any():
            raise DatasetError(f"{source['path']}: rows missing every model feature cannot be imputed.")
        if frame[FEATURES].isna().mean().max() > 0.25:
            raise DatasetError(f"{source['path']}: a model feature is over 25% missing; review the source before training.")
        frame["_source"] = source_path
        frames.append(frame)
        audits.append({"file": source_path, "source_rows": len(raw), "rows_missing_target_removed": invalid_label_rows,
                       "rows_missing_features": int(frame[FEATURES].isna().any(axis=1).sum()), "columns": list(raw.columns),
                       "mapped_features": mapping, "units": canonical_units,
                       "label_policy": "explicit_mapping" if isinstance(label_policy, dict) else "identity"})

    if not frames:
        raise DatasetError("No enabled datasets are configured.")
    combined = pd.concat(frames, ignore_index=True)
    combined_rows_before_deduplication = len(combined)
    key_cols = [*FEATURES]
    duplicate_mask = combined.duplicated(subset=[*key_cols, "crop"], keep="first")
    duplicate_count = int(duplicate_mask.sum())
    combined = combined.loc[~duplicate_mask].reset_index(drop=True)
    conflicting = combined.duplicated(subset=key_cols, keep=False)
    if conflicting.any():
        raise DatasetError("Identical feature rows have conflicting crop labels; resolve these records before training.")
    if combined["crop"].nunique() < 2:
        raise DatasetError("At least two crop labels are required to train a classifier.")
    audit = {"sources": audits, "combined_rows_before_deduplication": combined_rows_before_deduplication,
             "exact_duplicate_rows_removed": duplicate_count, "training_rows": len(combined),
             "crop_classes": int(combined["crop"].nunique()), "features": FEATURES, "units": INPUT_UNITS,
             "ignored_source_columns": ["rainfall: not supplied as an input measurement"]}
    return combined, audit


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)
