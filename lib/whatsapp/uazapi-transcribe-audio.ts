import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

type DownloadMediaResponse = {
  transcription?: string;
  Transcription?: string;
  fileURL?: string;
  fileUrl?: string;
};

/** Transcreve áudio de mensagem WhatsApp via UAZAPI POST /message/download (transcribe=true). */
export async function uazapiTranscreverAudioMensagem(
  messageId: string,
  instanceToken: string
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  const id = messageId.trim();
  const token = instanceToken.trim();
  if (!id) return { ok: false, erro: "message_id_ausente" };
  if (!token) return { ok: false, erro: "instance_token_ausente" };

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const body: Record<string, unknown> = {
    id,
    transcribe: true,
    return_link: false,
    return_base64: false,
    generate_mp3: true,
  };
  if (openaiKey) body.openai_apikey = openaiKey;

  const r = await uazapiFetchJson<DownloadMediaResponse>("/message/download", {
    method: "POST",
    instanceToken: token,
    body,
  });

  if (!r.ok) {
    return { ok: false, erro: r.error || `uazapi_download_${r.status}` };
  }

  const data = r.data;
  const texto =
    (typeof data?.transcription === "string" && data.transcription.trim()) ||
    (typeof data?.Transcription === "string" && data.Transcription.trim()) ||
    "";

  if (!texto) {
    return {
      ok: false,
      erro: openaiKey
        ? "transcricao_vazia_uazapi"
        : "transcricao_vazia_uazapi_sem_openai_key",
    };
  }

  return { ok: true, texto: texto.slice(0, 8000) };
}

/** Baixa áudio e devolve URL pública (para fallback Mistral). */
export async function uazapiObterUrlAudioMensagem(
  messageId: string,
  instanceToken: string
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const r = await uazapiFetchJson<DownloadMediaResponse>("/message/download", {
    method: "POST",
    instanceToken: instanceToken.trim(),
    body: {
      id: messageId.trim(),
      transcribe: false,
      return_link: true,
      return_base64: false,
      generate_mp3: true,
    },
  });

  if (!r.ok) return { ok: false, erro: r.error || `download_${r.status}` };

  const url =
    (typeof r.data?.fileURL === "string" && r.data.fileURL.trim()) ||
    (typeof r.data?.fileUrl === "string" && r.data.fileUrl.trim()) ||
    "";

  if (!url) return { ok: false, erro: "file_url_ausente" };
  return { ok: true, url };
}

/** URL pública de mídia WhatsApp (áudio, imagem, documento, vídeo). */
export async function uazapiObterUrlMidiaMensagem(
  messageId: string,
  instanceToken: string,
  opts?: { preferMp3?: boolean }
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const id = messageId.trim();
  const token = instanceToken.trim();
  if (!id) return { ok: false, erro: "message_id_ausente" };
  if (!token) return { ok: false, erro: "instance_token_ausente" };

  const body: Record<string, unknown> = {
    id,
    transcribe: false,
    return_link: true,
    return_base64: false,
  };
  if (opts?.preferMp3) body.generate_mp3 = true;

  const r = await uazapiFetchJson<DownloadMediaResponse>("/message/download", {
    method: "POST",
    instanceToken: token,
    body,
  });

  if (!r.ok) return { ok: false, erro: r.error || `download_${r.status}` };

  const url =
    (typeof r.data?.fileURL === "string" && r.data.fileURL.trim()) ||
    (typeof r.data?.fileUrl === "string" && r.data.fileUrl.trim()) ||
    "";

  if (!url) return { ok: false, erro: "file_url_ausente" };
  return { ok: true, url };
}
