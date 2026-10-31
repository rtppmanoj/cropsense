"""Leakage-aware model selection, holdout evaluation, and artifact export."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, classification_report,
                             f1_score, log_loss, precision_score, recall_score, top_k_accuracy_score)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline

from backend.dataset_pipeline import FEATURES, DatasetError, load_sources, write_json

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"


def build_candidates() -> dict[str, Pipeline]:
    candidates = {
        "random_forest": RandomForestClassifier(n_estimators=100, min_samples_leaf=2, max_features="sqrt",
                                                 class_weight="balanced_subsample", random_state=42, n_jobs=1),
        "extra_trees": ExtraTreesClassifier(n_estimators=500, min_samples_leaf=2, max_features="sqrt",
                                              class_weight="balanced", random_state=42, n_jobs=-1),
        "hist_gradient_boosting": HistGradientBoostingClassifier(max_iter=200, l2_regularization=1.0,
                                                                  random_state=42),
    }
    return {name: Pipeline([("imputer", SimpleImputer(strategy="median", add_indicator=True)), ("classifier", model)])
            for name, model in candidates.items()}


def stratified_split_indices(labels, test_fraction: float = 0.2, random_seed: int = 42):
    return train_test_split(list(range(len(labels))), test_size=test_fraction, random_state=random_seed, stratify=labels)


def train(manifest: Path = ROOT / "datasets" / "manifest.yaml") -> dict:
    data, audit = load_sources(manifest, ROOT)
    data = data.sort_values([*FEATURES, "crop"], kind="mergesort").reset_index(drop=True)
    class_counts = data["crop"].value_counts()
    if int(class_counts.min()) < 10:
        raise DatasetError("Each crop needs at least 10 records for stratified training/evaluation.")
    X, y = data[FEATURES], data["crop"]
    train_indices, test_indices = stratified_split_indices(y)
    X_train, X_test = X.iloc[train_indices], X.iloc[test_indices]
    y_train, y_test = y.iloc[train_indices], y.iloc[test_indices]
    folds = min(5, int(y_train.value_counts().min()))
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=42)
    candidates = build_candidates()
    cv_scores: dict[str, dict] = {}
    for name, pipeline in candidates.items():
        scores = cross_validate(pipeline, X_train, y_train, cv=cv,
                                scoring={"macro_f1": "f1_macro", "balanced_accuracy": "balanced_accuracy"},
                                n_jobs=1, return_train_score=False)
        cv_scores[name] = {"macro_f1_mean": float(scores["test_macro_f1"].mean()),
                           "macro_f1_std": float(scores["test_macro_f1"].std()),
                           "balanced_accuracy_mean": float(scores["test_balanced_accuracy"].mean())}
    selected_name = max(cv_scores, key=lambda name: cv_scores[name]["macro_f1_mean"])
    evaluation_model = candidates[selected_name].fit(X_train, y_train)
    predicted = evaluation_model.predict(X_test)
    probabilities = evaluation_model.predict_proba(X_test)
    classes = evaluation_model.named_steps["classifier"].classes_.tolist()
    metrics = {
        "holdout_rows": int(len(y_test)), "holdout_accuracy": float(accuracy_score(y_test, predicted)),
        "holdout_balanced_accuracy": float(balanced_accuracy_score(y_test, predicted)),
        "holdout_macro_precision": float(precision_score(y_test, predicted, average="macro", zero_division=0)),
        "holdout_macro_recall": float(recall_score(y_test, predicted, average="macro", zero_division=0)),
        "holdout_macro_f1": float(f1_score(y_test, predicted, average="macro", zero_division=0)),
        "holdout_log_loss": float(log_loss(y_test, probabilities, labels=classes)),
        "holdout_top5_accuracy": float(top_k_accuracy_score(y_test, probabilities, k=min(5, len(classes)), labels=classes)),
        "classification_report": classification_report(y_test, predicted, output_dict=True, zero_division=0),
        "test_fraction": 0.2, "random_seed": 42, "cv_folds_on_training_only": folds,
        "candidate_cv_scores": cv_scores, "selected_by": "mean cross-validated macro F1 on training split",
        "selection": selected_name, "sklearn_version": sklearn.__version__,
    }
    # The holdout metrics above are computed before refitting the deployable model on all labeled rows.
    final_estimator = build_candidates()[selected_name].fit(X, y)
    final_matrix = X.copy()
    final_matrix[FEATURES] = final_estimator.named_steps["imputer"].transform(X)[:, :len(FEATURES)]
    scales = (final_matrix[FEATURES].quantile(.75) - final_matrix[FEATURES].quantile(.25)).replace(0, 1)
    class_centers = {}
    for crop, group in final_matrix.groupby(y.loc[final_matrix.index]):
        class_centers[str(crop)] = {feature: float(value) for feature, value in group[FEATURES].median().items()}
    ranges = {feature: [float(X[feature].min()), float(X[feature].max())] for feature in FEATURES}
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = MODEL_DIR / "crop_model.joblib"
    temporary_artifact = artifact_path.with_suffix(".joblib.tmp")
    joblib.dump(final_estimator, temporary_artifact)
    temporary_artifact.replace(artifact_path)
    artifact_hash = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
    fingerprint_frame = data[[*FEATURES, "crop"]].sort_values([*FEATURES, "crop"]).reset_index(drop=True)
    dataset_fingerprint = hashlib.sha256(pd.util.hash_pandas_object(fingerprint_frame, index=False).values.tobytes()).hexdigest()
    metadata = {
        "model_name": selected_name, "model_version": artifact_hash[:12], "features": FEATURES,
        "feature_units": audit["units"], "classes": classes,
        "dataset_fingerprint": dataset_fingerprint,
        "excluded_source_columns": audit["ignored_source_columns"],
        "dataset_audit": audit, "final_fit_rows": int(len(y)), "final_fit_class_counts": {str(k): int(v) for k, v in y.value_counts().items()},
        "training_ranges": ranges, "class_centers": class_centers,
        "feature_scales": {key: float(value) for key, value in scales.items()},
        "evaluation": metrics, "artifact": str(artifact_path.relative_to(ROOT)), "artifact_sha256": artifact_hash,
    }
    write_json(MODEL_DIR / "metadata.json", metadata)
    report = {"model": selected_name, "evaluation": metrics, "dataset_audit": audit,
              "artifact": str(artifact_path.relative_to(ROOT))}
    write_json(MODEL_DIR / "evaluation.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "datasets" / "manifest.yaml")
    args = parser.parse_args()
    try:
        result = train(args.manifest)
        print(json.dumps({"model": result["model"], "evaluation": result["evaluation"],
                          "dataset_audit": result["dataset_audit"], "artifact": result["artifact"]}, indent=2))
    except DatasetError as exc:
        print(f"Dataset error: {exc}", file=sys.stderr)
        raise SystemExit(2)
