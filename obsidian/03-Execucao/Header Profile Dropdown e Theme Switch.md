---
type: implementation
updated: 2026-08-10
module: header-profile-dropdown
---

# Menu de Perfil e Seletor de Tema no Header

Data: 2026-08-10

## Implementado

### 1. Seletor de Tema (Switch Pill `🌙`)
- Adicionado botão pill arredondado com ícone de lua `🌙` e botão deslizante.
- Posicionado à esquerda do perfil no cabeçalho superior (`topbar`).

### 2. Botão de Perfil Arredondado (`user-profile-pill`)
- Substituiu o texto bruto e botão "Sair" retangular por um botão pill moderno:
  - Círculo de avatar branco com ícone de usuário `👤` ou inicial.
  - Nome do usuário (ex: `admin` / `Sysadmin`).
  - Indicador chevron `▲` / `▼`.

### 3. Dropdown de Perfil Flutuante (`user-profile-dropdown`)
- Ao clicar no perfil, abre um menu flutuante em vidro fosco com:
  - **✏ Editar perfil**: abre o modal corporativo de edição do usuário logado.
  - Linha divisória.
  - **🚪 Sair**: botão de logout em texto e ícone em vermelho com hover sutil.
- Fechamento automático ao clicar fora (`mousedown` global).

### 4. Modal de Edição de Perfil (`EditProfileModal`)
- Modal para atualizar o nome de exibição e senha corporativa do usuário ativo.
- Notificação Toast de confirmação ao salvar.

## Validação

- `npm.cmd run typecheck` — 0 erros.
- `npm.cmd run build:web` — compilado em 2.28s.
