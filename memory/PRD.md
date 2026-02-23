# Le Court Central - PRD

## Session du 23 Février 2026

### Toutes les Corrections Complétées

#### DB Critiques (CRITICAL) ✅
| Bug | Description | Status |
|-----|-------------|--------|
| **DB-4** | Systèmes d'ID utilisateur incompatibles | ✅ Corrigé |
| **DB-6** | Formats de dates incohérents (OCR) | ✅ Corrigé |

#### Frontend P2 (HIGH/MEDIUM) ✅
| Bug | Description | Status |
|-----|-------------|--------|
| **P2-8** | Impossible modifier/supprimer événements | ✅ Déjà implémenté |
| **P2-11** | État partagé entre modals residence | ✅ Corrigé |
| **P2-14** | Pas de message succès après ajout séjour | ✅ Déjà implémenté |
| **P2-16** | Suppression staff non-découvrable | ✅ Corrigé |
| **P2-20** | Titre modal tournoi incorrect | ✅ Corrigé |

#### Améliorations UI/UX (NEW) ✅
| Amélioration | Description | Status |
|--------------|-------------|--------|
| **Réactivité modal tournoi** | Mise à jour optimiste immédiate des statuts | ✅ Implémenté |
| **Homogénéité cartes** | Styles unifiés pour weekCard et weekCardSummary | ✅ Implémenté |
| **Boutons statut** | Nouveaux styles avec bordures et couleurs cohérentes | ✅ Implémenté |
| **Badges catégorie** | Typography améliorée avec letterSpacing | ✅ Implémenté |
| **Chips localisation** | Nouveaux styles avec bordures subtiles | ✅ Implémenté |
| **Modal tournoi** | Cards avec ombres, bordures et séparateurs | ✅ Implémenté |

### Détails des Améliorations UI

**Cartes de semaine (weekCard/weekCardSummary):**
- Bordures unifiées (`borderWidth: 1, borderColor: '#E5E7EB'`)
- Ombres améliorées (`shadowOpacity: 0.08`)
- Badge semaine avec background (`backgroundColor: '#1e3c7212'`)

**Modal détail tournoi:**
- Cards blanches avec ombres légères et bordures
- Séparateurs entre sections (`borderTopWidth: 1`)
- Badges de statut avec fond coloré
- Boutons de statut avec bordures et états actifs distincts

**Boutons d'inscription:**
- Padding augmenté (`paddingVertical: 12`)
- Bordures visibles (`borderWidth: 1, borderColor: '#E5E7EB'`)
- État actif bien différencié

### Fichiers Modifiés Cette Session
```
/app/backend/
├── routes/
│   ├── auth_helpers.py      # NOUVEAU - Auth centralisé
│   ├── residence_routes.py  # MODIFIÉ - userId depuis auth
│   └── tournament_routes.py # MODIFIÉ - userId depuis auth
└── server.py               # MODIFIÉ - Init auth + ISO dates

/app/frontend/app/(tabs)/
├── index.tsx               # MODIFIÉ - Réactivité + Homogénéité styles
├── profile.tsx             # MODIFIÉ - Icône suppression visible
└── residence.tsx           # MODIFIÉ - Reset état modals
```

## Tests Effectués
- API `/api/health` ✅
- API `/api/residence/days` POST/GET ✅
- API `/api/tournaments/weeks` ✅ (70 tournois, 35 semaines)
- Backend Lint Python ✅

## Backlog Restant

### P0 - Phase 3 Tax Residency (Long terme)
- GPS background tracking
- Push alerts pour seuils fiscaux
- Export PDF des rapports

### P1 - Moyenne priorité
- DB-7 & DB-8 : Tests complets statuts tournoi irréversibles

## Architecture Auth (après DB-4)
```
Request → Cookie/Header session_token
       → auth_helpers.get_current_user_id()
       → Lookup user_sessions collection
       → Return user_id (string: user_xxx)
       → Fallback "default-user" si non auth
```

## Credentials Test
- **User**: `testUser@example.com` / `testpassword123`
- **Admin**: `r.admin@gmail.com` / `allezparis75`
