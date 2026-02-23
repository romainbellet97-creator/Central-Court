# Le Court Central - PRD

## Completed Bug Fixes (Feb 22, 2026)

### Sprint DB & P2 UX Bugs ✅ NEW

#### 🔴 CRITIQUE DB - Isolation utilisateur
| # | Bug | Status | Fix |
|---|-----|--------|-----|
| DB-2 | Aucune isolation day_presences | ✅ | `userId` ajouté à tous les documents et requêtes |
| DB-3 | Aucune isolation tournament_registrations | ✅ | `userId` filtre sur register/hide/unhide |
| DB-7 | hide supprime registration | ✅ | `previousStatus` sauvegardé, restauré au unhide |
| DB-8 | Auto-masquage irréversible | ✅ | `autoHidden` + `hiddenByTournament` pour cleanup |
| DB-12 | Année 2026 hardcodée | ✅ | `datetime.now().year` par défaut |
| DB-13 | ID court 8 chars | ✅ | UUID complet pour éviter collisions |

#### 🟠 P2 UX Bugs corrigés
| # | Bug | Status | Fix |
|---|-----|--------|-----|
| P2-9 | Navigation mois futurs illimitée | ✅ | `canGoNextMonth` + bouton désactivé |
| P2-10 | Validation date | ✅ | `isValidDateFormat()` helper |

### Previous Sprints Completed

#### Sprint UX Bugs - 11 Corrections ✅
- #3 URL invitation → `EXPO_PUBLIC_BACKEND_URL`
- #4 OCR feedback → Alerte "OCR non disponible"
- #5 Devise hardcodée → `getCurrencySymbol()`
- #6 Erreur ajout jour → Alertes succès/échec
- #11 Notes partagées → Reset `showNotesField`
- #14 Message succès séjour → "X jour(s) enregistré(s)"
- #15 Chargement profil → Alerte + Réessayer
- #17 Valeur 0 = undefined → `isNaN()` check
- #18/19 Fuseau horaire → `parseDateString()`
- #21 Email validation → Regex
- #22 Équipement/Matériel → OCR_CATEGORIES

#### Sprint Bugs Observations ✅
- BUG #1-3 : Nom auteur, Badge envoi, TextInput clavier

#### Sprint Bugs Factures/Caméra ✅
- BUG #1-4 : Facture, Caméra, ATP/WTA, Invitation

## Key Backend Changes

### residence_routes.py
- `DayPresenceCreate` avec `userId`
- `/days` POST: `userId` dans document + UUID complet
- `/days` GET: filtre `userId`
- `/stats`: filtre `userId`
- DELETE: filtre `userId`

### tournament_routes.py
- `/weeks`: filtre `userId` sur registrations et hidden
- `/register`: `userId` + cleanup auto-masquage
- `/hide`: `previousStatus` sauvegardé
- `/hide/{id}` DELETE: restauration status

## Backlog

### P0 - Phase 3 Résidence Fiscale
- GPS background tracking + alertes push + PDF

### P1
- DB-9: TTL index sessions (croissance infinie)
- Loading state inscription tournoi

### P2 (Bugs mineurs restants)
- Modification document existant (#7)
- Sélecteur pays avec noms complets (#12)
- Date picker séjour limite future (#13)
- Titre modal tournoi multi (#20)

## Test Reports
- /app/test_reports/iteration_24.json - Bugs Observations (8/8 - 100%)
