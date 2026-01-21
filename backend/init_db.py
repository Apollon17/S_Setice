import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import bcrypt
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "gestion_pedagogique")

async def init_database():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔧 Création des indexes...")
    
    await db.etudiants.create_index([("email", ASCENDING)], unique=True)
    await db.etudiants.create_index([("matricule", ASCENDING)], unique=True)
    await db.formateurs.create_index([("email", ASCENDING)], unique=True)
    await db.directeurs.create_index([("email", ASCENDING)], unique=True)
    await db.travaux.create_index([("espace_id", ASCENDING)])
    await db.travaux.create_index([("formateur_id", ASCENDING)])
    await db.livraisons.create_index([("travail_id", ASCENDING)])
    await db.evaluations.create_index([("etudiant_id", ASCENDING)])
    
    print("✅ Indexes créés")
    
    hashed = bcrypt.hashpw("MDP123".encode(), bcrypt.gensalt()).decode()
    
    existing = await db.directeurs.find_one({"email": "directeur@gasa.com"})
    if not existing:
        await db.directeurs.insert_one({
            "email": "directeur@gasa.com",
            "mot_de_passe": hashed,
            "nom_complet": "Directeur Principal",
            "created_at": datetime.utcnow()
        })
        print("✅ Directeur créé: directeur@gasa.com / MDP123")
    else:
        print("ℹ️  Directeur existe déjà")
    
    print("✅ Base de données initialisée avec succès")

if __name__ == "__main__":
    asyncio.run(init_database())
