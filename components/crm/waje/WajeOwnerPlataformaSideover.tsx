"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Globe, Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfBodyOnDarkStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { WajeOwnerSectionHeading } from "@/components/crm/waje/WajeOwnerRetrofitUi";
import { WajeOwnerStatusBadge } from "@/components/crm/waje/WajeOwnerUi";
import type { PlatformBrandRow } from "@/lib/ops/platform-brand-map";
import { isUsableAssetUrl } from "@/lib/ops/platform-brand-asset-url";
import type { PlatformBrandUserRow } from "@/lib/ops/platform-brand-stats";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export type { PlatformBrandRow };

type Props = {
  open: boolean;
  row: PlatformBrandRow | null;
  createMode?: boolean;
  onClose: () => void;
  onSaved: (row: PlatformBrandRow) => void;
  onCreated: (row: PlatformBrandRow) => void;
  onDeactivated?: (id: string) => void;
};

type FormState = {
  slug: string;
  nome: string;
  tagline: string;
  dominios: string;
  logo_url: string;
  favicon_url: string;
  cor_primaria: string;
  cor_accent: string;
  cor_fundo: string;
  company_name: string;
  ativo: boolean;
  landing_assistant_ativo: boolean;
  registration_type: string;
  document_type: string;
  document: string;
  billing_legal_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

function emptyForm(): FormState {
  return {
    slug: "",
    nome: "",
    tagline: "",
    dominios: "",
    logo_url: "",
    favicon_url: "",
    cor_primaria: "#3f9848",
    cor_accent: "#92ff00",
    cor_fundo: "#0b1f10",
    company_name: "",
    ativo: true,
    landing_assistant_ativo: true,
    registration_type: "",
    document_type: "",
    document: "",
    billing_legal_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  };
}

function rowToForm(row: PlatformBrandRow): FormState {
  return {
    slug: row.slug,
    nome: row.nome,
    tagline: row.tagline ?? "",
    dominios: row.dominios.join(", "),
    logo_url: row.logo_url ?? "",
    favicon_url: row.favicon_url ?? "",
    cor_primaria: row.cor_primaria,
    cor_accent: row.cor_accent,
    cor_fundo: row.cor_fundo,
    company_name: row.company_name ?? "",
    ativo: row.ativo,
    landing_assistant_ativo: row.landing_assistant_ativo !== false,
    registration_type: row.registration_type ?? "",
    document_type: row.document_type ?? "",
    document: row.document ?? "",
    billing_legal_name: row.billing_legal_name ?? "",
    contact_name: row.contact_name ?? "",
    contact_email: row.contact_email ?? "",
    contact_phone: row.contact_phone ?? "",
  };
}

function payloadFromForm(form: FormState) {
  return {
    slug: form.slug,
    nome: form.nome,
    tagline: form.tagline,
    dominios: form.dominios,
    logo_url: form.logo_url,
    favicon_url: form.favicon_url,
    cor_primaria: form.cor_primaria,
    cor_accent: form.cor_accent,
    cor_fundo: form.cor_fundo,
    company_name: form.company_name,
    ativo: form.ativo,
    landing_assistant_ativo: form.landing_assistant_ativo,
    registration_type: form.registration_type || null,
    document_type: form.document_type || null,
    document: form.document,
    billing_legal_name: form.billing_legal_name,
    contact_name: form.contact_name,
    contact_email: form.contact_email,
    contact_phone: form.contact_phone,
  };
}

const inputCls =
  "w-full rounded-xl border border-[rgba(146,255,0,0.2)] bg-[#0b1f10] px-3 py-2 text-sm text-[#e8f5e9] outline-none focus:border-[#92ff00]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a9a7e]">{label}</span>
      {children}
    </label>
  );
}

function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type AssetKind = "logo" | "favicon";

type QueueItem = {
  id: string;
  kind: AssetKind;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function queueId(kind: AssetKind, file: File): string {
  return `${kind}::${file.name}::${file.size}::${file.lastModified}`;
}

const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico";

function MarcaAssetsAtuais({ logoUrl, faviconUrl }: { logoUrl: string; faviconUrl: string }) {
  const logo = isUsableAssetUrl(logoUrl) ? logoUrl : null;
  const favicon = isUsableAssetUrl(faviconUrl) ? faviconUrl : null;
  if (!logo && !favicon) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-xl p-3"
      style={{ border: `1px solid ${RF_BORDER}`, background: "rgba(6,13,8,0.35)" }}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RF_TEXT_MUTED }}>
        Em uso
      </span>
      {logo ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Logo" className="max-h-10 max-w-[140px] object-contain" />
        </div>
      ) : null}
      {favicon ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={favicon} alt="Favicon" className="h-8 w-8 object-contain" />
        </div>
      ) : null}
    </div>
  );
}

function PlataformaBrandLogosBlock({
  brandId,
  logoUrl,
  faviconUrl,
  onUploaded,
  onError,
}: {
  brandId: string;
  logoUrl: string;
  faviconUrl: string;
  onUploaded: (kind: AssetKind, row: PlatformBrandRow) => void;
  onError: (msg: string) => void;
}) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AssetKind>("logo");
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => {
    return () => {
      for (const item of queueRef.current) {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      setQueue((q) =>
        q.map((x) => (x.id === item.id ? { ...x, status: "uploading" as const, error: undefined } : x))
      );
      try {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("kind", item.kind);
        const res = await fetch(`/api/ops/platform-brands/${encodeURIComponent(brandId)}/logo`, {
          method: "POST",
          headers: await opsApiHeaders(),
          credentials: "include",
          body: fd,
        });
        const json = (await res.json()) as { data?: PlatformBrandRow; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Falha no upload.");
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "done" as const } : x)));
        onUploaded(item.kind, json.data!);
        setTimeout(() => {
          setQueue((q) => {
            const next = q.filter((x) => x.id !== item.id);
            const removed = q.find((x) => x.id === item.id);
            if (removed?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
            return next;
          });
        }, 1200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro no upload.";
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "error" as const, error: msg } : x)));
        onError(msg);
      }
    },
    [brandId, onError, onUploaded]
  );

  const adicionarFicheiro = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      const mime = (file.type || "").toLowerCase();
      const okMime =
        mime.startsWith("image/") || /\.(png|jpe?g|webp|svg|ico)$/i.test(file.name);
      if (!okMime) {
        onError("Formato inválido. Use PNG, JPG, WEBP, SVG ou ICO.");
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        onError("Arquivo muito grande (máx. 4 MB).");
        return;
      }

      const id = queueId(kind, file);
      const previewUrl = URL.createObjectURL(file);
      const item: QueueItem = { id, kind, file, previewUrl, status: "pending" };

      setQueue((q) => {
        for (const old of q) {
          if (old.kind === kind && old.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(old.previewUrl);
          }
        }
        return [...q.filter((x) => x.kind !== kind), item];
      });

      void uploadOne(item);
    },
    [kind, onError, uploadOne]
  );

  function removerDaFila(id: string) {
    setQueue((q) => {
      const item = q.find((x) => x.id === id);
      if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      return q.filter((x) => x.id !== id);
    });
  }

  function limparFila() {
    setQueue((q) => {
      for (const item of q) {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }

  const uploading = queue.some((x) => x.status === "uploading");

  return (
    <div className="space-y-4">
      <MarcaAssetsAtuais logoUrl={logoUrl} faviconUrl={faviconUrl} />
      <p className="text-xs" style={{ color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
        PNG, JPG, WEBP, SVG ou ICO · máx. 4 MB. Os ficheiros vão para o bucket{" "}
        <strong style={{ color: RF_TEXT_SECONDARY }}>platform-brands</strong> no Supabase Storage.
      </p>

      <div className="flex flex-wrap gap-2">
        {(["logo", "favicon"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
            style={{
              borderColor: kind === k ? RF_BORDER_STRONG : RF_BORDER,
              background: kind === k ? "rgba(146,255,0,0.12)" : "rgba(6,13,8,0.35)",
              color: kind === k ? RF_ACCENT : RF_TEXT_MUTED,
            }}
          >
            {k === "logo" ? "Logo principal" : "Favicon"}
          </button>
        ))}
      </div>

      <input
        id={fileInputId}
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          adicionarFicheiro(e.target.files);
          e.target.value = "";
        }}
      />

      <label
        htmlFor={uploading ? undefined : fileInputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) adicionarFicheiro(e.dataTransfer.files);
        }}
        style={{
          width: "100%",
          padding: "24px 16px",
          borderRadius: 12,
          border: `2px dashed ${dragOver ? RF_ACCENT : RF_BORDER_STRONG}`,
          background: dragOver ? "rgba(146,255,0,0.08)" : "rgba(6,13,8,0.55)",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.55 : 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <Upload size={26} color={RF_ACCENT} strokeWidth={1.75} />
        <span style={{ color: RF_TEXT_PRIMARY, fontSize: 13, fontWeight: 700 }}>
          Clique ou arraste a imagem ({kind === "logo" ? "logo principal" : "favicon"})
        </span>
        <span style={{ color: RF_TEXT_MUTED, fontSize: 11, textAlign: "center", lineHeight: 1.45 }}>
          O ficheiro aparece na fila abaixo e é enviado automaticamente
        </span>
      </label>

      {queue.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="m-0 text-[11px] font-bold" style={{ color: RF_ACCENT }}>
              Fila de envio ({queue.length})
            </p>
            <button
              type="button"
              onClick={limparFila}
              disabled={uploading}
              className="border-0 bg-transparent p-0 text-[11px] underline"
              style={{ color: RF_TEXT_MUTED, cursor: uploading ? "not-allowed" : "pointer" }}
            >
              Limpar tudo
            </button>
          </div>
          <div
            style={{
              border: `1px solid ${RF_BORDER}`,
              borderRadius: 10,
              overflow: "hidden",
              background: "rgba(6,13,8,0.35)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "52px 1fr auto 36px",
                gap: 8,
                padding: "8px 10px",
                borderBottom: `1px solid ${RF_BORDER}`,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: RF_TEXT_MUTED,
              }}
            >
              <span>Prévia</span>
              <span>Arquivo</span>
              <span style={{ textAlign: "right" }}>Tamanho</span>
              <span />
            </div>
            {queue.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px 1fr auto 36px",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderBottom: index < queue.length - 1 ? `1px solid ${RF_BORDER}` : "none",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${RF_BORDER}`,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt=""
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      color: RF_TEXT_PRIMARY,
                      wordBreak: "break-word",
                      lineHeight: 1.35,
                    }}
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>
                    {item.kind === "logo" ? "Logo principal" : "Favicon"}
                    {item.status === "uploading" ? " · A enviar…" : null}
                    {item.status === "done" ? " · Enviado" : null}
                    {item.status === "error" ? ` · ${item.error}` : null}
                  </p>
                </div>
                <span style={{ fontSize: 10, color: RF_TEXT_MUTED, whiteSpace: "nowrap" }}>
                  {item.status === "uploading" ? (
                    <Loader2 size={14} className="animate-spin" color={RF_ACCENT} />
                  ) : item.status === "done" ? (
                    <CheckCircle2 size={14} color={RF_ACCENT} />
                  ) : (
                    fmtTamanho(item.file.size)
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removerDaFila(item.id)}
                  disabled={item.status === "uploading"}
                  title="Remover da fila"
                  aria-label={`Remover ${item.file.name}`}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border"
                  style={{
                    color: "#f85149",
                    borderColor: "rgba(248,81,73,0.35)",
                    background: "transparent",
                    cursor: item.status === "uploading" ? "not-allowed" : "pointer",
                    opacity: item.status === "uploading" ? 0.5 : 1,
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WajeOwnerPlataformaSideover({
  open,
  row,
  createMode = false,
  onClose,
  onSaved,
  onCreated,
  onDeactivated,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [utilizadores, setUtilizadores] = useState<PlatformBrandUserRow[]>([]);
  const [utilStats, setUtilStats] = useState({
    tenants_total: 0,
    tenants_ativos: 0,
    usuarios_total: 0,
    usuarios_ativos: 0,
  });
  const [utilLoading, setUtilLoading] = useState(false);

  const isCreate = createMode || !row;

  useEffect(() => {
    if (row) setForm(rowToForm(row));
    else if (createMode) setForm(emptyForm());
    setErro("");
  }, [row, createMode, open]);

  useEffect(() => {
    if (!open || !row?.id) {
      setUtilizadores([]);
      return;
    }
    let cancelled = false;
    setUtilLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/ops/platform-brands/${encodeURIComponent(row.id)}/utilizadores`, {
          headers: await opsApiHeaders(),
          credentials: "include",
        });
        const json = (await res.json()) as {
          data?: { stats: typeof utilStats; usuarios: PlatformBrandUserRow[] };
          error?: string;
        };
        if (!cancelled && res.ok && json.data) {
          setUtilStats(json.data.stats);
          setUtilizadores(json.data.usuarios);
        }
      } catch {
        if (!cancelled) setUtilizadores([]);
      } finally {
        if (!cancelled) setUtilLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row?.id]);

  const handleLogoUploaded = useCallback(
    (kind: AssetKind, updated: PlatformBrandRow) => {
      if (kind === "logo") setForm((f) => ({ ...f, logo_url: updated.logo_url ?? "" }));
      else setForm((f) => ({ ...f, favicon_url: updated.favicon_url ?? "" }));
      onSaved(updated);
    },
    [onSaved]
  );

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const body = payloadFromForm(form);
      if (isCreate) {
        const res = await fetch("/api/ops/platform-brands", {
          method: "POST",
          headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { data?: PlatformBrandRow; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Falha ao criar.");
        onCreated(json.data!);
        onClose();
        return;
      }

      const res = await fetch(`/api/ops/platform-brands/${encodeURIComponent(row!.id)}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: PlatformBrandRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar.");
      onSaved(json.data!);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar() {
    if (!row || row.is_principal) return;
    if (!confirm(`Desativar a plataforma «${row.nome}»?`)) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/ops/platform-brands/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ativo: false }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao desativar.");
      onDeactivated?.(row.id);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao desativar.");
    } finally {
      setSalvando(false);
    }
  }

  const titulo = isCreate ? "Nova plataforma" : row?.nome ?? "White-label";

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="White-label"
      title={titulo}
      subtitle={isCreate ? "Marca e domínio do revendedor" : row?.slug}
      icon={Globe}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {!isCreate && row && !row.is_principal && row.ativo ? (
            <button
              type="button"
              onClick={() => void desativar()}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold text-[#f87171]"
              style={{ borderColor: "rgba(248,113,113,0.35)" }}
            >
              <Trash2 size={14} />
              Desativar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2.5 text-xs font-bold"
            style={{ borderColor: "rgba(146,255,0,0.25)", color: "#b8d4bc" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !form.nome.trim() || (isCreate && !form.slug.trim())}
            onClick={() => void salvar()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60"
            style={{ background: RF_ACCENT, color: "#0b1f10" }}
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isCreate ? "Criar" : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="space-y-5" style={rfBodyOnDarkStyle()}>
        {!isCreate && row ? (
          <div className="flex flex-wrap gap-2">
            <WajeOwnerStatusBadge variant={row.ativo ? "ativo" : "inativo"} />
            {row.is_principal ? <WajeOwnerStatusBadge variant="ativo" label="Principal" /> : null}
          </div>
        ) : null}

        {erro ? <p className="text-sm text-[#f87171]">{erro}</p> : null}

        <WajeOwnerSectionHeading>Identidade da marca</WajeOwnerSectionHeading>
        <p className="text-xs text-[#7a9a7e]">
          Mesma landing page e mesmo CRM — só mudam nome, cores e logos conforme o domínio.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {isCreate ? (
            <Field label="Slug (único)">
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="synkron"
              />
            </Field>
          ) : null}
          <Field label="Nome exibido">
            <input
              className={inputCls}
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field label="Tagline">
            <input
              className={inputCls}
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            />
          </Field>
          <Field label="Domínios (vírgula)">
            <input
              className={inputCls}
              value={form.dominios}
              onChange={(e) => setForm((f) => ({ ...f, dominios: e.target.value }))}
              placeholder="synkronia.com.br, www.synkronia.com.br"
            />
          </Field>
          <Field label="Empresa (rodapé)">
            <input
              className={inputCls}
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            />
          </Field>
          <Field label="Cor primária">
            <input
              className={inputCls}
              value={form.cor_primaria}
              onChange={(e) => setForm((f) => ({ ...f, cor_primaria: e.target.value }))}
            />
          </Field>
          <Field label="Cor destaque">
            <input
              className={inputCls}
              value={form.cor_accent}
              onChange={(e) => setForm((f) => ({ ...f, cor_accent: e.target.value }))}
            />
          </Field>
          <Field label="Cor fundo">
            <input
              className={inputCls}
              value={form.cor_fundo}
              onChange={(e) => setForm((f) => ({ ...f, cor_fundo: e.target.value }))}
            />
          </Field>
          {!row?.is_principal ? (
            <Field label="Status">
              <select
                className={inputCls}
                value={form.ativo ? "ativo" : "inativo"}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value === "ativo" }))}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>
          ) : null}
        </div>

        <WajeOwnerSectionHeading>Logos</WajeOwnerSectionHeading>
        {!isCreate && row ? (
          <PlataformaBrandLogosBlock
            brandId={row.id}
            logoUrl={form.logo_url}
            faviconUrl={form.favicon_url}
            onUploaded={handleLogoUploaded}
            onError={setErro}
          />
        ) : (
          <p className="text-xs text-[#7a9a7e]">
            Após criar a plataforma, abra novamente para enviar logos por arrastar e soltar.
          </p>
        )}

        <WajeOwnerSectionHeading>Landing pública</WajeOwnerSectionHeading>
        <p className="text-xs text-[#7a9a7e]">
          Assistente flutuante na landing («Olá! Precisa de ajuda?») — 3 perguntas e formulário de
          contacto para captar leads.
        </p>
        <Field label="Assistente de leads">
          <select
            className={inputCls}
            value={form.landing_assistant_ativo ? "ativo" : "inativo"}
            onChange={(e) =>
              setForm((f) => ({ ...f, landing_assistant_ativo: e.target.value === "ativo" }))
            }
          >
            <option value="ativo">Activo — visível na landing</option>
            <option value="inativo">Inactivo — oculto</option>
          </select>
        </Field>

        <WajeOwnerSectionHeading>Cadastro do revendedor (opcional)</WajeOwnerSectionHeading>
        <p className="text-xs text-[#7a9a7e]">
          Dados de PJ ou PF que opera esta marca — não obrigatório para activar o white-label.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className={inputCls}
              value={form.registration_type}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  registration_type: v,
                  document_type: v === "PJ" ? "CNPJ" : v === "PF" ? "CPF" : "",
                }));
              }}
            >
              <option value="">— Não informado —</option>
              <option value="PJ">Empresa (PJ)</option>
              <option value="PF">Pessoa física (PF)</option>
            </select>
          </Field>
          <Field label="Documento">
            <select
              className={inputCls}
              value={form.document_type}
              onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
            >
              <option value="">—</option>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
          </Field>
          <Field label="Número CNPJ/CPF">
            <input
              className={inputCls}
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
            />
          </Field>
          <Field label="Razão social / nome legal">
            <input
              className={inputCls}
              value={form.billing_legal_name}
              onChange={(e) => setForm((f) => ({ ...f, billing_legal_name: e.target.value }))}
            />
          </Field>
          <Field label="Contacto — nome">
            <input
              className={inputCls}
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
          </Field>
          <Field label="Contacto — e-mail">
            <input
              className={inputCls}
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            />
          </Field>
          <Field label="Contacto — telefone">
            <input
              className={inputCls}
              value={form.contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
            />
          </Field>
        </div>

        {!isCreate && row ? (
          <>
            <WajeOwnerSectionHeading>Controlo financeiro — clientes e utilizadores</WajeOwnerSectionHeading>
            <p className="text-xs text-[#7a9a7e]">
              Leitura apenas — total de empresas (tenants) e utilizadores desta marca para facturação
              e acompanhamento. Não apaga contas daqui.
            </p>
            <div
              className="grid gap-2 sm:grid-cols-2"
              style={{ border: `1px solid ${RF_BORDER}`, borderRadius: 12, padding: 12 }}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a9a7e]">
                  Clientes (tenants)
                </span>
                <p className="text-lg font-bold" style={{ color: RF_TEXT_PRIMARY }}>
                  {utilStats.tenants_ativos}
                  <span className="text-sm font-normal text-[#7a9a7e]"> / {utilStats.tenants_total} total</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a9a7e]">
                  Utilizadores
                </span>
                <p className="text-lg font-bold" style={{ color: RF_TEXT_PRIMARY }}>
                  {utilStats.usuarios_ativos}
                  <span className="text-sm font-normal text-[#7a9a7e]"> / {utilStats.usuarios_total} total</span>
                </p>
              </div>
            </div>
            {utilLoading ? (
              <p className="flex items-center gap-2 text-xs text-[#7a9a7e]">
                <Loader2 size={14} className="animate-spin" /> A carregar utilizadores…
              </p>
            ) : utilizadores.length === 0 ? (
              <p className="text-xs text-[#7a9a7e]">Nenhum utilizador associado a clientes desta marca.</p>
            ) : (
              <div
                className="max-h-52 overflow-y-auto rounded-xl"
                style={{ border: `1px solid ${RF_BORDER}`, background: "rgba(6,13,8,0.35)" }}
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${RF_BORDER}` }}>
                      <th className="px-3 py-2 font-bold text-[#7a9a7e]">E-mail</th>
                      <th className="px-3 py-2 font-bold text-[#7a9a7e]">Nome</th>
                      <th className="px-3 py-2 font-bold text-[#7a9a7e]">Cliente</th>
                      <th className="px-3 py-2 font-bold text-[#7a9a7e]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilizadores.map((u) => (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${RF_BORDER}` }}>
                        <td className="px-3 py-2" style={{ color: RF_TEXT_PRIMARY }}>
                          {u.email || "—"}
                        </td>
                        <td className="px-3 py-2" style={{ color: RF_TEXT_SECONDARY }}>
                          {u.name || "—"}
                        </td>
                        <td className="px-3 py-2" style={{ color: RF_TEXT_SECONDARY }}>
                          {u.tenant_nome || "—"}
                        </td>
                        <td className="px-3 py-2" style={{ color: RF_TEXT_MUTED }}>
                          {u.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}

        <p className="text-[11px] text-[#7a9a7e]">
          Webhook WhatsApp (UAZAPI) permanece em <strong className="text-[#b8d4bc]">waje.com.br</strong> para todas
          as marcas.
        </p>
      </div>
    </CrmRetrofitSideoverShell>
  );
}
