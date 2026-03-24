"""Safe script to update ONLY the tournaments collection in MongoDB.
Does NOT touch users, events, alerts, registrations or any other data.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")


async def seed_tournaments():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.central_court

    from seed_data.tournaments_seed import get_all_tournaments

    await db.tournaments.delete_many({})
    tournaments = get_all_tournaments()
    if tournaments:
        await db.tournaments.insert_many(tournaments)

    atp_count = sum(1 for t in tournaments if t.get('circuit') == 'atp')
    wta_count = sum(1 for t in tournaments if t.get('circuit') == 'wta')
    itf_count = sum(1 for t in tournaments if t.get('circuit') == 'itf')
    wc_count = sum(1 for t in tournaments if t.get('circuit') == 'itf_wheelchair')
    print(f"✅ Seeded {len(tournaments)} tournaments (ATP: {atp_count}, WTA: {wta_count}, ITF: {itf_count}, ITF Wheelchair: {wc_count})")

    await db.tournaments.create_index("circuit")
    await db.tournaments.create_index("weekNumber")
    print("✅ Indexes created")

    print("\n🎾 Tournaments updated — all other collections untouched.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_tournaments())
