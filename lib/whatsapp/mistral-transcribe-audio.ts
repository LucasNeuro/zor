const MISTRAL_TRANSCRIPTIONS_URL = "https://api.mistral.ai/v1/audio/transcriptions";

function modeloTranscricaoMistral(): string {
  return (
    process.env.MISTRAL_TRANSCRIBE_MODEL?.trim() ||
    process.env.MISTRAL_AUDIO_MODEL?.trim() ||
    "voxtral-mini-latest"
  );
}

type MistralTranscriptionJson = {
  text?: string;
  transcription?: string;
};

/** Transcreve áudio a partir de URL pública (ex.: link UAZAPI após download). */
export async function mistralTranscreverAudioUrl(
  fileUrl: string
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, erro: "mistral_api_key_ausente" };

  let blob: Blob;
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return { ok: false, erro: `fetch_audio_http_${res.status}` };
    blob = await res.blob();
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "fetch_audio_falhou" };
  }

  const form = new FormData();
  form.append("file", blob, "whatsapp-audio.mp3");
  form.append("model", modeloTranscricaoMistral());
  form.append("language", "pt");

  try {
    const res = await fetch(MISTRAL_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });

    const ct = res.headers.get("content-type") || "";
    let data: unknown;
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      const t = await res.text();
      data = t ? { text: t } : undefined;
    }

    if (!res.ok) {
      const err =
        data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : `mistral_transcribe_http_${res.status}`;
      return { ok: false, erro: err.slice(0, 500) };
    }

    const o = data as MistralTranscriptionJson;
    const texto =
      (typeof o?.text === "string" && o.text.trim()) ||
      (typeof o?.transcription === "string" && o.transcription.trim()) ||
      "";

    if (!texto) return { ok: false, erro: "mistral_transcricao_vazia" };
    return { ok: true, texto: texto.slice(0, 8000) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "mistral_transcribe_falhou" };
  }
}
