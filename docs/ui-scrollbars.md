# Barras de rolagem (padrão global)

## Referência visual

O padrão segue o **sideover / painel direito** (ex.: `DecisionPanel`, listas com `panel-scroll`): trilho **transparente**, indicador **fino** (~3px), cor **clara semitransparente** sobre fundo escuro, extremidades **bem arredondadas** (pill).

## Implementação

Definido em `app/globals.css`:

- Variáveis em `:root`: `--obra-scrollbar-size`, `--obra-scrollbar-thumb`, `--obra-scrollbar-thumb-hover`, `--obra-scrollbar-track`.
- Regras em **`*`** para Firefox (`scrollbar-width` / `scrollbar-color`) e WebKit (`::-webkit-scrollbar*`).
- Classes **`.panel-scroll`**, **`.scrollbar-soft`** e **`.custom-scrollbar`** repetem os mesmos tokens (compatibilidade com componentes que já usavam nomes antigos).

## Manutenção

- Para ajustar o look em todo o produto, altere apenas as variáveis em `:root`.
- Não é necessário repetir `scrollbarWidth` / `scrollbarColor` em estilos inline; o global aplica-se a qualquer elemento com overflow que mostre scrollbar.
- Exceções futuras (ex.: superfície clara onde o polegar claro some): usar um wrapper com classe que sobrescreva `--obra-scrollbar-thumb` localmente.

## Histórico

| Data       | Notas |
|------------|--------|
| 2026-05-11 | Unificação global + tokens; legado `scrollbar-soft` / `custom-scrollbar` alinhados ao sideover. |
