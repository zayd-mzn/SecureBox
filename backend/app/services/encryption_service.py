import os
from cryptography.fernet import Fernet

class EncryptionService:
    """
    Service gérant le chiffrement et le déchiffrement des fichiers au repos.
    Utilise le schéma Fernet : AES-128 en mode CBC avec un code d'authentification HMAC-SHA256.
    """

    @staticmethod
    def get_cipher():
        """
        Récupère la clé maître depuis les variables d'environnement et initialise le chiffreur.
        """
        # On cherche la clé dans le fichier .env
        key = os.getenv('ENCRYPTION_KEY')
        
        # Sécurité de secours pour l'environnement de développement local
        if not key:
            print("⚠️ [SÉCURITÉ] Aucune clé 'ENCRYPTION_KEY' trouvée dans l'environnement !")
            print("Génération d'une clé temporaire en mémoire pour la session actuelle...")
            key = Fernet.generate_key()
            os.environ['ENCRYPTION_KEY'] = key.decode('utf-8')
        
        return Fernet(key)

    @staticmethod
    def encrypt_data(file_data: bytes) -> bytes:
        """
        Prend les octets purs d'un fichier entrant et retourne les octets chiffrés.
        """
        cipher = EncryptionService.get_cipher()
        try:
            encrypted_data = cipher.encrypt(file_data)
            return encrypted_data
        except Exception as e:
            print(f"❌ Erreur lors du chiffrement : {e}")
            raise e

    @staticmethod
    def decrypt_data(encrypted_data: bytes) -> bytes:
        """
        Prend les octets chiffrés depuis le disque et retourne le fichier clair original.
        """
        cipher = EncryptionService.get_cipher()
        try:
            decrypted_data = cipher.decrypt(encrypted_data)
            return decrypted_data
        except Exception as e:
            print(f"❌ Erreur lors du déchiffrement (Clé invalide ou fichier corrompu) : {e}")
            raise e

    @staticmethod
    def generate_new_key() -> str:
        """
        Utilitaire pour générer une nouvelle clé de chiffrement robuste (Base64 URL-safe).
        À exécuter une fois par l'administrateur pour configurer le fichier .env.
        """
        return Fernet.generate_key().decode('utf-8')