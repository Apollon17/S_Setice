from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    mot_de_passe: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_type: str
    user_id: str
    nom_complet: str

class DirecteurCreate(BaseModel):
    email: EmailStr
    nom_complet: str

class DirecteurCreateResponse(BaseModel):
    id: str
    email: str
    nom_complet: str
    mot_de_passe_clair: str

class DirecteurResponse(BaseModel):
    id: str
    email: str
    nom_complet: str

class FormateurCreate(BaseModel):
    nom_complet: str
    email: EmailStr
    telephone: Optional[str] = None
    specialite: Optional[str] = None

class FormateurCreateResponse(BaseModel):
    id: str
    nom_complet: str
    email: str
    mot_de_passe_clair: str
    telephone: Optional[str] = None
    specialite: Optional[str] = None

class FormateurUpdate(BaseModel):
    nom_complet: Optional[str] = None
    email: Optional[EmailStr] = None
    telephone: Optional[str] = None
    specialite: Optional[str] = None

class FormateurResponse(BaseModel):
    id: str
    nom_complet: str
    email: str
    telephone: Optional[str] = None
    specialite: Optional[str] = None
    compte_active: bool = False

class PromotionCreate(BaseModel):
    nom: str
    annee_debut: int
    annee_fin: int
    description: Optional[str] = None

class PromotionUpdate(BaseModel):
    nom: Optional[str] = None
    annee_debut: Optional[int] = None
    annee_fin: Optional[int] = None
    description: Optional[str] = None

class PromotionResponse(BaseModel):
    id: str
    nom: str
    annee_debut: int
    annee_fin: int
    description: Optional[str] = None
    nombre_etudiants: int = 0

class EtudiantCreate(BaseModel):
    nom_complet: str
    email: EmailStr
    matricule: str
    telephone: Optional[str] = None
    promotion_id: str

class EtudiantCreateResponse(BaseModel):
    id: str
    nom_complet: str
    email: str
    matricule: str
    mot_de_passe_clair: str
    telephone: Optional[str] = None
    promotion_id: str

class EtudiantUpdate(BaseModel):
    nom_complet: Optional[str] = None
    email: Optional[EmailStr] = None
    matricule: Optional[str] = None
    telephone: Optional[str] = None
    promotion_id: Optional[str] = None

class EtudiantResponse(BaseModel):
    id: str
    nom_complet: str
    email: str
    matricule: str
    telephone: Optional[str] = None
    promotion_id: str
    promotion_nom: Optional[str] = None
    compte_active: bool = False

class EspacePedagogiqueCreate(BaseModel):
    nom_matiere: str
    code_matiere: str
    description: Optional[str] = None
    coefficient: int = 1

class EspacePedagogiqueUpdate(BaseModel):
    nom_matiere: Optional[str] = None
    code_matiere: Optional[str] = None
    description: Optional[str] = None
    coefficient: Optional[int] = None

class EspacePedagogiqueResponse(BaseModel):
    id: str
    nom_matiere: str
    code_matiere: str
    description: Optional[str] = None
    coefficient: int
    formateurs: List[dict] = []
    promotions: List[dict] = []
    etudiants: List[dict] = []

class TravailCreate(BaseModel):
    titre: str
    consignes: str
    type_travail: str
    espace_id: str
    date_debut: datetime
    date_fin: datetime
    fichiers_urls: List[str] = []
    liens: List[str] = []
    etudiants_assignes: List[str]

class TravailUpdate(BaseModel):
    titre: Optional[str] = None
    consignes: Optional[str] = None
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    fichiers_urls: Optional[List[str]] = None
    liens: Optional[List[str]] = None

class TravailResponse(BaseModel):
    id: str
    titre: str
    consignes: str
    type_travail: str
    espace_id: str
    espace_nom: Optional[str] = None
    formateur_id: str
    formateur_nom: Optional[str] = None
    date_debut: datetime
    date_fin: datetime
    fichiers_urls: List[str] = []
    liens: List[str] = []
    etudiants_assignes: List[dict] = []
    statut: str
    created_at: datetime

class LivraisonCreate(BaseModel):
    contenu: Optional[str] = None
    fichiers_urls: List[str] = []
    liens: List[str] = []

class LivraisonResponse(BaseModel):
    id: str
    travail_id: str
    etudiant_id: str
    etudiant_nom: Optional[str] = None
    contenu: Optional[str] = None
    fichiers_urls: List[str] = []
    liens: List[str] = []
    date_soumission: datetime
    modifiable: bool = False

class EvaluationCreate(BaseModel):
    livraison_id: str
    note: float
    commentaire: Optional[str] = None

class EvaluationUpdate(BaseModel):
    note: float
    commentaire: Optional[str] = None
    raison_modification: str

class EvaluationResponse(BaseModel):
    id: str
    livraison_id: str
    travail_id: str
    travail_titre: Optional[str] = None
    etudiant_id: str
    etudiant_nom: Optional[str] = None
    formateur_id: str
    formateur_nom: Optional[str] = None
    note: float
    commentaire: Optional[str] = None
    date_evaluation: datetime
    historique_modifications: List[dict] = []

class NoteEtudiantResponse(BaseModel):
    etudiant_id: str
    nom_complet: str
    notes_par_matiere: List[dict]
    moyenne_generale: float

class StatistiquesEspace(BaseModel):
    espace_id: str
    nom_matiere: str
    moyenne: float
    note_min: float
    note_max: float
    nombre_evalues: int
