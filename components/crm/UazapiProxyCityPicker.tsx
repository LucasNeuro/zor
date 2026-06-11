"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import { RF_BORDER_STRONG, RF_TEXT_MUTED, RF_TEXT_PRIMARY } from "@/lib/crm/crm-retrofit-dark-theme";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  buildProxyCityApiSearch,
  filterProxyCitiesByQuery,
  formatProxyCityDisplay,
  formatProxyCityLabel,
} from "@/lib/whatsapp/uazapi-proxy-city-label";

export type CidadeProxyUazapi = {
  value: string;
  label: string;
  state?: string;
};

const BR_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

type Props = {
  agenteSlug: string;
  cityValue: string;
  stateValue: string;
  disabled?: boolean;
  saving?: boolean;
  dark?: boolean;
  temInstancia?: boolean;
  externalError?: string | null;
  onSelect: (city: CidadeProxyUazapi) => void;
  onSave: () => void;
};

function parseCitiesPayload(raw: unknown): CidadeProxyUazapi[] {
  if (!Array.isArray(raw)) return [];
  const parsed: CidadeProxyUazapi[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const value = typeof o.value === "string" ? o.value.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : value;
    if (!value) continue;
    parsed.push({
      value,
      label: label || formatProxyCityLabel(value),
      state: typeof o.state === "string" ? o.state.trim().toLowerCase() : undefined,
    });
  }
  parsed.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return parsed;
}

export function UazapiProxyCityPicker({
  agenteSlug,
  cityValue,
  stateValue,
  disabled = false,
  saving = false,
  dark = false,
  temInstancia = false,
  externalError = null,
  onSelect,
  onSave,
}: Props) {
  const [uf, setUf] = useState(stateValue.trim().toUpperCase());
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CidadeProxyUazapi[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchSeqRef = useRef(0);

  const selectedDisplay = useMemo(() => {
    if (!cityValue.trim()) return null;
    const fromResults = results.find((c) => c.value === cityValue);
    const label = fromResults?.label || formatProxyCityLabel(cityValue);
    const st = (fromResults?.state || stateValue || uf).trim().toUpperCase();
    return formatProxyCityDisplay(label, st);
  }, [cityValue, stateValue, uf, results]);

  useEffect(() => {
    setUf(stateValue.trim().toUpperCase());
  }, [stateValue]);

  const fetchCities = useCallback(
    async (opts: { uf?: string; search?: string; userQuery?: string }) => {
      const userQuery = (opts.userQuery ?? opts.search ?? "").trim();
      if (userQuery.length < 2) return;

      const seq = ++fetchSeqRef.current;
      setResults([]);
      setLoading(true);
      setFetchError(null);

      const apiSearch = buildProxyCityApiSearch(userQuery);
      const ufNorm = opts.uf?.trim().toLowerCase();

      try {
        const body: Record<string, unknown> = {
          action: "list_proxy_cities",
          proxy_managed_country: "br",
        };
        if (ufNorm) body.proxy_managed_state = ufNorm;
        if (apiSearch) body.search = apiSearch;

        const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/uazapi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));

        if (seq !== fetchSeqRef.current) return;

        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : typeof data.detail === "string"
                ? data.detail
                : "Não foi possível buscar cidades.";
          setFetchError(msg);
          setResults([]);
          return;
        }

        let parsed = parseCitiesPayload(data.cities);
        parsed = filterProxyCitiesByQuery(parsed, userQuery);

        if (parsed.length === 0 && apiSearch.length >= 3) {
          const fallbackSearch = normalizeCitySearchFallback(userQuery);
          if (fallbackSearch && fallbackSearch !== apiSearch) {
            const retryBody: Record<string, unknown> = {
              action: "list_proxy_cities",
              proxy_managed_country: "br",
              search: fallbackSearch,
            };
            if (ufNorm) retryBody.proxy_managed_state = ufNorm;

            const retryRes = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/uazapi`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...internalApiHeaders() },
              body: JSON.stringify(retryBody),
            });
            const retryData = await retryRes.json().catch(() => ({}));
            if (seq !== fetchSeqRef.current) return;
            if (retryRes.ok) {
              parsed = filterProxyCitiesByQuery(parseCitiesPayload(retryData.cities), userQuery);
            }
          }
        }

        if (seq !== fetchSeqRef.current) return;

        setResults(parsed.slice(0, 40));
        setHighlightIdx(0);
        if (parsed.length === 0) {
          setFetchError(`Nenhuma cidade encontrada para «${userQuery}»${ufNorm ? ` em ${ufNorm.toUpperCase()}` : ""}.`);
        }
      } catch {
        if (seq !== fetchSeqRef.current) return;
        setFetchError("Falha de rede ao buscar cidades.");
        setResults([]);
      } finally {
        if (seq === fetchSeqRef.current) setLoading(false);
      }
    },
    [agenteSlug]
  );

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      fetchSeqRef.current += 1;
      setResults([]);
      setFetchError(null);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchCities({ uf: uf || undefined, search: q, userQuery: q });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search, uf, fetchCities]);

  useEffect(() => {
    if (!cityValue.trim() || search.trim().length >= 2) return;
    const probe = formatProxyCityLabel(cityValue);
    if (probe.length < 2) return;
    void fetchCities({
      uf: (stateValue || uf || "").trim().toLowerCase() || undefined,
      search: probe,
      userQuery: probe,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolver rótulo guardado ao abrir
  }, [cityValue, stateValue]);

  function pickCity(c: CidadeProxyUazapi) {
    onSelect(c);
    setSearch("");
    setResults([]);
    setFetchError(null);
    if (c.state) setUf(c.state.toUpperCase());
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[highlightIdx];
      if (c) pickCity(c);
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, results.length]);

  const fieldStyle: CSSProperties = dark
    ? {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 9,
        border: `1px solid ${RF_BORDER_STRONG}`,
        background: "rgba(6, 13, 8, 0.85)",
        color: RF_TEXT_PRIMARY,
        fontSize: 13,
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 9,
        border: "1px solid #dcebd8",
        background: "#f8fcf6",
        color: "#0b2210",
        fontSize: 13,
        boxSizing: "border-box",
      };

  const canSave = Boolean(cityValue.trim()) && !disabled && !saving;
  const searchReady = uf.trim().length === 2;
  const showResults = search.trim().length >= 2 && (loading || results.length > 0 || fetchError);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "88px minmax(0, 1fr)",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>UF</label>
          <select
            value={uf}
            disabled={disabled}
            onChange={(e) => {
              setUf(e.target.value);
              setSearch("");
              setResults([]);
              setFetchError(null);
              window.setTimeout(() => searchRef.current?.focus(), 0);
            }}
            style={fieldStyle}
            aria-label="Estado (UF)"
          >
            <option value="">—</option>
            {BR_UFS.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Buscar cidade</label>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 11,
                top: "50%",
                transform: "translateY(-50%)",
                color: dark ? RF_TEXT_MUTED : "#6e7681",
                pointerEvents: "none",
              }}
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={search}
              disabled={disabled || !searchReady}
              placeholder={searchReady ? "Ex.: Campinas, Recife…" : "Escolha a UF primeiro"}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              style={{
                ...fieldStyle,
                paddingLeft: 34,
              }}
              aria-autocomplete="list"
              aria-expanded={showResults}
            />
            {loading ? (
              <Loader2
                size={15}
                className="animate-spin"
                style={{
                  position: "absolute",
                  right: 11,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: CRM_ACCENT,
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: dark ? RF_TEXT_MUTED : "#6e7681", lineHeight: 1.45 }}>
        Escolha o <strong>estado</strong>, digite pelo menos <strong>2 letras</strong> da cidade e seleccione na lista —
        evita percorrer centenas de opções no menu antigo.
      </p>

      {selectedDisplay ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 9,
            border: `1px solid ${CRM_ACCENT}55`,
            background: dark ? "rgba(63, 185, 80, 0.1)" : "#23863614",
          }}
        >
          <MapPin size={14} style={{ color: CRM_ACCENT, flexShrink: 0 }} aria-hidden />
          <span style={{ fontSize: 12, fontWeight: 700, color: dark ? RF_TEXT_PRIMARY : "#0b2210", flex: 1 }}>
            Seleccionada: {selectedDisplay}
          </span>
        </div>
      ) : null}

      {showResults ? (
        <div
          ref={listRef}
          role="listbox"
          style={{
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 10,
            border: dark ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
            background: dark ? "rgba(6, 13, 8, 0.92)" : "#ffffff",
          }}
        >
          {loading && results.length === 0 ? (
            <p style={{ margin: 0, padding: 12, fontSize: 12, color: dark ? RF_TEXT_MUTED : "#6e7681" }}>
              A buscar cidades…
            </p>
          ) : null}
          {!loading && fetchError ? (
            <p style={{ margin: 0, padding: 12, fontSize: 12, color: "#f85149" }}>{fetchError}</p>
          ) : null}
          {results.map((c, idx) => {
            const active = idx === highlightIdx;
            const selected = c.value === cityValue;
            return (
              <button
                key={c.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => pickCity(c)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderBottom:
                    idx < results.length - 1
                      ? dark
                        ? "1px solid rgba(63, 152, 72, 0.15)"
                        : "1px solid #eef7eb"
                      : "none",
                  background: active
                    ? dark
                      ? "rgba(146, 255, 0, 0.1)"
                      : "#23863618"
                    : "transparent",
                  color: dark ? RF_TEXT_PRIMARY : "#0b2210",
                  fontSize: 13,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {formatProxyCityDisplay(c.label, c.state)}
              </button>
            );
          })}
        </div>
      ) : search.trim().length > 0 && search.trim().length < 2 ? (
        <p style={{ margin: 0, fontSize: 11, color: dark ? RF_TEXT_MUTED : "#6e7681" }}>
          Digite mais {2 - search.trim().length} caractere(s) para buscar.
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 9,
            border: `1px solid ${CRM_ACCENT}66`,
            background: canSave ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.4)",
            color: canSave ? CRM_ACCENT : "#6e7681",
            fontSize: 12,
            fontWeight: 800,
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Guardar região
        </button>
        <button
          type="button"
          disabled={disabled || loading || search.trim().length < 2}
          onClick={() => void fetchCities({ uf: uf || undefined, search: search.trim(), userQuery: search.trim() })}
          style={{
            border: "none",
            background: "transparent",
            color: CRM_ACCENT,
            fontSize: 11,
            fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RefreshCw size={12} aria-hidden />
          Actualizar busca
        </button>
      </div>

      {externalError ? (
        <p style={{ margin: 0, color: "#f85149", fontSize: 11 }}>
          {!temInstancia && /invalid token/i.test(externalError)
            ? "A busca de cidades fica disponível depois de criar a ligação WhatsApp."
            : externalError.replace(/UAZAPI/gi, "WhatsApp")}
        </p>
      ) : !temInstancia && !externalError ? (
        <p style={{ margin: 0, color: dark ? RF_TEXT_MUTED : "#5d7a67", fontSize: 11 }}>
          Crie a instância WhatsApp primeiro; depois escolha UF + cidade e guarde a região.
        </p>
      ) : null}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  color: "#5d7a67",
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 8,
};

function normalizeCitySearchFallback(query: string): string {
  const norm = query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  const first = norm.split(/\s+/).filter(Boolean)[0];
  return first && first.length >= 2 ? first : norm.replace(/\s+/g, "");
}
