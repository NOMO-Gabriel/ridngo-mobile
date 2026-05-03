# RidnGo Mobile — TODO & Checklist de débogage complet

> **Mode d'emploi :** Teste chaque étape sur le téléphone. Si ça échoue, note l'erreur exacte (screenshot ou message console) et corrige avant de passer à la suivante.  
> Pour tester le backend indépendamment : `Invoke-RestMethod -Uri "URL" -Method POST -ContentType "application/json" -Body '{...}'`  
> URL backend : `https://traefikdev.yowyob.com/ridngo`

---

## 🔧 PRÉREQUIS TECHNIQUES

- [ ] **T-01** Node v20 actif dans le PATH (`$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"`)
- [ ] **T-02** `npm install --legacy-peer-deps` passe sans erreur critique
- [ ] **T-03** `npx expo start --clear` démarre sans crash
- [ ] **T-04** EAS CLI disponible (`eas --version`)
- [ ] **T-05** Connecté au compte Expo (`npx expo whoami` → `nomo-gabriel`)
- [ ] **T-06** Projet EAS configuré (`eas.json` contient le profil `apk`, projectId `abcdfabf-967b-423a-9ebd-552147959f52`)

---

## 🌐 CONNECTIVITÉ BACKEND

- [ ] **B-01** Le backend répond : `Invoke-RestMethod -Uri "https://traefikdev.yowyob.com/ridngo/api/v1/offers/landing?limit=3"` → retourne une liste JSON (même vide)
- [ ] **B-02** Swagger accessible dans le navigateur : `https://traefikdev.yowyob.com/ridngo/webjars/swagger-ui/index.html`
- [ ] **B-03** `api.ts` contient bien `BASE_URL = 'https://traefikdev.yowyob.com/ridngo'` (pas l'ancienne URL `ride-and-go.pynfi.com`)
- [ ] **B-04** `app.json` contient `"usesCleartextTraffic": true` dans le bloc Android
- [ ] **B-05** Permissions Android dans `app.json` : `INTERNET` et `ACCESS_NETWORK_STATE` présentes

---

## 1️⃣ LANDING & NAVIGATION INITIALE

- [ ] **L-01** L'app démarre sans crash (écran landing visible)
- [ ] **L-02** Le switcher thème clair/sombre fonctionne sur la landing
- [ ] **L-03** Le bouton "Se connecter" navigue vers `/(auth)/login`
- [ ] **L-04** Le bouton "S'inscrire" navigue vers `/(auth)/register`
- [ ] **L-05** `index.tsx` redirige correctement selon le rôle stocké en session :
  - `PASSENGER` → `/(passenger)/ride`
  - `DRIVER` → `/(driver)/dashboard`
  - Pas de session → `/(auth)/landing`

---

## 2️⃣ INSCRIPTION PASSAGER

- [ ] **RP-01** L'écran register affiche bien les deux modes : "Passager" et "Chauffeur"
- [ ] **RP-02** Le mode "Passager" est sélectionné par défaut
- [ ] **RP-03** Les champs (prénom, nom, email, téléphone, mot de passe) sont bien visibles
- [ ] **RP-04** Le clavier ne disparaît pas à chaque frappe (fix `keyboardShouldPersistTaps`, `useCallback`)
- [ ] **RP-05** La requête multipart est construite manuellement avec `fetch` (boundary manuel) et non avec Axios
- [ ] **RP-06** Le body envoyé contient bien le champ `data` avec `Content-Type: application/json`
- [ ] **RP-07** Le rôle envoyé est bien `RIDE_AND_GO_PASSENGER`
- [ ] **RP-08** Test backend direct (PowerShell) : l'inscription retourne `200 OK` avec `accessToken`
- [ ] **RP-09** Après inscription réussie → stockage `accessToken` + `refreshToken` dans SecureStore
- [ ] **RP-10** Après inscription → appel `GET /api/v1/users/me` pour récupérer le profil complet
- [ ] **RP-11** `user.phone` (champ `telephone` du backend) est bien extrait et stocké
- [ ] **RP-12** Redirection automatique vers `/(passenger)/ride` après inscription

---

## 3️⃣ CONNEXION PASSAGER

- [ ] **LP-01** Les champs email et mot de passe sont bien visibles et éditables
- [ ] **LP-02** Le clavier ne disparaît pas à chaque frappe
- [ ] **LP-03** Test backend : `POST /api/v1/auth/login` avec `{ "identifier": "email", "password": "..." }` → retourne `accessToken`
- [ ] **LP-04** `accessToken` et `refreshToken` stockés dans SecureStore après login
- [ ] **LP-05** `GET /api/v1/users/me` appelé après login → `roles[0]` = `RIDE_AND_GO_PASSENGER`
- [ ] **LP-06** `user.telephone` bien extrait et stocké (crucial pour publier une offre)
- [ ] **LP-07** Redirection vers `/(passenger)/ride`
- [ ] **LP-08** Au redémarrage de l'app : le token est rechargé depuis SecureStore → pas de reconnexion nécessaire
- [ ] **LP-09** Le refresh token automatique fonctionne (si le `accessToken` expire, `api.ts` appelle `POST /api/v1/auth/refresh` automatiquement)

---

## 4️⃣ TAB COMMANDER — PASSAGER (`/(passenger)/ride.tsx`)

### 4a. Interface de base
- [ ] **RC-01** La carte OSM s'affiche en plein écran en arrière-plan (WebView + Leaflet)
- [ ] **RC-02** Le panel bottom-sheet est positionné par-dessus la carte
- [ ] **RC-03** Le panel est scrollable (ScrollView) — aucun bouton n'est coupé hors écran
- [ ] **RC-04** Le titre "Où allez-vous ?" s'affiche correctement

### 4b. Sélection du lieu de départ
- [ ] **RC-05** Le champ "Lieu de départ" est visible et cliquable
- [ ] **RC-06** La frappe dans le champ déclenche la recherche Nominatim (après 600ms de debounce)
- [ ] **RC-07** Les suggestions s'affichent dans un dropdown (zIndex correct, pas caché derrière la carte)
- [ ] **RC-08** Le formatage de l'adresse est lisible (`road + suburb + city`, pas le `display_name` brut)
- [ ] **RC-09** La sélection d'une suggestion ferme le dropdown et remplit le champ
- [ ] **RC-10** Le bouton GPS fonctionne → `expo-location` → reverse geocoding Nominatim → remplit le champ départ
- [ ] **RC-11** Après sélection du départ : un marqueur orange apparaît sur la carte OSM

### 4c. Sélection via tap sur la carte
- [ ] **RC-12** Un tap sur la carte déclenche un reverse geocoding Nominatim avec les coordonnées du tap
- [ ] **RC-13** Le résultat remplit le champ actif (départ ou destination selon lequel est vide)
- [ ] **RC-14** Si les deux champs sont déjà remplis, le tap sur la carte ne fait rien (ou demande lequel modifier)

### 4d. Sélection de la destination
- [ ] **RC-15** Le champ "Destination" fonctionne identiquement au départ (recherche, suggestions, GPS)
- [ ] **RC-16** Après sélection de la destination : un marqueur bleu apparaît sur la carte
- [ ] **RC-17** Quand départ ET destination sont remplis : `fitBounds` automatique sur la carte pour afficher les deux marqueurs

### 4e. Estimation du tarif
- [ ] **RC-18** Le bouton "Estimer le prix" est visible (pas coupé par le bas de l'écran)
- [ ] **RC-19** Le bouton est actif seulement si départ ET destination sont remplis
- [ ] **RC-20** Clic → `POST /api/v1/fares/estimate` avec `{ depart, arrivee, heure: "matin", meteo: 0, type_zone: 0, congestion_user: 1 }`
- [ ] **RC-21** Test backend direct (PowerShell) : retourne `{ prix_moyen, prix_min, prix_max, distance, duree }`
- [ ] **RC-22** `prix_moyen` s'affiche à l'écran comme tarif recommandé
- [ ] **RC-23** La distance et la durée estimées s'affichent
- [ ] **RC-24** Un tracé de l'itinéraire apparaît sur la carte entre les deux marqueurs

### 4f. Modification du tarif
- [ ] **RC-25** Le passager peut modifier le montant (champ éditable pré-rempli avec `prix_moyen`)
- [ ] **RC-26** La valeur minimum est `prix_min` (affichée comme info)
- [ ] **RC-27** Le champ téléphone du passager est pré-rempli avec `user.phone` stocké en session

### 4g. Publication de l'offre
- [ ] **RC-28** Le bouton "Publier mon offre" est visible et actif
- [ ] **RC-29** Le body envoyé contient tous les champs requis :
  ```json
  {
    "startPoint": "nom adresse départ",
    "startLat": 3.866,
    "startLon": 11.516,
    "endPoint": "nom adresse destination",
    "endLat": 3.870,
    "endLon": 11.520,
    "price": 1500,
    "passengerPhone": "699000000",
    "departureTime": "08:30"
  }
  ```
- [ ] **RC-30** Test backend direct : `POST /api/v1/offers` avec le bon token → retourne l'offre avec `id` et `state: "PENDING"`
- [ ] **RC-31** L'`offerId` est stocké localement (AsyncStorage/SecureStore) pour pouvoir reprendre si l'app redémarre
- [ ] **RC-32** Après publication → transition vers le panel "En attente des chauffeurs"

---

## 5️⃣ ATTENTE DES BIDS — PASSAGER (`RideWaiting`)

- [ ] **RW-01** Le panel affiche "Votre offre est visible, les chauffeurs vont répondre..."
- [ ] **RW-02** Polling `GET /api/v1/offers/{offerId}/bids` toutes les 3 secondes
- [ ] **RW-03** Test backend : après que le chauffeur postule, `bids` n'est plus vide
- [ ] **RW-04** Pour chaque bid, appel `GET /api/v1/users/drivers/{driverId}` pour charger le profil complet
- [ ] **RW-05** Chaque `BidCard` affiche : photo/initiales, nom chauffeur, note, nb de courses, véhicule, plaque
- [ ] **RW-06** Le bouton "Choisir ce chauffeur" est visible sur chaque BidCard
- [ ] **RW-07** Clic "Choisir" → `PATCH /api/v1/offers/{offerId}/select-driver?driverId={driverId}` → offre passe en `DRIVER_SELECTED`
- [ ] **RW-08** Après sélection → panel affiche "En attente de confirmation du chauffeur..."
- [ ] **RW-09** Polling continue sur l'offre → dès que `state = VALIDATED` (chauffeur a accepté), transition vers course active
- [ ] **RW-10** `GET /api/v1/offers/{offerId}/ride` retourne le Trip créé → stockage du `rideId`
- [ ] **RW-11** Bouton "Annuler ma demande" visible et fonctionnel → `DELETE /api/v1/offers/{offerId}` → retour à l'étape search

---

## 6️⃣ INSCRIPTION CHAUFFEUR

- [ ] **RC2-01** Sur l'écran register, le toggle "Mode Chauffeur" sélectionne le bon mode
- [ ] **RC2-02** Les champs supplémentaires chauffeur sont visibles si nécessaire (ou l'inscription est identique au passager)
- [ ] **RC2-03** Le rôle envoyé est `RIDE_AND_GO_DRIVER`
- [ ] **RC2-04** L'inscription réussit (même flow multipart que passager)
- [ ] **RC2-05** Après inscription chauffeur → redirection vers `/(driver)/onboarding`

---

## 7️⃣ ONBOARDING CHAUFFEUR (`/(driver)/onboarding.tsx`)

### 7a. Étape 1 — Enregistrement du véhicule
- [ ] **OB-01** L'écran onboarding s'affiche (step 1 = véhicule)
- [ ] **OB-02** Les listes déroulantes sont chargées depuis `https://vehicule-service.pynfi.com` (marques, modèles, types, carburants...)
- [ ] **OB-03** Fallback si le service véhicule ne répond pas (données hardcodées Toyota/Mercedes/etc.)
- [ ] **OB-04** Tous les champs requis sont remplis (marque, modèle, immatriculation, numéro de permis...)
- [ ] **OB-05** Soumission → `POST /api/v1/users/become-driver` (ou endpoint équivalent selon Swagger) avec les infos véhicule
- [ ] **OB-06** Test backend direct : l'endpoint retourne `200 OK`
- [ ] **OB-07** Après succès véhicule → passage à l'étape 2 (syndicat)

### 7b. Étape 2 — Vérification syndicale (UGate)
- [ ] **OB-08** Le bouton "Ouvrir UGate Compliance" s'affiche
- [ ] **OB-09** L'URL de callback est correcte : `[app_url]/driver/onboarding?action=verify`
- [ ] **OB-10** Après retour de UGate avec `?action=verify` → `PATCH /api/v1/users/verify-compliance` appelé
- [ ] **OB-11** Test backend : l'endpoint retourne `200 OK`
- [ ] **OB-12** Après vérification → écran de succès puis redirection vers `/(driver)/dashboard`

---

## 8️⃣ CONNEXION CHAUFFEUR

- [ ] **LD-01** Login avec le compte chauffeur (email + mot de passe)
- [ ] **LD-02** `GET /api/v1/users/me/driver-profile` appelé après login → retourne `{ user, driver, vehicle }`
- [ ] **LD-03** `driver.isProfileValidated` et `driver.isSyndicated` vérifiés
- [ ] **LD-04** Si profil non complété → redirect vers `/(driver)/onboarding`
- [ ] **LD-05** Si profil OK → redirect vers `/(driver)/dashboard`
- [ ] **LD-06** Au redémarrage de l'app : session chauffeur rechargée → pas de reconnexion nécessaire

---

## 9️⃣ DASHBOARD CHAUFFEUR (`/(driver)/dashboard.tsx`)

### 9a. Chargement initial
- [ ] **DD-01** `GET /api/v1/users/me/driver-profile` → profil affiché (nom, photo/initiales)
- [ ] **DD-02** Solde wallet affiché → `GET /api/v1/wallets/me` → `balance` en FCFA
- [ ] **DD-03** Vérification d'une course active en cours → `GET /api/v1/trips/driver/current` (ou équivalent)
- [ ] **DD-04** Si course active → bandeau/bouton "Course en cours" visible → navigue vers `/(driver)/ride/[id]`

### 9b. Toggle Online/Offline
- [ ] **DD-05** Le toggle Online/Offline s'affiche avec l'état actuel de `driver.isOnline`
- [ ] **DD-06** Passage en Online → `PATCH /api/v1/users/me/online` (ou endpoint Swagger) → `isOnline: true`
- [ ] **DD-07** Passage en Offline → même endpoint avec `isOnline: false`
- [ ] **DD-08** En Online → polling `GET /api/v1/offers/available?page=0&size=100` toutes les 5s
- [ ] **DD-09** En Online → envoi GPS toutes les 2s → `POST /api/v1/trips/location` avec `{ latitude, longitude }`
- [ ] **DD-10** En Offline → le polling s'arrête, la liste d'offres se vide

### 9c. Radar — liste des offres disponibles
- [ ] **DD-11** La liste des offres disponibles s'affiche (départ, destination, prix proposé)
- [ ] **DD-12** Tri par défaut : "récent" (configurable : prix croissant/décroissant)
- [ ] **DD-13** Clic sur une offre → navigue vers `/(driver)/offers/[id]`

### 9d. Carte OSM sur le dashboard
- [ ] **DD-14** Carte OSM visible sur le dashboard (WebView + Leaflet)
- [ ] **DD-15** Position GPS du chauffeur affichée sur la carte (marqueur voiture)
- [ ] **DD-16** Les offres disponibles sont affichées sur la carte (marqueurs)

---

## 🔟 DÉTAIL OFFRE & CANDIDATURE CHAUFFEUR (`/(driver)/offers/[id].tsx`)

- [ ] **OD-01** `GET /api/v1/offers/{id}` → chargement des détails de l'offre (départ, destination, prix, infos passager)
- [ ] **OD-02** La carte affiche le point de départ et la destination de l'offre
- [ ] **OD-03** Le bouton "Je suis intéressé" est visible
- [ ] **OD-04** Clic → `POST /api/v1/offers/{offerId}/apply` → retourne l'offre mise à jour
- [ ] **OD-05** Test backend direct : l'endpoint retourne `200 OK` et le chauffeur apparaît dans les bids côté passager
- [ ] **OD-06** Après candidature → affichage "En attente du choix du client..."
- [ ] **OD-07** Polling sur `GET /api/v1/offers/{id}` toutes les 3s → vérifie si `state = DRIVER_SELECTED` et `selectedDriverId == monId`
- [ ] **OD-08** Quand sélectionné → affichage "VOUS AVEZ ÉTÉ CHOISI !" avec infos passager

---

## 1️⃣1️⃣ HANDSHAKE — CHAUFFEUR ACCEPTE (`/(driver)/offers/[id].tsx`)

- [ ] **HS-01** Le bouton "Confirmer la course" apparaît quand `selectedDriverId == monId`
- [ ] **HS-02** Clic → `POST /api/v1/offers/{offerId}/accept?driverId={monDriverId}`
- [ ] **HS-03** Test backend direct : retourne un `Trip` avec `state: CREATED`
- [ ] **HS-04** Le `rideId` du Trip est stocké localement
- [ ] **HS-05** Redirection automatique vers `/(driver)/ride/{rideId}`

---

## 1️⃣2️⃣ COURSE ACTIVE — CHAUFFEUR (`/(driver)/ride/[id].tsx`)

- [ ] **CA-01** `GET /api/v1/trips/{rideId}` → chargement des détails (state, passagerId, offerId)
- [ ] **CA-02** `GET /api/v1/users/{passagerId}` → infos passager (nom, téléphone, photo)
- [ ] **CA-03** La carte affiche la position du passager (depuis l'offre : `startLat/startLon`)
- [ ] **CA-04** La carte affiche la position GPS du chauffeur en temps réel (expo-location)
- [ ] **CA-05** Le numéro de téléphone du passager est affiché et copiable/appelable
- [ ] **CA-06** Bouton "Démarrer la course" visible quand `state = CREATED`
- [ ] **CA-07** Clic → `PATCH /api/v1/trips/{rideId}/status` avec `{ status: "ONGOING" }` → `state: ONGOING`
- [ ] **CA-08** Bouton "Terminer la course" visible quand `state = ONGOING`
- [ ] **CA-09** Clic → `PATCH /api/v1/trips/{rideId}/status` avec `{ status: "COMPLETED" }` → `state: COMPLETED`
- [ ] **CA-10** Après COMPLETED → retour automatique vers `/(driver)/dashboard`

---

## 1️⃣3️⃣ COURSE ACTIVE — PASSAGER (suite de `/(passenger)/ride.tsx`)

- [ ] **PA-01** Dès que le Trip est créé (après handshake) → panel affiche les infos du chauffeur
- [ ] **PA-02** `GET /api/v1/users/drivers/{driverId}` → nom, photo, véhicule, plaque, note chauffeur
- [ ] **PA-03** La carte affiche la position GPS du chauffeur en temps réel (polling `GET /api/v1/trips/{rideId}/location` toutes les 3s)
- [ ] **PA-04** ETA (temps d'arrivée estimé) affiché
- [ ] **PA-05** Le numéro de téléphone du chauffeur est affiché et copiable
- [ ] **PA-06** Quand `state = ONGOING` → affichage "Trajet en cours"
- [ ] **PA-07** Quand `state = COMPLETED` → affichage de la modale de notation

---

## 1️⃣4️⃣ NOTATION POST-COURSE — PASSAGER

- [ ] **RV-01** Modale étoiles (1 à 5) s'affiche automatiquement quand `state = COMPLETED`
- [ ] **RV-02** Champ commentaire optionnel
- [ ] **RV-03** Clic "Envoyer" → `POST /api/v1/reviews/ride/{rideId}` avec `{ stars, comment }`
- [ ] **RV-04** Test backend direct : retourne `200 OK`
- [ ] **RV-05** Après envoi (ou skip) → retour à l'écran initial du tab Commander
- [ ] **RV-06** L'`offerId` stocké localement est bien supprimé après la course

---

## 1️⃣5️⃣ HISTORIQUE PASSAGER (`/(passenger)/history.tsx`)

- [ ] **HP-01** `GET /api/v1/trips/passenger` (ou `/trips/my-history`) → liste des courses du passager
- [ ] **HP-02** Chaque course affiche : date, départ, destination, prix, état (COMPLETED/CANCELLED)
- [ ] **HP-03** Pour chaque course : `GET /api/v1/trips/{rideId}` → `driverId` → `GET /api/v1/users/{driverId}` → nom chauffeur affiché
- [ ] **HP-04** Mini-carte OSM affichée pour chaque course (marqueurs départ/destination)
- [ ] **HP-05** Si aucune course → message vide affiché proprement

---

## 1️⃣6️⃣ PROFIL PASSAGER (`/(passenger)/profile.tsx`)

- [ ] **PP-01** `GET /api/v1/users/me` → prénom, nom, email, téléphone affichés dans le formulaire
- [ ] **PP-02** Modification du profil → `PUT /api/v1/users/profile` avec `{ firstName, lastName, phone }` → succès
- [ ] **PP-03** Changement de mot de passe → `PUT /api/v1/users/password` avec `{ currentPassword, newPassword }` → succès
- [ ] **PP-04** Si `newPassword != confirmPassword` → message d'erreur avant l'envoi
- [ ] **PP-05** Switch thème clair/sombre fonctionne et persiste (SecureStore)
- [ ] **PP-06** Bouton "Déconnexion" → supprime tokens → redirige vers landing
- [ ] **PP-07** Wallet affiché : `GET /api/v1/wallets/me` → solde en FCFA

---

## 1️⃣7️⃣ HISTORIQUE CHAUFFEUR (`/(driver)/history.tsx`) — ❌ À CRÉER

- [ ] **HD-01** Écran créé avec bottom tab "Historique"
- [ ] **HD-02** `GET /api/v1/trips/enriched-history?page=0&size=20` → liste des courses terminées
- [ ] **HD-03** Chaque course affiche : date, départ, destination, prix encaissé, note reçue
- [ ] **HD-04** `GET /api/v1/users/{passengerId}` → nom passager affiché
- [ ] **HD-05** Mini-carte OSM pour chaque course
- [ ] **HD-06** Total revenus du mois affiché en haut
- [ ] **HD-07** Si aucune course → message vide affiché

---

## 1️⃣8️⃣ PROFIL CHAUFFEUR (`/(driver)/profile.tsx`)

- [ ] **DP-01** `GET /api/v1/users/me/driver-profile` → `{ user, driver, vehicle }` affichés
- [ ] **DP-02** Section "Informations personnelles" : prénom, nom, email, téléphone
- [ ] **DP-03** Section "Informations pro" : numéro de permis, statut validation, syndicat
- [ ] **DP-04** Section "Véhicule" : marque, modèle, immatriculation, type
- [ ] **DP-05** Modification profil → `PUT /api/v1/users/profile` → succès
- [ ] **DP-06** Changement mot de passe → `PUT /api/v1/users/password` → succès
- [ ] **DP-07** Switch thème clair/sombre fonctionne et persiste
- [ ] **DP-08** Wallet affiché : `GET /api/v1/wallets/me` → solde en FCFA
- [ ] **DP-09** Bouton "Déconnexion" fonctionne → retour landing

---

## 1️⃣9️⃣ NOTIFICATIONS

- [ ] **NT-01** `GET /api/v1/notifications?page=0&size=10` → liste des notifs
- [ ] **NT-02** Badge de compteur sur le tab ou en haut de l'écran pour les notifs non lues
- [ ] **NT-03** Clic sur une notif → `PATCH /api/v1/notifications/{id}/read` → marque comme lue
- [ ] **NT-04** Bouton "Tout marquer comme lu" → `PATCH /api/v1/notifications/read-all`
- [ ] **NT-05** Préférences notifs → `GET /api/v1/settings/notifications` → toggles email/sms/push/whatsapp
- [ ] **NT-06** Sauvegarde préférences → `PUT /api/v1/settings/notifications`

---

## 2️⃣0️⃣ GESTION DES ERREURS & CAS LIMITES

- [ ] **ER-01** Si le token expire pendant l'utilisation → refresh automatique transparent (api.ts interceptor)
- [ ] **ER-02** Si le refresh échoue → déconnexion forcée + redirect landing
- [ ] **ER-03** Si l'app est fermée pendant une offre en attente → au redémarrage, reprendre depuis l'offre stockée
- [ ] **ER-04** Si l'app est fermée pendant une course active → au redémarrage, reprendre la course
- [ ] **ER-05** Perte de réseau → message d'erreur lisible (pas un crash)
- [ ] **ER-06** Backend down ou 500 → message d'erreur lisible
- [ ] **ER-07** Offre expirée/annulée par le passager → le chauffeur voit un message approprié et retourne au radar

---

## 📋 COMMANDES DE RÉFÉRENCE

```powershell
# Forcer le bon Node
$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"

# Installer les dépendances
npm install --legacy-peer-deps

# Lancer en dev (même réseau WiFi)
npx expo start --clear

# Build APK EAS
eas build --platform android --profile apk

# Tester un endpoint backend
$headers = @{ "Authorization" = "Bearer TON_TOKEN" }
Invoke-RestMethod -Uri "https://traefikdev.yowyob.com/ridngo/api/v1/users/me" -Headers $headers

# Tester l'inscription (sans token)
$body = '--boundary\r\nContent-Disposition: form-data; name="data"\r\nContent-Type: application/json\r\n\r\n{"email":"test@test.com","password":"Test1234!","firstName":"Test","lastName":"User","phone":"699000000","roles":["RIDE_AND_GO_PASSENGER"]}\r\n--boundary--'
Invoke-RestMethod -Uri "https://traefikdev.yowyob.com/ridngo/api/v1/auth/register" -Method POST -ContentType 'multipart/form-data; boundary=boundary' -Body $body

# Committer un fichier corrigé
git add src/chemin/du/fichier.tsx && git commit -m "fix: description du fix"

# Scanner le code actuel pour donner le contexte
powershell -ExecutionPolicy Bypass -File scan_project.ps1
```

---

## 📊 ÉTAT D'AVANCEMENT

| Section | Total | ✅ OK | ❌ KO | ⬜ Pas encore testé |
|---------|-------|-------|-------|---------------------|
| Prérequis | 6 | | | 6 |
| Backend connectivité | 5 | | | 5 |
| Landing/navigation | 5 | | | 5 |
| Inscription passager | 12 | | | 12 |
| Connexion passager | 9 | | | 9 |
| Tab Commander | 32 | | | 32 |
| Attente bids | 11 | | | 11 |
| Inscription chauffeur | 5 | | | 5 |
| Onboarding chauffeur | 12 | | | 12 |
| Connexion chauffeur | 6 | | | 6 |
| Dashboard chauffeur | 16 | | | 16 |
| Détail offre | 8 | | | 8 |
| Handshake acceptation | 5 | | | 5 |
| Course active chauffeur | 10 | | | 10 |
| Course active passager | 7 | | | 7 |
| Notation post-course | 6 | | | 6 |
| Historique passager | 5 | | | 5 |
| Profil passager | 7 | | | 7 |
| Historique chauffeur | 7 | | | 7 |
| Profil chauffeur | 9 | | | 9 |
| Notifications | 6 | | | 6 |
| Erreurs & cas limites | 7 | | | 7 |
| **TOTAL** | **197** | | | **197** |