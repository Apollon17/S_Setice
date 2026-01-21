"""
Script de nettoyage complet de la base de données
- Convertit tous les ObjectId en string dans les espaces pédagogiques
- Affiche les statistiques avant/après
"""
import asyncio
from bson import ObjectId
from database import espaces_collection


async def convert_objectid_to_string(value):
    """Convertit récursivement les ObjectId en string"""
    if isinstance(value, ObjectId):
        return str(value)
    elif isinstance(value, dict):
        return {k: await convert_objectid_to_string(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [await convert_objectid_to_string(item) for item in value]
    else:
        return value


async def count_objectids_in_espaces():
    """Compte combien d'ObjectId non convertis existent"""
    espaces = await espaces_collection.find().to_list(None)
    total_objectids = 0
    
    for espace in espaces:
        for field in ["formateurs", "promotions", "etudiants"]:
            items = espace.get(field, [])
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("id"), ObjectId):
                    total_objectids += 1
                elif isinstance(item, ObjectId):
                    total_objectids += 1
    
    return total_objectids, len(espaces)


async def fix_all_espaces():
    """Nettoie tous les espaces pédagogiques"""
    print("🔍 Analyse de la base de données...")
    objectids_count, espaces_count = await count_objectids_in_espaces()
    
    print(f"\n📊 Statistiques initiales:")
    print(f"   - Espaces pédagogiques: {espaces_count}")
    print(f"   - ObjectId non convertis: {objectids_count}")
    
    if objectids_count == 0:
        print("\n✅ Aucune correction nécessaire!")
        return
    
    print(f"\n🔧 Correction de {objectids_count} ObjectId...")
    
    espaces = await espaces_collection.find().to_list(None)
    corrected = 0
    
    for espace in espaces:
        needs_update = False
        
        # Nettoyer formateurs
        formateurs_cleaned = []
        for formateur in espace.get("formateurs", []):
            if isinstance(formateur, dict):
                formateurs_cleaned.append({
                    "id": str(formateur.get("id")),
                    "nom_complet": formateur.get("nom_complet", "Inconnu")
                })
                if isinstance(formateur.get("id"), ObjectId):
                    needs_update = True
            elif isinstance(formateur, ObjectId):
                formateurs_cleaned.append({"id": str(formateur), "nom_complet": "Inconnu"})
                needs_update = True
            else:
                formateurs_cleaned.append(formateur)
        
        # Nettoyer promotions
        promotions_cleaned = []
        for promotion in espace.get("promotions", []):
            if isinstance(promotion, dict):
                promotions_cleaned.append({
                    "id": str(promotion.get("id")),
                    "nom": promotion.get("nom", "Inconnue")
                })
                if isinstance(promotion.get("id"), ObjectId):
                    needs_update = True
            elif isinstance(promotion, ObjectId):
                promotions_cleaned.append({"id": str(promotion), "nom": "Inconnue"})
                needs_update = True
            else:
                promotions_cleaned.append(promotion)
        
        # Nettoyer étudiants
        etudiants_cleaned = []
        for etudiant in espace.get("etudiants", []):
            if isinstance(etudiant, dict):
                etudiants_cleaned.append({
                    "id": str(etudiant.get("id")),
                    "nom_complet": etudiant.get("nom_complet", "Inconnu")
                })
                if isinstance(etudiant.get("id"), ObjectId):
                    needs_update = True
            elif isinstance(etudiant, ObjectId):
                etudiants_cleaned.append({"id": str(etudiant), "nom_complet": "Inconnu"})
                needs_update = True
            else:
                etudiants_cleaned.append(etudiant)
        
        # Mettre à jour si nécessaire
        if needs_update:
            await espaces_collection.update_one(
                {"_id": espace["_id"]},
                {
                    "$set": {
                        "formateurs": formateurs_cleaned,
                        "promotions": promotions_cleaned,
                        "etudiants": etudiants_cleaned
                    }
                }
            )
            corrected += 1
            print(f"   ✅ '{espace['nom_matiere']}' nettoyé")
    
    # Vérification finale
    print("\n🔍 Vérification finale...")
    final_count, _ = await count_objectids_in_espaces()
    
    print(f"\n📊 Résultats:")
    print(f"   - Espaces corrigés: {corrected}/{espaces_count}")
    print(f"   - ObjectId restants: {final_count}")
    
    if final_count == 0:
        print("\n🎉 Nettoyage réussi! Tous les ObjectId ont été convertis en string.")
    else:
        print(f"\n⚠️  Attention: {final_count} ObjectId n'ont pas pu être convertis.")


async def main():
    print("=" * 70)
    print("NETTOYAGE DE LA BASE DE DONNÉES - CONVERSION OBJECTID → STRING")
    print("=" * 70)
    
    await fix_all_espaces()
    
    print("\n" + "=" * 70)
    print("Nettoyage terminé!")
    print("=" * 70)
    print("\nProchaines étapes:")
    print("1. Redémarrez votre serveur FastAPI")
    print("2. Testez les endpoints /api/espaces et /api/travaux")
    print("3. Vérifiez qu'il n'y a plus d'erreurs de sérialisation\n")


if __name__ == "__main__":
    asyncio.run(main())