/** Fundo principal do conteúdo CRM */
export const CRM_SURFACE_MAIN = "#f8fcf6";

/** Cartões, sidebar, chrome sólido */
export const CRM_SURFACE_CARD = "#ffffff";

/** Faixa exterior / mobile shell / alt */
export const CRM_SURFACE_ALT = "#eef7eb";

/** Skeleton leve (barras, chips) */
export const CRM_SKELETON = "#e8f0e6";

/** Skeleton mais contrastado (linhas de lista) */
export const CRM_SKELETON_STRONG = "#dcebd8";

/** Borda suave entre superfícies */
export const CRM_BORDER_SOFT = "#e8f0e6";

/** Sidebar CRM */
export const CRM_SIDEBAR_GRADIENT =
  "linear-gradient(180deg, #f8fbf7 0%, #f2f8ef 38%, #eef6ea 72%, #eaf3e6 100%)";

/**
 * Superfície única do chrome CRM (sidebar desktop, flyouts, drawer mobile, header md).
 * Mesma cor evita “dois azuis” entre sideover e faixa de título.
 */
export const CRM_CHROME_SOLID = "#f2f8ef";

/** Faixa antiga (gradiente); mobile / páginas sem blend podem continuar a usar. */
export const CRM_HEADER_BAR_GRADIENT = CRM_SIDEBAR_GRADIENT;

/** Estilos inline para `app/crm/loading.tsx` e skeletons segmentados */
export const CRM_LOADING_SHELL = {
  background: CRM_SURFACE_MAIN,
  skeleton: CRM_SKELETON,
  skeletonStrong: CRM_SKELETON_STRONG,
  rowBorder: CRM_BORDER_SOFT,
} as const;
