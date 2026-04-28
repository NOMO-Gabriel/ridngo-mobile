# 📱 RidnGo Mobile

Application mobile **React Native + Expo** pour le service de mise en relation passager ↔ chauffeur RidnGo.

> Africa's Freedom Move — Yowyob Inc. Ltd.

---

## ⚡ Démarrage Rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer l'app
npx expo start
```

Scannez le QR code avec **Expo Go** (Android/iOS) pour tester instantanément.

---

## 📚 Guides

| Guide | Description |
|-------|-------------|
| [🚀 GUIDE_LANCER.md](./docs/GUIDE_LANCER.md) | Installer, configurer et lancer l'app |
| [📦 GUIDE_APK.md](./docs/GUIDE_APK.md) | Générer et extraire l'APK Android |
| [📖 GUIDE_UTILISATION.md](./docs/GUIDE_UTILISATION.md) | Utiliser l'application (passager & chauffeur) |

---

## 🗂️ Structure du projet

```
ridngo-mobile/
├── app/                    # Écrans (expo-router)
│   ├── (auth)/            # Landing, Login, Register
│   ├── (passenger)/       # Ride, Historique, Profil
│   └── (driver)/          # Dashboard, Offres, Course, Onboarding, Profil
├── src/
│   ├── services/          # API, Auth, Ride, User
│   ├── context/           # AuthContext
│   ├── components/        # LocationSearch, etc.
│   └── types/             # Types TypeScript + Thème
├── assets/                # Icônes et images
├── docs/                  # Guides
└── app.json               # Configuration Expo
```

---

## 🎨 Design

- Palette : **Orange (#FF8C00)** + Dark (#0D0D0D)
- Typographie : System Bold/Black
- Composants : Cards glassmorphism, badges, bottom tabs

---

## 🔗 Backend

- **API principale** : `https://ride-and-go.pynfi.com`
- **Vehicle API** : `https://vehicule-service.pynfi.com`
- **Compliance** : `https://ugate-dev.yowyob.com/compliance`
- **Geocoding** : Nominatim OpenStreetMap (Cameroun)
