# AI Support Dashboard – Technisches Briefing

## Projektübersicht

Wir bauen ein internes Support-Dashboard für das Palacios Institut. Das System:
1. Empfängt eingehende E-Mails aus HubSpot
2. Generiert automatisch AI-Antwortvorschläge basierend auf einer Knowledge Base (RAG)
3. Ermöglicht Team-Mitgliedern das Reviewen, Bearbeiten und Absenden von Antworten
4. Lernt kontinuierlich durch neue Inhalte (Help-Artikel, vergangene E-Mails, FAQs)

**Wichtig:** Kein Auto-Send. Jede E-Mail muss manuell approved werden.

---

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Next.js 14 (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend | Next.js API Routes |
| Datenbank | Supabase (PostgreSQL + pgvector) |
| Authentication | Supabase Auth |
| AI/LLM | OpenAI API (GPT-4o) oder Anthropic Claude API |
| Embeddings | OpenAI text-embedding-3-small |
| E-Mail Integration | HubSpot API v3 |
| Hosting | Vercel |

---

## Datenbank Schema (Supabase)

### 1. Extensions aktivieren

```sql
-- In Supabase SQL Editor ausführen
create extension if not exists vector;
```

### 2. Tabellen

```sql
-- Knowledge Base Chunks (für RAG)
create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  source_type text not null, -- 'help_article', 'email', 'faq', 'course_info'
  source_id text, -- Referenz zur Original-Quelle (z.B. HubSpot Article ID)
  source_title text,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index für Vektorsuche
create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Eingehende E-Mails
create table incoming_emails (
  id uuid primary key default gen_random_uuid(),
  hubspot_email_id text unique not null,
  hubspot_thread_id text,
  hubspot_contact_id text,
  from_email text not null,
  from_name text,
  subject text not null,
  body_text text not null,
  body_html text,
  received_at timestamp with time zone not null,
  status text default 'pending', -- 'pending', 'draft_ready', 'approved', 'sent', 'rejected'
  assigned_to uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- AI-generierte Antwortvorschläge
create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references incoming_emails(id) on delete cascade,
  ai_generated_response text not null,
  edited_response text, -- Falls bearbeitet
  confidence_score float, -- 0.0 - 1.0
  relevant_chunks jsonb, -- IDs der genutzten Knowledge Chunks
  status text default 'pending', -- 'pending', 'approved', 'edited', 'rejected'
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamp with time zone,
  sent_at timestamp with time zone,
  hubspot_sent_email_id text, -- ID der gesendeten E-Mail in HubSpot
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Audit Log für Tracking
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references incoming_emails(id),
  draft_id uuid references email_drafts(id),
  action text not null, -- 'received', 'draft_generated', 'approved', 'edited', 'sent', 'rejected'
  performed_by uuid references auth.users(id),
  details jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Team Members (zusätzliche Infos)
create table team_members (
  id uuid primary key references auth.users(id),
  display_name text not null,
  email_signature text, -- Wird an Antworten angehängt
  role text default 'member', -- 'admin', 'member'
  created_at timestamp with time zone default now()
);
```

### 3. Supabase Functions für Vektorsuche

```sql
-- Funktion für Ähnlichkeitssuche
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  source_type text,
  source_title text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    knowledge_chunks.id,
    knowledge_chunks.content,
    knowledge_chunks.source_type,
    knowledge_chunks.source_title,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

## Projektstruktur

```
ai-support-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Dashboard Home / Inbox
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── inbox/
│   │   ├── page.tsx                # E-Mail Inbox Liste
│   │   └── [emailId]/
│   │       └── page.tsx            # Einzelne E-Mail mit AI-Vorschlag
│   ├── knowledge/
│   │   ├── page.tsx                # Knowledge Base verwalten
│   │   └── upload/
│   │       └── page.tsx            # Neue Inhalte hochladen
│   ├── settings/
│   │   └── page.tsx                # Einstellungen, Signatur, etc.
│   └── api/
│       ├── webhooks/
│       │   └── hubspot/
│       │       └── route.ts        # HubSpot Webhook Endpoint
│       ├── emails/
│       │   ├── route.ts            # GET: Liste, POST: Sync
│       │   └── [emailId]/
│       │       ├── route.ts        # GET: Einzelne E-Mail
│       │       ├── generate-draft/
│       │       │   └── route.ts    # POST: AI Draft generieren
│       │       └── send/
│       │           └── route.ts    # POST: E-Mail senden
│       ├── drafts/
│       │   └── [draftId]/
│       │       └── route.ts        # PATCH: Draft bearbeiten
│       ├── knowledge/
│       │   ├── route.ts            # GET: Chunks, POST: Neue Chunks
│       │   ├── sync-hubspot/
│       │   │   └── route.ts        # POST: HubSpot Knowledge Base sync
│       │   └── upload/
│       │       └── route.ts        # POST: Datei hochladen (PDF, etc.)
│       └── embeddings/
│           └── route.ts            # POST: Text zu Embedding
├── components/
│   ├── ui/                         # shadcn/ui Komponenten
│   ├── inbox/
│   │   ├── email-list.tsx
│   │   ├── email-list-item.tsx
│   │   ├── email-detail.tsx
│   │   └── email-filters.tsx
│   ├── draft/
│   │   ├── ai-draft-card.tsx
│   │   ├── draft-editor.tsx
│   │   └── confidence-badge.tsx
│   ├── knowledge/
│   │   ├── chunk-list.tsx
│   │   ├── upload-form.tsx
│   │   └── source-badge.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── stats-bar.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Client
│   │   ├── server.ts               # Server Client
│   │   └── admin.ts                # Admin Client (für Webhooks)
│   ├── hubspot/
│   │   ├── client.ts               # HubSpot API Client
│   │   ├── emails.ts               # E-Mail Funktionen
│   │   └── knowledge-base.ts       # Knowledge Base Sync
│   ├── ai/
│   │   ├── embeddings.ts           # OpenAI Embeddings
│   │   ├── generate-response.ts    # LLM Response Generation
│   │   └── prompts.ts              # System Prompts
│   ├── utils/
│   │   ├── chunking.ts             # Text in Chunks aufteilen
│   │   └── confidence.ts           # Confidence Score berechnen
│   └── types/
│       └── index.ts                # TypeScript Types
├── .env.local                      # Environment Variables
└── package.json
```

---

## Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# HubSpot
HUBSPOT_ACCESS_TOKEN=pat-xxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HUBSPOT_WEBHOOK_SECRET=xxxxxxxx  # Für Webhook Verification

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Anthropic (falls Claude statt GPT)
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## API Endpoints Spezifikation

### 1. HubSpot Webhook (Eingehende E-Mails)

**POST** `/api/webhooks/hubspot`

```typescript
// Wird von HubSpot bei neuer E-Mail getriggert
// 1. Verifiziert HubSpot Signatur
// 2. Speichert E-Mail in Supabase
// 3. Triggert AI Draft Generation (async)

interface HubSpotWebhookPayload {
  eventType: 'email.received';
  objectId: string;
  properties: {
    hs_email_subject: string;
    hs_email_text: string;
    hs_email_from_email: string;
    hs_email_from_firstname: string;
    hs_email_from_lastname: string;
  };
}
```

### 2. E-Mail Liste

**GET** `/api/emails`

```typescript
// Query Params
interface EmailListParams {
  status?: 'pending' | 'draft_ready' | 'approved' | 'sent' | 'rejected';
  limit?: number;
  offset?: number;
}

// Response
interface EmailListResponse {
  emails: IncomingEmail[];
  total: number;
  hasMore: boolean;
}
```

### 3. AI Draft Generieren

**POST** `/api/emails/[emailId]/generate-draft`

```typescript
// Flow:
// 1. E-Mail Text → Embedding
// 2. Supabase Vektorsuche → Relevante Chunks
// 3. LLM Call mit Kontext → Draft
// 4. Speichern in email_drafts

// Response
interface GenerateDraftResponse {
  draft: EmailDraft;
  relevantChunks: KnowledgeChunk[];
  confidenceScore: number;
}
```

### 4. E-Mail Senden

**POST** `/api/emails/[emailId]/send`

```typescript
// Request
interface SendEmailRequest {
  draftId: string;
  finalText: string; // Falls bearbeitet
}

// Flow:
// 1. E-Mail via HubSpot API senden
// 2. Status updaten
// 3. Audit Log schreiben

// Response
interface SendEmailResponse {
  success: boolean;
  hubspotEmailId: string;
}
```

### 5. Knowledge Base Sync

**POST** `/api/knowledge/sync-hubspot`

```typescript
// Synct HubSpot Knowledge Base Artikel
// 1. Alle Artikel von HubSpot holen
// 2. In Chunks aufteilen (max 500 Tokens pro Chunk)
// 3. Embeddings generieren
// 4. In Supabase speichern
```

---

## AI Prompts

### System Prompt für Antwortgenerierung

```typescript
// lib/ai/prompts.ts

export const SYSTEM_PROMPT = `Du bist ein freundlicher Support-Mitarbeiter des Palacios Instituts.

Das Palacios Institut bietet Ausbildungen in den Bereichen Hypnose, Meditation und Life Coaching an. Gründer ist Gabriel Palacios.

Deine Aufgabe:
- Beantworte Kundenanfragen freundlich und professionell
- Nutze die bereitgestellten Informationen aus der Knowledge Base
- Wenn du etwas nicht weisst, sage es ehrlich
- Schreibe im Schweizer Deutsch Stil (z.B. "Grüezi", "Herzliche Grüsse")
- Halte Antworten präzise aber herzlich

Formatierung:
- Beginne mit einer persönlichen Anrede
- Strukturiere längere Antworten mit Absätzen
- Schliesse mit "Herzliche Grüsse" und Platzhalter [Name]

Wichtig:
- Erfinde KEINE Preise, Daten oder Fakten
- Wenn die Knowledge Base keine Antwort liefert, bitte den Kunden höflich um Geduld und sage, dass sich jemand persönlich melden wird
`;

export const generateUserPrompt = (
  emailContent: string,
  relevantChunks: string[]
) => `
KUNDENANFRAGE:
${emailContent}

RELEVANTE INFORMATIONEN AUS UNSERER KNOWLEDGE BASE:
${relevantChunks.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}

Bitte erstelle eine passende Antwort auf diese Anfrage.
`;
```

---

## UI Komponenten Spezifikation

### 1. Inbox Seite (`/inbox`)

```
┌─────────────────────────────────────────────────────────────────┐
│  🏠 Palacios Support                              [User ▼]      │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  📬 Inbox  │   📬 Support Inbox                   3 ausstehend  │
│  ├─ Alle   │   ─────────────────────────────────────────────    │
│  ├─ Offen  │                                                    │
│  ├─ Bereit │   ┌─────────────────────────────────────────────┐  │
│  └─ Erled. │   │ 🟡 maria.mueller@gmail.com          vor 2h  │  │
│            │   │ Frage zur Hypnose-Ausbildung                │  │
│  📚 Knowl. │   │ "Guten Tag, ich interessiere mich..."       │  │
│            │   │ Confidence: 92% ████████░░                  │  │
│  ⚙️ Einst. │   └─────────────────────────────────────────────┘  │
│            │                                                    │
│            │   ┌─────────────────────────────────────────────┐  │
│            │   │ 🟡 thomas.weber@bluewin.ch          vor 5h  │  │
│            │   │ Ratenzahlung möglich?                       │  │
│            │   │ "Hallo, ich würde gerne wissen ob..."       │  │
│            │   │ Confidence: 87% ███████░░░                  │  │
│            │   └─────────────────────────────────────────────┘  │
│            │                                                    │
│            │   ┌─────────────────────────────────────────────┐  │
│            │   │ 🔴 info@firma.ch                    vor 1d  │  │
│            │   │ Firmenausbildung anfragen                   │  │
│            │   │ "Wir sind ein Unternehmen mit 50..."        │  │
│            │   │ Confidence: 45% ████░░░░░░  ⚠️ Review!     │  │
│            │   └─────────────────────────────────────────────┘  │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

**Farb-Coding:**
- 🟢 Grün: Confidence > 85% - Bereit zum Senden
- 🟡 Gelb: Confidence 70-85% - Review empfohlen
- 🔴 Rot: Confidence < 70% - Manuell prüfen

### 2. E-Mail Detail Seite (`/inbox/[emailId]`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Zurück zur Inbox                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Von: maria.mueller@gmail.com                                   │
│  Betreff: Frage zur Hypnose-Ausbildung                         │
│  Erhalten: 9. Januar 2026, 14:32                               │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ORIGINAL NACHRICHT                                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │ Guten Tag                                               │   │
│  │                                                         │   │
│  │ Ich interessiere mich für die Hypnose-Ausbildung.      │   │
│  │ Wann startet der nächste Kurs und was kostet er?       │   │
│  │ Gibt es auch eine Ratenzahlungsmöglichkeit?            │   │
│  │                                                         │   │
│  │ Freundliche Grüsse                                      │   │
│  │ Maria Müller                                            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🤖 AI ANTWORTVORSCHLAG                   Confidence: 92%│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │ Liebe Frau Müller                                       │   │
│  │                                                         │   │
│  │ Vielen Dank für Ihr Interesse an unserer               │   │
│  │ Hypnose-Ausbildung.                                    │   │
│  │                                                         │   │
│  │ Der nächste Ausbildungsstart ist am 15. März 2026.     │   │
│  │ Die Ausbildung kostet CHF 4'800.–, Ratenzahlung ist    │   │
│  │ selbstverständlich möglich (6 x CHF 850.–).            │   │
│  │                                                         │   │
│  │ Gerne sende ich Ihnen unsere ausführliche              │   │
│  │ Informationsbroschüre zu.                              │   │
│  │                                                         │   │
│  │ Herzliche Grüsse                                        │   │
│  │ [Name]                                                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📚 VERWENDETE QUELLEN                                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ • Hypnose-Ausbildung Übersicht (Help Center)           │   │
│  │ • Preisliste 2026 (FAQ)                                │   │
│  │ • Ratenzahlung Info (Help Center)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ ✅ Senden  │  │ ✏️ Bearb.  │  │ ❌ Verwer. │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Bearbeitungs-Modal

Wenn "Bearbeiten" geklickt wird:

```
┌─────────────────────────────────────────────────────────────────┐
│  Antwort bearbeiten                                    [X]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Liebe Frau Müller                                       │   │
│  │                                                         │   │
│  │ Vielen Dank für Ihr Interesse an unserer               │   │
│  │ Hypnose-Ausbildung.                                    │   │
│  │                                                         │   │
│  │ Der nächste Ausbildungsstart ist am 15. März 2026.     │   │
│  │ Die Ausbildung kostet CHF 4'800.–, Ratenzahlung ist    │   │
│  │ selbstverständlich möglich (6 x CHF 850.–).            │   │
│  │                                                         │   │
│  │ [Cursor hier - Text editierbar]                        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Signatur: ┌──────────────────────────────────────────────┐    │
│            │ Herzliche Grüsse                             │    │
│            │ Max Mustermann                               │    │
│            │ Palacios Institut                            │    │
│            └──────────────────────────────────────────────┘    │
│                                                                 │
│            ┌────────────────────┐  ┌──────────────┐            │
│            │ Speichern & Senden │  │   Abbrechen  │            │
│            └────────────────────┘  └──────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Knowledge Base Seite (`/knowledge`)

```
┌─────────────────────────────────────────────────────────────────┐
│  📚 Knowledge Base                        [+ Inhalt hinzufügen] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filter: [Alle ▼]  [Help Center ▼]  Suche: [____________]      │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│  📄 Hypnose-Ausbildung Übersicht                               │
│     Quelle: Help Center | 3 Chunks | Aktualisiert: vor 2 Tagen │
│                                                                 │
│  📄 Preisliste 2026                                            │
│     Quelle: FAQ | 5 Chunks | Aktualisiert: vor 1 Woche         │
│                                                                 │
│  📧 Support-Antwort: Ratenzahlung                              │
│     Quelle: E-Mail | 1 Chunk | Aktualisiert: vor 3 Tagen       │
│                                                                 │
│  📄 Meditation Coach Ausbildung                                │
│     Quelle: Help Center | 4 Chunks | Aktualisiert: vor 5 Tagen │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  Statistiken:                                                   │
│  • 127 Knowledge Chunks                                        │
│  • 45 Help Center Artikel                                      │
│  • 23 FAQ Einträge                                             │
│  • 59 E-Mail Vorlagen                                          │
│                                                                 │
│  [🔄 HubSpot Sync]  Letzter Sync: vor 6 Stunden                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HubSpot Setup Anleitung

### 1. Private App erstellen

1. HubSpot → Settings → Integrations → Private Apps
2. "Create private app"
3. Name: "Palacios AI Support"
4. Scopes benötigt:
   - `crm.objects.contacts.read`
   - `conversations.read`
   - `conversations.write`
   - `content.read` (für Knowledge Base)
   - `tickets.read`
   - `tickets.write`

### 2. Webhook einrichten

1. Settings → Integrations → Webhooks
2. Target URL: `https://your-domain.com/api/webhooks/hubspot`
3. Events:
   - `conversation.newMessage`
   - `email.received` (falls verfügbar)

### 3. Knowledge Base API

HubSpot Knowledge Base Artikel können über die CMS API abgerufen werden:

```typescript
// GET /cms/v3/objects/knowledge_articles
// Docs: https://developers.hubspot.com/docs/api/cms/knowledge-base
```

---

## Implementierungsreihenfolge

### Phase 1: Basis Setup (Tag 1-2)
1. [ ] Next.js Projekt mit shadcn/ui aufsetzen
2. [ ] Supabase Projekt erstellen, pgvector aktivieren
3. [ ] Datenbank Schema deployen
4. [ ] Supabase Auth konfigurieren
5. [ ] Basis Layout mit Sidebar

### Phase 2: Knowledge Base (Tag 2-3)
1. [ ] OpenAI Embeddings Integration
2. [ ] Chunking-Funktion implementieren
3. [ ] Manueller Upload von Inhalten (Textarea/File)
4. [ ] Knowledge Base UI
5. [ ] Vektorsuche testen

### Phase 3: HubSpot Integration (Tag 3-4)
1. [ ] HubSpot Client Library
2. [ ] Knowledge Base Sync (HubSpot → Supabase)
3. [ ] Webhook Endpoint für eingehende E-Mails
4. [ ] E-Mail Sync (manueller Trigger erst)

### Phase 4: AI Response Generation (Tag 4-5)
1. [ ] LLM Integration (OpenAI/Claude)
2. [ ] Prompt Engineering
3. [ ] Draft Generation Flow
4. [ ] Confidence Score Berechnung

### Phase 5: Inbox UI (Tag 5-6)
1. [ ] E-Mail Liste
2. [ ] E-Mail Detail View
3. [ ] AI Draft Card
4. [ ] Bearbeitungs-Modal

### Phase 6: Senden & Workflow (Tag 6-7)
1. [ ] Approve/Reject Flow
2. [ ] E-Mail via HubSpot senden
3. [ ] Status Updates
4. [ ] Audit Log

### Phase 7: Polish & Deploy (Tag 7-8)
1. [ ] Error Handling
2. [ ] Loading States
3. [ ] Mobile Responsive
4. [ ] Vercel Deployment
5. [ ] Webhook mit echter URL verbinden

---

## Zusätzliche Features (Future)

- [ ] Automatisches Lernen: Gesendete Antworten als neue Knowledge Chunks speichern
- [ ] Analytics Dashboard: Response Time, Approval Rate, etc.
- [ ] Template-System: Häufige Antworten als Templates
- [ ] Multi-Language: Erkennung und Antwort in passender Sprache
- [ ] Slack/Teams Notifications bei neuen E-Mails
- [ ] Bulk Actions: Mehrere E-Mails gleichzeitig bearbeiten

---

## Wichtige Hinweise für die Entwicklung

1. **Sicherheit**: Webhook-Signatur immer verifizieren
2. **Rate Limits**: OpenAI Embeddings haben Limits, Batching nutzen
3. **Chunking**: Chunks sollten 300-500 Tokens sein für beste Ergebnisse
4. **Testing**: Erst mit Mock-Daten testen bevor HubSpot live
5. **Logging**: Alle API Calls loggen für Debugging
6. **Backups**: Supabase Backups aktivieren

---

## Referenz-Links

- [Supabase pgvector Docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [HubSpot API Docs](https://developers.hubspot.com/docs/api/overview)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [shadcn/ui](https://ui.shadcn.com/)
