import unittest
import json

# On importe l'application Flask (assure-toi que le nom correspond à ce que Jawad a fait)
# Généralement, c'est importé depuis 'run' ou 'app'
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app # Adapte ceci si votre app est instanciée différemment

class SecurityTestCase(unittest.TestCase):
    def setUp(self):
        """Initialisation avant chaque test."""
        # Si votre groupe n'utilise pas de factory (create_app), 
        # remplace par : from run import app ; self.app = app.test_client()
        self.app = create_app().test_client()
        self.app.testing = True

    def test_security_headers_present(self):
        """Vérifie que les en-têtes de protection sont injectés dans les réponses."""
        # On fait une requête GET simple sur une route existante
        response = self.app.get('/api/logs/')
        
        headers = response.headers
        self.assertIn('X-Frame-Options', headers, "La protection Clickjacking manque")
        self.assertEqual(headers['X-Frame-Options'], 'DENY')
        
        self.assertIn('X-Content-Type-Options', headers, "La protection MIME-sniffing manque")
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        
        self.assertIn('X-XSS-Protection', headers, "Le filtre XSS manque")
        self.assertIn('1; mode=block', headers['X-XSS-Protection'])

    def test_rate_limiting_bruteforce(self):
        """Vérifie qu'un attaquant est bloqué après 5 tentatives échouées."""
        payload = json.dumps({"username": "hacker", "password": "wrongpassword"})
        
        # 5 tentatives qui doivent échouer mais passer le routeur (code 401 ou 400)
        for _ in range(5):
            response = self.app.post('/api/auth/login', 
                                     data=payload, 
                                     content_type='application/json')
            self.assertNotEqual(response.status_code, 429)

        # La 6ème tentative doit être bloquée par ton rate_limit_decorator (code 429)
        response_blocked = self.app.post('/api/auth/login', 
                                         data=payload, 
                                         content_type='application/json')
        
        self.assertEqual(response_blocked.status_code, 429, "Le Rate Limiting n'a pas bloqué l'attaque")
        data = json.loads(response_blocked.data)
        self.assertIn("Trop de tentatives échouées", data.get("error", ""))

if __name__ == '__main__':
    unittest.main()