# Le Court Central - PRD

## Original Problem Statement
Application professionnelle de tennis: FastAPI + MongoDB + React Native (Expo)

## Completed Features (Feb 2026)

### Core
- User onboarding (7 steps), profile edit, logout, staff invitations, OCR

### 🆕 Sprint Technique - Bugs & Features v2 (Feb 22, 2026) ✅ 
#### Bugs corrigés:
- **Bug #1 - Bouton + observation FREEZE**: Corrigé
  - Ajouté backdrop cliquable et `onRequestClose` au modal d'observation
  - Le modal s'ouvre sans freezer l'interface
  - Navigation reste fonctionnelle après utilisation
- **Bug #2 - Tournois "Participant" absents**: Corrigé
  - Fusion des événements manuels avec les tournois "participating" dans `dayEvents`
  - Carte tournoi spéciale avec badge "En tournoi", niveau (ATP 500), drapeaux, dates
  - Clic sur un jour couvert par un tournoi affiche maintenant le tournoi
- **Bug #3 - Statut not_interested incohérent**: Corrigé
  - Rendu unifié pour tous les tournois `not_interested` ou `hidden`
  - Affiche UNIQUEMENT le bouton "👁 Rétablir", pas les autres boutons de statut
- **Bug #4 - Vue tournois trop dense**: Corrigé
  - Card résumée pour semaines avec 2+ tournois
  - Badge "🎾 X tournois" violet
  - Chips de localisation avec drapeaux
  - Bouton "Voir le détail" vers le modal complet

#### Features implémentées:
- **Feature #1 - Label Intéressé/Participant**: Le badge affiche le bon statut dynamiquement
- **Feature #2 - "X tournois" badge**: Badge violet avec chips de localisation
- **Feature #3 - Auto-grisage tournois**: Les autres tournois de la semaine sont automatiquement grisés

### Tournois - Base de données restaurée (Feb 18, 2026) ✅
- **137 tournois importés** avec données complètes:
  - 70 tournois ATP (Grand Chelem, Masters 1000, ATP 500, ATP 250, ATP Finals)
  - 40 tournois WTA (Grand Chelem, WTA 1000, WTA 500, WTA 250, WTA Finals)
  - 12 tournois ITF (M25, M15, W25, W15)
  - 15 tournois ITF Wheelchair
- **Données enrichies** : Prize money, drapeaux 🇫🇷, surface, dates, villes, catégories
- Script d'import: `/app/backend/scripts/import_user_tournaments.py`

### Calendrier & Événements - RESTAURATION COMPLÈTE (Feb 18, 2026) ✅
- **Calendrier avec dots colorés** par type d'événement:
  - 🎾 Entraînement Tennis (vert #10B981)
  - 💪 Préparation Physique (orange #F59E0B)
  - 🏆 Match (rouge #EF4444)
  - 🎯 Tournoi (violet #8B5CF6)
  - 🧘 Récupération (cyan #06B6D4)
  - 📋 Réunion (gris #6B7280)
  - 🏥 Médical (rose #E91E63)
  - ✈️ Voyage (violet #9C27B0)
- **CRUD complet** : Créer, modifier, supprimer événements
- **Apple-style wheel pickers** pour type, date et heure
- **Système de commentaires/observations staff**:
  - Ajout d'observations avec auteur et rôle
  - Affichage temps relatif (Il y a 2h, Hier, etc.)
  - Badge compteur d'observations sur les cartes événements
- **FAB button** flottant pour ajout rapide
- **Modal détail événement** avec :
  - Header coloré par type
  - Section notes
  - Liste observations staff avec nom/rôle
  - Boutons Modifier / Supprimer

### Tournaments (Phase 1-3)
- Country flags, future-only filtering, "Pas intéressé" hide/unhide
- Multi-filter: surface, level, prize money, country
- Category badges (ATP 500, Masters 1000, Grand Chelem)
- Simplified statuses: pending → Participant/Décliné
- Conflict detection: GET /api/tournaments/conflicts/{id}

### Documents - REDESIGN
- Monthly view with slider (prev/next month)
- Monthly total with category breakdown (progress bars + percentages)
- Receipts grouped by day (Aujourd'hui, Hier, date)
- Category icons: Transport, Hébergement, Restauration, Médical, Équipement, Services, Autre
- FAB camera button for quick receipt scanning
- OCR integration with verification modal
- Upload: camera, gallery, PDF file picker

### Résidence Fiscale - Phase 1 (Feb 12, 2026)
- Nouvel onglet "Résidence" dans la tab bar avec icône globe
- Dashboard des jours par pays avec barres de progression
- Alertes visuelles pour seuils fiscaux (75% warning, 100% critical)
- API Backend complète pour CRUD des jours de présence
- Calcul automatique des pourcentages de seuil (183 jours)

### Résidence Fiscale - Phase 2 (Feb 12, 2026) ✅
- **GPS Tracking automatique** :
  - Détection du pays actuel via expo-location
  - Bouton "Aujourd'hui" pour enregistrer la présence GPS en 1 clic
  - Prévention de double enregistrement le même jour
  - Status "confirmed" pour GPS vs "manual" pour saisie manuelle
- **Saisie facilitée** :
  - DatePicker natif pour sélection de dates
  - Indicateur de durée pour les séjours (bulk)
  - Suggestion GPS dans le modal d'ajout de jour
- **Paramètres GPS** :
  - Modal de configuration avec Switch on/off
  - Affichage du statut de permission
  - Message de confidentialité des données

### Bug Fix P1 - Modification des périodes (Feb 13, 2026) ✅
- **Backend** : Nouvel endpoint PUT /api/residence/days/{date}
- **Frontend** : Modal d'édition dans residence.tsx

### OCR Module - Correction (Feb 13, 2026) ✅
- Migration vers Emergent LLM Key (clé universelle)
- GPT-4o Vision pour analyse d'images de factures

## Key API Endpoints
- POST /api/users/onboarding, PUT /api/users/profile/{user_id}
- GET /api/tournaments/weeks, /conflicts/{id}, /register, /hide
- GET /api/tournaments/stats - Statistiques (total: 137, byCircuit)
- GET /api/documents, POST /api/documents, PUT/DELETE /api/documents/{id}
- POST /api/invoices/analyze-base64 (OCR)
- GET /api/residence/countries, /stats, /days
- POST /api/residence/days, /days/bulk
- PUT /api/residence/days/{date}
- DELETE /api/residence/days/{date}
- **Events API**:
  - GET /api/events?month=YYYY-MM - Liste événements
  - POST /api/events - Créer événement
  - PUT /api/events/{id} - Modifier événement
  - DELETE /api/events/{id} - Supprimer événement
  - POST /api/events/{id}/observations - Ajouter observation staff

## Backlog

### P0 - En cours
- **Phase 3 - Résidence Fiscale**: Tracking GPS background + alertes push + génération de rapports PDF
  - Dépendances installées: expo-location, expo-task-manager, expo-background-fetch
  - À créer: frontend/services/geolocationService.ts, backend/routes/tax_residency_routes.py

### P1
- PDF export of documents
- Élargir les cartes tournois + homogénéité visuelle

### P2
- Invitation emails via Resend
- Push notifications
- Deadline reminders
- "Pas intéressé" - demander la raison
- Export calendrier vers Google Calendar/iCal
- UI de reprogrammation des conflits de calendrier

## Architecture
```
/app
├── frontend/          # React Native (Expo)
│   ├── app/(tabs)/
│   │   ├── index.tsx     # Calendrier/Tournois
│   │   ├── vault.tsx     # Documents
│   │   ├── residence.tsx # Résidence fiscale (GPS + manual)
│   │   └── profile.tsx
│   └── src/services/api.ts
├── backend/
│   ├── server.py
│   └── routes/
│       ├── residence_routes.py
│       ├── tournament_routes.py
│       ├── documents.py
│       └── user_routes.py
```

## Test Reports
- /app/test_reports/iteration_16.json - Phase 1 (20/20 tests)
- /app/test_reports/iteration_17.json - Phase 2 (23/23 tests)
- /app/test_reports/iteration_18.json - Bug Fix P1 (62/62 tests)
- /app/test_reports/iteration_19.json - Sprint Bugs & Features (6/6 - 100%) ✅ NEW
