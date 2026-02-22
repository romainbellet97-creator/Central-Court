# Le Court Central - PRD

## Original Problem Statement
Application professionnelle de tennis: FastAPI + MongoDB + React Native (Expo)

## Completed Features (Feb 2026)

### Core
- User onboarding (7 steps), profile edit, logout, staff invitations, OCR

### Sprint 3 - Refonte UI Événements (Feb 22, 2026) ✅ NEW
#### Features implémentées:
- **FEATURE #1 - Système observations inline**: 
  - Nouveau composant `EventObservationSection.tsx` avec threaded replies
  - Support parentId pour les réponses aux observations
  - Optimistic updates + rollback en cas d'erreur
  - Interface moderne avec avatars, dates relatives, compteur
- **FEATURE #2 - Notification staff pour modifications**:
  - Bannière dans le modal d'édition quand date/heure modifiée
  - Boutons "Suggérer ce créneau" / "Modifier sans notifier"
  - Création automatique de notification pour le staff assigné
  - Badge "En attente de validation" sur les événements
- **FEATURE #3 - Heure de fin (endTime)**:
  - Time range picker (Début → Fin) dans les formulaires
  - Validation: heure de fin > heure de début
  - Auto-calcul heure de fin (+1h par défaut)
  - Affichage "09:00 → 10:00" dans le modal de détail

### Sprint Technique - Bugs & Features v2 (Feb 22, 2026) ✅ 
#### Bugs corrigés:
- **Bug #1 - Bouton + observation FREEZE**: Corrigé - remplacé par composant inline
- **Bug #2 - Tournois "Participant" absents**: Corrigé - fusion événements + tournois
- **Bug #3 - Statut not_interested incohérent**: Corrigé - rendu unifié
- **Bug #4 - Vue tournois trop dense**: Corrigé - card résumée "X tournois"

#### Features implémentées:
- **Feature #1 - Label Intéressé/Participant**: Badge dynamique correct
- **Feature #2 - "X tournois" badge**: Badge violet avec chips localisation
- **Feature #3 - Auto-grisage tournois**: Blocage automatique des autres tournois

### Tournois - Base de données restaurée (Feb 18, 2026) ✅
- **137 tournois importés** avec données complètes (ATP, WTA, ITF)
- **Données enrichies**: Prize money, drapeaux, surface, dates, villes

### Calendrier & Événements - COMPLET (Feb 18, 2026) ✅
- **Calendrier avec dots colorés** par type d'événement
- **CRUD complet**: Créer, modifier, supprimer événements
- **Apple-style wheel pickers** pour type, date et heure
- **Système d'observations staff** avec threaded replies
- **FAB button** + **Modal détail** avec actions

### Résidence Fiscale - Phase 1 & 2 (Feb 12, 2026) ✅
- Dashboard des jours par pays avec alertes visuelles
- GPS Tracking automatique avec bouton "Aujourd'hui"
- Saisie facilitée avec DatePicker natif

## Key API Endpoints
- POST /api/users/onboarding, PUT /api/users/profile/{user_id}
- GET /api/tournaments/weeks, /conflicts/{id}, /register, /hide
- GET /api/tournaments/stats
- GET /api/documents, POST /api/documents, PUT/DELETE /api/documents/{id}
- POST /api/invoices/analyze-base64 (OCR)
- GET /api/residence/countries, /stats, /days
- POST /api/residence/days, /days/bulk
- PUT /api/residence/days/{date}
- DELETE /api/residence/days/{date}
- **Events API**:
  - GET /api/events?month=YYYY-MM - Liste événements
  - POST /api/events - Créer événement (avec endTime)
  - PUT /api/events/{id} - Modifier (avec notify_staff, pending_validation)
  - DELETE /api/events/{id} - Supprimer
  - POST /api/events/{id}/observations - Ajouter observation (avec parentId)

## Backlog

### P0 - Prochaine priorité
- **Phase 3 - Résidence Fiscale**: Tracking GPS background + alertes push + génération de rapports PDF
  - Dépendances installées: expo-location, expo-task-manager, expo-background-fetch

### P1
- PDF export of documents
- Élargir les cartes tournois + homogénéité visuelle
- Fix tournament modal reactivity

### P2
- Invitation emails via Resend
- Push notifications système
- Deadline reminders
- Export calendrier vers Google Calendar/iCal

## Architecture
```
/app
├── frontend/          # React Native (Expo)
│   ├── app/(tabs)/
│   │   ├── index.tsx     # Calendrier/Tournois (REFACTORISÉ Sprint 3)
│   │   ├── vault.tsx     # Documents
│   │   ├── residence.tsx # Résidence fiscale
│   │   └── profile.tsx
│   └── src/
│       ├── components/
│       │   └── EventObservationSection.tsx  # NEW Sprint 3
│       └── services/api.ts
├── backend/
│   ├── server.py
│   └── routes/
│       ├── event_routes.py     # UPDATED Sprint 3
│       ├── residence_routes.py
│       ├── tournament_routes.py
│       └── documents.py
```

## Test Reports
- /app/test_reports/iteration_16.json - Phase 1 (20/20 tests)
- /app/test_reports/iteration_17.json - Phase 2 (23/23 tests)
- /app/test_reports/iteration_18.json - Bug Fix P1 (62/62 tests)
- /app/test_reports/iteration_19.json - Sprint Bugs v1 (6/6 - 100%)
- /app/test_reports/iteration_21.json - Sprint 3 Backend (21/21 - 100%) ✅ NEW
