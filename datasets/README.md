# Dataset provenance

`raw/crop-recommendation-dataset.zip` is the downloaded Kaggle archive for `atharvaingle/crop-recommendation-dataset`; `raw/kaggle/Crop_recommendation.csv` is the extracted source CSV used by `manifest.yaml`.

The source schema is `N,P,K,temperature,humidity,ph,rainfall,label`. The training pipeline currently uses N, P, K, temperature, humidity, and pH. Rainfall is an extra source column not requested by the current form. No rows or labels have been added by CropSense.
