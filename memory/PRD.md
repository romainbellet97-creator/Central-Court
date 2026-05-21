# Le Court Central - PRD & Roadmap

## Application
Tennis player management app (React Native/Expo + FastAPI/MongoDB) with role-based access for Players and Staff.

---

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
├── (tabs)/              # LEGACY — à supprimer (P1)
├── _layout.tsx          # Root layout + role routing
├── login.tsx            # Login unifié
└── index.tsx            # Redirection
```

## Credentials Test
- **Player**: Google Auth (bouton "Joueur - Connexion Google")
- **Staff**: `coach@gmail.com` + mot de passe créé à l'inscription
- **Admin**: `r.admin@gmail.com` / `allezparis75`

---

## Bug Fixes & Sprints Complétés

### Sprint Interface Staff — Février 24, 2026 ✅
- Routing Player/Staff (`app/(player)/` + `app/(staff)/`)
- Types & Permissions (`src/types/staff.ts`, `PermissionGate.tsx`)
- Écrans Staff (Dashboard, Calendrier, Documents, Fiche Joueur)
- Redirection automatique selon le rôle

### DB-4: Incompatible User IDs ✅
`auth_helpers.py` centralisé avec `get_current_user_id`.

### DB-6: Inconsistent Date Formats ✅
OCR helper retourne toujours `YYYY-MM-DD`.

### P0: Data Isolation Vulnerability ✅ (Février 26, 2026)
Audit complet + correction de tous les endpoints. 16/16 tests passés.

### Counter-Proposal UX — Mai 2026 ✅
- Flux complet joueur ↔ staff (propose → accepte/refuse/reschedule → confirme)
- `RespondEventRequest` modèle Pydantic avec champs optionnels (note, alternativeDate/Time)
- Endpoint `PUT /{event_id}/confirm-reschedule` implémenté
- `targetSlot` dans les alertes de proposition
- Wheel pickers (AppleDatePicker/AppleTimePicker) dans les modals de réponse
- Tous les rôles staff (coach, physio, agent, famille) bénéficient du même flux
- Nom complet de l'événement visible dans les notifications
- Keyboard UX amélioré (blurOnSubmit, Keyboard.dismiss, returnKeyType)

### Code Review — Mai 2026 ✅
- Lookup table remplace les ternaires imbriqués (info modal staff)
- `asyncio.gather()` pour livraison d'alertes en parallèle
- `LEGACY_EVENT_TYPE_ALIASES` module-level + `useMemo` sur `eventTypeOptions`
- Interface `CalendarEvent` typée (availableSlots, slotDuration — suppression des `as any`)
- Spacer `<View>` remplacés par `marginTop` sur les éléments adjacents

---

## Roadmap Priorisée

### P0 — Sécurité Critique (à faire avant tout déploiement prod)

- [ ] **Restreindre CORS** — remplacer `allow_origins=["*"]` par la liste des domaines autorisés
- [ ] **Supprimer la clé secrète codée en dur** — `ADMIN_SECRET_KEY` doit être obligatoire au démarrage (lever une exception si absent)
- [ ] **Migrer les mots de passe staff vers bcrypt** — sha256 utilisé actuellement, incompatible avec le niveau de sécurité des joueurs
- [ ] **Rate limiting sur les endpoints d'auth** — slowapi ou equivalent (login, register, OCR)
- [ ] **Authentifier l'endpoint OCR** — `POST /api/ocr/analyze-receipt` est actuellement public

### P1 — Nettoyage Architecture (dette technique)

- [ ] **Supprimer `app/(tabs)/`** — dossier legacy dupliqué de `app/(player)/`
- [ ] **Migrer le stockage des documents de base64 vers S3/GCS** — stocker des blobs en MongoDB ne passe pas à l'échelle
- [ ] **Persistance des messages** — la feature messages n'a pas de collection MongoDB dédiée ; ajouter `messages` et `channels`
- [ ] **Logging structuré** — ajouter loguru ou structlog (actuellement aucun logging en production)
- [ ] **Peupler `staffRole`, `staffRoleLabel`, `linkedPlayerId` dans AuthContext** — valeurs manquantes dans le contexte global
- [ ] **Supprimer les données mock** — `staffV1.ts`, `eventsV1.ts`, `alertsV1.ts`, `tournamentsV1.ts` sont des données de dev référencées dans le code frontend

### P1 — Fonctionnalités Incomplètes

- [ ] **Push notifications (APNs/FCM)** — actuellement uniquement des alertes in-app via polling ; implémenter `expo-notifications` avec tokens de device
- [ ] **Export PDF résidence fiscale** — endpoint backend prévu, UI non connectée
- [ ] **DB-7 & DB-8** — Corriger les changements irréversibles de statut tournoi + masquage qui ne supprime pas les données d'inscription
- [ ] **Contexte multi-joueurs pour le staff** — un agent peut gérer plusieurs joueurs mais l'UI ne reflète pas encore ce cas

### P2 — Dashboard Admin

- [ ] **UI complète admin** — Charts métriques (inscriptions, activité), gestion des rôles, modification des invitations
- [ ] **Gestion des utilisateurs** — Activer/désactiver comptes, réinitialiser mots de passe depuis l'admin

### P2 — UX & Qualité

- [ ] **Recherche / filtres** — sur les événements, documents, tournois (actuellement aucune fonctionnalité de recherche)
- [ ] **Validation des mots de passe** — imposer une longueur minimale et une complexité lors de l'inscription
- [ ] **Dark mode** — ThemeProvider en place mais un seul thème défini
- [ ] **Gestion des erreurs globale** — ajouter un Error Boundary React dans `_layout.tsx`
- [ ] **Validation des tokens de session côté web** — session dans localStorage exposée aux XSS ; utiliser HTTPOnly cookies sur web

### P3 — Nouvelles Fonctionnalités

- [ ] **Intégration Stripe** — dépendance déjà dans requirements.txt mais non implémentée ; facturation staff, paiement prestations
- [ ] **Planification vidéo/appel** — intégrer un lien Zoom/Teams/Google Meet dans les événements
- [ ] **Détection d'anomalies fiscales** — alertes automatiques quand le joueur approche des seuils (90, 120, 180 jours)
- [ ] **Internationalisation (i18n)** — l'app est intégralement en français ; ajouter l'anglais comme langue alternative
- [ ] **Analytics / télémétrie** — suivi des actions utilisateurs (Mixpanel, Amplitude, ou PostHog)
- [ ] **Mode hors-ligne** — cache des événements et du calendrier pour consultation sans réseau
- [ ] **Visualisation du tableau de tournoi** — draw visualization pour les Grand Chelems / Masters 1000
- [ ] **Statistiques de performance** — charge d'entraînement, résultats de matchs, courbe de classement ATP/WTA
- [ ] **Documentation API (OpenAPI)** — auto-générer et exposer Swagger UI depuis FastAPI

---

## Bilan Technique — Mai 2026

### Forces
| Domaine | Détail |
|---------|--------|
| RBAC complet | 5 rôles staff avec permissions granulaires (proposableTypes, canEditCalendar, canCreateBrandActivation) |
| Isolation des données | Chaque endpoint filtre par userId — vérifié par 16 tests automatisés |
| Flux contre-proposition | Round-trip complet : propose → répond → confirme, avec alertes à chaque étape |
| OCR documents | Tesseract intégré, extraction montant/date/fournisseur avec score de confiance |
| Onboarding progressif | 8 étapes fluides, stockage local entre étapes, validation à chaque niveau |
| Suivi fiscal | Géolocalisation + saisie manuelle, seuil 183 jours par pays |
| Sync calendrier | Import/export device calendar via expo-calendar |
| UX date/heure | Wheel pickers natifs (AppleDatePicker/AppleTimePicker) cohérents partout |
| Alertes parallèles | asyncio.gather() pour livraison multi-staff simultanée |
| Invitations par token | Email + lien de connexion, expiration 30 jours, rôle pré-assigné |

### Faiblesses Actives
| Sévérité | Problème |
|----------|---------|
| 🔴 Critique | CORS ouvert (`allow_origins=["*"]`) |
| 🔴 Critique | Clé admin codée en dur (`"lecourtcentral-admin-secret-2026"`) |
| 🔴 Critique | Mots de passe staff en SHA256 (vs bcrypt pour les joueurs) |
| 🟡 Haut | Session token dans localStorage sur web (XSS) |
| 🟡 Haut | Aucun rate limiting sur les endpoints d'auth |
| 🟡 Haut | Endpoint OCR public (pas d'authentification) |
| 🟠 Moyen | Documents stockés en base64 dans MongoDB (scalabilité) |
| 🟠 Moyen | `app/(tabs)/` — dossier legacy non supprimé |
| 🟠 Moyen | Messages sans persistance MongoDB |
| 🟠 Moyen | Aucun logging structuré en production |
| 🟢 Faible | Données mock (staffV1, eventsV1…) encore dans le code |
| 🟢 Faible | Aucune validation de complexité pour les mots de passe |
