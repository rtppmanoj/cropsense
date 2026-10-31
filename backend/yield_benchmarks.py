"""Indicative fallback yields used when the crop classifier has no yield output.

Values are quintals per acre, not crop-model predictions. They are deliberately
kept in one place so deployments can review and replace them for local practice.
"""

YIELD_BENCHMARKS_QUINTALS_PER_ACRE: dict[str, float] = {
    "apple": 60,
    "banana": 120,
    "blackgram": 4,
    "chickpea": 5,
    "coconut": 25,
    "coffee": 3,
    "cotton": 7,
    "grapes": 40,
    "jute": 10,
    "kidneybeans": 5,
    "lentil": 4,
    "maize": 25,
    "mango": 40,
    "mothbeans": 3,
    "mungbean": 4,
    "muskmelon": 50,
    "orange": 50,
    "papaya": 100,
    "pigeonpeas": 4,
    "pomegranate": 30,
    "rice": 22,
    "watermelon": 80,
    # Included for future model versions; Wheat is not a current classifier label.
    "wheat": 18,
}


def benchmark_yield(crop: str) -> float | None:
    return YIELD_BENCHMARKS_QUINTALS_PER_ACRE.get(crop.casefold())
