# Le Court Central - PRD

## Sprint Interface Staff — Février 24, 2026

### Implémentation Complète

#### Étape 1 — Routing Player/Staff ✅
**Structure créée:**
```
app/
├── _layout.tsx              # MODIFIÉ: Ajout AuthProvider + routes (player)/(staff)
├── index.tsx                # MODIFIÉ: Redirection basée sur user.role
├── (player)/                # NOUVEAU
│   ├── _layout.tsx          # Tabs joueur avec garde de rôle
│   ├── index.tsx            # Calendrier joueur (copié de (tabs))
│   ├── vault.tsx            # Documents joueur
│   ├── residence.tsx        # Résidence fiscale
│   ├── profile.tsx          # Profil joueur
│   └── [autres fichiers]
└── (staff)/                 # NOUVEAU
    ├── _layout.tsx          # Tabs staff avec garde de rôle
    ├── dashboard.tsx        # Vue d'ensemble staff
    ├── calendar.tsx         # Calendrier (lecture/édition)
    ├── documents.tsx        # Documents avec filtres
    └── player-info.tsx      # Fiche joueur
```

#### Étape 2 — Types & Permissions ✅
**Fichiers créés:**
- `src/types/staff.ts` — Types `StaffRole`, `StaffPermissions`, `ROLE_PERMISSIONS`
- `src/components/PermissionGate.tsx` — Composant de contrôle d'accès

**Rôles supportés:**
| Rôle | canViewCalendar | canEditCalendar | canViewDocuments | canUploadDocuments | canViewFinances |
|------|-----------------|-----------------|------------------|--------------------| ----------------|
| tennis_coach | ✅ | ✅ | ✅ | ✅ | ❌ |
| physical_coach | ✅ | ✅ | ✅ | ✅ | ❌ |
| physio | ✅ | ❌ | ✅ | ✅ | ❌ |
| agent | ✅ | ✅ | ✅ | ✅ | ✅ |
| family | ✅ | ❌ | ✅ | ❌ | ❌ |

**Mapping backend → staff:**
- `technical` → `tennis_coach`
- `medical` → `physio`
- `logistics` → `physical_coach`
- `agent` → `agent`

#### Étape 3 — Écrans Staff ✅

**Dashboard (`dashboard.tsx`):**
- Header avec gradient + nom du staff + rôle
- Section "Cette semaine" avec événements du joueur
- Section "Alertes" avec badge compteur
- Section "Statut rapide" avec stats (classement, points, tournois)
- Pull-to-refresh

**Calendrier (`calendar.tsx`):**
- Calendrier français avec `react-native-calendars`
- Badge "Lecture seule" si pas de permission d'édition
- Liste des événements du jour sélectionné
- Événements en attente (`pending_approval`) affichés en grisé
- FAB "+" pour proposer un créneau (si `canEditCalendar`)
- Modal de proposition avec titre, heure début/fin, notes

**Documents (`documents.tsx`):**
- Liste des documents avec icônes par catégorie
- Montants masqués si `!canViewFinances`
- FAB upload si `canUploadDocuments`
- `RestrictedScreen` si `!canViewDocuments`

**Fiche Joueur (`player-info.tsx`):**
- Header avec avatar et nom du joueur
- Sections: Profil, Classement, Tournois confirmés, Préférences voyage
- Section "Résidence fiscale" uniquement si `canViewFinances`

### Logique de Redirection

```
index.tsx:
  Si authLoading → Loader
  Si web → Landing page Expo Go
  Si isNewUser → /onboarding
  Si user.role !== 'player' → /(staff)/dashboard
  Sinon → /(player)/
  Fallback → /(tabs)
```

### Non-régression
- Les fichiers `(tabs)` restent intacts pour rétro-compatibilité
- Les écrans joueur sont copiés dans `(player)` avec garde de rôle

### Fichiers Créés
```
/app/frontend/
├── app/(player)/_layout.tsx       # Layout tabs joueur
├── app/(staff)/_layout.tsx        # Layout tabs staff
├── app/(staff)/dashboard.tsx      # Dashboard staff
├── app/(staff)/calendar.tsx       # Calendrier staff
├── app/(staff)/documents.tsx      # Documents staff
├── app/(staff)/player-info.tsx    # Fiche joueur
├── src/types/staff.ts             # Types staff
└── src/components/PermissionGate.tsx # Composant permissions
```

### Fichiers Modifiés
```
/app/frontend/app/_layout.tsx      # Ajout AuthProvider + routes
/app/frontend/app/index.tsx        # Redirection selon rôle
```

## Backlog Restant

### Sprint Staff (À compléter)
- [ ] Tester connexion staff via invitation
- [ ] Vérifier proposition de créneaux
- [ ] Notifications push au joueur
- [ ] Endpoint `PATCH /api/events/{id}/approve`

### P0 - Phase 3 Tax Residency
- GPS background tracking
- Alertes push seuils fiscaux
- Export PDF

## Credentials Test
- **Player**: `testUser@example.com` / `testpassword123`
- **Admin**: `r.admin@gmail.com` / `allezparis75`
