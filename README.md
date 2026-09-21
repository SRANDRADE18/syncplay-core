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
3. Inicie a aplicação:
   ```bash
   npm run dev
   ```
