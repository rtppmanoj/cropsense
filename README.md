# CropSense

React and TypeScript frontend with a Python/scikit-learn crop recommendation API. Crop examples are loaded from CSV files; crop labels, requirements, and recommendation mappings are not embedded in frontend code.

## Dataset and feature coverage

The Kaggle Crop Recommendation Dataset linked by the project owner is in `datasets/raw/kaggle/Crop_recommendation.csv` (2,200 labeled rows). The current model uses its six compatible source fields: N, P, K, temperature, humidity, and pH. The CSV also contains rainfall, which the current form does not request.

The Kaggle file does not establish a physical unit conversion for N, P, and K. CropSense keeps those columns in the original file's `kaggle_source_scale`; this token means only that exact source scale, not a portable physical unit. Future datasets with different nutrient units must be converted against a documented definition or rejected. The app does not label these values kg/ha.

## Run locally

Requires Node.js 20.19+ (or 22.12+) and Python 3.12+.

```powershell
npm.cmd install
python -m pip install -r requirements.txt
python -m backend.train
```

In two terminals, start the API and UI:

```powershell
npm.cmd run dev:api
```

```powershell
npm.cmd run dev
```

Open the Vite URL printed in the UI terminal. `npm.cmd run dev:api` binds the local API to `127.0.0.1:8013`, and Vite proxies `/api` there by default. If you choose another API port/origin, set `CROPSENSE_API_ORIGIN` before starting Vite, for example `$env:CROPSENSE_API_ORIGIN = "http://127.0.0.1:8000"`. After editing a CSV or the manifest, rerun `python -m backend.train` to regenerate `models/crop_model.joblib` and its metadata; the API detects the new artifact and reloads it on the next request.

## Training and evaluation

`backend/train.py` first validates and canonicalizes each configured CSV, removes duplicate records in the features the model actually uses, rejects conflicting duplicate labels, and keeps incomplete feature cells for median imputation inside the training pipeline. Crop labels without a value are discarded. It makes a stratified 80/20 split before fitting preprocessing, compares Random Forest, Extra Trees, and HistGradientBoosting with stratified cross-validation on the training partition, then evaluates the selected classifier once on the untouched holdout set. The Random Forest candidate uses 100 trees and one worker: a local benchmark reduced artifact loading from about 27 seconds to under half a second while retaining the measured validation score. After reporting holdout metrics, training refits the selected model on all labeled rows. The generated `models/evaluation.json` contains measured holdout accuracy, balanced accuracy, macro precision/recall/F1, log loss, top-five accuracy, class report, and candidate CV scores.

Model scores are classifier probability estimates and are not calibrated guarantees of agricultural success. Predictions are marked uncertain if the top score is no greater than the uniform chance baseline for the model's number of classes, or if inputs fall outside the observed training ranges.

## Add more datasets

1. Put a CSV under `datasets/raw/`.
2. Add an entry in `datasets/manifest.yaml` with its path, `enabled: true`, `target: crop`, its actual `target_column`, a mapping for all six canonical model features, and units for each mapped feature. The current NPK token is specific to this Kaggle file's scale.
3. Convert source units before ingestion if they differ. The trainer rejects mismatched units or missing mapped columns instead of guessing. If enabling multiple files, add `label_policy: identity` only when their crop labels have the same meaning, or provide an explicit raw-to-canonical label mapping for each source.
4. Compatible sources are merged only after canonical feature, unit, and label mapping. Additional unused columns such as rainfall may differ; only the six supported features and crop label train this current model. New classes and records are discovered from the CSV automatically.
5. Run `python -m backend.train` and review the generated audit and evaluation report.

New model inputs need genuine labeled examples, documented units, and an explicit schema change. Do not relabel a different measurement or infer one from unrelated values. The current source archive and extracted CSV are preserved in `datasets/raw/` for provenance.

### Adding model input fields
Every additional feature needs genuinely measured values, compatible units, and defensible crop labels. Add its source mapping, request schema, frontend input, model pipeline field, and evaluation coverage together. Do not infer a measurement from unrelated values. The current Kaggle file has no farm/site identifiers, so its random holdout cannot establish independent-farm generalization or protect against correlated source examples.

### Production operations

New CSVs do not trigger automatic retraining. Run `python -m backend.train` after reviewing the new source; the API reloads the resulting artifact on the next request. The provided `dev:api` command uses Uvicorn reload and is for local development. Before public deployment, run a production ASGI server without reload, set `CROPSENSE_CORS_ORIGINS` to the deployed frontend origins, restrict network access/rate-limit inference at the deployment layer, and only load model artifacts produced by a trusted training run. The joblib hash check detects mismatched/corrupt artifacts but does not make an untrusted pickle safe.

## Tests and checks

```powershell
npm.cmd run test:backend
npm.cmd run test:frontend
npm.cmd run build
npm.cmd run lint
```

Backend modules: `backend/dataset_pipeline.py` (CSV mapping and validation), `backend/train.py` (training and evaluation), `backend/api.py` (inference), and `backend/schemas.py` (input validation). React pages continue to provide home, results, about, navigation, and English/Hindi/Tamil/Telugu language selection.

## Authentication and role-based access

CropSense supports two server-enforced roles: `admin` and `farmer`. Farmer accounts can register at `/farmer/register`; there is no public admin-registration endpoint. Admin accounts are provisioned by an operator. Passwords use Argon2id hashes. The API issues a random opaque session token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 digest is stored in SQLite. Sessions expire after eight hours by default, logout revokes the current session, password changes revoke other sessions, and suspending a farmer revokes all of their sessions. Farmer history and saved recommendations are always queried using the authenticated user ID.

SQLite schema migrations in `backend/migrations/` apply at API startup. The default database is `data/cropsense.sqlite3` (ignored by Git). Configure `CROPSENSE_DB_PATH` to use a persistent database location in deployment. Migration `002_farmer_contact_and_location.sql` adds farmer mobile numbers and per-recommendation farm coordinates; migration `003_land_area.sql` stores cultivated acreage; migration `004_farmer_admin_location.sql` stores the selected village, district, and state for weather lookup; migration `007_recommendation_report_ids.sql` assigns each farmer sequential five-digit report IDs and backfills existing recommendation history; migration `008_farmer_report_counters.sql` preserves report ID sequences after old history is removed. Recommendation input/result records and their associated audit details are deleted after 90 days when an administrator successfully signs in. This retention does not delete farmer accounts or saved scheme tracking. Back up this database and protect it as sensitive account and farm data.

Configure these environment variables before starting the API:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CROPSENSE_DB_PATH` | `data/cropsense.sqlite3` | SQLite database path; absolute or project-relative. |
| `GOOGLE_MAPS_API_KEY` | unset | Server-side Google Geocoding API key used to resolve typed farmer locations. Keep it in the API deployment secret store; never put it in frontend variables. |
| `SMTP_EMAIL` | unset | Gmail SMTP account used by the API to send recommendation PDFs. Set to `cropsensevit@gmail.com`. |
| `SMTP_APP_PASSWORD` | unset | Google App Password for `SMTP_EMAIL`; backend only. Never use a normal Gmail password or add this value to a `VITE_` variable. |
| `OPENROUTER_API_KEY` | unset | OpenRouter API key used by the FastAPI chatbot endpoint. Backend only; never add to frontend/Vite variables. |
| `OPENROUTER_MODEL` | `nvidia/nemotron-3-ultra-550b-a55b:free` | Primary OpenRouter chatbot model. |
| `OPENROUTER_FALLBACK_MODELS` | NVIDIA Nemotron 3.5 Super VL, Nemotron 3.5 Lightning, Google Gemma 4 31B, Google Gemma 4 26B A4B, then `openrouter/free` | Comma-separated model fallback order; all configured defaults are free endpoints or the free model router. |
| `OPENROUTER_SITE_URL` | unset | Optional site origin sent as OpenRouter's `HTTP-Referer` metadata. |
| `OPENROUTER_APP_NAME` | `CropSaathi AI` | Optional application title sent as OpenRouter's `X-Title` metadata. |

| `CROPSENSE_SESSION_HOURS` | `8` | Session lifetime, clamped to 1â€“720 hours. |
| `CROPSENSE_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Exact allowed frontend origins. Set deployed HTTPS origins in production. |
| `CROPSENSE_ENV` | `development` | Set to `production` to enable production cookie and HSTS behavior. |
| `CROPSENSE_COOKIE_SECURE` | false locally; true in production | Force Secure cookies when TLS terminates at your deployment edge. |
| `CROPSENSE_ADMIN_EMAIL` | unset | Required only for initial admin provisioning. |
| `CROPSENSE_ADMIN_PASSWORD` | unset | Required only for initial admin provisioning; 8-128 characters. |

Install backend requirements, set the initial admin credentials in the current PowerShell session, and provision once:

```powershell
python -m pip install -r requirements.txt
$env:CROPSENSE_ADMIN_EMAIL = Read-Host "Initial admin email"
$secureAdminPassword = Read-Host "Initial admin password" -AsSecureString
$env:CROPSENSE_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secureAdminPassword).Password
python -m backend.auth_admin
Remove-Item Env:CROPSENSE_ADMIN_EMAIL
Remove-Item Env:CROPSENSE_ADMIN_PASSWORD
Remove-Variable secureAdminPassword
```

The provisioning command refuses to replace an existing admin and never prints the password. Keep the initial credential out of source control and shell history; use your deployment secret manager outside local development. Then run the existing commands in separate terminals:

```powershell
npm.cmd run dev:api
npm.cmd run dev
```

### Emailing recommendation PDFs

The results page's **Email PDF to me** action sends the generated report to the signed-in farmer's registered account email. The FastAPI server uses Gmail SMTP with STARTTLS; the browser never receives SMTP credentials or chooses the destination address. CropSense does not submit applications or other forms by email. Print remains available independently.

For local development, copy `.env.example` to `.env` (or set the variables in the API process environment). In the Google account `cropsensevit@gmail.com`, enable 2-Step Verification and create an App Password for this application. Set `SMTP_EMAIL=cropsensevit@gmail.com` and `SMTP_APP_PASSWORD` to that App Password in `.env` or your deployment's secret manager, then restart the API. Do not commit `.env`; do not put SMTP credentials in frontend/Vite configuration. The same Gmail SMTP configuration sends one-time password reset codes for farmer accounts; the administrator sign-in does not offer password reset. Reset codes expire after 10 minutes and are single-use. Automated tests replace SMTP with a mock and never send real mail.

### CropSaathi AI

The site chat widget is available to farmers and public visitors and is hidden for administrator accounts and the admin sign-in page. It uses the OpenRouter Chat Completions API through FastAPI, with a backend-only API key, a per-IP request limit, and a CropSense-specific system prompt. The form helper gathers the existing recommendation form values step by step for a signed-in farmer and places them in the form for review. Chat messages are sent to OpenRouter to generate replies; farmers are prompted not to enter passwords, bank details, or identity numbers. Set the four `OPENROUTER_*` values above in `.env` or the API secret store and restart the API. Choose a model identifier available to your OpenRouter account. If no key/model is configured or the chat service is unavailable, the widget falls back to its built-in CropSense topic guidance.

The navigation offers one `/login` page. `POST /api/auth/login` checks the stored account role and the React client routes admins to `/admin/dashboard` and farmers to `/farmer/dashboard`; the browser does not submit a role. Farmer registration at `/farmer/register` asks for name, email, mobile number, and password. There is no public admin-registration endpoint. Older `/admin/login` and `/farmer/login` URLs redirect to the shared page.

The admin dashboard reports farmer accounts, active farmers, recommendation totals and today's submissions (India time), currently active unexpired sessions, a 30-day crop popularity summary, and the latest recommendations from today. Successful logins are counted distinctly from audit events. Recommendation activity is retained for 90 days and purged at successful admin login. The dashboard also shows farmer status/search, saved recommendation activity with farmer-entered area, audit events, dataset availability, and trained artifact evaluation metrics. Dataset training remains a deliberate operator action (`python -m backend.train`); the dashboard does not trigger a training job.

The results page resolves crop-specific reference images from Wikipedia and provides a share action and downloadable PDF report. Crop recommendations include an indicative per-acre yield benchmark and an estimated harvest based on the farmer's entered acreage. No current market prices or market-based revenue estimates are provided.

The classifier predicts crop labels, not yield. For planning context, CropSense shows an indicative per-acre yield benchmark from `backend/yield_benchmarks.py` (including Rice 22, Maize 25, and Wheat 18 quintals/acre), then multiplies that benchmark by the farmer's acreage to estimate harvest. These generic values are not location-validated agronomic forecasts; actual yields vary by location, season, and farming practices. No crop price or revenue estimate is included.

Signed-in farmers can enter an address and resolve it through the Google Geocoding API, select a map point, or use browser geolocation. Text geocoding requires `GOOGLE_MAPS_API_KEY` on the API server and the Google Cloud Geocoding API enabled for that key. Restrict the key to that API, set quota/billing alerts, and keep it in the deployment secret store. The API returns the resolved address and coordinates; the form places a zoomed map marker there and saves the label, latitude, longitude, and source (`google`, `map`, or `gps`) with the farmer's recommendation, separately from model inputs. The map currently displays OpenStreetMap tiles; configure `VITE_MAP_TILE_URL` for a compatible provider. Map and geocoding requests disclose the searched/viewed place to those providers. The home page has no recommendation form; recommendations require a farmer session through `/api/farmer/recommend`, which also saves the request to private history. The legacy `/api/recommend` route has been removed.

The API enforces the role on each private route; client-side route guards are only navigation convenience. Authentication requests use `credentials: include`; mutation endpoints validate an allowed `Origin`, require JSON, and use SameSite cookies. Keep the frontend and API same-site, preferably behind the existing same-origin `/api` proxy; a cross-site deployment needs a deliberate CSRF-token and cookie policy before enabling it. Before production, run one API instance with a persistent protected database volume, scheduled backups and restore checks, HTTPS, ingress/WAF rate limits, monitoring, and a tested retention policy. SQLite is the current database: it is free and appropriate for a single-instance deployment on persistent storage, but it is not a managed multi-region database and should not be shared by multiple API replicas over a network filesystem. `CROPSENSE_DB_PATH` lets deployment select the persistent volume path. MongoDB Atlas has a free tier, but this codebase does not use MongoDB; changing providers needs a deliberate migration of the SQL auth, session, audit, and history store and a verified backup/import process. Email ownership is not verified, and account recovery is not implemented. Configure `CROPSENSE_COOKIE_SECURE=true` when TLS terminates at a proxy, and set exact `CROPSENSE_CORS_ORIGINS`; do not deploy the development defaults publicly.

## Dataset source

The CSV was downloaded from the public Kaggle dataset referenced by the project: [Crop Recommendation Dataset](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset). The supplied notebook reference is [What crop to grow?](https://www.kaggle.com/code/atharvaingle/what-crop-to-grow).


### Weather and climate outlook

The farmer dashboard uses Open-Meteo Geocoding to verify a typed village against the selected district and state in India, then requests monthly ECMWF seasonal outlooks and ERA5-Land daily history through the FastAPI backend. Seasonal values can extend up to seven months but are uncertain area-scale model output, not daily predictions. History uses the previous ten complete calendar years and is kept separate from forecast values. The backend caches successful weather data for six hours by coordinate; tune `WEATHER_CACHE_TTL_SECONDS` and `WEATHER_REQUEST_TIMEOUT_SECONDS` in the backend environment if needed. No API key is required for the documented non-commercial endpoints. Open-Meteo data attribution and CC BY 4.0 links appear in the dashboard; production commercial use requires an appropriate Open-Meteo subscription.
