# Le Court Central - PRD

## Original Problem Statement
Application professionnelle de tennis: FastAPI + MongoDB + React Native (Expo)

## Completed Features (Feb 2026)

### Sprint Bugs Observations (Feb 22, 2026) ✅ NEW
#### Bugs corrigés:
- **BUG #1 - Mauvais nom auteur observation**:
  - `getCurrentUser()` utilise maintenant `authUser?.name` du contexte Auth
  - Plus de hardcodé "Coach Martin" - affiche le nom réel de l'utilisateur connecté
  - Fonctionne pour joueur et staff
- **BUG #2 - Badge "Envoi..." ne passe pas à "Envoyé"**:
  - `SEND_STATUS` enum: `sending` → `sent` (2s) → `null` ou `error`
  - `SendStatusBadge` component avec 3 couleurs (orange/vert/rouge)
  - `handleObservationUpdated()` pour mettre à jour le statut dans le state
- **BUG #3 - TextInput masqué par le clavier**:
  - `detailScrollRef` avec `scrollToEnd()` automatique
  - `onComposerOpen` callback déclenche le scroll vers le bas
  - `keyboardShouldPersistTaps="handled"` sur tous les ScrollView

### Sprint Bugs Factures, Caméra & Onboarding (Feb 22, 2026) ✅
- BUG #1 - Facture non mise à jour: Navigation vers le mois de la facture après save
- BUG #2 - Caméra au retour app: useFocusEffect + AppState listener
- BUG #3 - ATP/WTA mutuellement exclusifs: MUTUALLY_EXCLUSIVE array
- BUG #4 - Saisie invisible invitation: Style formInput avec color

### Sprint Technique - Bugs Clavier, Tournois & Affichage (Feb 22, 2026) ✅
- BUG #1 - Clavier observation: ComposerBox isolé avec state local
- BUG #2 - Freeze calendrier tournoi: Logique immutée
- FEATURE #3 - Affichage événements: Heure début → fin + durée

### Core Features ✅
- Calendrier avec dots colorés, CRUD événements, observations inline
- 137 tournois importés (ATP, WTA, ITF)
- Résidence fiscale Phase 1 & 2
- OCR factures avec extraction automatique

## Key API Endpoints
- Events: GET/POST /api/events, PUT/DELETE /api/events/{id}
- Observations: POST /api/events/{id}/observations (avec parentId)
- Tournaments: GET /api/tournaments/weeks, POST /api/tournaments/register

## Backlog

### P0 - Prochaine priorité
- **Phase 3 - Résidence Fiscale**: GPS background tracking + alertes push + PDF

### P1
- PDF export of documents
- Amélioration UI cartes tournois

## Architecture
```
/app/frontend/
├── app/(tabs)/index.tsx     # Calendrier (BUG #1,#2,#3 FIX - Auth context)
├── src/components/
│   └── EventObservationSection.tsx  # SEND_STATUS, SendStatusBadge
└── src/context/AuthContext.tsx
```

## Test Reports
- /app/test_reports/iteration_23.json - Bugs Factures/Caméra (7/7 - 100%)
- /app/test_reports/iteration_24.json - Bugs Observations (8/8 - 100%) ✅ NEW
