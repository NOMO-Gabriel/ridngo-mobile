# Rapport Complet — Session 02 — RidnGo Mobile

## Contexte de la Session

**Date :** 03 mai 2026  
**Numéro de session :** 02  
**Session précédente :** session_01.md (rapport fourni manuellement en contexte en début de session)  
**Durée estimée :** Session longue (~2-3h) — beaucoup de discussion stratégique et de structuration  
**Objectif de départ :** Établir une todo list exhaustive du flux complet, puis créer les outils de gestion de sessions (prompts, guide, rapports)

---

## Résumé Exécutif

Cette session était une session de **structuration et de préparation**, pas de développement. On n'a touché à aucun fichier de code mobile. L'objectif était de partir sur de bonnes bases pour les sessions suivantes : créer une todo list couvrant l'intégralité du flux utilisateur réel (197 items), et mettre en place les outils qui permettent de changer de conversation Claude sans perdre de contexte. La décision de ne rien déclarer comme "fonctionnel" avant test physique a été formalisée. On repart de zéro sur les tests : tout est à vérifier.

---

## Ce Qu'on a Produit Cette Session

### ✅ Livrables créés

Aucun code mobile modifié. Les livrables sont des outils de pilotage du projet :

**`todo.md`** — La checklist de référence absolue  
197 items organisés dans l'ordre logique du flux utilisateur complet, du démarrage de l'app jusqu'à la review post-course et la gestion des profils. Chaque item a un ID unique (format `XX-NN`), une description courte et une description technique précise. Les items couvrent : prérequis techniques, connectivité backend, auth (passager + chauffeur), tab Commander passager avec tous les sous-flux (LocationSearch, tap carte, estimation, tracé, publication), attente bids, handshake double, course active (les deux côtés), review, historiques, profils, notifications, gestion des erreurs.

**`docs/prompts/session_start.md`** — Prompt de début de session  
Document complet que Claude doit lire en début de chaque session. Contient : contexte projet, architecture mobile, URLs backend, infos machine dev, commandes de référence, règles de travail, points techniques critiques, workflow type de correction de bug.

**`docs/prompts/session_end.md`** — Prompt de fin de session  
Template détaillé pour générer un rapport de session long et exhaustif, calqué sur le format du rapport session_01. Contient les instructions pour que Claude sache quoi inclure et avec quel niveau de détail.

**`docs/prompts/new_project_setup.md`** — Guide de changement de projet  
Guide complet étape par étape pour créer un nouveau projet Claude quand les tokens sont épuisés : description du projet, instructions système, liste des fichiers à charger dans la mémoire, checklist de vérification.

**`docs/reports/session_02.md`** — Ce rapport

---

## Étapes Détaillées de la Session

### Phase 1 — Analyse du contexte fourni

En début de session, le rapport complet de la session 01 a été fourni directement dans le contexte de la conversation (copié-collé). Ce rapport décrivait en détail tout le travail de la session 01 : génération initiale du projet depuis `contexte_frontend.txt`, longue phase de débogage d'installation (bugs Node, conflits React, Windows chemins longs, Expo SDK, ngrok), premier build EAS réussi, et corrections fonctionnelles post-installation (clavier TextInput, register multipart, network error, méthode manquante dans rideService).

La mémoire du projet contient `contexte_frontend.txt` (~16 000 lignes de code du frontend web) et `project_context.txt` (scan du code mobile actuel).

### Phase 2 — Demande de todo list

La demande initiale portait sur une todo list organisée selon le flux utilisateur réel :

> *"je suis client, j'arrive, je crée mon compte, je veux aller quelque part, je choisis le lieu de départ ou d'arrivée ou les deux, soit via les sélecteurs, soit via la carte..."*

Un premier rendu visuel (SVG dans le chat) a été produit mais était incomplet — il ne couvrait pas le login chauffeur, l'onboarding, le double handshake complet, les profils, etc.

**Décision :** Reformuler complètement en fichier Markdown avec checkboxes, couvrant absolument tout.

### Phase 3 — Construction de la todo.md

Après lecture du code source du frontend web (particulièrement `rideService.ts`, `ride/page.tsx`, `driver/dashboard`, `driver/offers/[id]`, `active/[id]/page.tsx`, `profile/page.tsx`, `history/page.tsx`) et du code mobile actuel, la todo a été construite section par section.

**Sections créées :**
- T-01 → T-06 : Prérequis techniques machine (Node, EAS, Expo)
- B-01 → B-05 : Connectivité backend (URL, cleartext, permissions Android)
- L-01 → L-05 : Landing et redirections par rôle
- RP-01 → RP-12 : Inscription passager (multipart, rôle, stockage, redirect)
- LP-01 → LP-09 : Connexion passager (JWT, profil, phone, refresh token, persistance session)
- RC-01 → RC-32 : Tab Commander complet — 32 items couvrant carte OSM, GPS, tap sur carte, LocationSearch, estimation, tracé itinéraire, modification tarif, publication offre avec tous les champs requis
- RW-01 → RW-11 : Attente des bids, BidCard, sélection chauffeur, annulation
- RC2-01 → RC2-05 : Inscription chauffeur
- OB-01 → OB-12 : Onboarding chauffeur (véhicule via vehicule-service + UGate syndicat)
- LD-01 → LD-06 : Connexion chauffeur (profil driver-profile, validation, redirect onboarding si incomplet)
- DD-01 → DD-16 : Dashboard chauffeur (profil, wallet, toggle online, GPS, polling offres, carte OSM)
- OD-01 → OD-08 : Détail offre, candidature (apply), polling sélection
- HS-01 → HS-05 : Handshake — chauffeur accepte, création Trip, stockage rideId
- CA-01 → CA-10 : Course active chauffeur (infos passager, carte, CREATED→ONGOING→COMPLETED)
- PA-01 → PA-07 : Course active passager (infos chauffeur, tracking temps réel, états)
- RV-01 → RV-06 : Review post-course passager
- HP-01 → HP-05 : Historique passager
- PP-01 → PP-07 : Profil passager (update, password, thème, wallet, déco)
- HD-01 → HD-07 : Historique chauffeur (à créer de zéro)
- DP-01 → DP-09 : Profil chauffeur (données pro, véhicule, thème, wallet)
- NT-01 → NT-06 : Notifications (liste, badge, markAsRead, préférences)
- ER-01 → ER-07 : Gestion erreurs et cas limites (refresh token, reprise de session, perte réseau)

**Total : 197 items.**

### Phase 4 — Feedback et itérations sur les outils de session

Après livraison de la todo et d'une première version des prompts, retour critique :

1. Le prompt de début de session était "une blague" — trop court, pas de contexte réel du projet
2. Le template de rapport était trop squelettique — pas du tout au niveau du rapport session_01
3. Dans le guide de setup, le prompt de démarrage rapide était insuffisant — 4 lignes sans dire de lire `session_start.md`

**Corrections apportées :**
- `session_start.md` refait complètement : maintenant ~250 lignes avec architecture complète, URLs, infos machine, commandes de référence, points techniques critiques, workflow de correction de bug
- `session_end.md` refait avec un template de rapport qui oblige à documenter les bugs avec symptôme/diagnostic/cause/fix/commit, les étapes détaillées en journal de bord, et un prompt de démarrage rapide qui pointe vers `session_start.md`
- `new_project_setup.md` refait avec le guide complet pour créer un projet Claude incluant description, instructions système, liste des fichiers à charger, checklist

---

## Analyse du Code Existant (Session 01 — Non Revérifié)

D'après le rapport session_01 et le code scanné dans `project_context.txt`, voici ce qui existe dans le code **selon ce qu'a rapporté la session précédente** — rien n'a été vérifié sur le téléphone pendant cette session :

### Ce qui existe dans le code (implémenté session 01)

**Auth :**
- Login avec `POST /api/v1/auth/login` → `{ identifier, password }` → JWT stocké
- Register avec `fetch` natif, multipart boundary manuel, champ `data` de type `application/json`
- Rôle `RIDE_AND_GO_PASSENGER` ou `RIDE_AND_GO_DRIVER` envoyé selon le toggle
- `AuthContext` avec `SecureStore` pour la persistance

**UI/Thème :**
- `ThemeContext` avec `LightColors` et `DarkColors` dans `theme.ts`
- `ThemeToggle` bouton soleil/lune
- Thème clair par défaut au premier lancement
- Switcher visible sur landing et profil

**Tab Commander passager (`ride.tsx`) :**
- Carte OSM plein écran via WebView + Leaflet
- Panel bottom-sheet par-dessus
- `LocationSearch.tsx` avec Nominatim, debounce 600ms, formatage `road + suburb + city`
- GPS avec `expo-location` + reverse geocoding
- Dropdown en `position: absolute` avec `zIndex: 9999`
- Marqueurs orange (départ) et bleu (destination)
- `fitBounds` automatique quand départ + destination sélectionnés
- Estimation de prix via `POST /api/v1/fares/estimate` → `prix_moyen` affiché

**Dashboard chauffeur :**
- Radar : polling `GET /api/v1/offers/available`
- Toggle online/offline
- Wallet affiché

**Historique passager :**
- Mini-cartes OSM pour chaque course

**Onboarding chauffeur :**
- Étape véhicule avec champs
- Étape syndicat UGate avec callback

### Bugs Connus Non Résolus (Hérités Session 01)

**Bug A : Bouton "Estimer le prix" potentiellement coupé**  
Fix appliqué en session 01 (suppression `maxHeight`, ajout `ScrollView`) mais non buildé et non testé. À vérifier en item RC-18.

**Bug B : Tap sur carte non implémenté**  
Pas de handler Leaflet → app → React Native pour la sélection via tap sur la carte. À implémenter : item RC-12.

**Bug C : Tracé itinéraire absent**  
`fitBounds` existe mais pas de polyligne entre départ et destination sur la carte. À implémenter : item RC-24.

**Bug D : Double handshake chauffeur non testé**  
Le flow complet (apply → polling sélection → accept → course active) n'a pas été testé bout en bout. Items OD-07, HS-01 → CA-10.

---

## État Complet de l'App à la Fin de Cette Session

### ✅ Fonctionne — Testé sur téléphone physique (d'après rapport session 01)
*(Ces items ont été testés pendant la session 01 — aucun retest cette session)*
- Build EAS APK installable sur Android
- Login passager avec JWT
- Register passager et chauffeur (multipart fetch manuel)
- Navigation par rôle (PASSENGER → tabs passager, DRIVER → tabs chauffeur)
- Thème clair/sombre avec persistance SecureStore
- Carte OSM affichée sur tab Commander
- LocationSearch Nominatim fonctionnel (debounce, GPS, formatage)
- Estimation de prix (`prix_moyen` depuis `/api/v1/fares/estimate`)

### ⚠️ Implémenté dans le code — Non testé sur téléphone
- Fix panel ride.tsx (ScrollView, suppression maxHeight) — commité non buildé
- Dashboard chauffeur complet (radar, toggle, wallet)
- Historique passager avec mini-cartes
- Profil passager avec données backend
- Onboarding chauffeur (véhicule + syndicat)

### ❌ Pas encore fait / À créer de zéro
- Tap sur carte → reverse geocoding → remplissage champ
- Tracé itinéraire sur carte après estimation
- Flow complet publication offre → bids → sélection chauffeur
- Double handshake complet (passager sélectionne → chauffeur accepte → Trip → course active)
- Course active côté passager avec tracking temps réel
- Review post-course
- Historique chauffeur (`/(driver)/history.tsx`)
- Profil chauffeur avec données réelles + thème
- Notifications

---

## Informations Techniques Importantes pour la Prochaine Session

**1. multipart/form-data — Ne jamais utiliser Axios pour le register**  
Spring WebFlux exige que le champ `data` soit de type `Content-Type: application/json` dans la partie multipart. Axios ne permet pas de contrôler le Content-Type par partie. Solution : `fetch` natif avec construction manuelle du boundary. `new Blob()` n'existe pas dans l'environnement React Native natif — utiliser une string boundary.

**2. URL backend correcte**  
`https://traefikdev.yowyob.com/ridngo`. L'ancienne `https://ride-and-go.pynfi.com` est obsolète. Vérifier dans `api.ts` que `BASE_URL` est correct.

**3. Format de réponse profil chauffeur**  
`GET /api/v1/users/me/driver-profile` → `{ user: {...}, driver: {...}, vehicle: {...} }`. Ce n'est pas le même objet que `GET /api/v1/users/me` qui retourne directement l'utilisateur. Bien extraire `res.data.user` pour les infos personnelles, `res.data.driver` pour `isOnline`, `isProfileValidated`, etc.

**4. Champs requis pour CreateOfferRequest**  
En plus des noms d'adresses, le backend exige les coordonnées numériques : `startLat`, `startLon`, `endLat`, `endLon`. Ces coordonnées doivent venir de l'objet retourné par LocationSearch (Nominatim retourne `lat` et `lon` sous forme de strings — convertir en `parseFloat`).

**5. Clavier TextInput — bug récurrent**  
Tous les écrans avec formulaire doivent avoir : `keyboardShouldPersistTaps="always"` sur ScrollView, `blurOnSubmit={false}` sur chaque TextInput, et `useCallback` sur tous les handlers `onChangeText`. Sans ça, le clavier se ferme à chaque frappe (re-render du parent).

**6. Estimation de prix — paramètres hardcodés**  
Le body de `POST /api/v1/fares/estimate` contient des paramètres qu'on ne demande pas à l'utilisateur : `heure: "matin"`, `meteo: 0`, `type_zone: 0`, `congestion_user: 1`. Ces valeurs sont hardcodées comme dans le frontend web.

**7. Onboarding chauffeur — vérification du statut au login**  
Au login d'un chauffeur, après `GET /api/v1/users/me/driver-profile`, vérifier `driver.isProfileCompleted` et `driver.isSyndicated`. Si l'un des deux est `false`, rediriger vers `/(driver)/onboarding` au lieu du dashboard.

**8. GPS temps réel dashboard chauffeur**  
Quand le chauffeur est en ligne, envoi de position toutes les 2s via `POST` (endpoint à confirmer dans Swagger). Utiliser `expo-location` avec `watchPositionAsync` plutôt que `getCurrentPosition` en boucle.

---

## Prochain Item Todo

**Item suivant :** T-01  
**Description :** Vérifier que Node v20 est actif dans le PATH et que la machine de développement est opérationnelle  
**Contexte :** On recommence de zéro — rien n'est présumé fonctionnel. On vérifie l'environnement avant de toucher au code.  
**Pré-requis :** Ouvrir PowerShell sur la machine `nomo-gabriel`

**Actions pour T-01 à T-06 :**
```powershell
# T-01 : Forcer le bon Node
$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"
node --version   # doit afficher v20.x.x

# T-02 : Vérifier les dépendances
npm install --legacy-peer-deps

# T-03 : Vérifier le démarrage Expo
npx expo start --clear

# T-04 : Vérifier EAS CLI
eas --version

# T-05 : Vérifier le compte Expo
npx expo whoami   # doit afficher : nomo-gabriel

# T-06 : Vérifier eas.json
# Vérifier que projectId = abcdfabf-967b-423a-9ebd-552147959f52
# Vérifier que le profil "apk" existe
```

Ensuite enchaîner sur B-01 → B-05 (connectivité backend) avant de toucher au code.

---

## Prompt de Démarrage Rapide — Session 03

> **Copie-colle ce bloc exact comme premier message de la prochaine conversation :**

```
Session 03 — RidnGo Mobile.

Lis d'abord docs/prompts/session_start.md dans la mémoire du projet (règles, architecture, URLs, commandes, points techniques critiques).
Ensuite lis docs/reports/session_02.md pour l'état exact où on s'est arrêtés.
Ensuite lis todo.md pour identifier le prochain item.

On reprend au tout début : item T-01 (prérequis machine).
Rien n'a encore été testé sur le téléphone dans cette session — tout est à vérifier.
On suit la todo dans l'ordre strict, sans exception.

Points critiques à garder en tête :
- multipart register = fetch natif avec boundary manuel, jamais Axios
- URL backend = https://traefikdev.yowyob.com/ridngo (pas l'ancienne ride-and-go.pynfi.com)
- profil chauffeur = res.data.user / .driver / .vehicle (pas le même format que /users/me)
- CreateOfferRequest nécessite startLat, startLon, endLat, endLon en plus des noms d'adresses

Donne-moi ton briefing de session puis attends mes instructions.
```