# 🚀 Guide de Lancement — RidnGo Mobile

Ce guide couvre l'installation, la configuration et le lancement de l'application sur votre téléphone physique ou émulateur.

---

## 📋 Prérequis

| Outil | Version | Vérifier |
|-------|---------|----------|
| Node.js | >= 18 | `node -v` |
| npm | >= 9 | `npm -v` |
| Expo CLI | dernière | `npx expo --version` |
| Git | any | `git --version` |

**Sur votre téléphone :**
- Android : App **Expo Go** ([Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent))
- iOS : App **Expo Go** ([App Store](https://apps.apple.com/app/expo-go/id982107779))

> ⚠️ Votre téléphone et votre PC doivent être **sur le même réseau Wi-Fi**.

---

## 📦 Installation

### 1. Extraire le projet

```bash
# Si vous avez reçu un zip :
unzip ridngo-mobile.zip
cd ridngo-mobile

# Ou si c'est un dossier déjà extrait :
cd ridngo-mobile
```

### 2. Installer les dépendances

```bash
npm install
```

> ⏳ Cette étape peut prendre 2-5 minutes la première fois.

---

## 🔧 Configuration

### Variables d'environnement (optionnel)

Créez un fichier `.env` à la racine si vous voulez pointer vers un autre backend :

```bash
# .env (optionnel — par défaut c'est le backend de prod)
EXPO_PUBLIC_API_BASE_URL=https://ride-and-go.pynfi.com
EXPO_PUBLIC_VEHICLE_API_URL=https://vehicule-service.pynfi.com
```

### Google Maps (Android) — Pour la carte

Dans `app.json`, remplacez `YOUR_GOOGLE_MAPS_API_KEY` par votre vraie clé Google Maps :

```json
"config": {
  "googleMaps": {
    "apiKey": "AIzaSy..."
  }
}
```

> 💡 Sans cette clé, la recherche d'adresses via Nominatim fonctionnera quand même, mais la carte native ne s'affichera pas.

---

## ▶️ Lancer l'application

### Option A — Expo Go (plus simple, recommandé pour tester)

```bash
npx expo start
```

Un QR code s'affiche dans le terminal.

- **Android** : Ouvrez Expo Go → Scannez le QR code
- **iOS** : Ouvrez l'appareil photo → Scannez le QR code → "Ouvrir dans Expo Go"

### Option B — Émulateur Android (Android Studio requis)

```bash
# Lancer l'émulateur depuis Android Studio, puis :
npx expo start --android
```

### Option C — Émulateur iOS (Mac + Xcode requis)

```bash
npx expo start --ios
```

---

## 🔄 Rechargement

- **Secouer le téléphone** → Menu Expo → "Reload"
- **Appuyer `r`** dans le terminal pour recharger
- **Appuyer `j`** dans le terminal pour ouvrir le débogueur JS

---

## 🐛 Problèmes courants

### ❌ "Network request failed"
→ Vérifiez que votre téléphone et PC sont sur le **même Wi-Fi**  
→ Essayez `npx expo start --tunnel` (utilise un tunnel ngrok)

### ❌ "Unable to resolve module..."
```bash
npm install
npx expo install --fix
```

### ❌ "Metro bundler port already in use"
```bash
npx expo start --port 8082
```

### ❌ L'app plante au démarrage sur Android
→ Vérifiez que Expo Go est à jour  
→ Essayez de vider le cache : `npx expo start --clear`

### ❌ "expo-secure-store" error
```bash
npx expo install expo-secure-store
```

---

## 📱 Tester sur un vrai téléphone Android sans Play Store

Si vous n'avez pas accès à Expo Go :

```bash
# Générer un APK de développement
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
# L'APK est dans : android/app/build/outputs/apk/debug/app-debug.apk
```

Voir [GUIDE_APK.md](./GUIDE_APK.md) pour plus de détails.
