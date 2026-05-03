# Guide — Créer un Nouveau Projet Claude pour RidnGo Mobile

> Utilise ce guide quand les tokens du projet actuel sont épuisés, ou quand le contexte d'une conversation devient trop lourd pour continuer efficacement.

---

## Quand changer de projet ?

- Claude te suggère de changer de session (il le fait une seule fois — tu décides)
- La conversation dépasse ~30-40 échanges et Claude commence à perdre le fil
- Tu sens que Claude "oublie" des décisions prises plus tôt dans la conversation
- Les tokens du projet Claude actuel sont épuisés (limite atteinte)

**Avant de créer un nouveau projet, génère toujours le rapport de session** avec le prompt `docs/prompts/session_end.md`. Le rapport est le pont entre les deux projets.

---

## Étape 1 — Générer le rapport de la session en cours

Avant de fermer la conversation actuelle, envoie le contenu de `docs/prompts/session_end.md` comme message. Claude générera et livrera `docs/reports/session_XX.md`.

Mets ce fichier dans ton repo git et committe-le :
```powershell
git add docs/reports/session_XX.md
git commit -m "docs: rapport session XX"
```

---

## Étape 2 — Mettre à jour project_context.txt

Lance le scan du code actuel **avant** d'ouvrir la nouvelle session :
```powershell
$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"
powershell -ExecutionPolicy Bypass -File scan_project.ps1
```

Cela génère un `project_context.txt` frais avec l'état exact du code au moment du changement de session.

---

## Étape 3 — Créer le nouveau projet sur Claude.ai

1. Va sur **claude.ai**
2. Menu gauche → **"Nouveau projet"**
3. Nom du projet : `RidnGo Mobile — Session XX` (remplace XX par le bon numéro)

---

## Étape 4 — Description du projet

Dans le champ **"Description du projet"**, colle exactement :

```
RidnGo Mobile — App React Native + Expo SDK 52. Version mobile du service de transport urbain RidnGo (équivalent Uber, Yaoundé, Cameroun). Projet Yowyob Inc. / ENSPY, supervisé par Pr Djotio.

Stack backend : Java 21 / Spring Boot 3 WebFlux, PostgreSQL/PostGIS, Kafka, Redis.
URL backend : https://traefikdev.yowyob.com/ridngo
Expo account : nomo-gabriel | Projet EAS : ridengo (abcdfabf-967b-423a-9ebd-552147959f52)
Machine dev : Windows 11, user nomo-gabriel, Node dans C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64\

Je suis le développeur. Claude est mon assistant développeur principal.
On suit une todo.md de 197 items dans l'ordre strict.
On ne déclare rien "fonctionnel" sans test sur téléphone physique.
```

---

## Étape 5 — Instructions système du projet

Dans le champ **"Instructions"**, colle exactement :

```
Au TOUT début de chaque conversation dans ce projet, avant de répondre quoi que ce soit :

1. Lis le fichier docs/prompts/session_start.md dans la mémoire du projet. Ce fichier contient toutes les règles de travail, l'architecture, les URLs, les commandes et les points techniques critiques. C'est ta bible pour ce projet.

2. Lis le rapport de session le plus récent dans docs/reports/ (numéro le plus élevé). C'est ta mémoire de ce qui s'est passé.

3. Lis todo.md et identifie le prochain item non coché.

4. Donne un briefing de session : numéro de session, dernier item coché, prochain item, état de l'app, points critiques. Puis attends mes instructions.

Règles permanentes :
- Livraison par present_files uniquement pour les fichiers entiers.
- Test PowerShell backend avant tout développement mobile.
- "Fonctionne" = testé sur téléphone physique uniquement.
- Todo strictement dans l'ordre.
- Si le contexte devient chargé : suggère de changer de session une seule fois sans insister.
```

---

## Étape 6 — Fichiers à charger dans la mémoire du projet

Via **"Ajouter des fichiers au projet"**, charge ces fichiers **dans cet ordre** :

### Obligatoires — toujours

| Fichier | Où le trouver | Rôle |
|---------|---------------|------|
| `docs/prompts/session_start.md` | repo git | Règles, architecture, commandes, gotchas techniques — la bible du projet |
| `contexte_frontend.txt` | racine du repo (généré par scan) | Code source complet du frontend web — référence de parité |
| `project_context.txt` | racine du repo (généré par `scan_project.ps1`) | Code mobile actuel — état exact du projet |
| `todo.md` | racine du repo ou `docs/` | La checklist des 197 items |
| `docs/reports/session_XX.md` | repo git | Rapport de la dernière session — état exact où on s'est arrêtés |

### Optionnels — selon le contexte

| Fichier | Quand l'ajouter |
|---------|-----------------|
| `docs/reports/session_XX-1.md` | Si le rapport récent référence des bugs anciens non résolus qui viennent d'une session plus ancienne |
| Le PDF de présentation Yowyob | Si on travaille sur l'architecture, les endpoints ou le contexte métier |
| Un fichier de code spécifique | Si on sait d'avance qu'on va travailler intensément sur ce fichier |

**Note importante :** `session_start.md` doit être dans la mémoire du projet, pas juste mentionné dans les instructions. Claude doit pouvoir le lire directement.

---

## Étape 7 — Premier message dans la nouvelle session

Copie le **"Prompt de Démarrage Rapide"** qui se trouve à la fin du dernier rapport de session. Il ressemble à ça :

```
Session XX — RidnGo Mobile.

Lis d'abord docs/prompts/session_start.md pour les règles et le contexte complet du projet.
Ensuite lis docs/reports/session_XX-1.md pour l'état exact où on s'est arrêtés.
Ensuite lis todo.md pour identifier le prochain item.

On reprend à l'item [ID EXACT] — [description courte].

Points critiques de la session précédente :
- [point critique 1]
- [point critique 2]

Donne-moi ton briefing de session puis attends mes instructions.
```

---

## Récapitulatif checklist — Nouveau projet

- [ ] Rapport de la session précédente généré et commité (`session_XX.md`)
- [ ] `scan_project.ps1` relancé → `project_context.txt` à jour
- [ ] Nouveau projet créé sur claude.ai avec le bon nom
- [ ] Description du projet collée
- [ ] Instructions système collées
- [ ] `docs/prompts/session_start.md` chargé dans la mémoire
- [ ] `contexte_frontend.txt` chargé dans la mémoire
- [ ] `project_context.txt` (version fraîche) chargé dans la mémoire
- [ ] `todo.md` chargé dans la mémoire
- [ ] `docs/reports/session_XX.md` (dernier rapport) chargé dans la mémoire
- [ ] Prompt de démarrage rapide envoyé comme premier message
- [ ] Claude a donné son briefing de session et attend les instructions

---

## En cas de perte de contexte en cours de session

Si Claude semble avoir "oublié" quelque chose en cours de conversation sans que tu aies changé de session, rappelle-lui avec :

```
Rappel : lis docs/prompts/session_start.md dans la mémoire du projet et le dernier rapport de session. On est à l'item [ID]. [Rappel du contexte spécifique si nécessaire.]
```