---
name: api-design
description: API Design — entwirf REST/GraphQL APIs mit Endpoints, Schemas und Beispielen.
argument-hint: "<api-beschreibung>"
user-invocable: true
---

API Design für: $ARGUMENTS

1. **Verstehe** die Anforderungen:
   - Welche Entitäten/Ressourcen?
   - Welche Operationen (CRUD + Custom)?
   - Wer sind die Consumers?

2. **Entwirf Endpoints:**
   | Method | Path | Description | Auth |
   |---|---|---|---|
   | GET | /api/v1/... | | |
   | POST | /api/v1/... | | |

3. **Schema Design:**
   - Request/Response Bodies (JSON Schema oder TypeScript)
   - Pagination, Filtering, Sorting
   - Error Responses (standardisiert)

4. **Beispiele:** Curl/Fetch Beispiele für jeden Endpoint
5. **Besonderheiten:** Rate Limiting, Webhooks, Versioning
