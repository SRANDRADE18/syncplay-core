# SyncPlay Core

SyncPlay é uma aplicação web de Watch Party (consumo sincronizado de vídeo) com arquitetura Soft Real-Time.

Este repositório é um monorepo contendo o frontend e o backend da aplicação.

## Estrutura do Projeto

- `/frontend`: Interface de usuário em React (Vite) + Tailwind CSS.
- `/backend`: Servidor Node.js com Express, Socket.io e Prisma ORM.

## Configuração do Ambiente Local

### Pré-requisitos
- Node.js (v18+)
- PostgreSQL rodando localmente ou em container (Docker).

### Backend

1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente:
   - Copie o arquivo `.env.example` para `.env`:
     ```bash
     cp .env.example .env
     ```
   - Atualize a string de conexão `DATABASE_URL` no `.env` com as credenciais do seu banco PostgreSQL local.
4. Sincronize o schema do banco de dados:
   ```bash
   npx prisma db push
   ```
5. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

### Frontend

1. Em um novo terminal, navegue até a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (opcional):
   - Copie o arquivo `.env.example` para `.env`:
     ```bash
     cp .env.example .env
     ```
4. Inicie a aplicação:
   ```bash
   npm run dev
   ```

---

## Cronograma de Refinamento (13 Dias para Entrega)

Plano de ação estruturado em 5 blocos para preparação final e entrega acadêmica:

| Bloco | Período | Foco e Entregáveis | Status |
| :--- | :--- | :--- | :--- |
| **Bloco 1** | **Dias 1 a 3** | **Estabilização e Itens Críticos:** Flexibilização da trava de IP no cadastro (permitindo testes na mesma rede/Wi-Fi), centralização de URLs via variáveis de ambiente (`.env`), remoção de comparação de senha em texto plano (uso estrito de `bcrypt`) e limpeza total de avisos do linter (`oxlint`). | Concluído |
| **Bloco 2** | **Dias 4 a 6** | **Arquitetura e Persistência:** Refatoração e modularização do backend (`routes`, `controllers`, `sockets`, `services`) e persistência real do CRUD de salas no PostgreSQL via Prisma. | Pendente |
| **Bloco 3** | **Dias 7 a 9** | **Sync Engine, Infra e Testes:** Implementação de *Heartbeat* periódico de sincronização de vídeo, criação de `docker-compose.yml` para subir o banco com um comando e testes automatizados essenciais. | Pendente |
| **Bloco 4** | **Dias 10 a 11** | **UX e Documentação Técnica:** Tratamento de políticas de *Autoplay* dos navegadores, diagramas de arquitetura (Mermaid) no README e bateria de testes em múltiplos navegadores. | Pendente |
| **Bloco 5** | **Dias 12 a 13** | **Code Freeze e Apresentação:** Congelamento de código, revisão geral, roteiro de apresentação para a banca e gravação de vídeo de demonstração de backup. | Pendente |

