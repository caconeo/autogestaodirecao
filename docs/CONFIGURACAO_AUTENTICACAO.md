# Configuração da fundação de autenticação

## Variáveis obrigatórias

- `DATABASE_URL`: conexão pooled do Neon com TLS.
- `AUTH_JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `AUTH_JWT_ISSUER`: emissor dos tokens, por exemplo `auto-gestao-direcao`.
- `AUTH_JWT_AUDIENCE`: audiência da API, por exemplo `agd-api`.
- `CPF_LOOKUP_SECRET`: segundo segredo independente, com pelo menos 32 caracteres.
- `ALLOWED_ORIGIN`: origem pública autorizada no Netlify.

`AUTH_JWT_SECRET` e `CPF_LOOKUP_SECRET` não podem ter o mesmo valor e não devem ser incluídos no Git.

## Aplicação da migração

Execute `node scripts/migrate.mjs` somente depois de configurar as variáveis no ambiente correto.

## Endpoints iniciais

- `POST /api/auth?action=register-instructor`
- `POST /api/auth?action=login`
- `GET /api/auth?action=me`
- `POST /api/demo-admin?action=create-instructor` — somente `SUPER_ADMIN`
- `POST /api/demo-admin?action=create-student` — somente `SUPER_ADMIN`

Os cadastros demo recebem `modo_demo = true` na organização, identidade e pessoa cadastrada. Um aluno demo somente pode ser ligado a um instrutor demo ativo.
