# Le Court Central - PRD

## Original Problem Statement
Application professionnelle de tennis: FastAPI + MongoDB + React Native (Expo)

## Completed Features (Feb 2026)

### Sprint Bugs Factures, Caméra & Onboarding (Feb 22, 2026) ✅ NEW
#### Bugs corrigés:
- **BUG #1 - Facture non mise à jour**: 
  - Navigation automatique vers le mois de la facture après sauvegarde
  - Utilise la date extraite par l'IA (pas new Date())
  - setCurrentMonth/setCurrentYear avec la date de la facture
- **BUG #2 - Caméra ne fonctionne pas au retour**:
  - useFocusEffect pour relire permissions à chaque focus
  - AppState listener pour reset des verrous au retour foreground
  - isProcessingRef.current = false au retour de l'app
- **BUG #3 - ATP/WTA sélectionnables simultanément**:
  - MUTUALLY_EXCLUSIVE = ['ATP', 'WTA']
  - Sélectionner ATP désélectionne WTA automatiquement et vice-versa
  - ITF et ITF_WHEELCHAIR non affectés
- **BUG #4 - Saisie invisible invitation staff**:
  - Style formInput avec color: '#333' déjà en place
  - placeholderTextColor: '#999' pour le placeholder

### Sprint Technique - Bugs Clavier, Tournois & Affichage (Feb 22, 2026) ✅
- BUG #1 - Clavier observation: ComposerBox isolé avec state local
- BUG #2 - Freeze calendrier tournoi: Logique immutée
- FEATURE #3 - Affichage événements amélioré: Heure début → fin + durée

### Sprint 3 - Refonte UI Événements (Feb 22, 2026) ✅
- Système observations inline avec threaded replies
- Notification staff pour modifications date/heure
- Champs heure de fin (endTime) dans formulaires

### Core Features (Feb 2026) ✅
- User onboarding (7 steps), profile edit, logout
- Staff invitations avec liens de referral
- Calendrier avec dots colorés par type d'événement
- CRUD complet événements avec observations
- 137 tournois importés (ATP, WTA, ITF)
- Résidence fiscale Phase 1 & 2
- OCR factures avec extraction automatique

## Key API Endpoints
- Documents: GET/POST /api/documents, PUT/DELETE /api/documents/{id}
- OCR: POST /api/invoices/analyze-base64
- Events: GET/POST /api/events, PUT/DELETE /api/events/{id}
- Tournaments: GET /api/tournaments/weeks, POST /api/tournaments/register

## Backlog

### P0 - Prochaine priorité
- **Phase 3 - Résidence Fiscale**: GPS background tracking + alertes push + PDF

### P1
- PDF export of documents
- Amélioration UI cartes tournois

### P2
- Push notifications système
- Export calendrier Google Calendar/iCal

## Architecture
```
/app
├── frontend/          # React Native (Expo)
│   ├── app/(tabs)/
│   │   ├── vault.tsx     # Factures (BUG #1, #2 FIX)
│   │   ├── profile.tsx   # Invitation (BUG #4 FIX)
│   │   └── index.tsx     # Calendrier
│   └── app/onboarding/
│       └── step3-circuits.tsx  # ATP/WTA (BUG #3 FIX)
├── backend/
│   └── routes/
│       ├── documents.py
│       └── event_routes.py
```

## Test Reports
- /app/test_reports/iteration_21.json - Sprint 3 Backend (21/21 - 100%)
- /app/test_reports/iteration_22.json - Sprint Technique (8/8 - 100%)
- /app/test_reports/iteration_23.json - Bugs Factures/Caméra (7/7 - 100%) ✅ NEW
