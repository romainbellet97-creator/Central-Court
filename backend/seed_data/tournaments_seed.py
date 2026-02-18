"""
Seed data for ATP, WTA, and ITF tournaments 2026
Complete tournament calendar with prize money, dates, and locations
"""

# Country code mapping
COUNTRY_CODES = {
    "Australia": "AU", "Australie": "AU",
    "France": "FR",
    "United Kingdom": "GB", "Royaume-Uni": "GB", "UK": "GB",
    "USA": "US", "United States": "US", "États-Unis": "US",
    "Spain": "ES", "Espagne": "ES",
    "Italy": "IT", "Italie": "IT",
    "Germany": "DE", "Allemagne": "DE",
    "Canada": "CA",
    "China": "CN", "Chine": "CN",
    "Japan": "JP", "Japon": "JP",
    "Argentina": "AR", "Argentine": "AR",
    "Brazil": "BR", "Brésil": "BR",
    "Mexico": "MX", "Mexique": "MX",
    "Chile": "CL", "Chili": "CL",
    "Netherlands": "NL", "Pays-Bas": "NL",
    "Belgium": "BE", "Belgique": "BE",
    "Switzerland": "CH", "Suisse": "CH",
    "Austria": "AT", "Autriche": "AT",
    "Monaco": "MC",
    "Croatia": "HR", "Croatie": "HR",
    "Serbia": "RS", "Serbie": "RS",
    "Czech Republic": "CZ", "République tchèque": "CZ",
    "Poland": "PL", "Pologne": "PL",
    "Russia": "RU", "Russie": "RU",
    "Sweden": "SE", "Suède": "SE",
    "Norway": "NO", "Norvège": "NO",
    "Denmark": "DK", "Danemark": "DK",
    "Finland": "FI", "Finlande": "FI",
    "Portugal": "PT",
    "Greece": "GR", "Grèce": "GR",
    "Turkey": "TR", "Turquie": "TR",
    "Romania": "RO", "Roumanie": "RO",
    "Hungary": "HU", "Hongrie": "HU",
    "India": "IN", "Inde": "IN",
    "UAE": "AE", "Émirats": "AE", "United Arab Emirates": "AE",
    "Qatar": "QA",
    "Saudi Arabia": "SA", "Arabie Saoudite": "SA",
    "South Korea": "KR", "Corée du Sud": "KR",
    "Taiwan": "TW", "Taïwan": "TW",
    "Singapore": "SG", "Singapour": "SG",
    "Thailand": "TH", "Thaïlande": "TH",
    "Malaysia": "MY", "Malaisie": "MY",
    "Indonesia": "ID", "Indonésie": "ID",
    "Vietnam": "VN",
    "Kazakhstan": "KZ",
    "Uzbekistan": "UZ", "Ouzbékistan": "UZ",
    "Morocco": "MA", "Maroc": "MA",
    "Tunisia": "TN", "Tunisie": "TN",
    "Egypt": "EG", "Egypte": "EG", "Égypte": "EG",
    "South Africa": "ZA", "Afrique du Sud": "ZA",
    "New Zealand": "NZ", "Nouvelle-Zélande": "NZ",
    "Colombia": "CO", "Colombie": "CO",
    "Ecuador": "EC", "Équateur": "EC",
    "Peru": "PE", "Pérou": "PE",
    "Uruguay": "UY",
    "Venezuela": "VE",
}

# ============== ATP TOURNAMENTS 2026 ==============
ATP_TOURNAMENTS = [
    # Week 1 - United Cup
    {"name": "United Cup", "city": "Sydney", "country": "Australie", "startDate": "2025-12-29", "endDate": "2026-01-05", "surface": "Hard", "category": "ATP Cup", "prizeMoney": 10000000, "currency": "USD", "points": 0, "week": 1},
    
    # Week 1
    {"name": "Brisbane International", "city": "Brisbane", "country": "Australie", "startDate": "2025-12-29", "endDate": "2026-01-05", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 1},
    {"name": "Tata Open Maharashtra", "city": "Pune", "country": "Inde", "startDate": "2025-12-30", "endDate": "2026-01-05", "surface": "Hard", "category": "ATP 250", "prizeMoney": 579320, "currency": "USD", "points": 250, "week": 1},
    {"name": "Hong Kong Tennis Open", "city": "Hong Kong", "country": "Chine", "startDate": "2025-12-29", "endDate": "2026-01-05", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 1},
    
    # Week 2
    {"name": "Adelaide International 1", "city": "Adelaide", "country": "Australie", "startDate": "2026-01-06", "endDate": "2026-01-11", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 2},
    {"name": "ASB Classic", "city": "Auckland", "country": "Nouvelle-Zélande", "startDate": "2026-01-06", "endDate": "2026-01-11", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 2},
    
    # Week 3 - Australian Open
    {"name": "Australian Open", "city": "Melbourne", "country": "Australie", "startDate": "2026-01-19", "endDate": "2026-02-01", "surface": "Hard", "category": "Grand Slam", "prizeMoney": 76500000, "currency": "AUD", "points": 2000, "week": 3},
    
    # Week 5
    {"name": "Open Sud de France", "city": "Montpellier", "country": "France", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "Hard", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 5, "indoor": True},
    {"name": "Córdoba Open", "city": "Córdoba", "country": "Argentine", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "USD", "points": 250, "week": 5},
    {"name": "Dallas Open", "city": "Dallas", "country": "USA", "startDate": "2026-02-02", "endDate": "2026-02-09", "surface": "Hard", "category": "ATP 250", "prizeMoney": 690090, "currency": "USD", "points": 250, "week": 5, "indoor": True},
    
    # Week 6
    {"name": "Open 13 Provence", "city": "Marseille", "country": "France", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "Hard", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 6, "indoor": True},
    {"name": "Argentina Open", "city": "Buenos Aires", "country": "Argentine", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "USD", "points": 250, "week": 6},
    {"name": "Delray Beach Open", "city": "Delray Beach", "country": "USA", "startDate": "2026-02-09", "endDate": "2026-02-16", "surface": "Hard", "category": "ATP 250", "prizeMoney": 690090, "currency": "USD", "points": 250, "week": 6},
    
    # Week 7
    {"name": "ABN AMRO Open", "city": "Rotterdam", "country": "Pays-Bas", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2349365, "currency": "EUR", "points": 500, "week": 7, "indoor": True},
    {"name": "Rio Open", "city": "Rio de Janeiro", "country": "Brésil", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Clay", "category": "ATP 500", "prizeMoney": 2118090, "currency": "USD", "points": 500, "week": 7},
    {"name": "Qatar ExxonMobil Open", "city": "Doha", "country": "Qatar", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Hard", "category": "ATP 250", "prizeMoney": 1468905, "currency": "USD", "points": 250, "week": 7},
    
    # Week 8
    {"name": "Abierto Mexicano Telcel", "city": "Acapulco", "country": "Mexique", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2349365, "currency": "USD", "points": 500, "week": 8},
    {"name": "Chile Dove Men+Care Open", "city": "Santiago", "country": "Chili", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "USD", "points": 250, "week": 8},
    {"name": "Dubai Duty Free Championships", "city": "Dubai", "country": "Émirats", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2964465, "currency": "USD", "points": 500, "week": 8},
    
    # Week 10-11 - Indian Wells
    {"name": "BNP Paribas Open", "city": "Indian Wells", "country": "USA", "startDate": "2026-03-05", "endDate": "2026-03-16", "surface": "Hard", "category": "Masters 1000", "prizeMoney": 8995555, "currency": "USD", "points": 1000, "week": 10},
    
    # Week 12-13 - Miami
    {"name": "Miami Open", "city": "Miami", "country": "USA", "startDate": "2026-03-19", "endDate": "2026-03-30", "surface": "Hard", "category": "Masters 1000", "prizeMoney": 8995555, "currency": "USD", "points": 1000, "week": 12},
    
    # Week 14
    {"name": "Fayez Sarofim & Co. U.S. Men's Clay Court Championship", "city": "Houston", "country": "USA", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "Clay", "category": "ATP 250", "prizeMoney": 690090, "currency": "USD", "points": 250, "week": 14},
    {"name": "Grand Prix Hassan II", "city": "Marrakech", "country": "Maroc", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 14},
    
    # Week 15 - Monte-Carlo
    {"name": "Rolex Monte-Carlo Masters", "city": "Monte-Carlo", "country": "Monaco", "startDate": "2026-04-12", "endDate": "2026-04-19", "surface": "Clay", "category": "Masters 1000", "prizeMoney": 5950935, "currency": "EUR", "points": 1000, "week": 15},
    
    # Week 16
    {"name": "Barcelona Open Banc Sabadell", "city": "Barcelona", "country": "Espagne", "startDate": "2026-04-19", "endDate": "2026-04-26", "surface": "Clay", "category": "ATP 500", "prizeMoney": 2722480, "currency": "EUR", "points": 500, "week": 16},
    {"name": "BMW Open by American Express", "city": "Munich", "country": "Allemagne", "startDate": "2026-04-19", "endDate": "2026-04-26", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 16},
    {"name": "Srpska Open", "city": "Banja Luka", "country": "Serbie", "startDate": "2026-04-19", "endDate": "2026-04-26", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 16},
    
    # Week 17-18 - Madrid
    {"name": "Mutua Madrid Open", "city": "Madrid", "country": "Espagne", "startDate": "2026-04-26", "endDate": "2026-05-04", "surface": "Clay", "category": "Masters 1000", "prizeMoney": 7709570, "currency": "EUR", "points": 1000, "week": 17},
    
    # Week 19-20 - Rome
    {"name": "Internazionali BNL d'Italia", "city": "Rome", "country": "Italie", "startDate": "2026-05-10", "endDate": "2026-05-17", "surface": "Clay", "category": "Masters 1000", "prizeMoney": 7709570, "currency": "EUR", "points": 1000, "week": 19},
    
    # Week 20
    {"name": "Gonet Geneva Open", "city": "Geneva", "country": "Suisse", "startDate": "2026-05-17", "endDate": "2026-05-23", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 20},
    {"name": "Open de Lyon", "city": "Lyon", "country": "France", "startDate": "2026-05-17", "endDate": "2026-05-23", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 20},
    
    # Week 21-22 - Roland-Garros
    {"name": "Roland-Garros", "city": "Paris", "country": "France", "startDate": "2026-05-24", "endDate": "2026-06-07", "surface": "Clay", "category": "Grand Slam", "prizeMoney": 53478000, "currency": "EUR", "points": 2000, "week": 21},
    
    # Week 23
    {"name": "Boss Open", "city": "Stuttgart", "country": "Allemagne", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "Grass", "category": "ATP 250", "prizeMoney": 766280, "currency": "EUR", "points": 250, "week": 23},
    {"name": "Libema Open", "city": "'s-Hertogenbosch", "country": "Pays-Bas", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "Grass", "category": "ATP 250", "prizeMoney": 690090, "currency": "EUR", "points": 250, "week": 23},
    
    # Week 24
    {"name": "cinch Championships", "city": "London", "country": "Royaume-Uni", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "Grass", "category": "ATP 500", "prizeMoney": 2345155, "currency": "GBP", "points": 500, "week": 24},
    {"name": "Terra Wortmann Open", "city": "Halle", "country": "Allemagne", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "Grass", "category": "ATP 500", "prizeMoney": 2345155, "currency": "EUR", "points": 500, "week": 24},
    
    # Week 25
    {"name": "Mallorca Championships", "city": "Mallorca", "country": "Espagne", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "Grass", "category": "ATP 250", "prizeMoney": 766280, "currency": "EUR", "points": 250, "week": 25},
    {"name": "Rothesay International", "city": "Eastbourne", "country": "Royaume-Uni", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "Grass", "category": "ATP 250", "prizeMoney": 766280, "currency": "GBP", "points": 250, "week": 25},
    
    # Week 26-27 - Wimbledon
    {"name": "Wimbledon", "city": "London", "country": "Royaume-Uni", "startDate": "2026-06-29", "endDate": "2026-07-12", "surface": "Grass", "category": "Grand Slam", "prizeMoney": 44700000, "currency": "GBP", "points": 2000, "week": 26},
    
    # Week 28
    {"name": "Nordea Open", "city": "Båstad", "country": "Suède", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 28},
    {"name": "Hamburg European Open", "city": "Hamburg", "country": "Allemagne", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "Clay", "category": "ATP 500", "prizeMoney": 2118090, "currency": "EUR", "points": 500, "week": 28},
    {"name": "Infosys Hall of Fame Open", "city": "Newport", "country": "USA", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "Grass", "category": "ATP 250", "prizeMoney": 690090, "currency": "USD", "points": 250, "week": 28},
    
    # Week 29
    {"name": "Croatia Open Umag", "city": "Umag", "country": "Croatie", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 29},
    {"name": "Swiss Open Gstaad", "city": "Gstaad", "country": "Suisse", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 29},
    {"name": "Atlanta Open", "city": "Atlanta", "country": "USA", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 29},
    
    # Week 30
    {"name": "Generali Open", "city": "Kitzbühel", "country": "Autriche", "startDate": "2026-07-27", "endDate": "2026-08-02", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 30},
    {"name": "Plava Laguna Croatia Open Umag", "city": "Umag", "country": "Croatie", "startDate": "2026-07-27", "endDate": "2026-08-02", "surface": "Clay", "category": "ATP 250", "prizeMoney": 579320, "currency": "EUR", "points": 250, "week": 30},
    {"name": "Washington Open", "city": "Washington", "country": "USA", "startDate": "2026-07-27", "endDate": "2026-08-03", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2118090, "currency": "USD", "points": 500, "week": 30},
    
    # Week 31-32 - Canada
    {"name": "National Bank Open", "city": "Toronto/Montreal", "country": "Canada", "startDate": "2026-08-08", "endDate": "2026-08-16", "surface": "Hard", "category": "Masters 1000", "prizeMoney": 6926565, "currency": "USD", "points": 1000, "week": 31},
    
    # Week 33 - Cincinnati
    {"name": "Western & Southern Open", "city": "Cincinnati", "country": "USA", "startDate": "2026-08-15", "endDate": "2026-08-23", "surface": "Hard", "category": "Masters 1000", "prizeMoney": 6926565, "currency": "USD", "points": 1000, "week": 33},
    
    # Week 34
    {"name": "Winston-Salem Open", "city": "Winston-Salem", "country": "USA", "startDate": "2026-08-23", "endDate": "2026-08-29", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 34},
    
    # Week 35-36 - US Open
    {"name": "US Open", "city": "New York", "country": "USA", "startDate": "2026-08-31", "endDate": "2026-09-13", "surface": "Hard", "category": "Grand Slam", "prizeMoney": 65000000, "currency": "USD", "points": 2000, "week": 35},
    
    # Week 37
    {"name": "Chengdu Open", "city": "Chengdu", "country": "Chine", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 37},
    {"name": "Hangzhou Open", "city": "Hangzhou", "country": "Chine", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 37},
    {"name": "Laver Cup", "city": "San Francisco", "country": "USA", "startDate": "2026-09-25", "endDate": "2026-09-27", "surface": "Hard", "category": "Laver Cup", "prizeMoney": 0, "currency": "USD", "points": 0, "week": 37},
    
    # Week 38
    {"name": "China Open", "city": "Beijing", "country": "Chine", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "Hard", "category": "ATP 500", "prizeMoney": 3491865, "currency": "USD", "points": 500, "week": 38},
    {"name": "Japan Open Tennis Championships", "city": "Tokyo", "country": "Japon", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2118090, "currency": "USD", "points": 500, "week": 38},
    
    # Week 39-40 - Shanghai
    {"name": "Rolex Shanghai Masters", "city": "Shanghai", "country": "Chine", "startDate": "2026-10-05", "endDate": "2026-10-12", "surface": "Hard", "category": "Masters 1000", "prizeMoney": 8995555, "currency": "USD", "points": 1000, "week": 39},
    
    # Week 41
    {"name": "Erste Bank Open", "city": "Vienna", "country": "Autriche", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2118090, "currency": "EUR", "points": 500, "week": 41, "indoor": True},
    {"name": "European Open", "city": "Antwerp", "country": "Belgique", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "EUR", "points": 250, "week": 41, "indoor": True},
    {"name": "Stockholm Open", "city": "Stockholm", "country": "Suède", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "EUR", "points": 250, "week": 41, "indoor": True},
    
    # Week 42
    {"name": "Swiss Indoors Basel", "city": "Basel", "country": "Suisse", "startDate": "2026-10-26", "endDate": "2026-11-01", "surface": "Hard", "category": "ATP 500", "prizeMoney": 2118090, "currency": "EUR", "points": 500, "week": 42, "indoor": True},
    {"name": "St. Petersburg Open", "city": "St. Petersburg", "country": "Russie", "startDate": "2026-10-26", "endDate": "2026-11-01", "surface": "Hard", "category": "ATP 250", "prizeMoney": 766280, "currency": "USD", "points": 250, "week": 42, "indoor": True},
    
    # Week 43-44 - Paris Masters
    {"name": "Rolex Paris Masters", "city": "Paris", "country": "France", "startDate": "2026-11-01", "endDate": "2026-11-08", "surface": "Hard", "category": "Masters 1000", "prizeMoney": 5950935, "currency": "EUR", "points": 1000, "week": 43, "indoor": True},
    
    # Week 45
    {"name": "Mubadala World Tennis Championship", "city": "Abu Dhabi", "country": "Émirats", "startDate": "2026-12-17", "endDate": "2026-12-19", "surface": "Hard", "category": "Exhibition", "prizeMoney": 250000, "currency": "USD", "points": 0, "week": 51},
    
    # Week 46 - ATP Finals
    {"name": "Nitto ATP Finals", "city": "Turin", "country": "Italie", "startDate": "2026-11-15", "endDate": "2026-11-22", "surface": "Hard", "category": "ATP Finals", "prizeMoney": 15000000, "currency": "USD", "points": 1500, "week": 46, "indoor": True},
]

# ============== WTA TOURNAMENTS 2026 ==============
WTA_TOURNAMENTS = [
    # Week 1
    {"name": "Brisbane International WTA", "city": "Brisbane", "country": "Australie", "startDate": "2025-12-29", "endDate": "2026-01-05", "surface": "Hard", "category": "WTA 500", "prizeMoney": 1048755, "currency": "USD", "points": 500, "week": 1},
    {"name": "Adelaide International WTA 1", "city": "Adelaide", "country": "Australie", "startDate": "2026-01-06", "endDate": "2026-01-11", "surface": "Hard", "category": "WTA 500", "prizeMoney": 1048755, "currency": "USD", "points": 500, "week": 2},
    {"name": "ASB Classic WTA", "city": "Auckland", "country": "Nouvelle-Zélande", "startDate": "2026-01-06", "endDate": "2026-01-11", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 2},
    
    # Australian Open
    {"name": "Australian Open WTA", "city": "Melbourne", "country": "Australie", "startDate": "2026-01-19", "endDate": "2026-02-01", "surface": "Hard", "category": "Grand Slam", "prizeMoney": 76500000, "currency": "AUD", "points": 2000, "week": 3},
    
    # Week 6
    {"name": "Linz Open", "city": "Linz", "country": "Autriche", "startDate": "2026-02-03", "endDate": "2026-02-09", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "EUR", "points": 500, "week": 5, "indoor": True},
    {"name": "Hua Hin Open", "city": "Hua Hin", "country": "Thaïlande", "startDate": "2026-02-03", "endDate": "2026-02-09", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 5},
    
    # Week 7
    {"name": "Qatar TotalEnergies Open", "city": "Doha", "country": "Qatar", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 3221715, "currency": "USD", "points": 1000, "week": 6},
    {"name": "Abu Dhabi Open WTA", "city": "Abu Dhabi", "country": "Émirats", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 6},
    
    # Week 8
    {"name": "Dubai Duty Free Tennis Championships WTA", "city": "Dubai", "country": "Émirats", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 3221715, "currency": "USD", "points": 1000, "week": 7},
    
    # Week 9
    {"name": "Abierto GNP Seguros", "city": "Monterrey", "country": "Mexique", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 8},
    {"name": "Merida Open", "city": "Merida", "country": "Mexique", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 8},
    {"name": "Austin Open", "city": "Austin", "country": "USA", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 8},
    
    # Indian Wells
    {"name": "BNP Paribas Open WTA", "city": "Indian Wells", "country": "USA", "startDate": "2026-03-05", "endDate": "2026-03-16", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 8995555, "currency": "USD", "points": 1000, "week": 10},
    
    # Miami
    {"name": "Miami Open WTA", "city": "Miami", "country": "USA", "startDate": "2026-03-19", "endDate": "2026-03-30", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 8995555, "currency": "USD", "points": 1000, "week": 12},
    
    # Week 14
    {"name": "Charleston Open", "city": "Charleston", "country": "USA", "startDate": "2026-03-30", "endDate": "2026-04-06", "surface": "Clay", "category": "WTA 500", "prizeMoney": 1048755, "currency": "USD", "points": 500, "week": 13},
    {"name": "Bogotá Open", "city": "Bogota", "country": "Colombie", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 14},
    
    # Week 15
    {"name": "Porsche Tennis Grand Prix", "city": "Stuttgart", "country": "Allemagne", "startDate": "2026-04-13", "endDate": "2026-04-19", "surface": "Clay", "category": "WTA 500", "prizeMoney": 922573, "currency": "EUR", "points": 500, "week": 15, "indoor": True},
    {"name": "Istanbul Open", "city": "Istanbul", "country": "Turquie", "startDate": "2026-04-13", "endDate": "2026-04-19", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 15},
    
    # Madrid
    {"name": "Mutua Madrid Open WTA", "city": "Madrid", "country": "Espagne", "startDate": "2026-04-26", "endDate": "2026-05-04", "surface": "Clay", "category": "WTA 1000", "prizeMoney": 7709570, "currency": "EUR", "points": 1000, "week": 17},
    
    # Rome
    {"name": "Internazionali BNL d'Italia WTA", "city": "Rome", "country": "Italie", "startDate": "2026-05-10", "endDate": "2026-05-17", "surface": "Clay", "category": "WTA 1000", "prizeMoney": 4842434, "currency": "EUR", "points": 1000, "week": 19},
    
    # Week 20
    {"name": "Strasbourg International", "city": "Strasbourg", "country": "France", "startDate": "2026-05-17", "endDate": "2026-05-23", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 20},
    {"name": "Rabat Open", "city": "Rabat", "country": "Maroc", "startDate": "2026-05-17", "endDate": "2026-05-23", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 20},
    
    # Roland-Garros
    {"name": "Roland-Garros WTA", "city": "Paris", "country": "France", "startDate": "2026-05-24", "endDate": "2026-06-07", "surface": "Clay", "category": "Grand Slam", "prizeMoney": 53478000, "currency": "EUR", "points": 2000, "week": 21},
    
    # Grass season
    {"name": "Nottingham Open", "city": "Nottingham", "country": "Royaume-Uni", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "Grass", "category": "WTA 250", "prizeMoney": 259303, "currency": "GBP", "points": 250, "week": 23},
    {"name": "Libema Open WTA", "city": "'s-Hertogenbosch", "country": "Pays-Bas", "startDate": "2026-06-08", "endDate": "2026-06-14", "surface": "Grass", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 23},
    {"name": "Birmingham Classic", "city": "Birmingham", "country": "Royaume-Uni", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "Grass", "category": "WTA 500", "prizeMoney": 780637, "currency": "GBP", "points": 500, "week": 24},
    {"name": "Berlin Open", "city": "Berlin", "country": "Allemagne", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "Grass", "category": "WTA 500", "prizeMoney": 922573, "currency": "EUR", "points": 500, "week": 24},
    {"name": "Bad Homburg Open", "city": "Bad Homburg", "country": "Allemagne", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "Grass", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 25},
    {"name": "Rothesay International WTA", "city": "Eastbourne", "country": "Royaume-Uni", "startDate": "2026-06-22", "endDate": "2026-06-28", "surface": "Grass", "category": "WTA 500", "prizeMoney": 780637, "currency": "GBP", "points": 500, "week": 25},
    
    # Wimbledon
    {"name": "Wimbledon WTA", "city": "London", "country": "Royaume-Uni", "startDate": "2026-06-29", "endDate": "2026-07-12", "surface": "Grass", "category": "Grand Slam", "prizeMoney": 44700000, "currency": "GBP", "points": 2000, "week": 26},
    
    # Summer hard court
    {"name": "Palermo Open", "city": "Palermo", "country": "Italie", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 28},
    {"name": "Hungarian Grand Prix", "city": "Budapest", "country": "Hongrie", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 28},
    {"name": "Prague Open", "city": "Prague", "country": "République tchèque", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 29},
    {"name": "Polish Open", "city": "Warsaw", "country": "Pologne", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "Clay", "category": "WTA 250", "prizeMoney": 259303, "currency": "EUR", "points": 250, "week": 29},
    {"name": "Washington Open WTA", "city": "Washington", "country": "USA", "startDate": "2026-08-03", "endDate": "2026-08-09", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 31},
    
    # Canadian Open
    {"name": "National Bank Open WTA", "city": "Toronto/Montreal", "country": "Canada", "startDate": "2026-08-08", "endDate": "2026-08-16", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 3211475, "currency": "USD", "points": 1000, "week": 32},
    
    # Cincinnati
    {"name": "Western & Southern Open WTA", "city": "Cincinnati", "country": "USA", "startDate": "2026-08-15", "endDate": "2026-08-23", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 3211475, "currency": "USD", "points": 1000, "week": 33},
    
    # Week 34
    {"name": "Cleveland Open", "city": "Cleveland", "country": "USA", "startDate": "2026-08-23", "endDate": "2026-08-29", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 34},
    {"name": "Monterrey Open", "city": "Monterrey", "country": "Mexique", "startDate": "2026-08-23", "endDate": "2026-08-29", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 34},
    
    # US Open
    {"name": "US Open WTA", "city": "New York", "country": "USA", "startDate": "2026-08-31", "endDate": "2026-09-13", "surface": "Hard", "category": "Grand Slam", "prizeMoney": 65000000, "currency": "USD", "points": 2000, "week": 35},
    
    # Asian swing
    {"name": "Guadalajara Open", "city": "Guadalajara", "country": "Mexique", "startDate": "2026-09-14", "endDate": "2026-09-20", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 37},
    {"name": "Korea Open", "city": "Seoul", "country": "Corée du Sud", "startDate": "2026-09-14", "endDate": "2026-09-20", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 37},
    {"name": "Toray Pan Pacific Open", "city": "Tokyo", "country": "Japon", "startDate": "2026-09-21", "endDate": "2026-09-27", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 38},
    {"name": "China Open WTA", "city": "Beijing", "country": "Chine", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 3221715, "currency": "USD", "points": 1000, "week": 39},
    {"name": "Wuhan Open", "city": "Wuhan", "country": "Chine", "startDate": "2026-10-05", "endDate": "2026-10-11", "surface": "Hard", "category": "WTA 1000", "prizeMoney": 3221715, "currency": "USD", "points": 1000, "week": 40},
    
    # Indoor
    {"name": "Ningbo Open", "city": "Ningbo", "country": "Chine", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "Hard", "category": "WTA 500", "prizeMoney": 780637, "currency": "USD", "points": 500, "week": 41},
    {"name": "Guangzhou Open", "city": "Guangzhou", "country": "Chine", "startDate": "2026-10-12", "endDate": "2026-10-18", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 41},
    {"name": "Hong Kong Open WTA", "city": "Hong Kong", "country": "Chine", "startDate": "2026-10-26", "endDate": "2026-11-01", "surface": "Hard", "category": "WTA 250", "prizeMoney": 259303, "currency": "USD", "points": 250, "week": 43},
    
    # WTA Finals
    {"name": "WTA Finals", "city": "Riyadh", "country": "Arabie Saoudite", "startDate": "2026-11-02", "endDate": "2026-11-09", "surface": "Hard", "category": "WTA Finals", "prizeMoney": 15250000, "currency": "USD", "points": 1500, "week": 44, "indoor": True},
]

# ============== ITF TOURNAMENTS 2026 ==============
ITF_TOURNAMENTS = [
    # ITF Men's World Tennis Tour (M25, M15)
    {"name": "ITF Antalya M25", "city": "Antalya", "country": "Turquie", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "Hard", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 1},
    {"name": "ITF Monastir M15", "city": "Monastir", "country": "Tunisie", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "Hard", "category": "ITF M15", "prizeMoney": 15000, "currency": "USD", "points": 15, "week": 1},
    {"name": "ITF Sharm El Sheikh M15", "city": "Sharm El Sheikh", "country": "Egypte", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "Hard", "category": "ITF M15", "prizeMoney": 15000, "currency": "USD", "points": 15, "week": 2},
    {"name": "ITF Cairo M25", "city": "Le Caire", "country": "Egypte", "startDate": "2026-01-19", "endDate": "2026-01-25", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 3},
    {"name": "ITF Cancun M25", "city": "Cancun", "country": "Mexique", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "Hard", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 5},
    {"name": "ITF Traralgon M25", "city": "Traralgon", "country": "Australie", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "Hard", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 6},
    {"name": "ITF Lagos M25", "city": "Lagos", "country": "Portugal", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 7},
    {"name": "ITF Santa Margherita M25", "city": "Santa Margherita", "country": "Italie", "startDate": "2026-02-23", "endDate": "2026-03-01", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 8},
    {"name": "ITF Heraklion M15", "city": "Héraklion", "country": "Grèce", "startDate": "2026-03-02", "endDate": "2026-03-08", "surface": "Hard", "category": "ITF M15", "prizeMoney": 15000, "currency": "USD", "points": 15, "week": 9},
    {"name": "ITF Hammamet M25", "city": "Hammamet", "country": "Tunisie", "startDate": "2026-03-16", "endDate": "2026-03-22", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 11},
    {"name": "ITF Bolton Indoor M25", "city": "Bolton", "country": "Royaume-Uni", "startDate": "2026-03-23", "endDate": "2026-03-29", "surface": "Hard", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 12, "indoor": True},
    {"name": "ITF Bratislava M25", "city": "Bratislava", "country": "Slovaquie", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 14},
    {"name": "ITF Lousada M25", "city": "Lousada", "country": "Portugal", "startDate": "2026-04-13", "endDate": "2026-04-19", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 15},
    {"name": "ITF Madrid M15", "city": "Madrid", "country": "Espagne", "startDate": "2026-04-20", "endDate": "2026-04-26", "surface": "Clay", "category": "ITF M15", "prizeMoney": 15000, "currency": "USD", "points": 15, "week": 16},
    {"name": "ITF Alicante M25", "city": "Alicante", "country": "Espagne", "startDate": "2026-05-04", "endDate": "2026-05-10", "surface": "Clay", "category": "ITF M25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 18},
    
    # ITF Women's World Tennis Tour (W25, W15, W50, W75)
    {"name": "ITF Antalya W25", "city": "Antalya", "country": "Turquie", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "Hard", "category": "ITF W25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 1},
    {"name": "ITF Monastir W15", "city": "Monastir", "country": "Tunisie", "startDate": "2026-01-05", "endDate": "2026-01-11", "surface": "Hard", "category": "ITF W15", "prizeMoney": 15000, "currency": "USD", "points": 15, "week": 1},
    {"name": "ITF Sharm El Sheikh W15", "city": "Sharm El Sheikh", "country": "Egypte", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "Hard", "category": "ITF W15", "prizeMoney": 15000, "currency": "USD", "points": 15, "week": 2},
    {"name": "ITF Canberra W50", "city": "Canberra", "country": "Australie", "startDate": "2026-01-19", "endDate": "2026-01-25", "surface": "Hard", "category": "ITF W50", "prizeMoney": 50000, "currency": "USD", "points": 50, "week": 3},
    {"name": "ITF Dubai W25", "city": "Dubai", "country": "Émirats", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "Hard", "category": "ITF W25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 5},
    {"name": "ITF Surprise W75", "city": "Surprise", "country": "USA", "startDate": "2026-02-09", "endDate": "2026-02-15", "surface": "Hard", "category": "ITF W75", "prizeMoney": 75000, "currency": "USD", "points": 75, "week": 6},
    {"name": "ITF Caserta W25", "city": "Caserta", "country": "Italie", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Clay", "category": "ITF W25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 7},
    {"name": "ITF Madrid W25", "city": "Madrid", "country": "Espagne", "startDate": "2026-03-02", "endDate": "2026-03-08", "surface": "Clay", "category": "ITF W25", "prizeMoney": 25000, "currency": "USD", "points": 25, "week": 9},
    {"name": "ITF Croissy-Beaubourg W50", "city": "Croissy-Beaubourg", "country": "France", "startDate": "2026-03-16", "endDate": "2026-03-22", "surface": "Hard", "category": "ITF W50", "prizeMoney": 50000, "currency": "USD", "points": 50, "week": 11, "indoor": True},
    {"name": "ITF Boca Raton W100", "city": "Boca Raton", "country": "USA", "startDate": "2026-03-23", "endDate": "2026-03-29", "surface": "Hard", "category": "ITF W100", "prizeMoney": 100000, "currency": "USD", "points": 100, "week": 12},
    {"name": "ITF Dothan W50", "city": "Dothan", "country": "USA", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "Hard", "category": "ITF W50", "prizeMoney": 50000, "currency": "USD", "points": 50, "week": 14},
    {"name": "ITF Rome W50", "city": "Rome", "country": "Italie", "startDate": "2026-04-27", "endDate": "2026-05-03", "surface": "Clay", "category": "ITF W50", "prizeMoney": 50000, "currency": "USD", "points": 50, "week": 17},
    {"name": "ITF Saint-Gaudens W50", "city": "Saint-Gaudens", "country": "France", "startDate": "2026-05-04", "endDate": "2026-05-10", "surface": "Clay", "category": "ITF W50", "prizeMoney": 50000, "currency": "USD", "points": 50, "week": 18},
]

# ============== ITF WHEELCHAIR TOURNAMENTS 2026 ==============
ITF_WHEELCHAIR_TOURNAMENTS = [
    # Grand Slams Wheelchair
    {"name": "Australian Open Wheelchair", "city": "Melbourne", "country": "Australie", "startDate": "2026-01-22", "endDate": "2026-02-01", "surface": "Hard", "category": "ITF Wheelchair Grand Slam", "prizeMoney": 400000, "currency": "AUD", "points": 800, "week": 3},
    {"name": "Roland-Garros Wheelchair", "city": "Paris", "country": "France", "startDate": "2026-06-01", "endDate": "2026-06-07", "surface": "Clay", "category": "ITF Wheelchair Grand Slam", "prizeMoney": 350000, "currency": "EUR", "points": 800, "week": 22},
    {"name": "Wimbledon Wheelchair", "city": "London", "country": "Royaume-Uni", "startDate": "2026-07-06", "endDate": "2026-07-12", "surface": "Grass", "category": "ITF Wheelchair Grand Slam", "prizeMoney": 320000, "currency": "GBP", "points": 800, "week": 27},
    {"name": "US Open Wheelchair", "city": "New York", "country": "USA", "startDate": "2026-09-07", "endDate": "2026-09-13", "surface": "Hard", "category": "ITF Wheelchair Grand Slam", "prizeMoney": 400000, "currency": "USD", "points": 800, "week": 36},
    
    # Super Series
    {"name": "Japan Open Wheelchair", "city": "Tokyo", "country": "Japon", "startDate": "2026-05-11", "endDate": "2026-05-17", "surface": "Hard", "category": "ITF Wheelchair Super Series", "prizeMoney": 185000, "currency": "USD", "points": 400, "week": 19},
    {"name": "British Open Wheelchair", "city": "Nottingham", "country": "Royaume-Uni", "startDate": "2026-07-13", "endDate": "2026-07-19", "surface": "Grass", "category": "ITF Wheelchair Super Series", "prizeMoney": 185000, "currency": "GBP", "points": 400, "week": 28},
    {"name": "Swiss Open Wheelchair", "city": "Geneva", "country": "Suisse", "startDate": "2026-07-20", "endDate": "2026-07-26", "surface": "Clay", "category": "ITF Wheelchair Super Series", "prizeMoney": 185000, "currency": "CHF", "points": 400, "week": 29},
    {"name": "US Open Wheelchair Super Series", "city": "St. Louis", "country": "USA", "startDate": "2026-08-03", "endDate": "2026-08-09", "surface": "Hard", "category": "ITF Wheelchair Super Series", "prizeMoney": 185000, "currency": "USD", "points": 400, "week": 31},
    {"name": "NEC Wheelchair Masters", "city": "Orlando", "country": "USA", "startDate": "2026-11-11", "endDate": "2026-11-15", "surface": "Hard", "category": "ITF Wheelchair Masters", "prizeMoney": 200000, "currency": "USD", "points": 600, "week": 45, "indoor": True},
    
    # ITF 1 (Main tour)
    {"name": "Belgian Wheelchair Open", "city": "Brussels", "country": "Belgique", "startDate": "2026-02-16", "endDate": "2026-02-22", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "EUR", "points": 100, "week": 7, "indoor": True},
    {"name": "South Africa Wheelchair Open", "city": "Johannesburg", "country": "Afrique du Sud", "startDate": "2026-03-09", "endDate": "2026-03-15", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "USD", "points": 100, "week": 10},
    {"name": "Bolton Indoor Wheelchair", "city": "Bolton", "country": "Royaume-Uni", "startDate": "2026-03-23", "endDate": "2026-03-29", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "GBP", "points": 100, "week": 12, "indoor": True},
    {"name": "Israel Wheelchair Open", "city": "Ramat Hasharon", "country": "Israël", "startDate": "2026-04-06", "endDate": "2026-04-12", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "USD", "points": 100, "week": 14},
    {"name": "Barcelona Wheelchair Open", "city": "Barcelona", "country": "Espagne", "startDate": "2026-04-20", "endDate": "2026-04-26", "surface": "Clay", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "EUR", "points": 100, "week": 16},
    {"name": "French Riviera Wheelchair Open", "city": "Nice", "country": "France", "startDate": "2026-05-18", "endDate": "2026-05-24", "surface": "Clay", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "EUR", "points": 100, "week": 20},
    {"name": "German Open Wheelchair", "city": "Berlin", "country": "Allemagne", "startDate": "2026-08-17", "endDate": "2026-08-23", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "EUR", "points": 100, "week": 33},
    {"name": "Canadian Wheelchair Open", "city": "Montreal", "country": "Canada", "startDate": "2026-08-24", "endDate": "2026-08-30", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "CAD", "points": 100, "week": 34},
    {"name": "Korean Wheelchair Open", "city": "Seoul", "country": "Corée du Sud", "startDate": "2026-09-28", "endDate": "2026-10-04", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "USD", "points": 100, "week": 39},
    {"name": "Czech Indoor Wheelchair", "city": "Prague", "country": "République tchèque", "startDate": "2026-10-19", "endDate": "2026-10-25", "surface": "Hard", "category": "ITF Wheelchair 1", "prizeMoney": 50000, "currency": "EUR", "points": 100, "week": 42, "indoor": True},
    
    # ITF 2 / ITF 3 (Futures)
    {"name": "Tunisia Wheelchair Open", "city": "Tunis", "country": "Tunisie", "startDate": "2026-01-12", "endDate": "2026-01-18", "surface": "Hard", "category": "ITF Wheelchair 2", "prizeMoney": 15000, "currency": "USD", "points": 50, "week": 2},
    {"name": "Thailand Wheelchair Open", "city": "Bangkok", "country": "Thaïlande", "startDate": "2026-02-02", "endDate": "2026-02-08", "surface": "Hard", "category": "ITF Wheelchair 2", "prizeMoney": 15000, "currency": "USD", "points": 50, "week": 5},
    {"name": "Egypt Wheelchair Open", "city": "Cairo", "country": "Egypte", "startDate": "2026-03-02", "endDate": "2026-03-08", "surface": "Clay", "category": "ITF Wheelchair 2", "prizeMoney": 15000, "currency": "USD", "points": 50, "week": 9},
    {"name": "Portugal Wheelchair Open", "city": "Lisbon", "country": "Portugal", "startDate": "2026-04-13", "endDate": "2026-04-19", "surface": "Clay", "category": "ITF Wheelchair 2", "prizeMoney": 15000, "currency": "EUR", "points": 50, "week": 15},
    {"name": "Italian Wheelchair Futures", "city": "Rome", "country": "Italie", "startDate": "2026-05-04", "endDate": "2026-05-10", "surface": "Clay", "category": "ITF Wheelchair 3", "prizeMoney": 10000, "currency": "EUR", "points": 25, "week": 18},
    {"name": "Polish Wheelchair Open", "city": "Warsaw", "country": "Pologne", "startDate": "2026-06-15", "endDate": "2026-06-21", "surface": "Clay", "category": "ITF Wheelchair 2", "prizeMoney": 15000, "currency": "EUR", "points": 50, "week": 24},
    {"name": "Austrian Wheelchair Open", "city": "Vienna", "country": "Autriche", "startDate": "2026-09-14", "endDate": "2026-09-20", "surface": "Hard", "category": "ITF Wheelchair 2", "prizeMoney": 15000, "currency": "EUR", "points": 50, "week": 37},
    {"name": "Dutch Wheelchair Futures", "city": "Rotterdam", "country": "Pays-Bas", "startDate": "2026-10-05", "endDate": "2026-10-11", "surface": "Hard", "category": "ITF Wheelchair 3", "prizeMoney": 10000, "currency": "EUR", "points": 25, "week": 40, "indoor": True},
]

def get_all_tournaments():
    """Return all tournaments with proper IDs and country codes"""
    all_tournaments = []
    
    for t in ATP_TOURNAMENTS:
        t["circuit"] = "atp"
        t["id"] = f"atp-{t['name'].lower().replace(' ', '-')[:30]}-2026"
        t["countryCode"] = COUNTRY_CODES.get(t["country"], "XX")
        t["year"] = 2026
        t["indoor"] = t.get("indoor", False)
        all_tournaments.append(t)
    
    for t in WTA_TOURNAMENTS:
        t["circuit"] = "wta"
        t["id"] = f"wta-{t['name'].lower().replace(' ', '-')[:30]}-2026"
        t["countryCode"] = COUNTRY_CODES.get(t["country"], "XX")
        t["year"] = 2026
        t["indoor"] = t.get("indoor", False)
        all_tournaments.append(t)
    
    for t in ITF_TOURNAMENTS:
        t["circuit"] = "itf"
        t["id"] = f"itf-{t['name'].lower().replace(' ', '-')[:30]}-2026"
        t["countryCode"] = COUNTRY_CODES.get(t["country"], "XX")
        t["year"] = 2026
        t["indoor"] = t.get("indoor", False)
        all_tournaments.append(t)
    
    for t in ITF_WHEELCHAIR_TOURNAMENTS:
        t["circuit"] = "itf_wheelchair"
        t["id"] = f"itf-wc-{t['name'].lower().replace(' ', '-')[:30]}-2026"
        t["countryCode"] = COUNTRY_CODES.get(t["country"], "XX")
        t["year"] = 2026
        t["indoor"] = t.get("indoor", False)
        all_tournaments.append(t)
    
    return all_tournaments
