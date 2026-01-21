import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "gestion_pedagogique")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "secret-key")

client = AsyncIOMotorClient(MONGO_URL)
database = client[DB_NAME]

formateurs_collection = database.get_collection("formateurs")
promotions_collection = database.get_collection("promotions")
etudiants_collection = database.get_collection("etudiants")
espaces_collection = database.get_collection("espaces")
travaux_collection = database.get_collection("travaux")
livraisons_collection = database.get_collection("livraisons")
evaluations_collection = database.get_collection("evaluations")
directeurs_collection = database.get_collection("directeurs")
