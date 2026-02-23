# Le Court Central - PRD

## Session du 23 Février 2026

### Corrections Complétées

#### DB Critiques (CRITICAL)
| Bug | Description | Status |
|-----|-------------|--------|
| **DB-4** | Systèmes d'ID utilisateur incompatibles | ✅ Corrigé |
| **DB-6** | Formats de dates incohérents (OCR) | ✅ Corrigé |

**Implémentation DB-4:**
- Créé `/app/backend/routes/auth_helpers.py` avec `get_current_user_id(request)`
- Modifié `residence_routes.py`: tous les endpoints utilisent le vrai userId depuis l'auth
- Modifié `tournament_routes.py`: tous les endpoints utilisent le vrai userId
- Fallback `"default-user"` pour rétro-compatibilité

**Implémentation DB-6:**
- `server.py > extract_date_from_text()` retourne maintenant ISO 8601 (`YYYY-MM-DD`)
- Avant: `15/01/2026` → Après: `2026-01-15`

#### Frontend P2 (HIGH/MEDIUM)
| Bug | Description | Status |
|-----|-------------|--------|
| **P2-8** | Impossible modifier/supprimer événements | ✅ Déjà implémenté |
| **P2-11** | État partagé entre modals residence | ✅ Corrigé |
| **P2-14** | Pas de message succès après ajout séjour | ✅ Déjà implémenté |
| **P2-16** | Suppression staff non-découvrable | ✅ Corrigé |
| **P2-20** | Titre modal tournoi incorrect | ✅ Corrigé |

**Implémentation P2-11:**
- `residence.tsx`: Reset `notes`, `showNotesField`, `selectedCountry` à la fermeture des modals
- Modal "Ajouter un jour" et "Ajouter un séjour" réinitialisent l'état

**Implémentation P2-16:**
- `profile.tsx`: Ajout icône de suppression visible (❌) à côté de chaque membre actif
- Le long-press reste disponible comme alternative

**Implémentation P2-20:**
- `index.tsx`: Titre du modal = nom du tournoi (si 1 seul) ou "Tournois de la semaine X" (si plusieurs)

### Corrections DB Précédentes
| # | Bug | Fix |
|---|-----|-----|
| DB-2 | Isolation day_presences | userId sur tous les documents |
| DB-3 | Isolation tournament_registrations | userId sur register/hide |
| DB-7 | hide supprime registration | previousStatus sauvegardé |
| DB-8 | Auto-hiding irréversible | autoHidden + hiddenByTournament |
| DB-9 | Sessions infinies | TTL index sur expires_at |
| DB-12 | Année hardcodée | datetime.now().year |
| DB-13 | IDs courts 8-char | UUID complet |

### Fichiers Modifiés
```
/app/backend/
├── routes/
│   ├── auth_helpers.py      # NOUVEAU
│   ├── residence_routes.py  # MODIFIÉ
│   └── tournament_routes.py # MODIFIÉ
└── server.py               # MODIFIÉ

/app/frontend/app/(tabs)/
├── index.tsx               # MODIFIÉ (P2-20)
├── profile.tsx             # MODIFIÉ (P2-16)
└── residence.tsx           # MODIFIÉ (P2-11)
```

## Backlog Restant

### P1 - Haute Priorité
- DB-7 & DB-8 : Tests complets des changements de statut tournoi

### P2 - Moyenne Priorité
- Améliorer la réactivité du modal tournoi
- Homogénéité des cartes tournoi

### P0 - Phase 3 (Backlog Long Terme)
- Géolocalisation automatique avec tracking GPS
- Alertes push pour seuils fiscaux
- Export PDF des rapports de résidence

## Credentials Test
- **User**: `testUser@example.com` / `testpassword123`
- **Admin**: `r.admin@gmail.com` / `allezparis75`

## Architecture Technique

### Auth Flow (après DB-4)
```
Request → Cookie/Header session_token
       → auth_helpers.get_current_user_id()
       → Lookup user_sessions collection
       → Return user_id (string format: user_xxx)
       → Fallback "default-user" si non auth
```

### Date Format Standard (après DB-6)
- **Stockage**: `YYYY-MM-DD` (ISO 8601)
- **Affichage**: `DD/MM/YYYY` ou `D MMMM YYYY` (localisé)
- **API**: Toujours ISO 8601
