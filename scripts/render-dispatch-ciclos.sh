#!/bin/sh
set -eu

# Called by Render Cron (Docker) or manually. Matches lib/cron-auth.ts (Bearer CRON_SECRET).
# Env:
#   CRON_SECRET — required in production on the API; cron must send the same value.
#   DISPATCH_CICLOS_URL — optional full URL to GET .../api/cron/dispatch-ciclos
#   NEXT_PUBLIC_APP_URL — if DISPATCH_CICLOS_URL is empty, URL base (see .env.example)

url="${DISPATCH_CICLOS_URL:-}"
if [ -z "$url" ]; then
  base="${NEXT_PUBLIC_APP_URL:-}"
  base="${base%/}"
  if [ -z "$base" ]; then
    echo "render-dispatch-ciclos: set DISPATCH_CICLOS_URL or NEXT_PUBLIC_APP_URL" >&2
    exit 1
  fi
  url="${base}/api/cron/dispatch-ciclos"
fi

secret="${CRON_SECRET:-}"
if [ -z "$secret" ]; then
  echo "render-dispatch-ciclos: CRON_SECRET is required" >&2
  exit 1
fi

curl -fsS -X GET \
  -H "Authorization: Bearer ${secret}" \
  -H "Accept: application/json" \
  "$url"

wa_url="${DISPATCH_WHATSAPP_JOBS_URL:-}"
if [ -z "$wa_url" ]; then
  base="${NEXT_PUBLIC_APP_URL:-}"
  base="${base%/}"
  if [ -n "$base" ]; then
    wa_url="${base}/api/cron/process-whatsapp-jobs"
  fi
fi

if [ -n "$wa_url" ]; then
  echo "render-dispatch-ciclos: process-whatsapp-jobs → ${wa_url}"
  curl -fsS -X GET \
    -H "Authorization: Bearer ${secret}" \
    -H "Accept: application/json" \
    --max-time 300 \
    "$wa_url" || echo "render-dispatch-ciclos: process-whatsapp-jobs failed (non-fatal)" >&2
fi

followup_url="${DISPATCH_FOLLOWUP_URL:-}"
if [ -z "$followup_url" ]; then
  base="${NEXT_PUBLIC_APP_URL:-}"
  base="${base%/}"
  if [ -n "$base" ]; then
    followup_url="${base}/api/cron/followup-whatsapp"
  fi
fi

if [ -n "$followup_url" ]; then
      skip_followup="${DISPATCH_FOLLOWUP_ENABLED:-0}"
  case "$skip_followup" in
    0|false|FALSE|off|OFF|no|NO)
      echo "render-dispatch-ciclos: followup-whatsapp skipped (DISPATCH_FOLLOWUP_ENABLED=$skip_followup)"
      ;;
    *)
      echo "render-dispatch-ciclos: followup-whatsapp → ${followup_url}"
      curl -fsS -X GET \
        -H "Authorization: Bearer ${secret}" \
        -H "Accept: application/json" \
        --max-time 300 \
        "$followup_url" || echo "render-dispatch-ciclos: followup-whatsapp failed (non-fatal)" >&2
      ;;
  esac
fi
