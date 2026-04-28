# 📦 Guide de Génération APK — RidnGo Mobile

Ce guide explique comment compiler l'application en un fichier `.apk` installable sur n'importe quel téléphone Android.

---

## 🔑 Deux méthodes

| Méthode | Prérequis | Durée | Recommandé si... |
|---------|-----------|-------|------------------|
| **EAS Build** (cloud) | Compte Expo gratuit | ~10 min | Pas d'Android Studio |
| **Build local** | Android Studio + JDK | ~20 min | Vous voulez tout faire en local |

---

## ✅ Méthode 1 — EAS Build (Cloud, plus simple)

### 1. Créer un compte Expo

Rendez-vous sur [expo.dev](https://expo.dev) et créez un compte gratuit.

### 2. Se connecter

```bash
npx expo login
# Entrez votre email et mot de passe Expo
```

### 3. Initialiser EAS

```bash
npx eas init
```

Cela va créer un `projectId` dans `app.json`. Ajoutez-le :

```json
"extra": {
  "eas": {
    "projectId": "VOTRE-ID-ICI"
  }
}
```

### 4. Générer l'APK

```bash
# APK direct (debug-like, installable sans Play Store)
npx eas build --platform android --profile apk
```

### 5. Télécharger l'APK

Une fois le build terminé (~10 min), EAS vous donne un **lien de téléchargement direct**.

Vous pouvez aussi le retrouver sur [expo.dev/builds](https://expo.dev/builds).

---

## 🔧 Méthode 2 — Build local avec Android Studio

### Prérequis
- **Android Studio** installé
- **JDK 17** installé
- Variable d'environnement `ANDROID_HOME` configurée

### 1. Générer le projet natif Android

```bash
npx expo prebuild --platform android
```

> ⚠️ Cette commande génère le dossier `/android`. Ne le modifiez pas manuellement.

### 2. Compiler l'APK

```bash
cd android
# Sur Windows :
gradlew.bat assembleRelease
# Sur Mac/Linux :
./gradlew assembleRelease
```

### 3. Localiser l'APK

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📲 Installer l'APK sur un téléphone Android

### Via USB (Android Debug Bridge)

```bash
# Vérifier que le téléphone est détecté
adb devices

# Installer l'APK
adb install app-release.apk
```

### Via transfert de fichiers

1. Copiez l'APK sur votre téléphone (USB, Bluetooth, WhatsApp, etc.)
2. Sur le téléphone : **Paramètres → Sécurité → Sources inconnues** → Activez
3. Ouvrez le gestionnaire de fichiers → Trouvez l'APK → Installez

### Via un lien de téléchargement (méthode EAS)

EAS Build génère un lien direct — ouvrez-le depuis le téléphone Android.

---

## ⚙️ Profils de build (eas.json)

Le fichier `eas.json` contient trois profils :

```json
{
  "apk": {
    "android": { "buildType": "apk" }        // ← APK direct, le plus simple
  },
  "preview": {
    "android": { "buildType": "apk" }        // ← Similaire, distribution interne
  },
  "production": {
    "android": { "buildType": "app-bundle" } // ← Pour le Play Store (.aab)
  }
}
```

Pour un APK de test rapide :
```bash
npx eas build --platform android --profile apk
```

---

## 🔒 Signature de l'APK

EAS gère automatiquement les keystores (clés de signature) pour vous.

Si vous faites un build local, vous devez créer un keystore :

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore ridngo.keystore \
  -alias ridngo -keyalg RSA -keysize 2048 -validity 10000
```

Puis configurez `android/app/build.gradle` avec votre keystore.

---

## 📋 Checklist avant de générer l'APK final

- [ ] Remplacer `YOUR_GOOGLE_MAPS_API_KEY` dans `app.json`
- [ ] Vérifier `package` dans `app.json` : `"com.yowyob.ridngo"`
- [ ] Mettre à jour `version` si nécessaire
- [ ] Tester sur Expo Go d'abord
- [ ] `npx expo login` effectué

---

## ❓ Problèmes courants

### ❌ "Gradle build failed"
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

### ❌ "SDK not found"
→ Vérifiez que `ANDROID_HOME` pointe vers votre installation Android SDK  
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### ❌ L'APK s'installe mais l'app plante
→ Vérifiez les logs :
```bash
adb logcat | grep -i "ridngo\|error\|exception"
```
