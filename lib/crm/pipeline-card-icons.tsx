import type { LucideIcon } from "lucide-react";
import {
  CircleDot,
  Flag,
  Flame,
  Globe,
  Handshake,
  Inbox,
  Instagram,
  Linkedin,
  Megaphone,
  MessageCircle,
  Monitor,
  Phone,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserPlus,
  XCircle,
} from "lucide-react";

const ORIGEM_ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  meta_ads: Megaphone,
  google_ads: Target,
  linkedin: Linkedin,
  site: Globe,
  indicacao: UserPlus,
  interno: Monitor,
  simulacao_ia: Monitor,
  outro: CircleDot,
};

const ESTAGIO_ICONS: Record<string, LucideIcon> = {
  novo: Inbox,
  em_atendimento: Phone,
  qualificando: Sparkles,
  qualificado: Star,
  proposta: Flag,
  negociando: Handshake,
  fechamento: Flame,
  ganho: Trophy,
  perdido: XCircle,
  spam_invalido: XCircle,
  em_negociacao: Handshake,
  aberto: CircleDot,
};

export function origemIcon(origem: string | null | undefined): LucideIcon {
  if (!origem) return CircleDot;
  return ORIGEM_ICONS[origem] || CircleDot;
}

export function estagioIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return CircleDot;
  const key = slug.toLowerCase().replace(/\s+/g, "_");
  return ESTAGIO_ICONS[key] || CircleDot;
}
