# Rapport Complet — RidnGo Mobile App

## Contexte du Projet

**RidnGo** est un sous-projet de la suite **Ingénierie de Voyage** (Yowyob Inc. Ltd., Yaoundé, Cameroun), supervisé par Pr Djotio. C'est un service de mise en relation passager ↔ chauffeur (équivalent Uber local) intégré dans un écosystème de microservices de mobilité urbaine au Cameroun.

**Stack backend :** Java 21 / Spring Boot 3.x (WebFlux réactif), PostgreSQL/PostGIS, Kafka, Redis  
**Frontend web :** Next.js + Tailwind CSS (déjà complet et fonctionnel)  
**App mobile :** React Native + Expo (ce qu'on a construit ici)

---

## Ce Qu'on a Construit

### Architecture de l'app mobile

```
ridngo-mobile/
├── app/
│   ├── _layout.tsx          # Root layout avec ThemeProvider + AuthProvider
│   ├── index.tsx            # Redirect selon rôle (PASSENGER/DRIVER/ADMIN)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── landing.tsx      # Page d'accueil avec switcher thème
│   │   ├── login.tsx        # Connexion JWT
│   │   └── register.tsx     # Inscription passager ou chauffeur
│   ├── (passenger)/
│   │   ├── _layout.tsx      # Bottom tabs passager
│   │   ├── ride.tsx         # Commande de course + carte OSM
│   │   ├── history.tsx      # Historique avec mini-cartes
│   │   └── profile.tsx      # Profil + switch thème + mdp
│   └── (driver)/
│       ├── _layout.tsx      # Bottom tabs chauffeur
│       ├── dashboard.tsx    # Radar offres + toggle online
│       ├── offers/[id].tsx  # Détail offre + postuler
│       ├── ride/[id].tsx    # Course active chauffeur
│       ├── onboarding.tsx   # Enregistrement véhicule + syndicat
│       └── profile.tsx      # Profil chauffeur
├── src/
│   ├── services/
│   │   ├── api.ts           # Axios + refresh token auto
│   │   ├── auth.ts          # Login/Register/Session
│   │   ├── rideService.ts   # Tous les appels courses
│   │   └── userService.ts   # Profil, notifications, géocodage
│   ├── context/
│   │   ├── AuthContext.tsx  # Session JWT globale
│   │   └── ThemeContext.tsx # Thème clair/sombre persisté
│   ├── components/
│   │   ├── LocationSearch.tsx  # Recherche adresse Nominatim
│   │   └── ThemeToggle.tsx     # Bouton switcher thème
│   └── types/
│       ├── api.ts           # Types TypeScript complets
│       └── theme.ts         # LightColors + DarkColors
└── assets/                  # Icônes placeholder orange
```

---

## Étapes Détaillées

### Phase 1 — Génération initiale du projet

**Ce qu'on a fait :** Généré l'app complète depuis le code source du frontend web (contexte_frontend.txt, ~16000 lignes). Extraction des URLs, types, flows, services.

**Fichiers générés :** package.json, app.json, eas.json, babel.config.js, tsconfig.json, tous les écrans, services, types, contextes, assets placeholder.

**Livraison :** ZIP complet + 3 guides MD (GUIDE_LANCER, GUIDE_APK, GUIDE_UTILISATION) + README.

---

### Phase 2 — Déboguer l'installation (très long)

#### Bug 1 : Conflit de versions React
```
npm error: peer react@"^18.2.0" from react-native@0.76.5
```
**Cause :** `react@18.3.2` incompatible avec `react-native@0.76.5`  
**Fix :** Rétrogradé à `react@18.2.0`  
**Commande :** `npm install --legacy-peer-deps`

#### Bug 2 : `expo-asset` manquant
```
Error: The required package `expo-asset` cannot be found
```
**Fix :** Ajouté `expo-asset` et `expo-constants` dans package.json

#### Bug 3 : Windows — chemins trop longs pour `Remove-Item`
```
Remove-Item: Impossible de supprimer... DirectoryNotFoundException
```
**Cause :** Windows limite les chemins à 260 chars, node_modules de React Native dépasse.  
**Fix :** `cmd /c "rmdir /s /q node_modules"` au lieu de `Remove-Item`

#### Bug 4 : Node.js installé sous compte `hp` (machine partagée)
```
Error: EPERM: operation not permitted, lstat 'C:\Users\hp\AppData'
```
**Cause :** Node installé globalement sous un autre utilisateur admin.  
**Fix :** Forcer le PATH vers le node personnel :
```powershell
$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"
```
Puis installer Node v24 en mode "current user only".

#### Bug 5 : Expo Go SDK 54 incompatible avec SDK 52
**Cause :** Expo Go sur le téléphone était SDK 54, notre projet SDK 52.  
**Tentative :** Mettre à jour vers SDK 54 → trop de dépendances cassées.  
**Solution finale :** Générer directement l'APK via EAS Build (contourne Expo Go).

#### Bug 6 : Tunnel ngrok demande login
**Cause :** Tunnel anonyme refusé par Expo Go récent.  
**Fix :** `npx expo login` avec compte expo.dev gratuit.

#### Bug 7 : `eas init` échoue (EPERM node)
**Fix :** Installer EAS CLI via le node personnel :
```powershell
C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64\npm.cmd install -g eas-cli
```

---

### Phase 3 — Premier build EAS réussi

**Problème :** Import path incorrect dans `LocationSearch.tsx`
```
Unable to resolve module ../../services/userService
```
**Fix :** `../../` → `../` (le composant est dans `src/components/`, pas dans `app/`)

**Build réussi :** APK généré et installé sur le téléphone Android.

---

### Phase 4 — Bugs fonctionnels post-installation

#### Bug 1 : Clavier disparaît à chaque frappe (Login/Register)
**Cause :** Re-render du composant parent à chaque `setState`, unmount/remount des TextInput.  
**Fix :**
- `keyboardShouldPersistTaps="always"` sur ScrollView
- `blurOnSubmit={false}` sur chaque TextInput
- `useCallback` sur les handlers de changement

#### Bug 2 : Register échoue — `Content type 'application/octet-stream' not supported`
**Diagnostic :** Backend Spring WebFlux attend multipart/form-data avec un champ `data` de type `application/json`.

**Tentative 1 :** Envoyer JSON pur → `415 Unsupported Media Type`  
**Tentative 2 :** FormData avec string → `octet-stream` (Axios sérialise mal)  
**Tentative 3 :** `new Blob([JSON.stringify(dto)], {type: 'application/json'})` → `Blob` n'existe pas en React Native natif  
**Solution finale :** Utiliser `fetch` natif avec multipart construit manuellement :
```typescript
const boundary = '----RidnGoBoundary' + Date.now();
let body = `--${boundary}\r\n`;
body += `Content-Disposition: form-data; name="data"\r\n`;
body += `Content-Type: application/json\r\n\r\n`;
body += `${JSON.stringify(registerDto)}\r\n`;
body += `--${boundary}--\r\n`;
const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  body,
});
```
**Validation :** Testé via PowerShell `Invoke-RestMethod` avant fix → confirme que le backend fonctionne bien.

#### Bug 3 : Network Error sur toutes les requêtes
**Cause 1 :** Mauvaise URL backend — on utilisait `https://ride-and-go.pynfi.com` mais la vraie URL est `https://traefikdev.yowyob.com/ridngo`  
**Cause 2 :** Permissions Android manquantes (INTERNET, ACCESS_NETWORK_STATE)  
**Fix :** Mise à jour `api.ts` + `app.json` avec `usesCleartextTraffic: true`

#### Bug 4 : `rideService.completeRide` manquant
**Cause :** La méthode était appelée dans `ride.tsx` mais n'existait pas dans `rideService.ts`.  
**Fix :** Ajout de la méthode dans l'objet (attention : elle avait été ajoutée APRÈS le `};` fermant au lieu d'être À L'INTÉRIEUR — bug de syntaxe subtil).

---

### Phase 5 — Améliorations UI/UX

#### Thème clair/sombre
- Ajout de `LightColors` et `DarkColors` dans `theme.ts`
- `ThemeContext` avec `SecureStore` pour persister la préférence
- `ThemeToggle` bouton soleil/lune
- Thème clair par défaut au premier lancement
- Switcher visible sur landing + profil

#### Carte OSM (WebView + Leaflet)
- Carte plein écran en arrière-plan
- Panel bottom sheet par-dessus
- Marqueurs orange (départ) et bleu (destination)
- Marker voiture pour le chauffeur en temps réel
- `fitBounds` automatique quand départ + destination sélectionnés
- Mini-cartes dans l'historique des courses

#### LocationSearch corrigé
- Nominatim OpenStreetMap avec `addressdetails=1`
- Debounce 600ms (identique au web)
- Formatage intelligent : `road + suburb + city` (pas le `display_name` brut)
- GPS avec `expo-location` + reverse geocoding
- Dropdown en `position: absolute` avec `zIndex: 9999`

#### Bug panel ride : bouton "Estimer le prix" invisible
**Cause :** `maxHeight: 72%` sur le panel + pas de ScrollView → le bouton était coupé hors écran.  
**Fix :** Suppression du `maxHeight`, ajout `ScrollView` dans le step search, `overflow: 'visible'` sur les parents des dropdowns.

---

## Façon de Travailler

### Workflow de développement
1. **Identifier le bug** via screenshot ou message d'erreur du téléphone
2. **Tester le backend** avec `Invoke-RestMethod` PowerShell pour isoler frontend vs backend
3. **Corriger le fichier** dans l'environnement Claude
4. **Livrer le fichier corrigé** via `present_files` (pas de zip sauf gros changements)
5. **Commit ciblé** : `git add fichier_modifié && git commit -m "fix: description"`
6. **Build EAS** : `eas build --platform android --profile apk`
7. **Installer l'APK** depuis le lien expo.dev sur le téléphone

### Commandes de référence
```powershell
# Forcer le bon Node (obligatoire sur cette machine)
$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"

# Installer les dépendances
npm install --legacy-peer-deps

# Lancer en dev (même réseau WiFi requis)
npx expo start --clear

# Scanner le projet pour partager le contexte
powershell -ExecutionPolicy Bypass -File scan_project.ps1

# Committer et builder
git add .
git commit -m "feat/fix: description"
eas build --platform android --profile apk
```

### Infos machine développeur
- **OS :** Windows 11, machine partagée (user `nomo-gabriel`, admin `hp`)
- **Node :** v20.19.0 dans `C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64\`
- **EAS CLI :** installé globalement via ce node
- **Expo account :** `nomo-gabriel`
- **Projet EAS :** `ridengo` (ID: `abcdfabf-967b-423a-9ebd-552147959f52`)
- **Git :** repo local initialisé, branche `main`

---

## URLs Backend

| Service | URL |
|---------|-----|
| API principale RidnGo | `https://traefikdev.yowyob.com/ridngo` |
| Swagger RidnGo | `https://traefikdev.yowyob.com/ridngo/webjars/swagger-ui/index.html` |
| Vehicle service | `https://vehicule-service.pynfi.com` |
| Compliance/Syndicats | `https://ugate-dev.yowyob.com/compliance` |
| Géocodage | `https://nominatim.openstreetmap.org` (OSM, gratuit) |

---

## État Actuel de l'App (dernier build)

### ✅ Fonctionne
- Login (JWT, refresh token automatique)
- Register passager et chauffeur (multipart fetch manuel)
- Navigation par rôle (PASSENGER → tabs passager, DRIVER → tabs chauffeur)
- Thème clair/sombre avec persistance
- Carte OSM plein écran sur le tab Commander
- Recherche d'adresses Nominatim avec formatage intelligent
- Estimation de prix (endpoint `/api/v1/fares/estimate`, champ `prix_moyen`)
- Historique courses avec mini-cartes
- Profil passager avec données backend réelles
- Dashboard chauffeur (radar, toggle online/offline, wallet)
- Onboarding chauffeur (véhicule + syndicat)

### ⚠️ En cours / À tester
- Bouton "Estimer le prix" (fix du panel dans le dernier commit, pas encore buildé)
- Flow complet de course passager (publish offer → bids → select driver → active → review)
- Flow complet chauffeur (apply → accept → start → complete)

### ❌ Pas encore fait
- Tab chauffeur historique de courses
- Tab chauffeur profil avec thème
- Notifications push (endpoint existe, UI manque)
- Carte sur le dashboard chauffeur
- Tests end-to-end du double handshake

---

## Où On Va

L'objectif est de **parité fonctionnelle avec le frontend web** tab par tab. Voici le plan :

### Prochaine session — Tabs chauffeur
1. **Dashboard chauffeur** — carte OSM + position GPS en temps réel + liste offres
2. **Course active chauffeur** — carte avec tracking passager
3. **Profil chauffeur** — thème + données réelles

### Sessions suivantes
4. **Notifications** — tab ou badge, lié à `/api/v1/notifications`
5. **Paiement/Wallet** — recharge, historique transactions
6. **Tests double handshake complet** — passager publie → chauffeur postule → passager sélectionne → chauffeur accepte → course → review

---

## Prompt de Démarrage pour la Nouvelle Conversation

---

> **Contexte :** Je développe **RidnGo Mobile**, une app React Native + Expo qui est la version mobile du frontend web RidnGo (service Uber-like au Cameroun, projet Yowyob). L'app web est déjà complète et fonctionnelle. Mon travail est de reproduire fidèlement ses fonctionnalités tab par tab sur mobile.
>
> **Mémoire du projet :** Tu as accès aux fichiers suivants dans la mémoire du projet :
> - `contexte_frontend.txt` — code source complet du frontend web (référence)
> - `project_context.txt` — scan du code mobile actuel
> - Le PowerPoint de présentation du projet (architecture, services, équipe)
>
> **Ce qui fonctionne déjà :**
> - Auth (login + register) avec multipart fetch manuel (Spring WebFlux)
> - Thème clair/sombre persisté (LightColors/DarkColors dans ThemeContext)
> - Carte OSM plein écran via WebView + Leaflet sur le tab Commander
> - LocationSearch Nominatim avec debounce 600ms et formatage adresse intelligent
> - Estimation de prix (`prix_moyen` depuis `/api/v1/fares/estimate`)
> - Historique courses avec mini-cartes OSM
> - Dashboard chauffeur (radar, toggle online)
>
> **Façon de travailler :**
> - Tu me livres les fichiers corrigés via `present_files` (pas de zip sauf refonte massive)
> - Je remplace les fichiers dans mon projet et commit : `git add fichier && git commit -m "fix/feat: description"`
> - Je build avec EAS : `eas build --platform android --profile apk`
> - Pour tester le backend avant de coder : `Invoke-RestMethod -Uri "URL" -Method POST -ContentType "application/json" -Body '...'`
> - Ma machine est partagée (Windows, user `nomo-gabriel`). Node est dans `C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64\`
> - Pour scanner le code actuel et te l'envoyer : script `scan_project.ps1` à la racine
>
> **URL backend :** `https://traefikdev.yowyob.com/ridngo`
>
> **Compte EAS :** `nomo-gabriel`, projet `ridengo` (ID: `abcdfabf-967b-423a-9ebd-552147959f52`)
>
> **Objectif :** Parité fonctionnelle avec le frontend web, tab par tab. On améliore une tab à la fois, on teste, on corrige, on passe à la suivante.
>
> Lis le rapport de contexte et le code source, puis **demande-moi sur quelle tab on commence**.