-- Bucket já criado em 20260514130000; alarga MIME permitido por segurança (upload API também usa só `text/markdown`).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/markdown',
  'text/markdown; charset=utf-8',
  'text/plain',
  'application/octet-stream'
]::text[]
WHERE id = 'hub-agent-playbooks';
