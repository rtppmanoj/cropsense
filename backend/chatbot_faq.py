"""Compact reference facts for retrieving CropSense help in chat context."""
from __future__ import annotations
import re

FAQ = [
    ("CropSense basics", "What is CropSense?", "CropSense is a Smart Farm Labs agriculture platform. Farmers enter field measurements and a location to get ranked crop suggestions and related guidance."),
    ("Smart Farm Labs", "What is Smart Farm Labs?", "Smart Farm Labs is the agricultural technology initiative behind CropSense. Its About page describes the organization as building data-driven digital tools to help farmers make informed decisions, use resources wisely, and support sustainable farming. CropSense is its current crop analysis platform."),
    ("Leadership", "Who is the owner of Smart Farm Labs or CropSense?", "The CropSense About page identifies Manoj P as Founder & CTO of Smart Farm Labs and Founder & Lead System Architect of CropSense. It says he founded CropSense and leads Smart Farm Labs. The page does not give a separate legal ownership title."),
    ("CropSense team", "Who is Manoj mentioned on the About page? Who are the people behind CropSense?", "The About page lists Manoj P as Founder & CTO of Smart Farm Labs and Founder & Lead System Architect of CropSense; he leads the platform's vision and technical architecture. Abdul Basheeruddin R is Head of Product Engineering, leading full-stack development, API integrations, and farmer-focused design. Hariharan B contributes to hardware and agricultural data work, including sensor integration, agricultural dataset curation, and field-data validation."),
    ("Getting started", "How do I get a crop recommendation?", "From the farmer dashboard, enter tested N, P2O5 and K2O in kg/ha, pH, moisture, temperature, humidity, farm area and location, then submit."),
    ("Soil Testing Tool", "What is the CropSense Soil Testing Tool?", "CropSense recommends its team-developed Soil Testing Tool, priced at â‚¹7,999. The setup connects an Arduino board to an NPK sensor, soil-moisture sensor, DHT22 for environmental temperature and humidity, and Gravity Analog pH sensor. Measured values appear on the LCD panel; farmers can read them and enter them in the CropSense dashboard recommendation form for soil testing."),
    ("Recommendations", "What appears in crop results?", "Results show ranked crop options, field context, available weather information, fertilizer guidance and report actions."),
    ("Reports", "How do I get my report?", "On the results page, download or print the generated PDF. Signed-in farmers can also email it to their registered address."),
    ("Fertilizer", "Where is fertilizer guidance?", "Open Fertilizer Guidance on a crop card to see listed fertilizer sources, nutrients, timing and any crop-specific reference available."),
    ("Weather", "Where can I see weather?", "Weather context for the farm location is shown with crop results when available."),
    ("Schemes", "How do I find government schemes?", "Open Schemes & Subsidies from the farmer dashboard to search schemes, review preliminary eligibility and documents, save schemes and track application status."),
    ("Crop loss", "Where can I get crop-loss assistance information?", "Open Schemes & Subsidies and select Crop Loss & Disaster Assistance for reporting channels, insurance information and document checklists."),
    ("History", "Where are saved recommendations?", "Open Recommendation History from the farmer dashboard to review recommendations saved to your farmer account."),
    ("Plans", "How do plan limits work?", "The Pricing page displays current plan prices, features and annual recommendation allowances. Use its plan cards to compare farmer and organization plans."),
    ("Account", "How can I update my account?", "Use the farmer profile to update contact details or change a password. Use Forgot password on farmer sign-in to reset access by email OTP."),
]
_STOP = {"what", "where", "when", "how", "does", "can", "the", "and", "for", "with", "from", "this", "that", "your", "are", "is", "do", "i", "my", "to", "a", "of", "in", "on", "it", "get", "me"}

def _terms(text: str) -> set[str]:
    return {word for word in re.findall(r"[\w]+", text.casefold()) if len(word) > 2 and word not in _STOP}

def relevant_faq(message: str, history: list[str] | None = None, limit: int = 2) -> list[dict[str, str]]:
    query = _terms(" ".join([*(history or [])[-3:], message]))
    ranked = []
    for category, question, answer in FAQ:
        terms = _terms(category + " " + question + " " + answer)
        score = len(query & terms) / max(1, len(query))
        if score >= 0.18:
            ranked.append((score, category, question, answer))
    ranked.sort(key=lambda row: (-row[0], row[1]))
    return [{"category": c, "question": q, "fact": a} for _, c, q, a in ranked[:limit]]


UNRELATED_REDIRECT = {
    "en": "I'm CropSaathi AI, focused on CropSense and farming. I can help with crop recommendations, soil, fertilizers, weather, market prices and schemes. What would you like to know about farming?",
    "hi": "\u092e\u0948\u0902 CropSaathi AI \u0939\u0942\u0901 \u0914\u0930 CropSense \u0935 \u0916\u0947\u0924\u0940 \u092e\u0947\u0902 \u0938\u0939\u093e\u092f\u0924\u093e \u0915\u0930\u0924\u093e \u0939\u0942\u0901. \u092e\u0948\u0902 \u092b\u0938\u0932 \u0938\u0941\u091d\u093e\u0935, \u092e\u093f\u091f\u094d\u091f\u0940, \u0909\u0930\u094d\u0935\u0930\u0915, \u092e\u094c\u0938\u092e, \u092e\u0902\u0921\u0940 \u092d\u093e\u0935 \u0914\u0930 \u0915\u0943\u0937\u093f \u092f\u094b\u091c\u0928\u093e\u0913\u0902 \u092e\u0947\u0902 \u092e\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u093e \u0939\u0942\u0901. \u0916\u0947\u0924\u0940 \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u0915\u094d\u092f\u093e \u091c\u093e\u0928\u0928\u093e \u091a\u093e\u0939\u0947\u0902\u0917\u0947?",
    "ta": "\u0ba8\u0bbe\u0ba9\u0bcd CropSaathi AI; CropSense \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0bb5\u0bbf\u0bb5\u0b9a\u0bbe\u0baf\u0bae\u0bcd \u0ba4\u0bca\u0b9f\u0bb0\u0bcd\u0baa\u0bbe\u0ba9 \u0b89\u0ba4\u0bb5\u0bbf\u0b95\u0bb3\u0bc8 \u0bb5\u0bb4\u0b99\u0bcd\u0b95\u0bc1\u0b95\u0bbf\u0bb1\u0bc7\u0ba9\u0bcd. \u0baa\u0baf\u0bbf\u0bb0\u0bcd \u0baa\u0bb0\u0bbf\u0ba8\u0bcd\u0ba4\u0bc1\u0bb0\u0bc8, \u0bae\u0ba3\u0bcd, \u0b89\u0bb0\u0bae\u0bcd, \u0bb5\u0bbe\u0ba9\u0bbf\u0bb2\u0bc8, \u0b9a\u0ba8\u0bcd\u0ba4\u0bc8 \u0bb5\u0bbf\u0bb2\u0bc8, \u0ba4\u0bbf\u0b9f\u0bcd\u0b9f\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0baa\u0bb1\u0bcd\u0bb1\u0bbf \u0b95\u0bc7\u0b9f\u0bcd\u0b95\u0bb2\u0bbe\u0bae\u0bcd. \u0bb5\u0bbf\u0bb5\u0b9a\u0bbe\u0baf\u0bae\u0bcd \u0baa\u0bb1\u0bcd\u0bb1\u0bbf \u0b8e\u0ba9\u0bcd\u0ba9 \u0ba4\u0bc6\u0bb0\u0bbf\u0ba8\u0bcd\u0ba4\u0bc1\u0b95\u0bcd\u0b95\u0bca\u0bb3\u0bcd\u0bb3 \u0bb5\u0bbf\u0bb0\u0bc1\u0bae\u0bcd\u0baa\u0bc1\u0b95\u0bbf\u0bb1\u0bc0\u0bb0\u0bcd\u0b95\u0bb3\u0bcd?",
    "te": "\u0c28\u0c47\u0c28\u0c41 CropSaathi AI; CropSense \u0c2e\u0c30\u0c3f\u0c2f\u0c41 \u0c35\u0c4d\u0c2f\u0c35\u0c38\u0c3e\u0c2f\u0c02 \u0c17\u0c41\u0c30\u0c3f\u0c02\u0c1a\u0c3f \u0c38\u0c39\u0c3e\u0c2f\u0c02 \u0c05\u0c02\u0c26\u0c3f\u0c38\u0c4d\u0c24\u0c3e\u0c28\u0c41. \u0c2a\u0c02\u0c1f \u0c38\u0c42\u0c1a\u0c28\u0c32\u0c41, \u0c28\u0c47\u0c32, \u0c0e\u0c30\u0c41\u0c35\u0c41\u0c32\u0c41, \u0c35\u0c3e\u0c24\u0c3e\u0c35\u0c30\u0c23\u0c02, \u0c2e\u0c3e\u0c30\u0c4d\u0c15\u0c46\u0c1f\u0c4d \u0c27\u0c30\u0c32\u0c41, \u0c2a\u0c25\u0c15\u0c3e\u0c32 \u0c17\u0c41\u0c30\u0c3f\u0c02\u0c1a\u0c3f \u0c05\u0c21\u0c17\u0c02\u0c21\u0c3f. \u0c35\u0c4d\u0c2f\u0c35\u0c38\u0c3e\u0c2f\u0c02 \u0c17\u0c41\u0c30\u0c3f\u0c02\u0c1a\u0c3f \u0c0f\u0c2e\u0c3f \u0c24\u0c46\u0c32\u0c41\u0c38\u0c41\u0c15\u0c4b\u0c35\u0c3e\u0c32\u0c28\u0c41\u0c15\u0c41\u0c02\u0c1f\u0c41\u0c28\u0c4d\u0c28\u0c3e\u0c30\u0c41?",
}

# Intercept only clear non-agriculture subject requests; greetings and CropSense questions pass through.
def unrelated_redirect(message: str, language: str) -> str | None:
    text = " ".join(message.casefold().split())
    if re.fullmatch(r"(hi|hello|hey|namaste|good morning|good evening|how are you)[!. ]*", text):
        return None
    agriculture = ("crop", "farm", "soil", "fertiliz", "fertiliser", "weather", "scheme", "harvest", "seed", "irrigat", "pest", "recommend", "market price", "cropsense", "cropsaathi", "farmer", "field", "ph ", "npk", "hardware", "sensor", "lcd", "soil testing tool")
    if any(term in text for term in agriculture):
        return None
    unrelated = ("prime minister", "president of", "politic", "movie", "film", "actor", "actress", "cricket", "football", "capital of", "write a poem", "tell me a story", "programming", "python code", "dating", "relationship advice", "stock market", "bitcoin")
    if any(term in text for term in unrelated):
        return UNRELATED_REDIRECT.get(language, UNRELATED_REDIRECT["en"])
    return None
