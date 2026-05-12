# Navegação lateral do CRM (`app/crm/layout.tsx`)

## Objetivo

Reduzir rolagem na sidebar, manter a marca Obra10+ e o acesso ao Escritório virtual, com visual alinhado ao produto (tom escuro, verde de destaque).

## Comportamento (atual)

### Desktop (`md+`)

- **Sidebar flutuante** com cantos arredondados, borda e sombra.
- **Fundo em gradiente** (`SIDEBAR_GRADIENT`): azul muito profundo no topo (`#0a1628`) descendo para tons próximos ao cinza já usado no app (`#1a1f27`), sem imagem de escritório no fundo da shell do CRM.
- **Toggle expandir/recolher**: botão **circular verde** menor (**28×28px**, `h-7 w-7`), na **borda direita** com `translate-x-1/2` (metade para fora). **`top-2` fixo** nos dois estados (sem “salto” ao recolher/expandir). **Expandido**: cabeçalho com `pr-10` / `md:pr-11` para a marca não encostar no toggle. **Recolhido**: `mt-6` + `pr-3` no bloco do selo e `mb-3` abaixo do logo para o O+ não ficar por baixo do botão. Chevron 14px; `touch-manipulation` para toque em tablets. Em viewports `< md` a sidebar (e este toggle) não aparecem — o fluxo móvel continua no header + drawer.
- **Menu expandido**: itens agrupados em **gavetas** (`NAV_GROUPS`). Cada gaveta é um acordeão: cabeçalho com título + chevron; ao abrir, os links aparecem num painel com **fundo levemente mais escuro** e **sombra interna** (efeito “por detrás” só dentro da sidebar).
- **Menu recolhido**: lista única só com ícones (lista plana `NAV`), sem gavetas — ainda pode rolar se a altura da janela for muito baixa.
- **Gaveta aberta**: ao mudar de rota, a gaveta que contém a rota ativa é **reaberta automaticamente** (sincronização com `pathname`).
- **Acordeão**: clicar de novo no cabeçalho da gaveta aberta **fecha** essa gaveta (`openDrawerId === null`), deixando só os títulos até o utilizador reabrir ou mudar de página.

### Mobile

- Drawer lateral com o **mesmo gradiente** e as **mesmas gavetas** que no desktop expandido.
- Backdrop escuro (`bg-black/55`) por detrás do painel do drawer (comportamento anterior, mantido).

## Dados

- **`NAV_GROUPS`**: fonte de verdade dos grupos; ordem e rótulos são de produto.
- **`NAV`**: `flatMap` dos grupos — usado onde a lista plana é necessária; manter coerente com os grupos.

## Alterações futuras (notas)

- Se o modo recolhido continuar longo demais em alturas pequenas: considerar segundo nível (popover) ou reduzir espaçamento apenas nesse modo.
- Persistir `openDrawerId` em `localStorage` é opcional; hoje só persiste **sidebar expandido/recolhido** (`SIDEBAR_STORAGE_KEY`).

## Histórico resumido

| Data       | Alteração |
|------------|-----------|
| 2026-05-11 | Gavetas (acordeão), gradiente azul→cinza, toggle circular verde na borda da sidebar, documento criado. |
| 2026-05-11 | Toggle menor (28px), posicionado abaixo do selo quando recolhido, `pr-8`/`md:pr-9` no cabeçalho expandido; mobile continua em drawer separado. |
| 2026-05-11 | Toggle com `top-2` estável; cabeçalho `pr-10`/`md:pr-11`; recolhido `mt-6`, `pr-3`, `mb-3` no bloco do logo. |
