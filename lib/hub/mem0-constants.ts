/** Toggle por agente — activa recall automático Mem0 (não é function calling). */
export const MEM0_SUPER_MEMORIA_KEY = "hub_int_mem0_super_memoria";

/** Ferramenta explícita de busca semântica (function calling). */
export const MEM0_BUSCAR_KEY = "hub_int_mem0_buscar";

export const MEM0_INTEGRADOR_ID = "mem0" as const;

export const MEM0_FERRAMENTA_KEYS = [MEM0_SUPER_MEMORIA_KEY, MEM0_BUSCAR_KEY] as const;
