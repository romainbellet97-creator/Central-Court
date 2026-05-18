"""
Script d'import des tournois dans MongoDB
"""

import json
import csv
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "central_court")


def parse_date(date_str):
    """Parse date string to datetime"""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except:
        return None


def parse_wheelchair_date(date_str):
    """Parse wheelchair tournament date format (e.g., '10 Feb to 14 Feb 2026')"""
    try:
        parts = date_str.split(" to ")
        if len(parts) == 2:
            start_str = parts[0] + " 2026" if "2026" not in parts[0] else parts[0]
            end_str = parts[1]
            # Extract year from end date
            year = end_str.split()[-1]
            if "2026" not in start_str:
                start_str = parts[0] + " " + year
            start_date = datetime.strptime(start_str.strip(), "%d %b %Y")
            end_date = datetime.strptime(end_str.strip(), "%d %b %Y")
            return start_date, end_date
    except Exception as e:
        print(f"Date parse error for '{date_str}': {e}")
    return None, None


async def import_tournaments():
    """Import all tournaments from JSON and CSV files"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clear existing tournaments
    await db.tournaments.delete_many({})
    print("Cleared existing tournaments")
    
    tournaments = []
    
    # Import ATP tournaments
    print("\n=== Importing ATP tournaments ===")
    with open("/tmp/atp_tournaments.json", "r") as f:
        atp_data = json.load(f)
        for t in atp_data:
            tournament = {
                "id": t["id"],
                "name": t["name"],
                "circuit": "ATP",
                "category": t.get("category", ""),
                "surface": t.get("surface", ""),
                "startDate": parse_date(t.get("startDate")),
                "endDate": parse_date(t.get("endDate")),
                "week": t.get("week", 0),
                "city": t.get("location", {}).get("city", ""),
                "country": t.get("location", {}).get("country", ""),
                "venue": t.get("location", {}).get("venue", ""),
                "indoor": t.get("location", {}).get("indoor", False),
                "prizeMoney": t.get("prizeMoney", {}).get("total", 0),
                "currency": t.get("prizeMoney", {}).get("currency", "USD"),
                "points": t.get("points", {}).get("winner", 0),
                "drawSingles": t.get("draw", {}).get("singles", 0),
                "drawDoubles": t.get("draw", {}).get("doubles", 0),
                "year": t.get("year", 2026),
                "createdAt": datetime.utcnow(),
            }
            tournaments.append(tournament)
        print(f"Loaded {len(atp_data)} ATP tournaments")
    
    # Import WTA tournaments
    print("\n=== Importing WTA tournaments ===")
    with open("/tmp/wta_tournaments.json", "r") as f:
        wta_data = json.load(f)
        for t in wta_data:
            tournament = {
                "id": t["id"],
                "name": t["name"],
                "circuit": "WTA",
                "category": t.get("category", ""),
                "surface": t.get("surface", ""),
                "startDate": parse_date(t.get("startDate")),
                "endDate": parse_date(t.get("endDate")),
                "week": t.get("week", 0),
                "city": t.get("location", {}).get("city", ""),
                "country": t.get("location", {}).get("country", ""),
                "venue": t.get("location", {}).get("venue", ""),
                "indoor": t.get("location", {}).get("indoor", False),
                "prizeMoney": t.get("prizeMoney", {}).get("total", 0),
                "currency": t.get("prizeMoney", {}).get("currency", "USD"),
                "points": t.get("points", {}).get("winner", 0),
                "drawSingles": t.get("draw", {}).get("singles", 0),
                "drawDoubles": t.get("draw", {}).get("doubles", 0),
                "year": t.get("year", 2026),
                "createdAt": datetime.utcnow(),
            }
            tournaments.append(tournament)
        print(f"Loaded {len(wta_data)} WTA tournaments")
    
    # Import Wheelchair/ITF tournaments
    print("\n=== Importing ITF Wheelchair tournaments ===")
    wheelchair_count = 0
    with open("/tmp/wheelchair_tournaments.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            start_date, end_date = parse_wheelchair_date(row.get("Dates", ""))
            
            # Determine category level
            category = row.get("Category", "ITF")
            prize_str = row.get("Prize Money", "$0").replace("$", "").replace(",", "")
            try:
                prize_money = int(prize_str) if prize_str else 0
            except:
                prize_money = 0
            
            tournament = {
                "id": f"wheelchair-{row.get('Tournament Key', '')}".lower(),
                "name": row.get("Tournament Name", ""),
                "shortName": row.get("Short Name", ""),
                "circuit": "itf_wheelchair",
                "category": category,
                "surface": row.get("Surface", ""),
                "startDate": start_date,
                "endDate": end_date,
                "week": 0,  # Will calculate later
                "city": row.get("City/Town", ""),
                "country": row.get("Host Nation", ""),
                "venue": "",
                "indoor": "Indoor" in row.get("Surface", ""),
                "prizeMoney": prize_money,
                "currency": "USD",
                "points": 0,
                "drawSingles": 0,
                "drawDoubles": 0,
                "year": 2026,
                "tournamentUrl": row.get("Tournament URL", ""),
                "signUpLink": row.get("Sign Up Link", ""),
                "createdAt": datetime.utcnow(),
            }
            
            # Calculate week number from start date
            if start_date:
                tournament["week"] = start_date.isocalendar()[1]
            
            tournaments.append(tournament)
            wheelchair_count += 1
    print(f"Loaded {wheelchair_count} ITF Wheelchair tournaments")
    
    # Insert all tournaments
    print(f"\n=== Inserting {len(tournaments)} tournaments into database ===")
    if tournaments:
        result = await db.tournaments.insert_many(tournaments)
        print(f"Inserted {len(result.inserted_ids)} tournaments")
    
    # Create indexes
    print("\n=== Creating indexes ===")
    await db.tournaments.create_index("circuit")
    await db.tournaments.create_index("startDate")
    await db.tournaments.create_index("week")
    await db.tournaments.create_index("category")
    print("Indexes created")
    
    # Summary
    print("\n=== Summary ===")
    atp_count = await db.tournaments.count_documents({"circuit": "ATP"})
    wta_count = await db.tournaments.count_documents({"circuit": "WTA"})
    itf_count = await db.tournaments.count_documents({"circuit": "ITF"})
    print(f"ATP: {atp_count}")
    print(f"WTA: {wta_count}")
    print(f"ITF: {itf_count}")
    print(f"Total: {atp_count + wta_count + itf_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(import_tournaments())
