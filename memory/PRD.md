# Le Court Central - PRD

## Completed Bug Fixes (Feb 23, 2026)

### Sprint DB - Critical Bugs Fixed

#### DB-4 - Incompatible User ID Systems (CRITICAL) ✅ NEW
| Fix | Description |
|-----|-------------|
| `auth_helpers.py` | Created centralized auth helper module |
| `residence_routes.py` | All endpoints now use real userId from auth (not "default-user") |
| `tournament_routes.py` | All endpoints now use real userId from auth |
| `server.py` | Initialized auth_helpers_db at startup |

**Implementation:**
- Created `/app/backend/routes/auth_helpers.py` with `get_current_user_id()` function
- Modified all residence endpoints (`/days`, `/stats`, `/days/bulk`) to use auth
- Modified all tournament endpoints (`/weeks`, `/register`, `/hide`) to use auth
- Fallback to "default-user" for backward compatibility when not authenticated

#### DB-6 - Inconsistent Date Formats (CRITICAL) ✅ NEW
| Fix | Description |
|-----|-------------|
| `server.py` | OCR `extract_date_from_text()` now returns ISO 8601 format (YYYY-MM-DD) |

**Before:** OCR returned dates as `DD/MM/YYYY` (e.g., `15/01/2026`)
**After:** OCR returns dates as `YYYY-MM-DD` (e.g., `2026-01-15`)

### Previous DB Fixes (Feb 22, 2026)

| # | Bug | Status | Fix |
|---|-----|--------|-----|
| DB-2 | No user isolation on day_presences | ✅ | `userId` added to all documents and queries |
| DB-3 | No user isolation on tournament_registrations | ✅ | `userId` filter on register/hide/unhide |
| DB-7 | hide deletes registration | ✅ | `previousStatus` saved, restored on unhide |
| DB-8 | Auto-hiding irreversible | ✅ | `autoHidden` + `hiddenByTournament` for cleanup |
| DB-9 | Infinite session growth | ✅ | TTL index on `user_sessions.expires_at` |
| DB-12 | Hardcoded year 2026 | ✅ | `datetime.now().year` default |
| DB-13 | Short 8-char IDs | ✅ | Full UUID to avoid collisions |

### P2 UX Bugs Fixed

| # | Bug | Status | Fix |
|---|-----|--------|-----|
| P2-7 | Cannot edit documents | ✅ | Edit modal in vault.tsx |
| P2-9 | Future month navigation unlimited | ✅ | `canGoNextMonth` + disabled button |
| P2-10 | Date validation | ✅ | `isValidDateFormat()` helper |
| P2-12 | Country selector only codes | ✅ | Shows full country names |
| P2-13 | No future date limit on bulk stay | ✅ | `maximumDate={new Date()}` on all pickers |

### Previous Sprint Fixes

- #3 Staff invitation URL → `EXPO_PUBLIC_BACKEND_URL`
- #4 OCR feedback → Alert "OCR non disponible"
- #5 Hardcoded currency → `getCurrencySymbol()`
- #6 Silent error on day addition → Success/error alerts
- #11 Shared notes state → Reset `showNotesField`
- #14 No success message bulk stay → "X jour(s) enregistré(s)"
- #15 Silent profile loading failure → Alert + Retry
- #17 Value 0 treated as undefined → `isNaN()` check
- #18/19 Timezone bugs → `parseDateString()`
- #21 Email validation → Regex
- #22 Category mismatch → OCR_CATEGORIES

## Key Backend Changes

### New File: `/app/backend/routes/auth_helpers.py`
```python
async def get_current_user_id(request: Request) -> str:
    """Get real user_id from session token, fallback to 'default-user'"""
```

### Modified: `residence_routes.py`
- All endpoints use `await get_current_user_id(request)`
- POST `/days`: userId from auth
- GET `/days`: Filter by userId
- GET `/stats`: Filter by userId
- POST `/days/bulk`: userId from auth
- DELETE `/days/{date}`: Filter by userId

### Modified: `tournament_routes.py`
- All endpoints use `await get_current_user_id(request)`
- GET `/weeks`: userId for registration/hidden queries
- POST `/register`: userId in upsert
- POST `/hide`: userId in document
- DELETE `/hide/{id}`: userId filter

### Modified: `server.py`
- Added `init_auth_helpers_db(db)` at startup
- `extract_date_from_text()` returns ISO 8601 format

## Backlog

### P0 - Phase 3 Tax Residency
- GPS background tracking + push alerts + PDF export

### P1 - Remaining
- P2-8: Cannot delete/modify calendar events
- P2-11: Shared state between residence modals (notes)
- P2-14: No success message after bulk stay
- P2-16: Non-discoverable staff deletion (onLongPress)
- P2-20: Incorrect tournament modal title

### P2 - Future
- DB-7 & DB-8: Irreversible tournament status changes (partially fixed)
- Tournament modal reactivity
- Tournament card UI homogeneity

## Test Reports
- /app/test_reports/iteration_24.json - Bugs Observations (8/8 - 100%)
- /app/test_reports/iteration_32.json
- /app/test_reports/iteration_39.json

## Architecture

```
/app/backend/routes/
├── auth_helpers.py      # NEW: Centralized auth for routes
├── residence_routes.py  # MODIFIED: Uses auth helpers
├── tournament_routes.py # MODIFIED: Uses auth helpers
└── server.py           # MODIFIED: Init auth helpers + ISO dates
```

## Credentials
- App User: `testUser@example.com` / `testpassword123`
- Admin User: `r.admin@gmail.com` / `allezparis75`
