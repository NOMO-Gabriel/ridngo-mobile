# Prompt de fin de session — RidnGo Mobile

---

Nous terminons cette session de travail sur **RidnGo Mobile**.

Génère le rapport de session complet au format Markdown. Le rapport doit être **long, exhaustif et détaillé** — exactement comme le rapport de session 01 fourni en contexte au début du projet. Un rapport trop court est inutile : la prochaine session (et le prochain Claude) doit pouvoir reconstituer exactement ce qui s'est passé sans lire toute la conversation.

Nomme le fichier `session_XX.md` où `XX` est le numéro de session. Place-le dans `docs/reports/` et livre-le via `present_files`.

---

## Structure OBLIGATOIRE du rapport

```markdown
# Rapport Complet — Session XX — RidnGo Mobile

## Contexte de la Session

**Date :** [date]
**Numéro de session :** XX
**Session précédente :** session_XX-1.md
**Durée estimée :** [estimation basée sur la densité des échanges]
**Objectif de départ :** [ce qu'on voulait accomplir au début]

---

## Résumé Exécutif

[3-5 phrases : ce qu'on a réellement fait vs ce qu'on voulait faire, les blocages majeurs, l'état général à la fin de la session. Assez précis pour qu'on comprenne en 30 secondes si la session était productive ou difficile.]

---

## Items Todo Traités Cette Session

### ✅ Items complétés et testés sur téléphone physique
[Pour chaque item :]
**[ID] — [description complète]**
- Ce qui a été fait
- Résultat du test sur téléphone
- Commande git du commit

### ⚠️ Items partiellement traités ou implémentés non testés
[Pour chaque item :]
**[ID] — [description]**
- Ce qui a été implémenté
- Pourquoi c'est pas encore considéré fini
- Ce qu'il reste à faire

### ❌ Items bloqués
[Pour chaque item :]
**[ID] — [description]**
- Raison précise du blocage
- Ce qu'il faudra faire pour débloquer

---

## Étapes Détaillées de la Session

[Section centrale — la plus importante. Raconte ce qui s'est passé étape par étape, comme un journal de bord technique. Pour chaque grande action :]

### Phase N — [titre descriptif]

**Ce qu'on a fait :** [description]

**Pourquoi :** [contexte]

**Résultat :** [ce qui s'est passé]

[Répéter pour chaque phase significative de la session]

---

## Bugs Rencontrés et Fixes Appliqués

[Section critique. Chaque bug doit être documenté avec suffisamment de détail pour qu'on puisse comprendre le problème et la solution sans relire toute la conversation.]

### Bug N : [Titre court et descriptif]

**Symptôme :**
[Message d'erreur exact, ou comportement observé sur le téléphone. Coller le message d'erreur verbatim si possible.]

**Diagnostic :**
[Comment on a identifié la cause. Quelle commande de test a aidé ? Quelle partie du code était en cause ?]

**Cause racine :**
[Explication technique précise de pourquoi ça échouait.]

**Tentatives échouées (si applicable) :**
- Tentative 1 : [ce qu'on a essayé] → [pourquoi ça n'a pas marché]
- Tentative 2 : [...]

**Fix appliqué :**
[Description précise de ce qu'on a changé. Inclure les snippets de code importants si le fix est non-trivial.]

**Fichier(s) modifié(s) :** `chemin/vers/fichier.tsx`

**Commit :** `git commit -m "fix: description"`

**Statut :** ✅ Résolu / ⚠️ Contournement temporaire / ❌ Non résolu (expliquer pourquoi)

[Répéter pour chaque bug]

---

## Fichiers Modifiés Cette Session

| Fichier | Type | Description des changements |
|---------|------|----------------------------|
| `src/services/api.ts` | fix | Correction URL backend |
| `app/(passenger)/ride.tsx` | feat | Implémentation tap sur carte |
| ... | ... | ... |

---

## État Complet de l'App à la Fin de Cette Session

### ✅ Fonctionne — Testé sur téléphone physique
[Liste détaillée — une ligne par fonctionnalité. Format : "Login passager (JWT, refresh token automatique)"]

### ⚠️ Implémenté dans le code — Non testé sur téléphone
[Liste des fonctionnalités codées mais pas encore validées physiquement]

### ❌ Pas encore fait / À créer de zéro
[Liste de ce qui manque complètement]

---

## Informations Techniques Importantes pour la Prochaine Session

[Tout ce qu'un nouveau Claude doit savoir pour ne pas refaire les mêmes erreurs ou perdre du temps. Gotchas découverts, comportements inattendus du backend, contraintes React Native spécifiques, etc.]

**1. [Titre du point]**
[Explication]

**2. [Titre du point]**
[Explication]

[...]

---

## Prochain Item Todo

**Item suivant :** [ID exact — ex: RC-18]
**Description :** [description complète de l'item]
**Contexte :** [pourquoi cet item vient maintenant, dépendances éventuelles]
**Pré-requis :** [ce qui doit être vrai avant de commencer]

**Test backend suggéré avant de coder :**
```powershell
# Forcer le bon Node
$env:PATH = "C:\Users\nomo-gabriel\tools\node-v20.19.0-win-x64;$env:PATH"

# Test de l'endpoint concerné
$headers = @{ "Authorization" = "Bearer TOKEN" }
Invoke-RestMethod -Uri "https://traefikdev.yowyob.com/ridngo/api/v1/..." -Headers $headers
```

---

## Prompt de Démarrage Rapide — Session XX+1

> **Copie-colle ce bloc exact comme premier message de la prochaine conversation :**

```
Session XX+1 — RidnGo Mobile.

Lis d'abord docs/prompts/session_start.md pour les règles et le contexte complet du projet.
Ensuite lis docs/reports/session_XX.md pour l'état exact où on s'est arrêtés.
Ensuite lis todo.md pour identifier le prochain item.

On reprend à l'item [ID EXACT] — [description courte].

Points critiques de la session précédente à garder en tête :
- [point 1 si applicable]
- [point 2 si applicable]

Donne-moi ton briefing de session puis attends mes instructions.
```
```

---

## Instructions pour la génération de ce rapport

- **Sois exhaustif sur les bugs** : le message d'erreur exact, la cause, les tentatives, le fix final. Un bug mal documenté sera redécouvert à la prochaine session.
- **"✅ Fonctionne"** uniquement si testé sur le téléphone physique pendant cette session. Sinon c'est "⚠️ implémenté non testé".
- **Les Étapes Détaillées** sont la partie la plus importante. Ne les résume pas. Raconte.
- **Le Prompt de Démarrage Rapide** doit pointer vers `session_start.md` ET vers le rapport actuel. Un Claude qui lit juste le prompt rapide sans `session_start.md` travaillera sans les règles.
- Pas de tableaux vides, pas de sections "N/A" — si une section ne s'applique pas à cette session, retire-la.