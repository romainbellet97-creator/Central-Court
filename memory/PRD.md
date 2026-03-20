# Le Court Central - PRD

## Application
Tennis player management app (React Native/Expo + FastAPI/MongoDB) with role-based access for Players and Staff.

## Sprint Interface Staff — Février 24, 2026

### Implémentation Complète

#### Étape 1 — Routing Player/Staff ✅
Structure `app/(player)/` et `app/(staff)/` avec tabs séparés.

#### Étape 2 — Types & Permissions ✅
`src/types/staff.ts`, `src/components/PermissionGate.tsx`

#### Étape 3 — Écrans Staff ✅ (structure)
Dashboard, Calendrier, Documents, Fiche Joueur (placeholder UI en place).

### Logique de Redirection ✅
index.tsx redirige vers `/(player)/` ou `/(staff)/dashboard` selon le rôle.

## Bug Fixes Complétés

### DB-4: Incompatible User IDs ✅
`backend/routes/auth_helpers.py` centralisé avec `get_current_user_id`.

### DB-6: Inconsistent Date Formats ✅
OCR helper retourne toujours `YYYY-MM-DD`.

### P0: Data Isolation Vulnerability ✅ (Février 26, 2026)
**RÉSOLU** — Audit complet et correction de tous les endpoints vulnérables:
- `event_routes.py`: GET/POST/PUT/DELETE + observations → filtrage par userId ✅
- `alert_routes.py`: GET/POST/read/dismiss/read-all/generate → filtrage par userId ✅
- `documents.py`: GET list/single/POST/PUT/DELETE/export PDF → filtrage par userId ✅
- `preference_routes.py`: GET/PUT → remplacement de "demo-user" par auth ✅
- **Test**: 16/16 tests passés (pytest) — isolation vérifiée entre 2 utilisateurs distincts

### Keyboard Avoidance ✅
Modals "Invite Member" et "Add Observation" corrigés avec `KeyboardAvoidingView`.

### Staff Login/Signup ✅
Formulaire email/password staff + endpoint `POST /api/auth/staff-login`.

## Backlog Restant

### Sprint Staff (P1 — À compléter)
- [ ] Backend: `POST /api/notifications/push`
- [ ] Backend: `PATCH /api/events/{id}/approve`
- [ ] Refactorer calendrier joueur en composant réutilisable (prop `readOnly`)
- [ ] Implémenter data fetching dans tous les écrans staff
- [ ] Peupler `staffRole`, `staffRoleLabel`, `linkedPlayerId` dans AuthContext

### DB-7 & DB-8 (P1)
- [ ] Corriger changements irréversibles de statut des tournois
- [ ] Masquage d'un tournoi ne doit pas supprimer les données d'inscription

### Nettoyage technique (P1)
- [ ] Supprimer l'ancien dossier `app/(tabs)/` (dupliqué avec `app/(player)/`)

### Phase 3 Tax Residency (P2)
- [ ] GPS background tracking
- [ ] Alertes push seuils fiscaux
- [ ] Export PDF résidence fiscale

## Credentials Test
- **Player**: Google Auth (bouton "Joueur - Connexion Google")
- **Staff**: `coach@gmail.com` + mot de passe créé à l'inscription
- **Admin**: `r.admin@gmail.com` / `allezparis75`

## Architecture
```
backend/routes/
├── auth_helpers.py      # Auth centralisé (get_current_user_id, require_user_id)
├── event_routes.py      # SÉCURISÉ ✅
├── alert_routes.py      # SÉCURISÉ ✅
├── documents.py         # SÉCURISÉ ✅
├── preference_routes.py # SÉCURISÉ ✅
├── residence_routes.py  # SÉCURISÉ ✅
├── tournament_routes.py # SÉCURISÉ ✅
├── invitation_routes.py # Staff invitations
├── user_routes.py       # User management
├── admin_routes.py      # Admin
└── email_routes.py      # Email service

frontend/app/
├── (player)/            # Écrans joueur
├── (staff)/             # Écrans staff
├── (tabs)/              # LEGACY — à supprimer
├── _layout.tsx          # Root layout + role routing
├── login.tsx            # Login unifié
└── index.tsx            # Redirection
```
