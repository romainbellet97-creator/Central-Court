# Le Court Central - PRD

## Completed Bug Fixes (Feb 22, 2026)

### Sprint UX Bugs - 22 Corrections ✅ NEW

#### 🔴 CRITIQUE (6 bugs)
1. ~~Mois initial hardcodé~~ → Déjà fixé (utilise `today.substring(0,7)`)
2. ~~Loading state inscription tournoi~~ → À implémenter (P1)
3. **URL invitation hardcodée** → Utilise `EXPO_PUBLIC_BACKEND_URL`
4. **Pas de retour OCR échoue** → Alerte "OCR non disponible"
5. **Devise toujours €** → `getCurrencySymbol(doc.currency)`
6. **Pas de retour erreur ajout jour** → Alerte succès/échec

#### 🟠 ÉLEVÉ (10 bugs)
7. ~~Modification document~~ → À implémenter (P2)
8. ~~Supprimer/modifier événement~~ → Déjà fonctionnel
9. ~~Navigation mois futurs~~ → À implémenter (P2)
10. ~~Champ date validation~~ → À implémenter (P2)
11. **État notes partagé modaux** → Reset `showNotesField` 
12. ~~Sélecteur pays code~~ → À améliorer (P2)
13. ~~Date picker séjour limite~~ → À implémenter (P2)
14. **Pas message succès séjour** → Alerte avec nombre de jours
15. **Chargement profil échec** → Alerte + bouton réessayer
16. ~~Suppression membre appui long~~ → Documentation UX

#### 🟡 MOYEN (6 bugs)
17. **Valeur 0 = undefined** → `isNaN()` check explicite
18. **Bug fuseau horaire suppression** → `formatDateStringDisplay()`
19. **Bug fuseau horaire liste** → `parseDateString()`
20. ~~Titre modal tournoi 1er~~ → À améliorer (P2)
21. **Validation email invitation** → Regex email
22. **Catégorie Équipement vs Matériel** → OCR_CATEGORIES aligné

### Bugs Corrigés Cette Session

| # | Bug | Fichier | Fix |
|---|-----|---------|-----|
| 3 | URL invitation | profile.tsx | `process.env.EXPO_PUBLIC_BACKEND_URL` |
| 4 | OCR sans feedback | vault.tsx | `Alert.alert('OCR non disponible')` |
| 5 | Devise hardcodée | vault.tsx | `getCurrencySymbol(doc.currency)` |
| 6 | Erreur ajout jour | residence.tsx | `Alert.alert('Erreur')` |
| 11 | Notes partagées | residence.tsx | `setShowNotesField(false)` reset |
| 14 | Message succès séjour | residence.tsx | `Alert.alert` avec nb jours |
| 15 | Chargement profil | profile.tsx | `Alert.alert` + Réessayer |
| 17 | 0 = undefined | vault.tsx | `isNaN()` explicit check |
| 18/19 | Fuseau horaire | residence.tsx | `parseDateString()` sans UTC |
| 21 | Email validation | profile.tsx | Regex `emailRegex.test()` |
| 22 | Équipement/Matériel | vault.tsx | OCR_CATEGORIES corrigé |

## Previous Sprints Completed

### Sprint Bugs Observations (3 bugs) ✅
- BUG #1 - Nom auteur observation : `authUser?.name` du contexte
- BUG #2 - Badge "Envoi..." : SEND_STATUS enum
- BUG #3 - TextInput masqué : `scrollToEnd()` + ref

### Sprint Bugs Factures/Caméra (4 bugs) ✅
- BUG #1 - Facture non mise à jour
- BUG #2 - Caméra retour app
- BUG #3 - ATP/WTA mutuellement exclusifs
- BUG #4 - Saisie invisible invitation

### Sprint Technique (3 bugs) ✅
- BUG #1 - Clavier observation
- BUG #2 - Freeze calendrier tournoi
- FEATURE #3 - Affichage événements

## Backlog P0/P1/P2

### P0 - Phase 3 Résidence Fiscale
- GPS background tracking
- Alertes push
- Export PDF

### P1
- Loading state inscription tournoi (BUG #2 original)
- Amélioration UI cartes tournois

### P2 (Bugs UX non critiques)
- Modification document existant (#7)
- Limite navigation mois futurs (#9)
- Validation champ date (#10)
- Sélecteur pays avec noms (#12)
- Date picker séjour limite future (#13)
- Titre modal tournoi multi (#20)

## Test Reports
- /app/test_reports/iteration_24.json - Bugs Observations (8/8 - 100%)
- /app/test_reports/iteration_23.json - Bugs Factures/Caméra (7/7 - 100%)
