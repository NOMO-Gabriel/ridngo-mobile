# 📖 Guide d'Utilisation — RidnGo Mobile

Ce guide décrit les fonctionnalités de l'application pour les deux types d'utilisateurs.

---

## 🚀 Premier lancement

### Écran d'accueil (Landing)

Au premier lancement, vous arrivez sur l'écran d'accueil avec trois options :

| Bouton | Action |
|--------|--------|
| **Se connecter** | Accéder à un compte existant |
| **Créer un compte passager** | Nouveau compte pour commander des courses |
| **Devenir chauffeur** | Nouveau compte pour proposer des courses |

---

## 👤 Connexion

1. Appuyez sur **Se connecter**
2. Entrez votre **email, téléphone ou pseudo**
3. Entrez votre **mot de passe**
4. L'app vous redirige automatiquement selon votre rôle :
   - **Passager** → Écran de commande de course
   - **Chauffeur** → Tableau de bord Radar

---

## 📝 Inscription

### Passager

1. Appuyez sur **Créer un compte passager**
2. Remplissez : Prénom, Nom, Pseudo, Email, Téléphone, Mot de passe
3. Optionnel : Choisissez une **photo de profil**
4. Appuyez **Créer mon compte**
5. Vous êtes redirigé vers l'écran de commande

### Chauffeur

1. Appuyez sur **Devenir chauffeur**
2. Remplissez le formulaire d'inscription (même que passager)
3. Vous êtes redirigé vers l'**onboarding chauffeur** (enregistrement du véhicule)

---

## 🚗 Espace Passager

### Onglets disponibles

| Onglet | Description |
|--------|-------------|
| 🚗 Commander | Réserver une course |
| 🕐 Mes courses | Historique des trajets |
| 👤 Profil | Paramètres du compte |

---

### Commander une course

**Étape 1 — Saisir l'itinéraire**

1. Appuyez sur le champ **"Lieu de départ"**
2. Tapez votre adresse ou appuyez sur 📍 pour utiliser votre **position GPS**
3. Appuyez sur le champ **"Destination finale"**
4. Tapez la destination
5. Appuyez **"Voir les prix"**

> 💡 La recherche d'adresses utilise OpenStreetMap — saisissez des noms de lieux (ex: "Carrefour Warda", "Université de Yaoundé 1")

**Étape 2 — Ajuster le prix**

- L'app affiche une **estimation de prix** basée sur le FareCalc
- Utilisez les boutons **+** / **-** pour ajuster par tranches de 50 FCFA
- Appuyez **"Publier la demande"**

**Étape 3 — Attente des chauffeurs (Double Handshake)**

- Votre demande est publiée sur le **radar des chauffeurs**
- Les chauffeurs disponibles apparaissent dans la liste
- Appuyez **"Go"** sur le chauffeur de votre choix pour le sélectionner

**Étape 4 — Course active**

- Attendez que le chauffeur **confirme** de son côté
- L'écran passe en mode "Course Acceptée"
- Appuyez **"Simuler Arrivée"** une fois arrivé à destination

**Étape 5 — Note**

- Attribuez une note de **1 à 5 étoiles**
- Laissez un commentaire (optionnel)
- Appuyez **"Terminer"**

---

### Historique des courses

- Consultez toutes vos courses passées
- Chaque carte affiche : départ, destination, prix, date, statut
- Glissez vers le bas pour **rafraîchir**

---

## 🚙 Espace Chauffeur

### Onglets disponibles

| Onglet | Description |
|--------|-------------|
| 📡 Radar | Tableau de bord + offres disponibles |
| 👤 Profil | Infos véhicule, portefeuille, paramètres |

---

### Onboarding Chauffeur (première fois)

Après l'inscription, vous devez enregistrer votre véhicule :

**Étape 1 — Véhicule**

1. Entrez votre **N° de permis de conduire**
2. Entrez le **N° d'immatriculation** du véhicule
3. Sélectionnez la marque, modèle, type, taille
4. Renseignez les options (climatisation, Wi-Fi...)
5. Appuyez **"Continuer"**

**Étape 2 — Syndicat**

1. Appuyez **"Ouvrir UGate Compliance"**
2. L'application UGate s'ouvre pour valider votre adhésion au syndicat
3. Une fois validé, vous êtes redirigé vers RidnGo

> 💡 Pour les tests : appuyez **"Passer"** pour ignorer cette étape

---

### Tableau de bord Radar

**Activer/Désactiver le radar**

- Appuyez sur le bouton **"HORS LIGNE / EN LIGNE"** dans la carte identité
- 🟢 **EN LIGNE** : vous recevez les offres de courses (actualisation toutes les 5s)
- ⚫ **HORS LIGNE** : vous n'apparaissez pas aux passagers

**Voir les offres**

- Les offres s'affichent sous forme de cartes avec départ / destination / prix
- Appuyez sur une offre pour voir les détails

**Trier les offres**

- Bouton 🔽 **Filtre** en haut à droite
- Tri : Récent / Prix ↓ / Prix ↑

**Si une course active existe**

- Une bannière orange apparaît en haut
- Appuyez dessus pour accéder à la course en cours

---

### Accepter une course

1. Appuyez sur une offre dans le radar
2. Vérifiez le départ, la destination et le prix
3. Appuyez **"Postuler à cette course"**
4. Attendez que le passager vous sélectionne
5. Quand le passager vous choisit : appuyez **"Accepter la course"** ✅

---

### Gérer une course active

Une fois la course démarrée :

| Bouton | Action |
|--------|--------|
| **Démarrer la course** | Passer le statut à ONGOING (passager à bord) |
| **Terminer** | Marquer la course comme COMPLETED |
| **Annuler** | Annuler la course (urgence uniquement) |

> ⚠️ Le GPS de votre téléphone est automatiquement envoyé au serveur toutes les 3 secondes quand vous êtes en ligne.

---

### Profil Chauffeur

- Consultez vos infos véhicule
- Vérifiez votre **solde portefeuille**
- Modifiez votre véhicule si nécessaire
- Déconnexion

---

## ⚙️ Paramètres généraux

### Changer de mot de passe

1. Onglet **Profil** → **Changer de mot de passe**
2. Entrez l'ancien, le nouveau, confirmez
3. Appuyez **"Mettre à jour"**

### Déconnexion

1. Onglet **Profil** → **Déconnexion**
2. Confirmez

---

## 🌐 Langue

L'application est en **français** par défaut, correspondant à l'interface du frontend web.

---

## 📞 Support

Pour toute question ou bug :
- Email : info@yowyob.com
- Téléphone : +237 675 518 880

---

## 📝 Notes techniques

- L'authentification utilise **JWT** (token stocké de manière sécurisée avec expo-secure-store)
- Le token est automatiquement **renouvelé** en arrière-plan (refresh token)
- La géolocalisation utilise **expo-location** avec permission demandée à la première utilisation
- La recherche d'adresses utilise **Nominatim / OpenStreetMap** (pas de clé API requise)
