import json
import urllib.parse
import urllib.request

import pytest

from backend import weather


def test_parse_seasonal_supported_monthly_fields_and_missing_values():
    result = weather.parse_seasonal({"monthly": {"time": ["2026-11", "2026-12"],
        "precipitation_mean": [120.0, None], "precipitation_anomaly": [-15.0, None],
        "temperature_2m_mean": [27.5, 28.0], "temperature_min24h_2m_mean": [20.0, 21.0],
        "temperature_max24h_2m_mean": [33.0, 34.0], "wind_speed_10m_mean": [10.0, 11.0],
        "relative_humidity_2m": [77, 78]}})
    assert result[0]["precipitation_mm"] == 120
    assert result[0]["precipitation_anomaly_mm"] == -15
    assert result[0]["temperature_mean_c"] == 27.5
    assert result[0]["temperature_min_c"] == 20
    assert result[0]["temperature_max_c"] == 33
    assert result[0]["wind_speed_kmh"] == 10
    assert "relative_humidity_2m" not in result[0]
    assert "precipitation_mm" not in result[1]


def test_parse_seasonal_malformed_or_missing_monthly_is_empty():
    assert weather.parse_seasonal({"daily": {"time": ["2026-10-27"]}}) == []
    assert weather.parse_seasonal({"monthly": {"time": ["bad"], "precipitation_mean": [1]}}) == []


def test_historical_monthly_aggregation_uses_only_complete_months():
    data = {"daily": {"time": ["2024-01-01", "2024-01-02", "2025-01-01", "2025-01-02", "2025-01-03"],
                      "precipitation_sum": [1, 3, 10, 10, 10]}}
    result = weather.aggregate_historical(data, 2024, 2025)
    assert result == []  # incomplete months are excluded, not treated as full-month climate totals


def test_historical_aggregation_complete_month_leap_year():
    times = []
    values = []
    for day in range(1, 30):
        times.append(f"2024-02-{day:02d}")
        values.append(2)
    result = weather.aggregate_historical({"daily": {"time": times, "precipitation_sum": values}}, 2024, 2024)
    assert result == [{"month": 2, "precipitation_mm": 58.0, "years": 1}]


def test_geocoder_requires_exact_india_state_district_match(monkeypatch):
    monkeypatch.setattr(weather, "_request_json", lambda _: {"results": [
        {"name": "Test Village", "country_code": "IN", "admin1": "Tamil Nadu", "admin2": "Coimbatore",
         "latitude": 11.0, "longitude": 76.0}]})
    monkeypatch.setattr(weather, "_nominatim_district", lambda *_: None)
    assert weather.resolve_location("Test Village", "Coimbatore", "Tamil Nadu")["latitude"] == 11
    with pytest.raises(weather.LocationNotFound):
        weather.resolve_location("Test Village", "Salem", "Tamil Nadu")


def test_chennai_geocoder_accepts_official_district_suffix(monkeypatch):
    monkeypatch.setattr(weather, "_request_json", lambda _: {"results": [
        {"name": "Chennai", "country_code": "IN", "admin1": "Tamil Nadu", "admin2": "Chennai district",
         "latitude": 13.08784, "longitude": 80.27847}]})
    result = weather.resolve_location("Chennai", "Chennai", "Tamil Nadu")
    assert result["report_level"] == "village"
    assert result["latitude"] == 13.08784


def test_unlisted_village_falls_back_to_exact_selected_district(monkeypatch):
    calls = []
    def fake(url):
        calls.append(url)
        if "name=Unlisted+Village" in url:
            return {"results": []}
        return {"results": [{"name": "Coimbatore", "country_code": "IN", "admin1": "Tamil Nadu",
                             "admin2": "Coimbatore district", "latitude": 11.0168, "longitude": 76.9558}]}
    monkeypatch.setattr(weather, "_request_json", fake)
    result = weather.resolve_location("Unlisted Village", "Coimbatore", "Tamil Nadu")
    assert len(calls) == 2
    assert result["report_level"] == "district"
    assert result["resolved_name"] == "Coimbatore"


def test_unlisted_open_meteo_district_uses_verified_osm_district(monkeypatch):
    monkeypatch.setattr(weather, "_request_json", lambda _: {"results": []})
    monkeypatch.setattr(weather, "_nominatim_district", lambda district, state: {
        "latitude": 9.58224, "longitude": 77.9537, "resolved_name": "Virudhunagar",
        "resolved_district": district, "resolved_state": state, "report_level": "district"})
    result = weather.resolve_location("Ezhayiram Pannai", "Virudhunagar", "Tamil Nadu")
    assert result["report_level"] == "district"
    assert result["resolved_name"] == "Virudhunagar"


def test_osm_district_match_requires_requested_state_country_and_district(monkeypatch):
    class FakeResponse:
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def read(self):
            return json.dumps([{"name": "Virudhunagar", "display_name": "Virudhunagar, Tamil Nadu, 626001, India",
                               "lat": "9.5822400", "lon": "77.9537000",
                               "address": {"state": "Tamil Nadu", "country": "India"}}]).encode()
    monkeypatch.setattr(weather.urllib.request, "urlopen", lambda *_args, **_kwargs: FakeResponse())
    result = weather._nominatim_district("Virudhunagar", "Tamil Nadu")
    assert result["latitude"] == pytest.approx(9.58224)
    assert result["report_level"] == "district"


def test_geocoder_uses_first_exact_place_when_gazetteer_has_duplicate_entries(monkeypatch):
    monkeypatch.setattr(weather, "_request_json", lambda _: {"results": [
        {"name": "Twin", "country_code": "IN", "admin1": "Tamil Nadu", "admin2": "Coimbatore", "latitude": 11.0, "longitude": 76.0},
        {"name": "Twin", "country_code": "IN", "admin1": "Tamil Nadu", "admin2": "Coimbatore", "latitude": 11.1, "longitude": 76.1}]})
    result = weather.resolve_location("Twin", "Coimbatore", "Tamil Nadu")
    assert result["latitude"] == 11.0


def test_weather_cache_hits_success_only(monkeypatch):
    weather._CACHE.clear()
    calls = []
    monkeypatch.setattr(weather, "_get_weather", lambda lat, lon: calls.append((lat, lon)) or {"forecast": [], "historical_monthly": []})
    first = weather.get_weather(11.001, 76.002)
    second = weather.get_weather(11.001, 76.002)
    assert first is second
    assert len(calls) == 1
    weather._CACHE.clear()


def test_history_remains_available_when_seasonal_provider_fails(monkeypatch):
    def fake(url):
        if "seasonal-api" in url:
            raise weather.WeatherProviderError()
        return {"daily": {"time": [], "precipitation_sum": []}}
    monkeypatch.setattr(weather, "_request_json", fake)
    data = weather._get_weather(11, 76)
    assert data["forecast"] == []
    assert data["historical_monthly"] == []
    assert data["historical_period"]


def test_both_provider_sections_unavailable_raise_gracefully(monkeypatch):
    monkeypatch.setattr(weather, "_request_json", lambda _: (_ for _ in ()).throw(weather.WeatherProviderError()))
    with pytest.raises(weather.WeatherProviderError):
        weather._get_weather(11, 76)


def test_provider_request_uses_documented_endpoints_and_available_monthly_fields(monkeypatch):
    captured = []
    def fake(url):
        captured.append(url)
        if "seasonal-api" in url:
            return {"monthly": {"time": []}}
        return {"daily": {"time": [], "precipitation_sum": []}}
    monkeypatch.setattr(weather, "_request_json", fake)
    weather._get_weather(11.0, 76.0)
    seasonal = next(url for url in captured if "seasonal-api" in url)
    archive = next(url for url in captured if "archive-api" in url)
    seasonal_query = urllib.parse.parse_qs(urllib.parse.urlsplit(seasonal).query)
    archive_query = urllib.parse.parse_qs(urllib.parse.urlsplit(archive).query)
    assert urllib.parse.urlsplit(seasonal).path == "/v1/seasonal"
    assert seasonal_query["forecast_days"] == ["217"]
    assert seasonal_query["models"] == ["ecmwf_seasonal_seamless"]
    assert "precipitation_mean" in seasonal_query["monthly"][0]
    assert "precipitation_anomaly" in seasonal_query["monthly"][0]
    assert "relative_humidity_2m" not in seasonal_query["monthly"][0]
    assert urllib.parse.urlsplit(archive).path == "/v1/archive"
    assert archive_query["models"] == ["era5_land"]
    assert archive_query["daily"] == ["precipitation_sum"]


def test_provider_timeout_is_reported_as_temporary_weather_error(monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", lambda *args, **kwargs: (_ for _ in ()).throw(TimeoutError()))
    with pytest.raises(weather.WeatherProviderError):
        weather._request_json("https://example.test/weather")
