"""Open-Meteo seasonal outlook and historical climate helpers."""
from __future__ import annotations

import json
import logging
import math
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timezone
from functools import lru_cache

logger = logging.getLogger(__name__)
TIMEOUT = float(os.getenv("WEATHER_REQUEST_TIMEOUT_SECONDS", "8"))
CACHE_TTL = max(60, int(os.getenv("WEATHER_CACHE_TTL_SECONDS", "21600")))
_CACHE: dict[tuple, tuple[float, dict]] = {}
_CACHE_LOCK = threading.Lock()
_REQUEST_SLOTS = threading.BoundedSemaphore(4)
_NOMINATIM_LOCK = threading.Lock()
_NOMINATIM_LAST_REQUEST = 0.0


class WeatherProviderError(Exception):
    pass


class LocationNotFound(Exception):
    pass


class LocationAmbiguous(Exception):
    pass


def _request_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "CropSense/1.0"})
    try:
        with _REQUEST_SLOTS:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.warning("Open-Meteo request failed (%s)", type(exc).__name__)
        raise WeatherProviderError("Weather data is temporarily unavailable.") from exc
    if not isinstance(payload, dict) or payload.get("error"):
        logger.warning("Open-Meteo returned an invalid or error response")
        raise WeatherProviderError("Weather data is temporarily unavailable.")
    return payload


def _normalize(value: str) -> str:
    return " ".join("".join(char.lower() if char.isalnum() else " " for char in value).split())


def _district_key(value: str) -> str:
    normalized = _normalize(value)
    for suffix in (" district", " districts", " dist", " zila", " zilla"):
        if normalized.endswith(suffix):
            return normalized[:-len(suffix)].strip()
    return normalized


def _geocode(name: str) -> list[dict]:
    query = urllib.parse.urlencode({"name": name, "countryCode": "IN", "count": 100, "language": "en"})
    result = _request_json(f"https://geocoding-api.open-meteo.com/v1/search?{query}")
    matches = result.get("results") or []
    return [item for item in matches if isinstance(item, dict)
            and str(item.get("country_code", "")).upper() == "IN"
            and _normalize(str(item.get("admin1", ""))) == _normalize(name.rsplit(",", 1)[-1].strip())
            and isinstance(item.get("latitude"), (int, float))
            and isinstance(item.get("longitude"), (int, float))]


def _nominatim_district(district: str, state: str) -> dict | None:
    """Use OSM's public geocoder as a district-center fallback when Open-Meteo has no gazetteer hit."""
    global _NOMINATIM_LAST_REQUEST
    query = urllib.parse.urlencode({"q": f"{district}, {state}, India", "format": "jsonv2", "limit": 5,
                                    "addressdetails": 1, "countrycodes": "in"})
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={"Accept": "application/json", "User-Agent": "CropSense/1.0 (weather district lookup)"})
    try:
        # Nominatim's public endpoint asks clients to stay at or below one request per second.
        with _NOMINATIM_LOCK:
            wait = 1.0 - (time.monotonic() - _NOMINATIM_LAST_REQUEST)
            if wait > 0:
                time.sleep(wait)
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                result = json.loads(response.read().decode("utf-8"))
            _NOMINATIM_LAST_REQUEST = time.monotonic()
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.info("OpenStreetMap district geocoder unavailable (%s)", type(exc).__name__)
        return None
    if not isinstance(result, list):
        return None
    district_key, state_key = _district_key(district), _normalize(state)
    for item in result:
        if not isinstance(item, dict):
            continue
        address = item.get("address") if isinstance(item.get("address"), dict) else {}
        label = _normalize(str(item.get("display_name", "")))
        resolved_state = _normalize(str(address.get("state", "")))
        country = _normalize(str(address.get("country", "")))
        if district_key not in label or state_key not in label or country != "india":
            continue
        if resolved_state and resolved_state != state_key:
            continue
        try:
            latitude, longitude = float(item["lat"]), float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not _india_coordinates(latitude, longitude):
            continue
        return {"latitude": latitude, "longitude": longitude,
                "resolved_name": str(item.get("name") or district),
                "resolved_district": district, "resolved_state": state, "report_level": "district"}
    return None


@lru_cache(maxsize=512)
def resolve_location(village: str, district: str, state: str) -> dict:
    """Resolve the village exactly, then fall back to the selected district center."""
    village_matches = _geocode(f"{village}, {state}")
    valid_villages = [item for item in village_matches
                      if _normalize(str(item.get("name", ""))) == _normalize(village)
                      and _district_key(str(item.get("admin2", ""))) == _district_key(district)]
    if valid_villages:
        point = valid_villages[0]
        return {"latitude": float(point["latitude"]), "longitude": float(point["longitude"]),
                "resolved_name": str(point["name"]), "resolved_district": str(point.get("admin2", district)),
                "resolved_state": str(point["admin1"]), "report_level": "village"}

    # Village names are often absent from global gazetteers. Resolve the selected
    # district in the selected state rather than using an unrelated nearby place.
    district_matches = _geocode(f"{district}, {state}")
    exact_districts = [item for item in district_matches
                       if _district_key(str(item.get("name", ""))) == _district_key(district)
                       and _district_key(str(item.get("admin2", district))) == _district_key(district)]
    if exact_districts:
        point = exact_districts[0]
    else:
        fallback = _nominatim_district(district, state)
        if not fallback:
            raise LocationNotFound("The selected district could not be resolved in the selected state.")
        return fallback
    return {"latitude": float(point["latitude"]), "longitude": float(point["longitude"]),
            "resolved_name": str(point["name"]), "resolved_district": str(point.get("admin2", district)),
            "resolved_state": str(point["admin1"]), "report_level": "district"}


def parse_seasonal(payload: dict) -> list[dict]:
    monthly = payload.get("monthly")
    if not isinstance(monthly, dict) or not isinstance(monthly.get("time"), list):
        return []
    times = monthly["time"]
    aliases = {
        "precipitation_mm": "precipitation_mean",
        "precipitation_anomaly_mm": "precipitation_anomaly",
        "temperature_mean_c": "temperature_2m_mean",
        "temperature_mean_anomaly_c": "temperature_2m_anomaly",
        "temperature_min_c": "temperature_min24h_2m_mean",
        "temperature_max_c": "temperature_max24h_2m_mean",
        "wind_speed_kmh": "wind_speed_10m_mean", "cloud_cover_percent": "cloud_cover_mean",
        "sunshine_duration_seconds": "sunshine_duration_mean",
        "soil_temperature_0_7cm_c": "soil_temperature_0_to_7cm_mean",
        "soil_moisture_0_7cm": "soil_moisture_0_to_7cm_mean",
        "evapotranspiration_mm": "evapotranspiration_mean",
    }
    output = []
    for index, month in enumerate(times):
        try:
            parsed_month = date.fromisoformat(f"{month}-01" if isinstance(month, str) and len(month) == 7 else month)
        except (TypeError, ValueError):
            continue
        month = parsed_month.strftime("%Y-%m")
        item = {"month": month}
        for target, source in aliases.items():
            values = monthly.get(source)
            if isinstance(values, list) and index < len(values) and isinstance(values[index], (int, float)):
                item[target] = float(values[index])
        if len(item) > 1:
            output.append(item)
    return output


def aggregate_historical(payload: dict, start_year: int, end_year: int) -> list[dict]:
    daily = payload.get("daily")
    if not isinstance(daily, dict) or not isinstance(daily.get("time"), list):
        return []
    times, values = daily["time"], daily.get("precipitation_sum")
    if not isinstance(values, list):
        return []
    totals: dict[tuple[int, int], float] = defaultdict(float)
    days: dict[tuple[int, int], int] = defaultdict(int)
    for timestamp, value in zip(times, values):
        try:
            current = date.fromisoformat(timestamp)
        except (TypeError, ValueError):
            continue
        if not start_year <= current.year <= end_year or not isinstance(value, (int, float)):
            continue
        key = (current.year, current.month)
        totals[key] += float(value)
        days[key] += 1
    by_month: dict[int, list[float]] = defaultdict(list)
    for (year, month), total in totals.items():
        expected = (date(year + (month == 12), month % 12 + 1, 1) - date(year, month, 1)).days
        if days[(year, month)] == expected:
            by_month[month].append(total)
    return [{"month": month, "precipitation_mm": sum(samples) / len(samples), "years": len(samples)}
            for month, samples in sorted(by_month.items()) if samples]


def _india_coordinates(latitude: float, longitude: float) -> bool:
    # Broad mainland + island bounds combined with the separately selected Indian state/district.
    return 6.0 <= latitude <= 37.5 and 68.0 <= longitude <= 98.0


def _get_weather(latitude: float, longitude: float) -> dict:
    today = datetime.now(timezone.utc).date()
    end_year = today.year - (1 if today.month == 1 else 0)
    start_year = end_year - 9
    start = f"{start_year}-01-01"
    end = f"{end_year}-12-31"
    params = {"latitude": latitude, "longitude": longitude, "monthly": ",".join((
        "precipitation_mean", "precipitation_anomaly", "temperature_2m_mean", "temperature_2m_anomaly",
        "temperature_min24h_2m_mean", "temperature_max24h_2m_mean", "wind_speed_10m_mean", "cloud_cover_mean",
        "sunshine_duration_mean", "soil_temperature_0_to_7cm_mean", "soil_moisture_0_to_7cm_mean",
        "evapotranspiration_mean")), "timezone": "Asia/Kolkata", "forecast_days": 217, "models": "ecmwf_seasonal_seamless"}
    seasonal_url = "https://seasonal-api.open-meteo.com/v1/seasonal?" + urllib.parse.urlencode(params)
    history_params = {"latitude": latitude, "longitude": longitude, "start_date": start, "end_date": end,
                      "daily": "precipitation_sum", "models": "era5_land", "timezone": "Asia/Kolkata"}
    history_url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(history_params)
    seasonal_data = None
    seasonal_ok = False
    history_ok = False
    try:
        seasonal_data = _request_json(seasonal_url)
        if not isinstance(seasonal_data.get("monthly"), dict) or not isinstance(seasonal_data["monthly"].get("time"), list):
            raise WeatherProviderError("Seasonal provider returned an unexpected response format.")
        seasonal_ok = True
        forecast = parse_seasonal(seasonal_data)
    except WeatherProviderError:
        logger.info("Seasonal outlook unavailable; continuing with historical climate")
        forecast = []
    try:
        history_data = _request_json(history_url)
        daily = history_data.get("daily")
        if not isinstance(daily, dict) or not isinstance(daily.get("time"), list) or not isinstance(daily.get("precipitation_sum"), list):
            raise WeatherProviderError("Historical provider returned an unexpected response format.")
        history_ok = True
        history = aggregate_historical(history_data, start_year, end_year)
    except WeatherProviderError:
        logger.info("Historical climate unavailable")
        history = []
    if not seasonal_ok and not history_ok:
        raise WeatherProviderError("Seasonal and historical weather data are temporarily unavailable.")
    model_update = None
    if seasonal_data:
        model_update = seasonal_data.get("forecast_reference_time") or seasonal_data.get("model_run")
    return {"forecast": forecast, "historical_monthly": history, "historical_period": f"{start_year}–{end_year}",
            "forecast_model": "ECMWF Seasonal Seamless (EC46 + SEAS5)", "forecast_model_updated_at": model_update,
            "refreshed_at": datetime.now(timezone.utc).isoformat(), "timezone": "Asia/Kolkata",
            "sources": [{"name": "Open-Meteo Seasonal Forecast API / ECMWF", "url": "https://open-meteo.com/en/docs/seasonal-forecast-api"},
                        {"name": "Open-Meteo Historical Weather API (ERA5-Land reanalysis)", "url": "https://open-meteo.com/en/docs/historical-weather-api"}],
            "attribution": "Weather data by Open-Meteo.com, CC BY 4.0"}


def get_weather(latitude: float, longitude: float) -> dict:
    key = (round(latitude, 3), round(longitude, 3))
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and cached[0] > now:
            return cached[1]
    result = _get_weather(latitude, longitude)
    with _CACHE_LOCK:
        if len(_CACHE) >= 512:
            expired = [entry_key for entry_key, entry in _CACHE.items() if entry[0] <= time.monotonic()]
            for entry_key in expired:
                _CACHE.pop(entry_key, None)
        _CACHE[key] = (time.monotonic() + CACHE_TTL, result)
    return result


def get_location_weather(village: str, district: str, state: str, latitude: float | None = None,
                         longitude: float | None = None) -> dict:
    if (latitude is None) != (longitude is None):
        raise LocationNotFound("Saved farm coordinates are incomplete.")
    location = resolve_location(village, district, state)
    if latitude is None or location["report_level"] == "district":
        latitude, longitude = location["latitude"], location["longitude"]
    else:
        latitude, longitude = float(latitude), float(longitude)
        if not _india_coordinates(latitude, longitude):
            raise LocationNotFound("Saved farm coordinates are outside the supported India region.")
        # Reuse the saved farm point only when it agrees with the geocoded village.
        lat_delta = (latitude - location["latitude"]) * 111.0
        lon_delta = (longitude - location["longitude"]) * 111.0 * abs(math.cos(math.radians(latitude)))
        if (lat_delta * lat_delta + lon_delta * lon_delta) ** 0.5 > 50:
            raise LocationNotFound("Saved farm coordinates do not match the selected village, district, and state.")
    if not _india_coordinates(latitude, longitude):
        raise LocationNotFound("Resolved farm coordinates are outside the supported India region.")
    return {"location": {"village": village, "district": district, "state": state,
                          "latitude": latitude, "longitude": longitude,
                          "resolved_name": location["resolved_name"], "report_level": location["report_level"]}, **get_weather(latitude, longitude)}
