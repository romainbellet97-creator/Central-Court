"""
Script d'import des tournois ATP, WTA et ITF fournis par l'utilisateur
Exécuter avec: python /app/backend/scripts/import_user_tournaments.py
"""

import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "central_court")

# Mapping pays -> code ISO
COUNTRY_TO_CODE = {
    "Australie": "AU",
    "France": "FR",
    "Pays-Bas": "NL",
    "Qatar": "QA",
    "EAU": "AE",
    "Mexique": "MX",
    "États-Unis": "US",
    "Monaco": "MC",
    "Espagne": "ES",
    "Portugal": "PT",
    "Italie": "IT",
    "Suisse": "CH",
    "Royaume-Uni": "GB",
    "Allemagne": "DE",
    "Suède": "SE",
    "Croatie": "HR",
    "Canada": "CA",
    "Chine": "CN",
    "Japon": "JP",
    "Autriche": "AT",
    "Belgique": "BE",
    "Argentine": "AR",
    "Brésil": "BR",
    "Chili": "CL",
    "Inde": "IN",
    "Nouvelle-Zélande": "NZ",
    "Maroc": "MA",
    "Roumanie": "RO",
    "Bulgarie": "BG",
    "Israël": "IL",
    "Kazakhstan": "KZ",
    "Hong Kong": "HK",
    "Corée du Sud": "KR",
    "Thaïlande": "TH",
    "Tunisie": "TN",
    "Égypte": "EG",
    "Grèce": "GR",
    "Mozambique": "MZ",
    "Sénégal": "SN",
    "Singapour": "SG",
    "Malaisie": "MY",
}

# ============== ATP TOURNAMENTS ==============
ATP_TOURNAMENTS = [
    {"id": "atp-001", "name": "Australian Open", "city": "Melbourne", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-19", "endDate": "2026-02-01", "surface": "dur", "prizeMoney": 86500000, "level": "grand_slam", "circuit": "atp", "category": "Grand Chelem"},
    {"id": "atp-002", "name": "ATP Cup", "city": "Perth", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "dur", "prizeMoney": 10000000, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-003", "name": "Adelaide International", "city": "Adelaide", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "dur", "prizeMoney": 661560, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-004", "name": "Open Sud de France", "city": "Montpellier", "country": "France", "flag": "🇫🇷", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-005", "name": "Open 13 Provence", "city": "Marseille", "country": "France", "flag": "🇫🇷", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-006", "name": "Rotterdam Open", "city": "Rotterdam", "country": "Pays-Bas", "flag": "🇳🇱", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "indoor", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-007", "name": "Qatar ExxonMobil Open", "city": "Doha", "country": "Qatar", "flag": "🇶🇦", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "dur", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-008", "name": "Dubai Duty Free Tennis", "city": "Dubai", "country": "EAU", "flag": "🇦🇪", "startDate": "2026-02-23", "endDate": "2026-02-28", "surface": "dur", "prizeMoney": 2950420, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-009", "name": "Acapulco Open", "city": "Acapulco", "country": "Mexique", "flag": "🇲🇽", "startDate": "2026-02-23", "endDate": "2026-02-28", "surface": "dur", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-010", "name": "Indian Wells Masters", "city": "Indian Wells", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-03-09", "endDate": "2026-03-22", "surface": "dur", "prizeMoney": 9619935, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-011", "name": "Miami Open", "city": "Miami", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-03-23", "endDate": "2026-04-05", "surface": "dur", "prizeMoney": 9619935, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-012", "name": "Monte-Carlo Masters", "city": "Monte-Carlo", "country": "Monaco", "flag": "🇲🇨", "startDate": "2026-04-12", "endDate": "2026-04-19", "surface": "terre", "prizeMoney": 6303645, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-013", "name": "Barcelona Open", "city": "Barcelona", "country": "Espagne", "flag": "🇪🇸", "startDate": "2026-04-20", "endDate": "2026-04-26", "surface": "terre", "prizeMoney": 2950420, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-014", "name": "Estoril Open", "city": "Estoril", "country": "Portugal", "flag": "🇵🇹", "startDate": "2026-04-20", "endDate": "2026-04-26", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-015", "name": "Madrid Open", "city": "Madrid", "country": "Espagne", "flag": "🇪🇸", "startDate": "2026-04-27", "endDate": "2026-05-10", "surface": "terre", "prizeMoney": 9619935, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-016", "name": "Italian Open", "city": "Rome", "country": "Italie", "flag": "🇮🇹", "startDate": "2026-05-11", "endDate": "2026-05-17", "surface": "terre", "prizeMoney": 9619935, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-017", "name": "Geneva Open", "city": "Genève", "country": "Suisse", "flag": "🇨🇭", "startDate": "2026-05-18", "endDate": "2026-05-23", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-018", "name": "Roland Garros", "city": "Paris", "country": "France", "flag": "🇫🇷", "startDate": "2026-05-24", "endDate": "2026-06-07", "surface": "terre", "prizeMoney": 53478000, "level": "grand_slam", "circuit": "atp", "category": "Grand Chelem"},
    {"id": "atp-019", "name": "Queen's Club Championships", "city": "Londres", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "gazon", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-020", "name": "Halle Open", "city": "Halle", "country": "Allemagne", "flag": "🇩🇪", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "gazon", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-021", "name": "Wimbledon", "city": "Londres", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-29", "endDate": "2026-07-12", "surface": "gazon", "prizeMoney": 50486000, "level": "grand_slam", "circuit": "atp", "category": "Grand Chelem"},
    {"id": "atp-022", "name": "Hamburg Open", "city": "Hambourg", "country": "Allemagne", "flag": "🇩🇪", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "terre", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-023", "name": "Swedish Open", "city": "Båstad", "country": "Suède", "flag": "🇸🇪", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-024", "name": "Swiss Open Gstaad", "city": "Gstaad", "country": "Suisse", "flag": "🇨🇭", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-025", "name": "Croatia Open", "city": "Umag", "country": "Croatie", "flag": "🇭🇷", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-026", "name": "Washington Open", "city": "Washington", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-03", "endDate": "2026-08-09", "surface": "dur", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-027", "name": "Canadian Open", "city": "Toronto", "country": "Canada", "flag": "🇨🇦", "startDate": "2026-08-10", "endDate": "2026-08-16", "surface": "dur", "prizeMoney": 6803885, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-028", "name": "Cincinnati Masters", "city": "Cincinnati", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-17", "endDate": "2026-08-23", "surface": "dur", "prizeMoney": 6803885, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-029", "name": "US Open", "city": "New York", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-31", "endDate": "2026-09-13", "surface": "dur", "prizeMoney": 65000000, "level": "grand_slam", "circuit": "atp", "category": "Grand Chelem"},
    {"id": "atp-030", "name": "Chengdu Open", "city": "Chengdu", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-031", "name": "China Open", "city": "Pékin", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "dur", "prizeMoney": 3720165, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-032", "name": "Shanghai Masters", "city": "Shanghai", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-10-05", "endDate": "2026-10-11", "surface": "dur", "prizeMoney": 9619935, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-033", "name": "Tokyo Open", "city": "Tokyo", "country": "Japon", "flag": "🇯🇵", "startDate": "2026-10-05", "endDate": "2026-10-11", "surface": "dur", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-034", "name": "Stockholm Open", "city": "Stockholm", "country": "Suède", "flag": "🇸🇪", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-035", "name": "Vienna Open", "city": "Vienne", "country": "Autriche", "flag": "🇦🇹", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "indoor", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-036", "name": "Basel Swiss Indoors", "city": "Bâle", "country": "Suisse", "flag": "🇨🇭", "startDate": "2026-10-26", "endDate": "2026-11-01", "surface": "indoor", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-037", "name": "Paris Masters", "city": "Paris", "country": "France", "flag": "🇫🇷", "startDate": "2026-11-02", "endDate": "2026-11-08", "surface": "indoor", "prizeMoney": 6803885, "level": "atp_1000", "circuit": "atp", "category": "Masters 1000"},
    {"id": "atp-038", "name": "ATP Finals", "city": "Turin", "country": "Italie", "flag": "🇮🇹", "startDate": "2026-11-15", "endDate": "2026-11-22", "surface": "indoor", "prizeMoney": 14750000, "level": "atp_finals", "circuit": "atp", "category": "ATP Finals"},
    {"id": "atp-039", "name": "Buenos Aires Open", "city": "Buenos Aires", "country": "Argentine", "flag": "🇦🇷", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-040", "name": "Rio Open", "city": "Rio de Janeiro", "country": "Brésil", "flag": "🇧🇷", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "terre", "prizeMoney": 2315250, "level": "atp_500", "circuit": "atp", "category": "ATP 500"},
    {"id": "atp-041", "name": "Santiago Open", "city": "Santiago", "country": "Chili", "flag": "🇨🇱", "startDate": "2026-02-23", "endDate": "2026-02-28", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-042", "name": "Delray Beach Open", "city": "Delray Beach", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-043", "name": "Córdoba Open", "city": "Córdoba", "country": "Argentine", "flag": "🇦🇷", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-044", "name": "Pune Open", "city": "Pune", "country": "Inde", "flag": "🇮🇳", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-045", "name": "Auckland Open", "city": "Auckland", "country": "Nouvelle-Zélande", "flag": "🇳🇿", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-046", "name": "Dallas Open", "city": "Dallas", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-047", "name": "Houston Open", "city": "Houston", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-048", "name": "Marrakech Open", "city": "Marrakech", "country": "Maroc", "flag": "🇲🇦", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-049", "name": "Bucharest Open", "city": "Bucarest", "country": "Roumanie", "flag": "🇷🇴", "startDate": "2026-04-13", "endDate": "2026-04-19", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-050", "name": "Munich Open", "city": "Munich", "country": "Allemagne", "flag": "🇩🇪", "startDate": "2026-04-20", "endDate": "2026-04-26", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-051", "name": "Lyon Open", "city": "Lyon", "country": "France", "flag": "🇫🇷", "startDate": "2026-05-18", "endDate": "2026-05-23", "surface": "terre", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-052", "name": "Stuttgart Open", "city": "Stuttgart", "country": "Allemagne", "flag": "🇩🇪", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "gazon", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-053", "name": "'s-Hertogenbosch Open", "city": "'s-Hertogenbosch", "country": "Pays-Bas", "flag": "🇳🇱", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "gazon", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-054", "name": "Eastbourne International", "city": "Eastbourne", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "gazon", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-055", "name": "Mallorca Championships", "city": "Majorque", "country": "Espagne", "flag": "🇪🇸", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "gazon", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-056", "name": "Newport Hall of Fame", "city": "Newport", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "gazon", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-057", "name": "Atlanta Open", "city": "Atlanta", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-07-27", "endDate": "2026-08-02", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-058", "name": "Los Cabos Open", "city": "Los Cabos", "country": "Mexique", "flag": "🇲🇽", "startDate": "2026-08-03", "endDate": "2026-08-09", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-059", "name": "Winston-Salem Open", "city": "Winston-Salem", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-24", "endDate": "2026-08-29", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-060", "name": "Metz Open", "city": "Metz", "country": "France", "flag": "🇫🇷", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-061", "name": "Sofia Open", "city": "Sofia", "country": "Bulgarie", "flag": "🇧🇬", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-062", "name": "San Diego Open", "city": "San Diego", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-063", "name": "Tel Aviv Open", "city": "Tel Aviv", "country": "Israël", "flag": "🇮🇱", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-064", "name": "Antwerp Open", "city": "Anvers", "country": "Belgique", "flag": "🇧🇪", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-065", "name": "Florence Open", "city": "Florence", "country": "Italie", "flag": "🇮🇹", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-066", "name": "Nur-Sultan Open", "city": "Nur-Sultan", "country": "Kazakhstan", "flag": "🇰🇿", "startDate": "2026-10-05", "endDate": "2026-10-11", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-067", "name": "Gijon Open", "city": "Gijón", "country": "Espagne", "flag": "🇪🇸", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "indoor", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-068", "name": "Napoli Cup", "city": "Naples", "country": "Italie", "flag": "🇮🇹", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-069", "name": "Hong Kong Open", "city": "Hong Kong", "country": "Hong Kong", "flag": "🇭🇰", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
    {"id": "atp-070", "name": "Zhuhai Championships", "city": "Zhuhai", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "dur", "prizeMoney": 691000, "level": "atp_250", "circuit": "atp", "category": "ATP 250"},
]

# ============== WTA TOURNAMENTS ==============
WTA_TOURNAMENTS = [
    {"id": "wta-001", "name": "Australian Open", "city": "Melbourne", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-19", "endDate": "2026-02-01", "surface": "dur", "prizeMoney": 86500000, "level": "grand_slam", "circuit": "wta", "category": "Grand Chelem"},
    {"id": "wta-002", "name": "Adelaide International", "city": "Adelaide", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "dur", "prizeMoney": 922573, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-003", "name": "Hobart International", "city": "Hobart", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-004", "name": "Qatar Open", "city": "Doha", "country": "Qatar", "flag": "🇶🇦", "startDate": "2026-02-09", "endDate": "2026-02-14", "surface": "dur", "prizeMoney": 3400000, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-005", "name": "Dubai Championships", "city": "Dubai", "country": "EAU", "flag": "🇦🇪", "startDate": "2026-02-16", "endDate": "2026-02-21", "surface": "dur", "prizeMoney": 3221715, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-006", "name": "Indian Wells Open", "city": "Indian Wells", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-03-09", "endDate": "2026-03-22", "surface": "dur", "prizeMoney": 9619935, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-007", "name": "Miami Open", "city": "Miami", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-03-23", "endDate": "2026-04-05", "surface": "dur", "prizeMoney": 9619935, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-008", "name": "Charleston Open", "city": "Charleston", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "terre", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-009", "name": "Stuttgart Open", "city": "Stuttgart", "country": "Allemagne", "flag": "🇩🇪", "startDate": "2026-04-13", "endDate": "2026-04-19", "surface": "terre", "prizeMoney": 922573, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-010", "name": "Madrid Open", "city": "Madrid", "country": "Espagne", "flag": "🇪🇸", "startDate": "2026-04-27", "endDate": "2026-05-10", "surface": "terre", "prizeMoney": 9619935, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-011", "name": "Italian Open", "city": "Rome", "country": "Italie", "flag": "🇮🇹", "startDate": "2026-05-11", "endDate": "2026-05-17", "surface": "terre", "prizeMoney": 5793580, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-012", "name": "Strasbourg International", "city": "Strasbourg", "country": "France", "flag": "🇫🇷", "startDate": "2026-05-18", "endDate": "2026-05-23", "surface": "terre", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-013", "name": "Roland Garros", "city": "Paris", "country": "France", "flag": "🇫🇷", "startDate": "2026-05-24", "endDate": "2026-06-07", "surface": "terre", "prizeMoney": 53478000, "level": "grand_slam", "circuit": "wta", "category": "Grand Chelem"},
    {"id": "wta-014", "name": "Nottingham Open", "city": "Nottingham", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "gazon", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-015", "name": "Birmingham Classic", "city": "Birmingham", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "gazon", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-016", "name": "Eastbourne International", "city": "Eastbourne", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "gazon", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-017", "name": "Wimbledon", "city": "Londres", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-06-29", "endDate": "2026-07-12", "surface": "gazon", "prizeMoney": 50486000, "level": "grand_slam", "circuit": "wta", "category": "Grand Chelem"},
    {"id": "wta-018", "name": "Lausanne Open", "city": "Lausanne", "country": "Suisse", "flag": "🇨🇭", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "terre", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-019", "name": "Hamburg Open", "city": "Hambourg", "country": "Allemagne", "flag": "🇩🇪", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "terre", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-020", "name": "Palermo Ladies Open", "city": "Palerme", "country": "Italie", "flag": "🇮🇹", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "terre", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-021", "name": "Canadian Open", "city": "Toronto", "country": "Canada", "flag": "🇨🇦", "startDate": "2026-08-10", "endDate": "2026-08-16", "surface": "dur", "prizeMoney": 3221715, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-022", "name": "Cincinnati Open", "city": "Cincinnati", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-17", "endDate": "2026-08-23", "surface": "dur", "prizeMoney": 3221715, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-023", "name": "US Open", "city": "New York", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-31", "endDate": "2026-09-13", "surface": "dur", "prizeMoney": 65000000, "level": "grand_slam", "circuit": "wta", "category": "Grand Chelem"},
    {"id": "wta-024", "name": "Guadalajara Open", "city": "Guadalajara", "country": "Mexique", "flag": "🇲🇽", "startDate": "2026-09-14", "endDate": "2026-09-20", "surface": "dur", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-025", "name": "Seoul Open", "city": "Séoul", "country": "Corée du Sud", "flag": "🇰🇷", "startDate": "2026-09-14", "endDate": "2026-09-20", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-026", "name": "China Open", "city": "Pékin", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "dur", "prizeMoney": 9619935, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-027", "name": "Wuhan Open", "city": "Wuhan", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-10-05", "endDate": "2026-10-11", "surface": "dur", "prizeMoney": 3221715, "level": "wta_1000", "circuit": "wta", "category": "WTA 1000"},
    {"id": "wta-028", "name": "Ningbo Open", "city": "Ningbo", "country": "Chine", "flag": "🇨🇳", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-029", "name": "Hong Kong Open", "city": "Hong Kong", "country": "Hong Kong", "flag": "🇭🇰", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-030", "name": "WTA Finals", "city": "Cancún", "country": "Mexique", "flag": "🇲🇽", "startDate": "2026-11-02", "endDate": "2026-11-08", "surface": "dur", "prizeMoney": 15000000, "level": "wta_finals", "circuit": "wta", "category": "WTA Finals"},
    {"id": "wta-031", "name": "Abu Dhabi Open", "city": "Abu Dhabi", "country": "EAU", "flag": "🇦🇪", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "dur", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-032", "name": "Lyon Open", "city": "Lyon", "country": "France", "flag": "🇫🇷", "startDate": "2026-02-23", "endDate": "2026-02-28", "surface": "indoor", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-033", "name": "Monterrey Open", "city": "Monterrey", "country": "Mexique", "flag": "🇲🇽", "startDate": "2026-03-02", "endDate": "2026-03-08", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-034", "name": "Austin Open", "city": "Austin", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-02-23", "endDate": "2026-02-28", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-035", "name": "Hua Hin Championships", "city": "Hua Hin", "country": "Thaïlande", "flag": "🇹🇭", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-036", "name": "Linz Open", "city": "Linz", "country": "Autriche", "flag": "🇦🇹", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "indoor", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-037", "name": "Cleveland Championships", "city": "Cleveland", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-08-24", "endDate": "2026-08-29", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
    {"id": "wta-038", "name": "San Diego Open", "city": "San Diego", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "dur", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-039", "name": "Tokyo Open", "city": "Tokyo", "country": "Japon", "flag": "🇯🇵", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "dur", "prizeMoney": 780637, "level": "wta_500", "circuit": "wta", "category": "WTA 500"},
    {"id": "wta-040", "name": "Osaka Open", "city": "Osaka", "country": "Japon", "flag": "🇯🇵", "startDate": "2026-09-14", "endDate": "2026-09-20", "surface": "dur", "prizeMoney": 259303, "level": "wta_250", "circuit": "wta", "category": "WTA 250"},
]

# ============== ITF TOURNAMENTS ==============
ITF_TOURNAMENTS = [
    {"id": "itf-001", "name": "ITF World Tennis Tour M25 Antalya", "city": "Antalya", "country": "Turquie", "flag": "🇹🇷", "startDate": "2026-01-06", "endDate": "2026-01-12", "surface": "dur", "prizeMoney": 25000, "level": "itf_m25", "circuit": "itf", "category": "ITF M25"},
    {"id": "itf-002", "name": "ITF World Tennis Tour M15 Heraklion", "city": "Heraklion", "country": "Grèce", "flag": "🇬🇷", "startDate": "2026-01-13", "endDate": "2026-01-19", "surface": "dur", "prizeMoney": 15000, "level": "itf_m15", "circuit": "itf", "category": "ITF M15"},
    {"id": "itf-003", "name": "ITF World Tennis Tour W25 Monastir", "city": "Monastir", "country": "Tunisie", "flag": "🇹🇳", "startDate": "2026-01-06", "endDate": "2026-01-12", "surface": "dur", "prizeMoney": 25000, "level": "itf_w25", "circuit": "itf", "category": "ITF W25"},
    {"id": "itf-004", "name": "ITF World Tennis Tour W15 Sharm El Sheikh", "city": "Sharm El Sheikh", "country": "Égypte", "flag": "🇪🇬", "startDate": "2026-01-13", "endDate": "2026-01-19", "surface": "dur", "prizeMoney": 15000, "level": "itf_w15", "circuit": "itf", "category": "ITF W15"},
    {"id": "itf-005", "name": "ITF World Tennis Tour M25 Cancún", "city": "Cancún", "country": "Mexique", "flag": "🇲🇽", "startDate": "2026-02-10", "endDate": "2026-02-16", "surface": "dur", "prizeMoney": 25000, "level": "itf_m25", "circuit": "itf", "category": "ITF M25"},
    {"id": "itf-006", "name": "ITF World Tennis Tour M15 Cairo", "city": "Le Caire", "country": "Égypte", "flag": "🇪🇬", "startDate": "2026-02-17", "endDate": "2026-02-23", "surface": "terre", "prizeMoney": 15000, "level": "itf_m15", "circuit": "itf", "category": "ITF M15"},
    {"id": "itf-007", "name": "ITF World Tennis Tour W25 Nonthaburi", "city": "Nonthaburi", "country": "Thaïlande", "flag": "🇹🇭", "startDate": "2026-02-10", "endDate": "2026-02-16", "surface": "dur", "prizeMoney": 25000, "level": "itf_w25", "circuit": "itf", "category": "ITF W25"},
    {"id": "itf-008", "name": "ITF World Tennis Tour W15 Buenos Aires", "city": "Buenos Aires", "country": "Argentine", "flag": "🇦🇷", "startDate": "2026-02-17", "endDate": "2026-02-23", "surface": "terre", "prizeMoney": 15000, "level": "itf_w15", "circuit": "itf", "category": "ITF W15"},
    {"id": "itf-009", "name": "ITF World Tennis Tour M25 Maputo", "city": "Maputo", "country": "Mozambique", "flag": "🇲🇿", "startDate": "2026-03-10", "endDate": "2026-03-16", "surface": "dur", "prizeMoney": 25000, "level": "itf_m25", "circuit": "itf", "category": "ITF M25"},
    {"id": "itf-010", "name": "ITF World Tennis Tour M15 Dakar", "city": "Dakar", "country": "Sénégal", "flag": "🇸🇳", "startDate": "2026-03-17", "endDate": "2026-03-23", "surface": "dur", "prizeMoney": 15000, "level": "itf_m15", "circuit": "itf", "category": "ITF M15"},
    {"id": "itf-011", "name": "ITF World Tennis Tour W25 Singapore", "city": "Singapour", "country": "Singapour", "flag": "🇸🇬", "startDate": "2026-03-10", "endDate": "2026-03-16", "surface": "dur", "prizeMoney": 25000, "level": "itf_w25", "circuit": "itf", "category": "ITF W25"},
    {"id": "itf-012", "name": "ITF World Tennis Tour W15 Kuala Lumpur", "city": "Kuala Lumpur", "country": "Malaisie", "flag": "🇲🇾", "startDate": "2026-03-17", "endDate": "2026-03-23", "surface": "dur", "prizeMoney": 15000, "level": "itf_w15", "circuit": "itf", "category": "ITF W15"},
]

# ============== ITF WHEELCHAIR TOURNAMENTS ==============
ITF_WHEELCHAIR_TOURNAMENTS = [
    {"id": "itf-w001", "name": "Australian Open Wheelchair", "city": "Melbourne", "country": "Australie", "flag": "🇦🇺", "startDate": "2026-01-24", "endDate": "2026-01-27", "surface": "dur", "prizeMoney": 500000, "level": "grand_slam_wheelchair", "circuit": "itf_wheelchair", "category": "Grand Chelem Wheelchair"},
    {"id": "itf-w002", "name": "Roland Garros Wheelchair", "city": "Paris", "country": "France", "flag": "🇫🇷", "startDate": "2026-06-04", "endDate": "2026-06-07", "surface": "terre", "prizeMoney": 450000, "level": "grand_slam_wheelchair", "circuit": "itf_wheelchair", "category": "Grand Chelem Wheelchair"},
    {"id": "itf-w003", "name": "Wimbledon Wheelchair", "city": "Londres", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-07-09", "endDate": "2026-07-12", "surface": "gazon", "prizeMoney": 450000, "level": "grand_slam_wheelchair", "circuit": "itf_wheelchair", "category": "Grand Chelem Wheelchair"},
    {"id": "itf-w004", "name": "US Open Wheelchair", "city": "New York", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-09-10", "endDate": "2026-09-13", "surface": "dur", "prizeMoney": 500000, "level": "grand_slam_wheelchair", "circuit": "itf_wheelchair", "category": "Grand Chelem Wheelchair"},
    {"id": "itf-w005", "name": "British Open Wheelchair Tennis", "city": "Nottingham", "country": "Royaume-Uni", "flag": "🇬🇧", "startDate": "2026-07-16", "endDate": "2026-07-20", "surface": "dur", "prizeMoney": 50000, "level": "super_series_wheelchair", "circuit": "itf_wheelchair", "category": "Super Series Wheelchair"},
    {"id": "itf-w006", "name": "Japan Open Wheelchair Tennis", "city": "Tokyo", "country": "Japon", "flag": "🇯🇵", "startDate": "2026-04-23", "endDate": "2026-04-27", "surface": "dur", "prizeMoney": 50000, "level": "super_series_wheelchair", "circuit": "itf_wheelchair", "category": "Super Series Wheelchair"},
    {"id": "itf-w007", "name": "Korea Open Wheelchair Tennis", "city": "Busan", "country": "Corée du Sud", "flag": "🇰🇷", "startDate": "2026-05-14", "endDate": "2026-05-18", "surface": "dur", "prizeMoney": 30000, "level": "itf1_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 1 Wheelchair"},
    {"id": "itf-w008", "name": "Swiss Open Wheelchair Tennis", "city": "Bienne", "country": "Suisse", "flag": "🇨🇭", "startDate": "2026-05-21", "endDate": "2026-05-25", "surface": "terre", "prizeMoney": 30000, "level": "itf1_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 1 Wheelchair"},
    {"id": "itf-w009", "name": "Belgian Open Wheelchair Tennis", "city": "Jambes", "country": "Belgique", "flag": "🇧🇪", "startDate": "2026-06-11", "endDate": "2026-06-15", "surface": "terre", "prizeMoney": 30000, "level": "itf1_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 1 Wheelchair"},
    {"id": "itf-w010", "name": "NEC Wheelchair Tennis Masters", "city": "Orlando", "country": "États-Unis", "flag": "🇺🇸", "startDate": "2026-11-18", "endDate": "2026-11-22", "surface": "dur", "prizeMoney": 300000, "level": "masters_wheelchair", "circuit": "itf_wheelchair", "category": "Masters Wheelchair"},
    {"id": "itf-w011", "name": "Israel Open Wheelchair Tennis", "city": "Ramat Hasharon", "country": "Israël", "flag": "🇮🇱", "startDate": "2026-02-26", "endDate": "2026-03-02", "surface": "dur", "prizeMoney": 15000, "level": "itf2_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 2 Wheelchair"},
    {"id": "itf-w012", "name": "Thailand Open Wheelchair Tennis", "city": "Bangkok", "country": "Thaïlande", "flag": "🇹🇭", "startDate": "2026-03-12", "endDate": "2026-03-16", "surface": "dur", "prizeMoney": 15000, "level": "itf2_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 2 Wheelchair"},
    {"id": "itf-w013", "name": "Turkey Open Wheelchair Tennis", "city": "Antalya", "country": "Turquie", "flag": "🇹🇷", "startDate": "2026-04-09", "endDate": "2026-04-13", "surface": "dur", "prizeMoney": 15000, "level": "itf2_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 2 Wheelchair"},
    {"id": "itf-w014", "name": "Spanish Open Wheelchair Tennis", "city": "Valence", "country": "Espagne", "flag": "🇪🇸", "startDate": "2026-04-30", "endDate": "2026-05-04", "surface": "terre", "prizeMoney": 30000, "level": "itf1_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 1 Wheelchair"},
    {"id": "itf-w015", "name": "French Riviera Open Wheelchair", "city": "Biot", "country": "France", "flag": "🇫🇷", "startDate": "2026-05-28", "endDate": "2026-06-01", "surface": "terre", "prizeMoney": 30000, "level": "itf1_wheelchair", "circuit": "itf_wheelchair", "category": "ITF 1 Wheelchair"},
]


def calculate_week(date_str: str) -> int:
    """Calculate week number from date string"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.isocalendar()[1]
    except:
        return 0


def get_country_code(country: str) -> str:
    """Get country ISO code"""
    return COUNTRY_TO_CODE.get(country, "XX")


async def import_all_tournaments():
    """Import all tournaments into MongoDB"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("IMPORT DES TOURNOIS ATP/WTA/ITF")
    print("=" * 60)
    
    # Clear existing tournaments
    result = await db.tournaments.delete_many({})
    print(f"\n✓ Suppression des anciens tournois: {result.deleted_count}")
    
    all_tournaments = []
    
    # Process ATP tournaments
    print("\n--- ATP TOURNAMENTS ---")
    for t in ATP_TOURNAMENTS:
        tournament = {
            "id": t["id"],
            "name": t["name"],
            "city": t["city"],
            "country": t["country"],
            "countryCode": get_country_code(t["country"]),
            "flag": t.get("flag", "🏳️"),
            "startDate": datetime.strptime(t["startDate"], "%Y-%m-%d"),
            "endDate": datetime.strptime(t["endDate"], "%Y-%m-%d"),
            "surface": t["surface"],
            "prizeMoney": t["prizeMoney"],
            "currency": "USD",
            "level": t["level"],
            "circuit": "atp",
            "category": t["category"],
            "week": calculate_week(t["startDate"]),
            "year": 2026,
            "indoor": t["surface"] == "indoor",
            "createdAt": datetime.now(timezone.utc),
        }
        all_tournaments.append(tournament)
    print(f"  ✓ {len(ATP_TOURNAMENTS)} tournois ATP préparés")
    
    # Process WTA tournaments
    print("\n--- WTA TOURNAMENTS ---")
    for t in WTA_TOURNAMENTS:
        tournament = {
            "id": t["id"],
            "name": t["name"],
            "city": t["city"],
            "country": t["country"],
            "countryCode": get_country_code(t["country"]),
            "flag": t.get("flag", "🏳️"),
            "startDate": datetime.strptime(t["startDate"], "%Y-%m-%d"),
            "endDate": datetime.strptime(t["endDate"], "%Y-%m-%d"),
            "surface": t["surface"],
            "prizeMoney": t["prizeMoney"],
            "currency": "USD",
            "level": t["level"],
            "circuit": "wta",
            "category": t["category"],
            "week": calculate_week(t["startDate"]),
            "year": 2026,
            "indoor": t["surface"] == "indoor",
            "createdAt": datetime.now(timezone.utc),
        }
        all_tournaments.append(tournament)
    print(f"  ✓ {len(WTA_TOURNAMENTS)} tournois WTA préparés")
    
    # Process ITF tournaments
    print("\n--- ITF TOURNAMENTS ---")
    for t in ITF_TOURNAMENTS:
        tournament = {
            "id": t["id"],
            "name": t["name"],
            "city": t["city"],
            "country": t["country"],
            "countryCode": get_country_code(t["country"]),
            "flag": t.get("flag", "🏳️"),
            "startDate": datetime.strptime(t["startDate"], "%Y-%m-%d"),
            "endDate": datetime.strptime(t["endDate"], "%Y-%m-%d"),
            "surface": t["surface"],
            "prizeMoney": t["prizeMoney"],
            "currency": "USD",
            "level": t["level"],
            "circuit": "itf",
            "category": t["category"],
            "week": calculate_week(t["startDate"]),
            "year": 2026,
            "indoor": False,
            "createdAt": datetime.now(timezone.utc),
        }
        all_tournaments.append(tournament)
    print(f"  ✓ {len(ITF_TOURNAMENTS)} tournois ITF préparés")
    
    # Process ITF Wheelchair tournaments
    print("\n--- ITF WHEELCHAIR TOURNAMENTS ---")
    for t in ITF_WHEELCHAIR_TOURNAMENTS:
        tournament = {
            "id": t["id"],
            "name": t["name"],
            "city": t["city"],
            "country": t["country"],
            "countryCode": get_country_code(t["country"]),
            "flag": t.get("flag", "🏳️"),
            "startDate": datetime.strptime(t["startDate"], "%Y-%m-%d"),
            "endDate": datetime.strptime(t["endDate"], "%Y-%m-%d"),
            "surface": t["surface"],
            "prizeMoney": t["prizeMoney"],
            "currency": "USD",
            "level": t["level"],
            "circuit": "itf_wheelchair",
            "category": t["category"],
            "week": calculate_week(t["startDate"]),
            "year": 2026,
            "indoor": False,
            "createdAt": datetime.now(timezone.utc),
        }
        all_tournaments.append(tournament)
    print(f"  ✓ {len(ITF_WHEELCHAIR_TOURNAMENTS)} tournois ITF Wheelchair préparés")
    
    # Insert all tournaments
    print("\n" + "=" * 60)
    print(f"INSERTION DE {len(all_tournaments)} TOURNOIS")
    print("=" * 60)
    
    result = await db.tournaments.insert_many(all_tournaments)
    print(f"✓ {len(result.inserted_ids)} tournois insérés avec succès!")
    
    # Create indexes
    await db.tournaments.create_index("circuit")
    await db.tournaments.create_index("startDate")
    await db.tournaments.create_index("week")
    await db.tournaments.create_index("category")
    await db.tournaments.create_index("id", unique=True)
    print("✓ Index créés")
    
    # Summary
    print("\n" + "=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    atp_count = await db.tournaments.count_documents({"circuit": "atp"})
    wta_count = await db.tournaments.count_documents({"circuit": "wta"})
    itf_count = await db.tournaments.count_documents({"circuit": "itf"})
    wheelchair_count = await db.tournaments.count_documents({"circuit": "itf_wheelchair"})
    
    print(f"  ATP:            {atp_count}")
    print(f"  WTA:            {wta_count}")
    print(f"  ITF:            {itf_count}")
    print(f"  ITF Wheelchair: {wheelchair_count}")
    print(f"  --------------------------")
    print(f"  TOTAL:          {atp_count + wta_count + itf_count + wheelchair_count}")
    
    client.close()
    print("\n✓ Import terminé avec succès!")


if __name__ == "__main__":
    asyncio.run(import_all_tournaments())
