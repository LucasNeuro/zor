-- Amplia tipos MIME aceites no bucket RAG (Office, HTML, RTF).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/rtf',
  'text/xml',
  'application/json',
  'application/xml',
  'application/pdf',
  'application/rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/octet-stream'
]::text[]
WHERE id = 'hub-agent-rag-docs';
