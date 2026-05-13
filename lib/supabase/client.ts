import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { installCrmAuthBridge } from "@/lib/supabase/crm-auth-bridge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variáveis de ambiente do Supabase não encontradas. Verifique o .env.local");
}

/** Uma instância por contexto browser; reutiliza em HMR para evitar avisos GoTrueClient duplicados. */
const globalForSupabase = globalThis as unknown as { __supabaseBrowser?: SupabaseClient };

export const supabase =
  globalForSupabase.__supabaseBrowser ??
  createClient(supabaseUrl, supabaseAnonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

if (typeof globalThis !== "undefined") {
  globalForSupabase.__supabaseBrowser = supabase;
}

if (typeof window !== "undefined") {
  installCrmAuthBridge(supabase);
}

export type HubPessoa = {
  id: string
  codigo: string
  nome: string
  telefone: string | null
  whatsapp_id: string | null
  email: string | null
  tipo: 'lead' | 'parceiro' | 'cliente' | 'fornecedor' | 'prospect'
  documento: string | null
  empresa: string | null
  cidade: string | null
  estado: string | null
  origem: string | null
  tags: string[]
  dados_extras: Record<string, unknown>
  criado_em: string
  atualizado_em: string
}

export type HubLead = {
  id: string
  codigo: string
  numero_visual: number
  pessoa_id: string
  campanha_id: string | null
  tipo: 'imobiliario' | 'reforma' | 'produto_servico' | 'fornecedor'
  prefixo_mercado: 'IMB' | 'ARQ' | 'RFM' | 'MRC' | 'ENG' | 'SRV' | 'PRO' | 'FOR'
  fase: 'entrada' | 'espera' | 'qualificacao' | 'apresentacao' | 'negociacao' | 'fechamento' | 'pos_venda' | 'perdido' | 'ganho'
  sala_canvas: string
  posicao_x: number
  posicao_y: number
  status_visual: 'normal' | 'critico' | 'frio' | 'quente'
  temperatura: number
  sla_horas: number
  sla_expira_em: string | null
  sla_violado: boolean
  ia_ativa: boolean
  ia_pausada_motivo: string | null
  ia_pausada_em: string | null
  atendente_id: string | null
  score: number
  descricao_projeto: string | null
  valor_estimado: number | null
  prazo_projeto: string | null
  dados_coletados: Record<string, unknown>
  dados_extras: Record<string, unknown>
  criado_em: string
  atualizado_em: string
  hub_pessoas?: HubPessoa
}

export type HubNegocio = {
  id: string
  codigo: string
  lead_id: string
  pessoa_id: string
  titulo: string
  descricao: string | null
  tipo: string
  prefixo_mercado: string
  valor_estimado: number | null
  valor_fechado: number | null
  percentual_comissao: number
  comissao_calculada: number | null
  status: 'aberto' | 'em_negociacao' | 'fechado_ganho' | 'fechado_perdido' | 'cancelado'
  etapa: string
  data_previsao_fechamento: string | null
  data_fechamento: string | null
  criado_em: string
  atualizado_em: string
}

export type HubConversa = {
  id: string
  lead_id: string
  pessoa_id: string
  canal: 'whatsapp' | 'email' | 'telefone' | 'presencial' | 'portal' | 'interno'
  status: 'ativa' | 'pausada' | 'encerrada' | 'transferida'
  ia_ativa: boolean
  ia_modelo: string | null
  ia_pausada_motivo: string | null
  atendente_id: string | null
  transferida_para: string | null
  total_mensagens: number
  ultima_mensagem_em: string | null
  ultima_mensagem_preview: string | null
  aberta_em: string
  encerrada_em: string | null
  dados_extras: Record<string, unknown>
  criado_em: string
}

export type HubMensagem = {
  id: string
  conversa_id: string
  lead_id: string
  pessoa_id: string
  remetente: 'lead' | 'agente' | 'sistema' | 'ia'
  agente_id: string | null
  ia_modelo: string | null
  tipo_conteudo: 'texto' | 'audio' | 'imagem' | 'documento' | 'localizacao' | 'sistema'
  conteudo: string | null
  conteudo_original: string | null
  url_midia: string | null
  nome_arquivo: string | null
  whatsapp_message_id: string | null
  whatsapp_status: 'enviado' | 'entregue' | 'lido' | 'erro' | null
  sugestao_ia: string | null
  aprovado_por: string | null
  metadados: Record<string, unknown>
  enviada_em: string
  criado_em: string
}

export type HubDecisao = {
  id: string
  tipo: string
  severidade: 'critico' | 'atencao' | 'info'
  titulo: string
  descricao: string | null
  contexto: Record<string, unknown>
  causa_provavel: string | null
  recomendacao_ia: string | null
  lead_id: string | null
  negocio_id: string | null
  parceiro_id: string | null
  pessoa_id: string | null
  status: 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado' | 'expirado'
  nivel_aprovacao: number
  aprovado_por: string | null
  aprovado_em: string | null
  expira_em: string | null
  criado_em: string
}

export type HubParceiro = {
  id: string
  codigo: string
  pessoa_id: string
  especialidade: string
  areas_atuacao: string[]
  cidades_atuacao: string[]
  status_homologacao: 'pendente' | 'documentacao' | 'entrevista' | 'aprovado' | 'suspenso' | 'reprovado'
  etapa_homologacao: number
  homologado_em: string | null
  transparency_score: number
  performance_score: number
  fit_score: number
  disponivel: boolean
  capacidade_leads: number
  leads_ativos: number
  percentual_comissao: number
  total_comissoes: number
  portal_ativo: boolean
  ultimo_acesso: string | null
  dados_extras: Record<string, unknown>
  criado_em: string
  atualizado_em: string
}
