from pathlib import Path

import pandas as pd
import pytest
import yaml

from backend.dataset_pipeline import DatasetError, FEATURES, load_sources
from backend.train import stratified_split_indices

ROOT = Path(__file__).resolve().parents[1]
KAGGLE_CSV = ROOT / "datasets/raw/kaggle/Crop_recommendation.csv"
MAPPING = {"nitrogen": "N", "phosphorus": "P", "potassium": "K", "temperature": "temperature", "humidity": "humidity", "ph": "ph"}
UNITS = {"nitrogen": "kaggle_source_scale", "phosphorus": "kaggle_source_scale", "potassium": "kaggle_source_scale", "temperature": "C", "humidity": "%", "ph": "pH"}


def source(path, target_column="label", columns=None, units=None, label_policy=None):
    return {"path": path, "enabled": True, "target": "crop", "target_column": target_column,
            "columns": columns or MAPPING, "units": units or UNITS,
            **({"label_policy": label_policy} if label_policy is not None else {})}


def write_manifest(path, sources):
    manifest = path.parent / "manifest.yaml"
    manifest.write_text(yaml.safe_dump({"sources": sources}), encoding="utf-8")
    return manifest


def test_kaggle_dataset_loads_and_projects_only_shared_inputs():
    data, audit = load_sources(ROOT / "datasets/manifest.yaml", ROOT)
    assert len(data) == 2200
    assert data.crop.nunique() == 22
    assert FEATURES == ["nitrogen", "phosphorus", "potassium", "temperature", "humidity", "ph"]
    assert "rainfall" not in data.columns
    assert "rainfall" in audit["ignored_source_columns"][0]


def test_duplicate_records_from_source_are_removed(tmp_path):
    actual = pd.read_csv(KAGGLE_CSV)
    rows = pd.concat([actual.iloc[[0, 100]], actual.iloc[[0]]], ignore_index=True)
    rows.to_csv(tmp_path / "records.csv", index=False)
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("records.csv")])
    data, audit = load_sources(manifest, tmp_path)
    assert len(data) == 2
    assert audit["exact_duplicate_rows_removed"] == 1


def test_conflicting_labels_for_same_model_inputs_are_rejected(tmp_path):
    actual = pd.read_csv(KAGGLE_CSV)
    first = actual.iloc[[0]].copy()
    conflict = first.copy()
    conflict["label"] = actual.iloc[100]["label"]
    pd.concat([first, conflict]).to_csv(tmp_path / "conflict.csv", index=False)
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("conflict.csv")])
    with pytest.raises(DatasetError, match="conflicting crop labels"):
        load_sources(manifest, tmp_path)


def test_partial_missing_numeric_values_are_preserved_for_training_imputation(tmp_path):
    actual = pd.read_csv(KAGGLE_CSV)
    rows = pd.concat([actual.iloc[:10], actual.iloc[100:110]]).copy()
    rows.loc[rows.index[0], "N"] = float("nan")
    rows.to_csv(tmp_path / "missing.csv", index=False)
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("missing.csv")])
    data, audit = load_sources(manifest, tmp_path)
    assert len(data) == 20
    assert data.nitrogen.isna().sum() == 1
    assert audit["sources"][0]["rows_missing_features"] == 1


def test_incompatible_units_fail_instead_of_merging(tmp_path):
    source_data = pd.read_csv(KAGGLE_CSV)
    actual = source_data.iloc[[0, 100]]
    actual.to_csv(tmp_path / "one.csv", index=False)
    actual.to_csv(tmp_path / "two.csv", index=False)
    incompatible_units = {**UNITS, "temperature": "F"}
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("one.csv", label_policy="identity"), source("two.csv", units=incompatible_units, label_policy="identity")])
    with pytest.raises(DatasetError, match="units"):
        load_sources(manifest, tmp_path)


def test_different_raw_schemas_merge_after_explicit_mapping(tmp_path):
    source_data = pd.read_csv(KAGGLE_CSV)
    actual = source_data.iloc[[0, 100]]
    alternate_data = source_data.iloc[[1, 101]]
    actual.to_csv(tmp_path / "one.csv", index=False)
    rename = {"N": "nitrogen_value", "P": "p_value", "K": "k_value", "temperature": "temp_c",
              "humidity": "rh", "ph": "soil_ph", "label": "crop_name"}
    alternate_data.rename(columns=rename).to_csv(tmp_path / "two.csv", index=False)
    alternate = {canonical: rename[raw] for canonical, raw in MAPPING.items()}
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("one.csv", label_policy="identity"), source("two.csv", "crop_name", alternate, label_policy="identity")])
    data, audit = load_sources(manifest, tmp_path)
    assert len(data) == 4
    assert data.crop.nunique() == 2
    assert len(audit["sources"]) == 2


def test_multi_source_merge_requires_explicit_label_semantics(tmp_path):
    actual = pd.read_csv(KAGGLE_CSV).iloc[[0, 100]]
    actual.to_csv(tmp_path / "one.csv", index=False)
    actual.to_csv(tmp_path / "two.csv", index=False)
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("one.csv"), source("two.csv")])
    with pytest.raises(DatasetError, match="label_policy"):
        load_sources(manifest, tmp_path)


def test_manifest_enabled_flag_must_be_boolean(tmp_path):
    manifest = write_manifest(tmp_path / "manifest.yaml", [{"path": "missing.csv", "enabled": "false"}])
    with pytest.raises(DatasetError, match="enabled.*booleans"):
        load_sources(manifest, tmp_path)


def test_missing_manifest_is_a_clear_dataset_error(tmp_path):
    with pytest.raises(DatasetError, match="Could not read dataset manifest"):
        load_sources(tmp_path / "missing.yaml", tmp_path)


def test_non_finite_feature_values_are_rejected(tmp_path):
    actual = pd.read_csv(KAGGLE_CSV).iloc[[0, 100]].copy()
    actual["N"] = actual["N"].astype(float)
    actual.loc[actual.index[0], "N"] = float("inf")
    actual.to_csv(tmp_path / "infinite.csv", index=False)
    manifest = write_manifest(tmp_path / "manifest.yaml", [source("infinite.csv")])
    with pytest.raises(DatasetError, match="infinite values"):
        load_sources(manifest, tmp_path)


def test_stratified_train_test_indices_are_reproducible():
    labels = pd.read_csv(KAGGLE_CSV)["label"]
    first_train, first_test = stratified_split_indices(labels)
    second_train, second_test = stratified_split_indices(labels)
    assert first_train == second_train
    assert first_test == second_test
    assert len(first_test) == 440
