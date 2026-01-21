import traceback
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from bson import ObjectId
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import List, Optional
import uuid

from database import (
    formateurs_collection, promotions_collection, etudiants_collection,
    espaces_collection, travaux_collection, livraisons_collection,
    evaluations_collection, directeurs_collection, JWT_SECRET,
    SUPABASE_URL, SUPABASE_SERVICE_KEY
)
from models import *
from utils import hash_password, verify_password, generate_password

app = FastAPI(title="Gestion Pédagogique API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dépendances & Utilitaires ---

async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

def create_token(user_id: str, user_type: str, nom_complet: str):
    expire = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode({
        "user_id": user_id,
        "user_type": user_type,
        "nom_complet": nom_complet,
        "exp": expire
    }, JWT_SECRET, algorithm="HS256")

# --- Authentification ---

@app.post("/api/auth/login-directeur", response_model=TokenResponse)
async def login_directeur(request: LoginRequest):
    directeur = await directeurs_collection.find_one({"email": request.email})
    if not directeur or not verify_password(request.mot_de_passe, directeur["mot_de_passe"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    token = create_token(str(directeur["_id"]), "directeur", directeur["nom_complet"])
    return TokenResponse(
        access_token=token,
        user_type="directeur",
        user_id=str(directeur["_id"]),
        nom_complet=directeur["nom_complet"]
    )

@app.post("/api/auth/login-user", response_model=TokenResponse)
async def login_user(request: LoginRequest):
    user = await formateurs_collection.find_one({"email": request.email})
    user_type = "formateur"

    if not user:
        user = await etudiants_collection.find_one({"email": request.email})
        user_type = "etudiant"

    if not user or not verify_password(request.mot_de_passe, user["mot_de_passe"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    collection = formateurs_collection if user_type == "formateur" else etudiants_collection
    if not user.get("compte_active"):
        await collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"compte_active": True, "date_activation": datetime.utcnow()}}
        )

    token = create_token(str(user["_id"]), user_type, user["nom_complet"])
    return TokenResponse(
        access_token=token,
        user_type=user_type,
        user_id=str(user["_id"]),
        nom_complet=user["nom_complet"]
    )

# --- Directeurs ---

@app.post("/api/directeurs", response_model=DirecteurCreateResponse, status_code=201)
async def create_directeur(directeur: DirecteurCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    existing = await directeurs_collection.find_one({"email": directeur.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email existe déjà")

    password_clair = generate_password(10)

    directeur_dict = directeur.model_dump()
    directeur_dict["mot_de_passe"] = hash_password(password_clair)
    directeur_dict["created_at"] = datetime.utcnow()

    result = await directeurs_collection.insert_one(directeur_dict)

    return DirecteurCreateResponse(
        id=str(result.inserted_id),
        email=directeur.email,
        nom_complet=directeur.nom_complet,
        mot_de_passe_clair=password_clair
    )

@app.get("/api/directeurs", response_model=List[DirecteurResponse])
async def list_directeurs(current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    directeurs = await directeurs_collection.find().to_list(None)
    return [
        DirecteurResponse(
            id=str(d["_id"]),
            email=d["email"],
            nom_complet=d["nom_complet"]
        )
        for d in directeurs
    ]

@app.delete("/api/directeurs/{id}")
async def delete_directeur(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    if current_user["user_id"] == id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")

    result = await directeurs_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Directeur introuvable")

    return {"message": "Directeur supprimé avec succès"}

# --- Formateurs ---

@app.post("/api/formateurs", response_model=FormateurCreateResponse, status_code=201)
async def create_formateur(formateur: FormateurCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    existing = await formateurs_collection.find_one({"email": formateur.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email existe déjà")

    password_clair = generate_password(8)

    formateur_dict = formateur.model_dump()
    formateur_dict["mot_de_passe"] = hash_password(password_clair)
    formateur_dict["compte_active"] = False
    formateur_dict["created_at"] = datetime.utcnow()

    result = await formateurs_collection.insert_one(formateur_dict)

    return FormateurCreateResponse(
        id=str(result.inserted_id),
        nom_complet=formateur.nom_complet,
        email=formateur.email,
        mot_de_passe_clair=password_clair,
        telephone=formateur.telephone,
        specialite=formateur.specialite
    )

@app.get("/api/formateurs", response_model=List[FormateurResponse])
async def list_formateurs(current_user: dict = Depends(get_current_user)):
    formateurs = await formateurs_collection.find().to_list(None)
    return [
        FormateurResponse(
            id=str(f["_id"]),
            nom_complet=f["nom_complet"],
            email=f["email"],
            telephone=f.get("telephone"),
            specialite=f.get("specialite"),
            compte_active=f.get("compte_active", False)
        )
        for f in formateurs
    ]

@app.get("/api/formateurs/{id}", response_model=FormateurResponse)
async def get_formateur(id: str, current_user: dict = Depends(get_current_user)):
    formateur = await formateurs_collection.find_one({"_id": ObjectId(id)})
    if not formateur:
        raise HTTPException(status_code=404, detail="Formateur introuvable")

    return FormateurResponse(
        id=str(formateur["_id"]),
        nom_complet=formateur["nom_complet"],
        email=formateur["email"],
        telephone=formateur.get("telephone"),
        specialite=formateur.get("specialite"),
        compte_active=formateur.get("compte_active", False)
    )

@app.put("/api/formateurs/{id}", response_model=FormateurResponse)
async def update_formateur(id: str, update: FormateurUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    formateur = await formateurs_collection.find_one({"_id": ObjectId(id)})
    if not formateur:
        raise HTTPException(status_code=404, detail="Formateur introuvable")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}

    if update_data:
        await formateurs_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

    updated = await formateurs_collection.find_one({"_id": ObjectId(id)})
    return FormateurResponse(
        id=str(updated["_id"]),
        nom_complet=updated["nom_complet"],
        email=updated["email"],
        telephone=updated.get("telephone"),
        specialite=updated.get("specialite"),
        compte_active=updated.get("compte_active", False)
    )

@app.delete("/api/formateurs/{id}")
async def delete_formateur(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    result = await formateurs_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Formateur introuvable")

    return {"message": "Formateur supprimé avec succès"}

# --- Promotions ---

@app.post("/api/promotions", response_model=PromotionResponse, status_code=201)
async def create_promotion(promotion: PromotionCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    promotion_dict = promotion.model_dump()
    promotion_dict["created_at"] = datetime.utcnow()

    result = await promotions_collection.insert_one(promotion_dict)

    return PromotionResponse(
        id=str(result.inserted_id),
        nom=promotion.nom,
        annee_debut=promotion.annee_debut,
        annee_fin=promotion.annee_fin,
        description=promotion.description,
        nombre_etudiants=0
    )

@app.get("/api/promotions", response_model=List[PromotionResponse])
async def list_promotions(current_user: dict = Depends(get_current_user)):
    promotions = await promotions_collection.find().to_list(None)
    result = []

    for p in promotions:
        count = await etudiants_collection.count_documents({"promotion_id": ObjectId(p["_id"])})
        result.append(PromotionResponse(
            id=str(p["_id"]),
            nom=p["nom"],
            annee_debut=p.get("annee_debut", 0),
            annee_fin=p.get("annee_fin", 0),
            description=p.get("description"),
            nombre_etudiants=count
        ))

    return result

@app.get("/api/promotions/{id}", response_model=PromotionResponse)
async def get_promotion(id: str, current_user: dict = Depends(get_current_user)):
    promotion = await promotions_collection.find_one({"_id": ObjectId(id)})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion introuvable")

    count = await etudiants_collection.count_documents({"promotion_id": ObjectId(id)})

    return PromotionResponse(
        id=str(promotion["_id"]),
        nom=promotion["nom"],
        annee_debut=promotion.get("annee_debut", 0),
        annee_fin=promotion.get("annee_fin", 0),
        description=promotion.get("description"),
        nombre_etudiants=count
    )

@app.put("/api/promotions/{id}", response_model=PromotionResponse)
async def update_promotion(id: str, update: PromotionUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    promotion = await promotions_collection.find_one({"_id": ObjectId(id)})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion introuvable")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}

    if update_data:
        await promotions_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

    updated = await promotions_collection.find_one({"_id": ObjectId(id)})
    count = await etudiants_collection.count_documents({"promotion_id": ObjectId(id)})

    return PromotionResponse(
        id=str(updated["_id"]),
        nom=updated["nom"],
        annee_debut=updated.get("annee_debut", 0),
        annee_fin=updated.get("annee_fin", 0),
        description=updated.get("description"),
        nombre_etudiants=count
    )

@app.delete("/api/promotions/{id}")
async def delete_promotion(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    count = await etudiants_collection.count_documents({"promotion_id": ObjectId(id)})
    if count > 0:
        raise HTTPException(status_code=400, detail="Impossible de supprimer une promotion contenant des étudiants")

    result = await promotions_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promotion introuvable")

    return {"message": "Promotion supprimée avec succès"}

# --- Étudiants ---

@app.post("/api/etudiants", response_model=EtudiantCreateResponse, status_code=201)
async def create_etudiant(etudiant: EtudiantCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    existing_email = await etudiants_collection.find_one({"email": etudiant.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Cet email existe déjà")

    existing_matricule = await etudiants_collection.find_one({"matricule": etudiant.matricule})
    if existing_matricule:
        raise HTTPException(status_code=400, detail="Ce matricule existe déjà")

    promotion = await promotions_collection.find_one({"_id": ObjectId(etudiant.promotion_id)})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion introuvable")

    password_clair = generate_password(8)

    etudiant_dict = etudiant.model_dump()
    etudiant_dict["mot_de_passe"] = hash_password(password_clair)
    etudiant_dict["promotion_id"] = ObjectId(etudiant.promotion_id)
    etudiant_dict["compte_active"] = False
    etudiant_dict["created_at"] = datetime.utcnow()

    result = await etudiants_collection.insert_one(etudiant_dict)

    return EtudiantCreateResponse(
        id=str(result.inserted_id),
        nom_complet=etudiant.nom_complet,
        email=etudiant.email,
        matricule=etudiant.matricule,
        mot_de_passe_clair=password_clair,
        telephone=etudiant.telephone,
        promotion_id=etudiant.promotion_id
    )

@app.get("/api/etudiants", response_model=List[EtudiantResponse])
async def list_etudiants(current_user: dict = Depends(get_current_user)):
    etudiants = await etudiants_collection.find().to_list(None)
    result = []

    for e in etudiants:
        promo_id = e.get("promotion_id")
        promotion = None
        if promo_id:
            promotion = await promotions_collection.find_one({"_id": promo_id})

        result.append(EtudiantResponse(
            id=str(e["_id"]),
            nom_complet=e["nom_complet"],
            email=e["email"],
            matricule=e.get("matricule", ""),
            telephone=e.get("telephone"),
            promotion_id=str(promo_id) if promo_id else "",
            promotion_nom=promotion["nom"] if promotion else None,
            compte_active=e.get("compte_active", False)
        ))

    return result

@app.get("/api/etudiants/promotion/{promotion_id}", response_model=List[EtudiantResponse])
async def list_etudiants_by_promotion(promotion_id: str, current_user: dict = Depends(get_current_user)):
    etudiants = await etudiants_collection.find({"promotion_id": ObjectId(promotion_id)}).to_list(None)

    promotion = await promotions_collection.find_one({"_id": ObjectId(promotion_id)})
    promotion_nom = promotion["nom"] if promotion else None

    return [
        EtudiantResponse(
            id=str(e["_id"]),
            nom_complet=e["nom_complet"],
            email=e["email"],
            matricule=e["matricule"],
            telephone=e.get("telephone"),
            promotion_id=str(e["promotion_id"]),
            promotion_nom=promotion_nom,
            compte_active=e.get("compte_active", False)
        )
        for e in etudiants
    ]

@app.get("/api/etudiants/{id}", response_model=EtudiantResponse)
async def get_etudiant(id: str, current_user: dict = Depends(get_current_user)):
    etudiant = await etudiants_collection.find_one({"_id": ObjectId(id)})
    if not etudiant:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")

    promotion = await promotions_collection.find_one({"_id": etudiant["promotion_id"]})

    return EtudiantResponse(
        id=str(etudiant["_id"]),
        nom_complet=etudiant["nom_complet"],
        email=etudiant["email"],
        matricule=etudiant["matricule"],
        telephone=etudiant.get("telephone"),
        promotion_id=str(etudiant["promotion_id"]),
        promotion_nom=promotion["nom"] if promotion else None,
        compte_active=etudiant.get("compte_active", False)
    )

@app.put("/api/etudiants/{id}", response_model=EtudiantResponse)
async def update_etudiant(id: str, update: EtudiantUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    etudiant = await etudiants_collection.find_one({"_id": ObjectId(id)})
    if not etudiant:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}

    if "promotion_id" in update_data:
        promotion = await promotions_collection.find_one({"_id": ObjectId(update_data["promotion_id"])})
        if not promotion:
            raise HTTPException(status_code=404, detail="Promotion introuvable")
        update_data["promotion_id"] = ObjectId(update_data["promotion_id"])

    if update_data:
        await etudiants_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

    updated = await etudiants_collection.find_one({"_id": ObjectId(id)})
    promotion = await promotions_collection.find_one({"_id": updated["promotion_id"]})

    return EtudiantResponse(
        id=str(updated["_id"]),
        nom_complet=updated["nom_complet"],
        email=updated["email"],
        matricule=updated["matricule"],
        telephone=updated.get("telephone"),
        promotion_id=str(updated["promotion_id"]),
        promotion_nom=promotion["nom"] if promotion else None,
        compte_active=updated.get("compte_active", False)
    )

@app.delete("/api/etudiants/{id}")
async def delete_etudiant(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    result = await etudiants_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")

    return {"message": "Étudiant supprimé avec succès"}

# --- Espaces Pédagogiques ---

@app.post("/api/espaces", response_model=EspacePedagogiqueResponse, status_code=201)
async def create_espace(espace: EspacePedagogiqueCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    espace_dict = espace.model_dump()
    espace_dict["formateurs"] = []
    espace_dict["promotions"] = []
    espace_dict["etudiants"] = []
    espace_dict["created_at"] = datetime.utcnow()

    result = await espaces_collection.insert_one(espace_dict)

    return EspacePedagogiqueResponse(
        id=str(result.inserted_id),
        nom_matiere=espace.nom_matiere,
        code_matiere=espace.code_matiere,
        description=espace.description,
        coefficient=espace.coefficient,
        formateurs=[],
        promotions=[],
        etudiants=[]
    )

@app.get("/api/espaces", response_model=List[EspacePedagogiqueResponse])
async def list_espaces(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["user_type"] == "formateur":
        query = {"formateurs.id": ObjectId(current_user["user_id"])}
    elif current_user["user_type"] == "etudiant":
        query = {"etudiants.id": ObjectId(current_user["user_id"])}

    espaces = await espaces_collection.find(query).to_list(None)

    result = []
    for e in espaces:
        def clean_person_list(items):
            cleaned = []
            for item in items:
                if isinstance(item, dict):
                    cleaned.append({
                        "id": str(item.get("id")),
                        "nom_complet": item.get("nom_complet", "Inconnu")
                    })
                elif isinstance(item, ObjectId):
                    cleaned.append({"id": str(item), "nom_complet": "Inconnu"})
            return cleaned

        def clean_promo_list(items):
            cleaned = []
            for item in items:
                if isinstance(item, dict):
                    cleaned.append({
                        "id": str(item.get("id")),
                        "nom": item.get("nom", "Inconnu")
                    })
                elif isinstance(item, ObjectId):
                    cleaned.append({"id": str(item), "nom": "Inconnu"})
            return cleaned

        result.append(EspacePedagogiqueResponse(
            id=str(e["_id"]),
            nom_matiere=e["nom_matiere"],
            code_matiere=e.get("code_matiere") or "",
            description=e.get("description"),
            coefficient=e.get("coefficient") or 0,
            formateurs=clean_person_list(e.get("formateurs", [])),
            promotions=clean_promo_list(e.get("promotions", [])),
            etudiants=clean_person_list(e.get("etudiants", []))
        ))

    return result

@app.put("/api/espaces/{id}", response_model=EspacePedagogiqueResponse)
async def update_espace(id: str, update: EspacePedagogiqueUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    espace = await espaces_collection.find_one({"_id": ObjectId(id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}

    if update_data:
        await espaces_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

    updated = await espaces_collection.find_one({"_id": ObjectId(id)})

    def clean(items, name_field):
        res = []
        for item in items:
            if isinstance(item, dict):
                res.append({
                    "id": str(item.get("id")),
                    name_field: item.get(name_field, "Inconnu")
                })
            elif isinstance(item, ObjectId):
                res.append({"id": str(item), name_field: "Inconnu"})
        return res

    return EspacePedagogiqueResponse(
        id=str(updated["_id"]),
        nom_matiere=updated["nom_matiere"],
        code_matiere=updated.get("code_matiere") or "",
        description=updated.get("description"),
        coefficient=updated.get("coefficient") or 0,
        formateurs=clean(updated.get("formateurs", []), "nom_complet"),
        promotions=clean(updated.get("promotions", []), "nom"),
        etudiants=clean(updated.get("etudiants", []), "nom_complet")
    )

@app.delete("/api/espaces/{id}")
async def delete_espace(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    result = await espaces_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    return {"message": "Espace pédagogique supprimé avec succès"}

@app.post("/api/espaces/{id}/formateur")
async def add_formateur_to_espace(id: str, formateur_id: dict, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    espace = await espaces_collection.find_one({"_id": ObjectId(id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    formateur = await formateurs_collection.find_one({"_id": ObjectId(formateur_id["formateur_id"])})
    if not formateur:
        raise HTTPException(status_code=404, detail="Formateur introuvable")

    formateurs = espace.get("formateurs", [])
    if any(str(f["id"]) == str(formateur["_id"]) for f in formateurs):
        raise HTTPException(status_code=400, detail="Ce formateur est déjà assigné à cet espace")

    formateurs.append({
        "id": formateur["_id"],
        "nom_complet": formateur["nom_complet"]
    })

    await espaces_collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"formateurs": formateurs}}
    )

    return {"message": "Formateur ajouté avec succès"}

@app.post("/api/espaces/{id}/promotion")
async def add_promotion_to_espace(id: str, promotion_id: dict, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    espace = await espaces_collection.find_one({"_id": ObjectId(id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    promotion = await promotions_collection.find_one({"_id": ObjectId(promotion_id["promotion_id"])})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion introuvable")

    promotions = espace.get("promotions", [])
    if any(str(p["id"]) == str(promotion["_id"]) for p in promotions):
        raise HTTPException(status_code=400, detail="Cette promotion est déjà assignée à cet espace")

    promotions.append({
        "id": promotion["_id"],
        "nom": promotion["nom"]
    })

    etudiants = await etudiants_collection.find({"promotion_id": promotion["_id"]}).to_list(None)
    etudiants_data = espace.get("etudiants", [])

    for etudiant in etudiants:
        if not any(str(e["id"]) == str(etudiant["_id"]) for e in etudiants_data):
            etudiants_data.append({
                "id": etudiant["_id"],
                "nom_complet": etudiant["nom_complet"]
            })

    await espaces_collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"promotions": promotions, "etudiants": etudiants_data}}
    )

    return {"message": "Promotion ajoutée avec succès"}

@app.post("/api/espaces/{id}/etudiants")
async def add_etudiants_to_espace(id: str, etudiant_ids: dict, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    espace = await espaces_collection.find_one({"_id": ObjectId(id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    etudiants_data = espace.get("etudiants", [])

    for etudiant_id in etudiant_ids["etudiant_ids"]:
        etudiant = await etudiants_collection.find_one({"_id": ObjectId(etudiant_id)})
        if etudiant and not any(str(e["id"]) == str(etudiant["_id"]) for e in etudiants_data):
            etudiants_data.append({
                "id": etudiant["_id"],
                "nom_complet": etudiant["nom_complet"]
            })

    await espaces_collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"etudiants": etudiants_data}}
    )

    return {"message": "Étudiants ajoutés avec succès"}

@app.delete("/api/espaces/{id}/etudiant/{etudiant_id}")
async def remove_etudiant_from_espace(id: str, etudiant_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    espace = await espaces_collection.find_one({"_id": ObjectId(id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    etudiants = espace.get("etudiants", [])
    etudiants = [e for e in etudiants if str(e["id"]) != etudiant_id]

    await espaces_collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"etudiants": etudiants}}
    )

    return {"message": "Étudiant retiré avec succès"}

# --- Travaux ---

@app.post("/api/travaux", response_model=TravailResponse, status_code=201)
async def create_travail(travail: TravailCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] not in ["directeur", "formateur"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    espace = await espaces_collection.find_one({"_id": ObjectId(travail.espace_id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    if travail.type_travail == "collectif" and len(travail.etudiants_assignes) < 2:
        raise HTTPException(status_code=400, detail="Un travail collectif nécessite au moins 2 étudiants")

    etudiants_data = []
    for etudiant_id in travail.etudiants_assignes:
        etudiant = await etudiants_collection.find_one({"_id": ObjectId(etudiant_id)})
        if etudiant:
            etudiants_data.append({
                "id": str(etudiant["_id"]),
                "nom_complet": etudiant["nom_complet"]
            })

    travail_dict = travail.model_dump()
    travail_dict["formateur_id"] = ObjectId(current_user["user_id"])
    travail_dict["statut"] = "en_attente"
    travail_dict["created_at"] = datetime.utcnow()
    travail_dict["etudiants_assignes"] = [ObjectId(e) for e in travail.etudiants_assignes]
    travail_dict["espace_id"] = ObjectId(travail.espace_id)

    result = await travaux_collection.insert_one(travail_dict)

    return TravailResponse(
        id=str(result.inserted_id),
        titre=travail.titre,
        consignes=travail.consignes,
        type_travail=travail.type_travail,
        espace_id=travail.espace_id,
        espace_nom=espace["nom_matiere"],
        formateur_id=current_user["user_id"],
        formateur_nom=current_user["nom_complet"],
        date_debut=travail.date_debut,
        date_fin=travail.date_fin,
        fichiers_urls=travail.fichiers_urls,
        liens=travail.liens,
        etudiants_assignes=etudiants_data,
        statut="en_attente",
        created_at=datetime.utcnow()
    )

@app.get("/api/travaux/espace/{espace_id}", response_model=List[TravailResponse])
async def list_travaux_by_espace(espace_id: str, current_user: dict = Depends(get_current_user)):
    travaux = await travaux_collection.find({"espace_id": ObjectId(espace_id)}).to_list(None)
    result = []

    for t in travaux:
        espace = await espaces_collection.find_one({"_id": t["espace_id"]})
        formateur = await formateurs_collection.find_one({"_id": t["formateur_id"]})

        etudiants_data = []
        for etudiant_id in t["etudiants_assignes"]:
            etudiant = await etudiants_collection.find_one({"_id": etudiant_id})
            if etudiant:
                etudiants_data.append({
                    "id": str(etudiant["_id"]),
                    "nom_complet": etudiant["nom_complet"]
                })

        result.append(TravailResponse(
            id=str(t["_id"]),
            titre=t["titre"],
            consignes=t["consignes"],
            type_travail=t["type_travail"],
            espace_id=str(t["espace_id"]),
            espace_nom=espace["nom_matiere"] if espace else None,
            formateur_id=str(t["formateur_id"]),
            formateur_nom=formateur["nom_complet"] if formateur else None,
            date_debut=t["date_debut"],
            date_fin=t["date_fin"],
            fichiers_urls=t.get("fichiers_urls", []),
            liens=t.get("liens", []),
            etudiants_assignes=etudiants_data,
            statut=t["statut"],
            created_at=t["created_at"]
        ))

    return result

@app.get("/api/travaux/etudiant/{etudiant_id}", response_model=List[TravailResponse])
async def list_travaux_by_etudiant(etudiant_id: str, current_user: dict = Depends(get_current_user)):
    travaux = await travaux_collection.find({
        "etudiants_assignes": ObjectId(etudiant_id)
    }).to_list(None)

    result = []

    for t in travaux:
        espace = await espaces_collection.find_one({"_id": t["espace_id"]})
        formateur = await formateurs_collection.find_one({"_id": t["formateur_id"]})

        etudiants_data = []
        for etudiant_id_obj in t["etudiants_assignes"]:
            etudiant = await etudiants_collection.find_one({"_id": etudiant_id_obj})
            if etudiant:
                etudiants_data.append({
                    "id": str(etudiant["_id"]),
                    "nom_complet": etudiant["nom_complet"]
                })

        result.append(TravailResponse(
            id=str(t["_id"]),
            titre=t["titre"],
            consignes=t["consignes"],
            type_travail=t["type_travail"],
            espace_id=str(t["espace_id"]),
            espace_nom=espace["nom_matiere"] if espace else None,
            formateur_id=str(t["formateur_id"]),
            formateur_nom=formateur["nom_complet"] if formateur else None,
            date_debut=t["date_debut"],
            date_fin=t["date_fin"],
            fichiers_urls=t.get("fichiers_urls", []),
            liens=t.get("liens", []),
            etudiants_assignes=etudiants_data,
            statut=t["statut"],
            created_at=t["created_at"]
        ))

    return result

@app.put("/api/travaux/{id}/dates")
async def update_travail_dates(id: str, update: TravailUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] not in ["directeur", "formateur"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    travail = await travaux_collection.find_one({"_id": ObjectId(id)})
    if not travail:
        raise HTTPException(status_code=404, detail="Travail introuvable")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}

    if update_data:
        await travaux_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )

    return {"message": "Dates mises à jour avec succès"}

@app.delete("/api/travaux/{id}")
async def delete_travail(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] not in ["directeur", "formateur"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    result = await travaux_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Travail introuvable")

    return {"message": "Travail supprimé avec succès"}

# --- Livraisons ---

@app.post("/api/travaux/{id}/livraisons", response_model=LivraisonResponse, status_code=201)
async def submit_livraison(id: str, livraison: LivraisonCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "etudiant":
        raise HTTPException(status_code=403, detail="Seuls les étudiants peuvent soumettre")

    travail = await travaux_collection.find_one({"_id": ObjectId(id)})
    if not travail:
        raise HTTPException(status_code=404, detail="Travail introuvable")

    if ObjectId(current_user["user_id"]) not in travail["etudiants_assignes"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas assigné à ce travail")

    existing = await livraisons_collection.find_one({
        "travail_id": ObjectId(id),
        "etudiant_id": ObjectId(current_user["user_id"])
    })
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà soumis ce travail")

    livraison_dict = {
        "travail_id": ObjectId(id),
        "etudiant_id": ObjectId(current_user["user_id"]),
        "contenu": livraison.contenu,
        "fichiers_urls": livraison.fichiers_urls,
        "liens": livraison.liens,
        "date_soumission": datetime.utcnow(),
        "modifiable": False
    }

    result = await livraisons_collection.insert_one(livraison_dict)

    await travaux_collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"statut": "livre"}}
    )

    return LivraisonResponse(
        id=str(result.inserted_id),
        travail_id=id,
        etudiant_id=current_user["user_id"],
        etudiant_nom=current_user["nom_complet"],
        contenu=livraison.contenu,
        fichiers_urls=livraison.fichiers_urls,
        liens=livraison.liens,
        date_soumission=datetime.utcnow(),
        modifiable=False
    )

@app.get("/api/travaux/{id}/livraisons", response_model=List[LivraisonResponse])
async def list_livraisons(id: str, current_user: dict = Depends(get_current_user)):
    livraisons = await livraisons_collection.find({"travail_id": ObjectId(id)}).to_list(None)
    result = []

    for l in livraisons:
        etudiant = await etudiants_collection.find_one({"_id": l["etudiant_id"]})
        result.append(LivraisonResponse(
            id=str(l["_id"]),
            travail_id=str(l["travail_id"]),
            etudiant_id=str(l["etudiant_id"]),
            etudiant_nom=etudiant["nom_complet"] if etudiant else None,
            contenu=l.get("contenu"),
            fichiers_urls=l.get("fichiers_urls", []),
            liens=l.get("liens", []),
            date_soumission=l["date_soumission"],
            modifiable=l.get("modifiable", False)
        ))

    return result

# --- Évaluations ---

@app.post("/api/evaluations", response_model=EvaluationResponse, status_code=201)
async def create_evaluation(evaluation: EvaluationCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "formateur":
        raise HTTPException(status_code=403, detail="Seuls les formateurs peuvent évaluer")

    if evaluation.note < 0 or evaluation.note > 20:
        raise HTTPException(status_code=400, detail="La note doit être entre 0 et 20")

    livraison = await livraisons_collection.find_one({"_id": ObjectId(evaluation.livraison_id)})
    if not livraison:
        raise HTTPException(status_code=404, detail="Livraison introuvable")

    existing = await evaluations_collection.find_one({"livraison_id": ObjectId(evaluation.livraison_id)})
    if existing:
        raise HTTPException(status_code=400, detail="Cette livraison a déjà été évaluée")

    eval_dict = {
        "livraison_id": ObjectId(evaluation.livraison_id),
        "travail_id": livraison["travail_id"],
        "etudiant_id": livraison["etudiant_id"],
        "formateur_id": ObjectId(current_user["user_id"]),
        "note": evaluation.note,
        "commentaire": evaluation.commentaire,
        "date_evaluation": datetime.utcnow(),
        "historique_modifications": []
    }

    result = await evaluations_collection.insert_one(eval_dict)

    await travaux_collection.update_one(
        {"_id": livraison["travail_id"]},
        {"$set": {"statut": "evalue"}}
    )

    travail = await travaux_collection.find_one({"_id": livraison["travail_id"]})
    etudiant = await etudiants_collection.find_one({"_id": livraison["etudiant_id"]})

    return EvaluationResponse(
        id=str(result.inserted_id),
        livraison_id=evaluation.livraison_id,
        travail_id=str(livraison["travail_id"]),
        travail_titre=travail["titre"] if travail else None,
        etudiant_id=str(livraison["etudiant_id"]),
        etudiant_nom=etudiant["nom_complet"] if etudiant else None,
        formateur_id=current_user["user_id"],
        formateur_nom=current_user["nom_complet"],
        note=evaluation.note,
        commentaire=evaluation.commentaire,
        date_evaluation=datetime.utcnow(),
        historique_modifications=[]
    )

@app.put("/api/evaluations/{id}", response_model=EvaluationResponse)
async def update_evaluation(id: str, update: EvaluationUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Seul le directeur peut modifier une évaluation")

    evaluation = await evaluations_collection.find_one({"_id": ObjectId(id)})
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    historique_entry = {
        "ancienne_note": evaluation["note"],
        "nouvelle_note": update.note,
        "raison": update.raison_modification,
        "modifie_par": current_user["user_id"],
        "date_modification": datetime.utcnow().isoformat()
    }

    await evaluations_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {"note": update.note, "commentaire": update.commentaire},
            "$push": {"historique_modifications": historique_entry}
        }
    )

    updated = await evaluations_collection.find_one({"_id": ObjectId(id)})
    travail = await travaux_collection.find_one({"_id": updated["travail_id"]})
    etudiant = await etudiants_collection.find_one({"_id": updated["etudiant_id"]})
    formateur = await formateurs_collection.find_one({"_id": updated["formateur_id"]})

    return EvaluationResponse(
        id=str(updated["_id"]),
        livraison_id=str(updated["livraison_id"]),
        travail_id=str(updated["travail_id"]),
        travail_titre=travail["titre"] if travail else None,
        etudiant_id=str(updated["etudiant_id"]),
        etudiant_nom=etudiant["nom_complet"] if etudiant else None,
        formateur_id=str(updated["formateur_id"]),
        formateur_nom=formateur["nom_complet"] if formateur else None,
        note=updated["note"],
        commentaire=updated.get("commentaire"),
        date_evaluation=updated["date_evaluation"],
        historique_modifications=updated.get("historique_modifications", [])
    )

@app.get("/api/notes/etudiant/{id}", response_model=NoteEtudiantResponse)
async def get_notes_etudiant(id: str, current_user: dict = Depends(get_current_user)):
    evaluations = await evaluations_collection.find({"etudiant_id": ObjectId(id)}).to_list(None)

    notes_par_matiere = {}
    for eval in evaluations:
        travail = await travaux_collection.find_one({"_id": eval["travail_id"]})
        if not travail:
            continue

        espace = await espaces_collection.find_one({"_id": travail["espace_id"]})
        if not espace:
            continue

        matiere = espace["nom_matiere"]
        if matiere not in notes_par_matiere:
            notes_par_matiere[matiere] = {
                "notes": [],
                "coefficient": espace.get("coefficient", 1)
            }
        notes_par_matiere[matiere]["notes"].append(eval["note"])

    result = []
    total_weighted = 0
    total_coef = 0

    for matiere, data in notes_par_matiere.items():
        moyenne = sum(data["notes"]) / len(data["notes"]) if data["notes"] else 0
        result.append({
            "matiere": matiere,
            "notes": data["notes"],
            "moyenne": round(moyenne, 2),
            "coefficient": data["coefficient"]
        })
        total_weighted += moyenne * data["coefficient"]
        total_coef += data["coefficient"]

    etudiant = await etudiants_collection.find_one({"_id": ObjectId(id)})

    return NoteEtudiantResponse(
        etudiant_id=id,
        nom_complet=etudiant["nom_complet"] if etudiant else "",
        notes_par_matiere=result,
        moyenne_generale=round(total_weighted / total_coef, 2) if total_coef > 0 else 0
    )

@app.get("/api/notes/espace/{id}", response_model=StatistiquesEspace)
async def get_statistiques_espace(id: str, current_user: dict = Depends(get_current_user)):
    espace = await espaces_collection.find_one({"_id": ObjectId(id)})
    if not espace:
        raise HTTPException(status_code=404, detail="Espace pédagogique introuvable")

    travaux = await travaux_collection.find({"espace_id": ObjectId(id)}).to_list(None)
    travaux_ids = [t["_id"] for t in travaux]

    evaluations = await evaluations_collection.find({"travail_id": {"$in": travaux_ids}}).to_list(None)

    if not evaluations:
        return StatistiquesEspace(
            espace_id=id,
            nom_matiere=espace["nom_matiere"],
            moyenne=0,
            note_min=0,
            note_max=0,
            nombre_evalues=0
        )

    notes = [e["note"] for e in evaluations]

    return StatistiquesEspace(
        espace_id=id,
        nom_matiere=espace["nom_matiere"],
        moyenne=round(sum(notes) / len(notes), 2),
        note_min=min(notes),
        note_max=max(notes),
        nombre_evalues=len(evaluations)
    )

# --- Utilitaires & Autres ---

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    print("\n--- UPLOAD VIA HTTPX ---")
    print(f"User: {current_user.get('user_id')}")
    print(f"File: {file.filename}")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Config Supabase manquante")
    
    try:
        import httpx
        
        content = await file.read()
        ext = file.filename.split(".")[-1] if "." in file.filename else ""
        unique_name = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
        path = f"{current_user['user_id']}/{unique_name}"
        
        print(f"Size: {len(content)} bytes")
        print(f"Path: {path}")
        
        upload_url = f"{SUPABASE_URL}/storage/v1/object/travaux/{path}"
        
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": file.content_type or "application/octet-stream"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(upload_url, content=content, headers=headers)
            
            if response.status_code not in [200, 201]:
                print(f"Error {response.status_code}: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)
        
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/travaux/{path}"
        print(f" Success: {public_url}")
        
        return {"url": public_url, "filename": file.filename}
        
    except Exception as e:
        print(f" Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        

@app.post("/api/users/{id}/relance")
async def relance_compte(id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "directeur":
        raise HTTPException(status_code=403, detail="Accès réservé au directeur")

    user = await formateurs_collection.find_one({"_id": ObjectId(id)})
    user_type = "formateur"

    if not user:
        user = await etudiants_collection.find_one({"_id": ObjectId(id)})
        user_type = "etudiant"

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if user.get("compte_active"):
        raise HTTPException(status_code=400, detail="Ce compte est déjà activé")

    new_password = generate_password(8)
    collection = formateurs_collection if user_type == "formateur" else etudiants_collection

    await collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"mot_de_passe": hash_password(new_password)}}
    )

    return {
        "message": "Identifiants régénérés",
        "email": user["email"],
        "nouveau_mot_de_passe": new_password
    }

@app.get("/")
async def root():
    return {"message": "Gestion Pédagogique API"}