# Document Storage Architecture

## Overview

Documents (corporate presentations, venture files) are stored in Supabase Storage and referenced in the `venture_applications` database table. Text is extracted from documents for AI analysis using `pdf-parse` and `mammoth` libraries.

---

## Storage Infrastructure

**Supabase Storage Bucket:** `venture-documents`

**Storage Path Format:** `{ventureId}/{timestamp}_{safeFileName}`
- Example: `550e8400-e29b-41d4-a716-446655440000/1705325847123_presentation_v2.pdf`

**File Size Limit:** 5 MB

**Allowed MIME Types:**
- `application/pdf` (PDF)
- `application/vnd.ms-powerpoint` (PPT)
- `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX)
- `application/msword` (DOC)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)

---

## Database Tables

### `venture_applications`

Primary table that stores document references alongside application form data.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `venture_id` | UUID | Foreign key to `ventures` (UNIQUE — 1:1 relationship) |
| `corporate_presentation_url` | text | Storage path in `venture-documents` bucket (not a full URL) |
| `created_at` | timestamptz | Record creation timestamp |
| `updated_at` | timestamptz | Record update timestamp |

**Indexes:**
```sql
CREATE UNIQUE INDEX ON venture_applications(venture_id);
CREATE INDEX idx_applications_venture_id ON venture_applications(venture_id);
CREATE INDEX idx_applications_created_at ON venture_applications(created_at DESC);
```

### Related Tables (AI-generated content from documents)

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `venture_assessments` | `ai_analysis` | JSONB | V1 screening insights (uses document text) |
| `venture_assessments` | `ai_generated_at` | timestamptz | When AI analysis was generated |
| `ventures` | `panel_ai_analysis` | JSONB | V2 panel insights (uses document text) |
| `venture_roadmaps` | `roadmap_data` | JSONB | AI-generated journey roadmap (uses document text) |

---

## API Endpoints

### Upload

#### Public Document Upload (No Auth)
```
POST /api/ventures/:id/public-upload-document
```
- **Source:** `backend/src/routes/ventures.ts`
- **Multer config:** Memory storage, 5MB max, file type validation
- **Flow:** Validate → Upload to `venture-documents` bucket → Save path to `venture_applications.corporate_presentation_url`
- **Response:** `{ filePath: "ventureId/timestamp_filename" }`

#### Authenticated Document Upload (Frontend Direct)
```typescript
api.uploadVentureDocument(ventureId, file)
```
- **Source:** `src/lib/api.ts`
- **Flow:** Client-side validation → Direct upload to Supabase storage → RPC `save_venture_document_url()` to persist path

### Download

#### Get Signed URL
```typescript
api.getVentureDocumentUrl(filePath): Promise<string>
```
- **Source:** `src/lib/api.ts`
- **Signed URL Expiry:** 3600 seconds (1 hour)
- **Method:** `supabase.storage.from('venture-documents').createSignedUrl(filePath, 3600)`

---

## Text Extraction Pipeline

**Service:** `backend/src/services/documentService.ts`

```typescript
export async function extractDocumentText(storagePath: string): Promise<string | null>
```

### Supported Formats

| Format | Library | Extraction |
|--------|---------|------------|
| PDF | `pdf-parse` | Full text extraction |
| DOCX | `mammoth` | Full text extraction |
| PPT/PPTX/DOC | — | Returns `null` (not supported) |

### Flow
1. Download document from Supabase storage using service role client
2. Detect file type by extension
3. Parse with appropriate library
4. Return plain text (or `null` if unsupported)

### Used By
- **V1 Screening Insights:** `POST /api/ventures/:id/generate-insights` → `aiService.generateVentureInsights()`
- **V2 Panel Insights:** `POST /api/ventures/:id/generate-insights?type=panel` → `aiService.generatePanelInsights()`
- **Roadmap Generation:** `POST /api/ventures/:id/generate-roadmap` → `aiService.generateVentureRoadmap()`

Corporate presentation text is truncated to **3,000 characters** before being included in AI prompts.

---

## Data Flow Diagrams

### Upload Flow

```
Frontend Form                    Backend API
═════════════                    ════════════
File Input ──────────────────>  POST /public-upload-document
(File object)                    │ multer validates type & size
                                 ▼
                          Upload to Supabase Storage
                          venture-documents/{ventureId}/{ts}_{name}
                                 │
                                 ▼
                          UPDATE venture_applications
                          SET corporate_presentation_url = filePath
                                 │
◄────────────────────────────────┘
{ filePath: "..." }
```

### Download Flow

```
Frontend                          Supabase Storage API
════════                          ════════════════════
api.getVentureDocumentUrl() ──>  .createSignedUrl(filePath, 3600)
(filePath)                        │
                                  ▼
◄─────────────────────────────── Signed URL (expires in 1hr)
window.open(signedUrl)
```

### AI Text Extraction Flow

```
Backend Route                     documentService.ts
═════════════                     ══════════════════
POST /generate-insights ────────> extractDocumentText(filePath)
(ventureId)                        │
                                   ▼
                            Download from storage
                            (service role client)
                                   │
                                   ▼
                            Detect extension
                            ├── .pdf  → pdf-parse
                            ├── .docx → mammoth
                            └── other → return null
                                   │
                                   ▼
◄──────────────────────────── Return extracted text
                                   │
                                   ▼
                            Build AI prompt with
                            corporate_presentation_text
                                   │
                                   ▼
                            Call Claude API
                                   │
                                   ▼
                            Persist results to DB
                            (ai_analysis / panel_ai_analysis / roadmap_data)
```

---

## Security

### Row-Level Security (RLS)
- Entrepreneurs can view/update their own applications (if workbench not locked)
- Staff (`success_mgr`, `venture_mgr`, `admin`, `committee_member`) can view all applications

### Storage Security
- Signed URLs expire after 1 hour
- Service role client required for text extraction (bypasses auth)
- Public upload endpoint validates venture existence before allowing upload
- Filenames sanitized (special characters removed)

---

## Dependencies

```json
{
  "multer": "^2.1.1",
  "pdf-parse": "^2.4.5",
  "mammoth": "^1.11.0",
  "@types/multer": "^2.1.0",
  "@types/pdf-parse": "^1.1.5"
}
```

---

**Last Updated:** 2026-03-11
