# Le Court Central - PRD

## Original Problem Statement
Application professionnelle de tennis: FastAPI + MongoDB + React Native (Expo)

## Completed Features (Feb 2026)

### Sprint Technique - Bugs Clavier, Tournois & Affichage (Feb 22, 2026) ✅ NEW
#### Bugs corrigés:
- **BUG #1 - Clavier disparaît observation**: 
  - ComposerBox isolé avec React.memo et state local (pas dans le parent)
  - `blurOnSubmit={false}` pour empêcher dismiss du clavier
  - `keyboardShouldPersistTaps="handled"` sur tous les ScrollView
- **BUG #2 - Freeze calendrier tournoi**: 
  - Logique de mise à jour immutée avec spread operator
  - API testée : changement Intéressé → Participant fonctionne

#### Features implémentées:
- **FEATURE #3 - Affichage événements amélioré**:
  - Heure début → fin visible sur la vignette (ex: `09:00 → 10:00`)
  - Durée calculée automatiquement (ex: `(2h30)`)
  - Nom complet de l'événement (pas tronqué)
  - Icône selon le type d'événement
  - Lieu affiché si disponible

### Sprint 3 - Refonte UI Événements (Feb 22, 2026) ✅
#### Features implémentées:
- **FEATURE #1 - Système observations inline**: 
  - Nouveau composant `EventObservationSection.tsx` avec threaded replies
  - Support parentId pour les réponses aux observations
  - Optimistic updates + rollback en cas d'erreur
- **FEATURE #2 - Notification staff pour modifications**:
  - Bannière dans le modal d'édition quand date/heure modifiée
  - Boutons "Suggérer ce créneau" / "Modifier sans notifier"
  - Badge "En attente de validation" sur les événements
- **FEATURE #3 - Heure de fin (endTime)**:
  - Time range picker (Début → Fin) dans les formulaires
  - Validation: heure de fin > heure de début

### Sprint Technique - Bugs & Features v2 (Feb 22, 2026) ✅ 
- Bug #1 - Bouton + observation FREEZE: Corrigé
- Bug #2 - Tournois "Participant" absents: Corrigé
- Bug #3 - Statut not_interested incohérent: Corrigé
- Feature #1 - Label Intéressé/Participant: Implémenté
- Feature #2 - "X tournois" badge: Implémenté
- Feature #3 - Auto-grisage tournois: Implémenté

### Core Features (Feb 2026) ✅
- User onboarding (7 steps), profile edit, logout
- Staff invitations avec liens de referral
- Calendrier avec dots colorés par type d'événement
- CRUD complet événements avec observations
- 137 tournois importés (ATP, WTA, ITF)
- Résidence fiscale Phase 1 & 2

## Key API Endpoints
- Events: GET/POST /api/events, PUT/DELETE /api/events/{id}
- Observations: POST /api/events/{id}/observations (avec parentId)
- Tournaments: GET /api/tournaments/weeks, POST /api/tournaments/register
- Residence: GET/POST /api/residence/days, /api/residence/stats

## Backlog

### P0 - Prochaine priorité
- **Phase 3 - Résidence Fiscale**: GPS background tracking + alertes push + PDF

### P1
- PDF export of documents
- Amélioration UI cartes tournois
- Fix tournament modal reactivity

### P2
- Push notifications système
- Export calendrier Google Calendar/iCal

## Architecture
```
/app
├── frontend/          # React Native (Expo)
│   ├── app/(tabs)/
│   │   ├── index.tsx     # Calendrier (SPRINT TECHNIQUE OK)
│   │   └── ...
│   └── src/components/
│       └── EventObservationSection.tsx  # ComposerBox isolé
├── backend/
│   └── routes/
│       ├── event_routes.py     # endTime, notify_staff, parentId
│       └── tournament_routes.py
```

## Test Reports
- /app/test_reports/iteration_21.json - Sprint 3 Backend (21/21 - 100%)
- /app/test_reports/iteration_22.json - Sprint Technique (8/8 - 100%) ✅ NEW
