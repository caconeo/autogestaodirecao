# Dossiê Técnico Atual — Gestão do Auto Gestão de Direção

**Versão do documento:** 1.0  
**Data de referência:** 11/10/2026  
**Repositório:** `caconeo/autogestaodirecao`  
**Branch principal:** `main`  
**Último commit documentado:** `42341d3 feat: add secure instructor finance foundation`

## 1. Finalidade deste documento

Este é o dossiê operacional da parte de **gestão** do Auto Gestão de Direção. Ele registra a arquitetura atual, a estrutura de pastas, o banco de dados, os fluxos de autenticação, as regras de negócio, os controles de segurança, o estado do frontend, o processo de build/deploy e os próximos passos.

O objetivo é permitir que outro desenvolvedor ou agente consiga assumir o projeto sem depender do histórico da conversa.

Este documento deve ser atualizado sempre que houver alteração relevante de código, banco, API, regra de negócio, segurança ou infraestrutura.

## 2. Visão do produto

O sistema é uma plataforma web de gestão para instrutores autônomos e, futuramente, autoescolas/CFCs. A prioridade atual é o instrutor, especialmente:

- cadastro e acesso seguro;
- organização própria e isolamento por tenant;
- gestão de alunos e veículos;
- agenda de aulas;
- pacotes de aulas;
- contas a receber;
- pagamentos parciais;
- despesas;
- painel financeiro;
- operação via celular com requisitos de acessibilidade WCAG 2.2 AA;
- demonstrações controladas para o administrador master.

O simulador gamificado e o Auditor CTB são um produto separado. Eles permanecem no repositório por compatibilidade e evolução futura, mas não fazem parte da implementação financeira atual e não devem ser modificados durante a evolução da gestão sem solicitação explícita.

## 3. Estado atual em uma frase

A base de gestão possui frontend vanilla JavaScript, APIs serverless protegidas em Netlify Functions e persistência Neon PostgreSQL; autenticação real de instrutor, migrações de identidade, regra de maioridade e API financeira tenant-safe estão implementadas, enquanto o cadastro completo de alunos, convites por e-mail, Google OAuth e substituição de todos os mocks ainda estão em evolução.

## 4. Arquitetura atual

```text
Navegador / celular
        |
        | HTTPS + Bearer JWT
        v
Netlify — arquivos estáticos em public/
        |
        | /api/* -> /.netlify/functions/:splat
        v
Netlify Functions — Node.js ESM
        |
        | @neondatabase/serverless + DATABASE_URL
        v
Neon PostgreSQL
```

### 4.1. Camadas

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Interface | HTML5, CSS, JavaScript sem framework | Painéis, formulários, navegação, responsividade e integração com APIs |
| Estado de sessão | `sessionStorage` somente para o token atual | Manter a sessão do navegador; não é fonte de autorização |
| API | Netlify Functions em `.mjs` | Autenticação, autorização, regras e acesso ao banco |
| Banco | Neon PostgreSQL | Dados persistentes, relacionamentos, triggers e migrações |
| Deploy | Netlify | Build, hospedagem estática e funções serverless |
| Versionamento | Git/GitHub | Histórico, colaboração e deploy conectado |
| Produto separado | `simulator/` | Motor do simulador, auditoria CTB, testes e áudios |

O navegador não deve acessar o Neon diretamente. Toda leitura ou alteração de dados passa por uma Function autenticada.

## 5. Estrutura de diretórios

```text
auto_gestao_direcao/
├── .agents/skills/                 # Skills locais relacionadas ao Neon
├── .env                            # Segredos locais; ignorado pelo Git
├── .env.example                    # Modelo de variáveis sem valores secretos
├── .gitignore
├── docs/                           # Documentação funcional e técnica
│   ├── CONFIGURACAO_AUTENTICACAO.md
│   ├── DECISOES.md
│   ├── DOSSIE_DO_SISTEMA.md        # Dossiê histórico/mestre anterior
│   ├── DOSSIE_GESTAO_ATUAL.md      # Este documento, estado consolidado atual
│   ├── ESCOPO_MVP.md
│   ├── GOVERNANCA_LGPD.md
│   ├── MODELO_DADOS.md
│   ├── ORIGEM_IDEA.md              # nome exato pode variar conforme histórico
│   ├── PLANO_CADASTRO_REAL.md
│   ├── PROGRESSO.md
│   ├── REGRA_MAIORIDADE.md
│   └── REQUISITOS_INSTRUTOR_FINANCEIRO_ACESSIBILIDADE.md
├── index.html                      # Entrada/redirecionamento legado na raiz
├── netlify/
│   └── functions/
│       ├── _identity.mjs           # CPF, e-mail, idade e senha
│       ├── _security.mjs           # JWT, RBAC, tenant e parsing
│       ├── admin.mjs               # APIs administrativas e agenda legada
│       ├── auth.mjs                # Cadastro/login/me do instrutor
│       ├── demo-admin.mjs          # Criação de demos por SUPER_ADMIN
│       └── instructor.mjs          # Painel e financeiro real
├── netlify.toml                    # Build, publish e redirects
├── neon.ts                         # Declaração/configuração auxiliar do Neon
├── package.json
├── public/
│   ├── index.html                  # Aplicação publicada
│   └── css/
│       ├── styles.css
│       ├── admin-styles.css
│       ├── student-styles.css
│       ├── finance-live.css
│       └── accessibility.css
├── scripts/
│   ├── build.mjs                   # Copia src para public/src e prepara publicação
│   ├── init-db.mjs                 # Bootstrap/seed histórico do schema
│   ├── migrate-all.mjs             # Executa todas as migrações atuais
│   ├── migrate.mjs                 # Executor histórico de migração parcial
│   ├── migrations/
│   │   ├── 001_identity_foundation.mjs
│   │   └── 002_student_minimum_age.mjs
│   ├── test-counts.mjs
│   ├── test-db.mjs
│   ├── verify-db.mjs
│   └── verify-foundation.mjs
├── simulator/                      # Produto separado; não alterar na gestão
│   ├── README.md
│   ├── package.json
│   ├── public/
│   ├── src/simulator-engine.js
│   └── tests/
├── src/
│   ├── auth/
│   │   ├── real-auth.js             # UI de login/cadastro real
│   │   ├── student-auth.js          # Autenticação legada/local do aluno
│   │   └── unified-auth.js          # Sessão e seleção de papel da interface
│   ├── core/
│   │   ├── accessibility.js         # Melhorias de teclado, foco e tabelas
│   │   └── domain.js                # Regras puras legadas do domínio
│   └── modules/
│       ├── admin/admin-portal.js
│       ├── instructor/app.js        # Interface principal do instrutor
│       ├── instructor/finance-live.js
│       └── student/
│           ├── student-app.js
│           └── student-portal.js
├── tests/
│   ├── admin-security.test.mjs
│   ├── adult-registration.test.mjs
│   ├── identity-security.test.mjs
│   ├── instructor-api.test.mjs
│   └── test-domain.cjs
└── sons/                            # Áudios históricos/compatibilidade
```

## 6. Publicação e build

O arquivo `netlify.toml` define:

```toml
[build]
  command = "npm run build"
  publish = "public"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

O comando `npm run build` executa `scripts/build.mjs`. O build prepara os arquivos de `src/` para serem servidos como `public/src/`. Por isso, no HTML publicado, scripts devem usar caminhos como `src/auth/real-auth.js`, e não `../src/...`.

O `public/index.html` carrega as folhas de estilo e os módulos de gestão. As URLs das APIs são relativas ao domínio publicado:

- `/api/auth?action=...`
- `/api/instructor?action=...`
- `/api/admin?action=...`
- `/api/demo-admin?action=...`

## 7. Banco de dados Neon PostgreSQL

### 7.1. Conexão

O backend usa `@neondatabase/serverless` e a variável `DATABASE_URL`. A conexão só deve ser utilizada em Functions ou scripts administrativos locais. Nunca deve ser exposta em HTML, JavaScript público, respostas de API ou `localStorage`.

O schema inicial é criado por `scripts/init-db.mjs`. A evolução atual é feita por migrações incrementais executadas por `scripts/migrate-all.mjs` e registradas em `schema_migration`.

Comandos:

```bash
npm run db:init
npm run db:migrate
node --use-system-ca scripts/verify-foundation.mjs
```

`db:init` é o bootstrap legado e contém seeds históricos. Em produção, a operação recomendada é aplicar migrações explicitamente e evitar recriar ou popular dados fictícios sem revisão.

### 7.2. Tabelas e finalidade

| Tabela | Finalidade | Relacionamentos principais |
|---|---|---|
| `admin_usuario` | Administrador master histórico | Não pertence a tenant; usado no fluxo administrativo legado |
| `plano_assinatura` | Planos, limites e recursos | `organizacao.plano_id` |
| `organizacao` | Tenant: instrutor autônomo ou CFC | Pai de usuários, alunos, veículos, aulas e financeiro |
| `usuario` | Instrutores e usuários internos | `organizacao_id -> organizacao.id` |
| `identidade_acesso` | Credenciais e provedor de login | Liga-se exclusivamente a `usuario` ou `aluno` |
| `convite_aluno` | Convites emitidos pelo instrutor | Liga organização, instrutor e eventual aluno |
| `aluno` | Alunos vinculados ao tenant/instrutor | Liga-se a organização, instrutor, convite e sessões |
| `veiculo` | Frota disponível | Pertence à organização |
| `aula` | Agenda e aulas práticas | Liga aluno, instrutor, veículo e organização |
| `pacote` | Pacote contratado e saldo de aulas | Liga aluno e conta a receber |
| `conta_receber` | Cobrança gerencial | Liga aluno, pacote e pagamentos |
| `pagamento` | Recebimentos, inclusive parciais | Liga conta a receber |
| `despesa` | Despesas gerenciais | Pertence à organização |
| `simulador_sessao` | Resultado de sessão do simulador | Liga-se a aluno; módulo separado |
| `registro_auditoria` | Trilha de ações relevantes | Guarda autor, ação, tabela e detalhes mínimos |
| `schema_migration` | Controle de migrações aplicadas | Guarda IDs das migrações |

### 7.3. Campos principais

As tabelas operacionais usam IDs textuais (`VARCHAR(64)`) e timestamps `TIMESTAMPTZ` quando há data/hora. Valores financeiros são inteiros em centavos.

`organizacao` contém tipo, nome, contatos, status de assinatura, plano, validade, ativação e `modo_demo`.

`usuario` contém organização, nome, e-mail, papel, status, último acesso e, após a migração de identidade, `cpf_fingerprint`, `cpf_ultimos4`, `modo_demo`, `email_verificado` e `perfil_completo`.

`aluno` contém organização, instrutor vinculado, nome, e-mail, telefone, categoria, status, origem do convite, XP, nível, habilidades, conquistas e, após a migração, CPF protegido, últimos quatro dígitos, data de nascimento, endereço JSONB, modo demo, verificação e completude.

`conta_receber` contém valor original, vencimento, status e origem. `pagamento` guarda cada recebimento individual. O saldo é calculado como valor da conta menos pagamentos registrados.

`pacote` guarda quantidade contratada, saldo de aulas, valor em centavos e status. A criação de um pacote gera uma conta a receber associada.

### 7.4. Relacionamentos

```text
organizacao
├── usuario
│   └── identidade_acesso
├── convite_aluno
│   └── aluno
│       ├── identidade_acesso
│       ├── aula
│       ├── pacote
│       │   └── conta_receber
│       │       └── pagamento
│       └── simulador_sessao
├── veiculo
├── aula
├── despesa
└── registro_auditoria
```

As chaves estrangeiras usam `ON DELETE CASCADE` ou `SET NULL` conforme a necessidade histórica. A integridade de tenant ainda depende também das condições explícitas nas consultas; a existência de uma FK isolada não autoriza cruzar organizações.

### 7.5. Migrações atuais

#### `001_identity_foundation`

- adiciona o sinalizador `modo_demo` em organização, usuário e aluno;
- adiciona fingerprint e últimos quatro dígitos do CPF;
- adiciona data de nascimento e endereço JSONB ao aluno;
- adiciona estados de e-mail verificado e perfil completo;
- cria unicidade do fingerprint de CPF real em `usuario`;
- cria `identidade_acesso` para senha e futuro Google;
- impede uma identidade de pertencer simultaneamente a usuário e aluno;
- permite provedores `PASSWORD` e `GOOGLE`;
- exige hash de senha quando o provedor é `PASSWORD`.

#### `002_student_minimum_age`

- cria a função PostgreSQL `validar_maioridade_aluno()`;
- rejeita data ausente ou inválida;
- rejeita data futura;
- rejeita idade inferior a 18 anos;
- instala trigger antes de inserir ou alterar `aluno.data_nascimento`.

## 8. Autenticação e autorização

### 8.1. Cadastro real do instrutor

`POST /api/auth?action=register-instructor` recebe nome, e-mail, CPF e senha. O backend:

1. normaliza e valida o nome;
2. normaliza e valida e-mail;
3. valida os dígitos do CPF;
4. calcula `cpf_fingerprint` com HMAC usando `CPF_LOOKUP_SECRET`;
5. gera hash `scrypt` com salt individual;
6. cria uma organização `INSTRUTOR_AUTONOMO`;
7. cria usuário `ADMIN_ORG`;
8. cria a identidade de acesso `PASSWORD`;
9. retorna JWT de uma hora e dados não sensíveis do usuário.

A operação usa CTEs encadeadas para que organização, usuário e identidade sejam criados de forma atômica no comando SQL. O CPF completo e o hash não retornam para o navegador.

### 8.2. Login

`POST /api/auth?action=login` recebe e-mail e senha. A identidade é localizada por e-mail normalizado e provedor `PASSWORD`; a senha é verificada com `scrypt`. A organização e o usuário precisam estar ativos.

### 8.3. Sessão atual

`GET /api/auth?action=me` exige Bearer JWT e devolve o usuário autenticado, organização, papel, status, modo demo, estado de perfil e últimos quatro dígitos do CPF.

### 8.4. JWT

O token usa HMAC-SHA256 e contém, no mínimo:

- `sub`: ID do usuário;
- `papel`: papel de acesso;
- `organizacao_id`: tenant;
- `modo_demo`;
- `iat` e `exp`;
- `iss` e `aud`.

`netlify/functions/_security.mjs` rejeita token ausente, expirado, sem identidade, com algoritmo diferente de HS256, assinatura inválida, emissor inválido ou audiência inválida.

### 8.5. Papéis

| Papel | Acesso |
|---|---|
| `SUPER_ADMIN` | Administração master e criação de dados demo |
| `ADMIN_ORG` | Gestão da própria organização; papel gerado no cadastro do instrutor |
| `INSTRUTOR` | Gestão operacional/financeira autorizada da própria organização |
| `ALUNO` | Previsto para área restrita do aluno; fluxo real ainda incompleto |

O frontend pode ocultar menus por papel, mas a proteção verdadeira é sempre feita no backend.

## 9. Isolamento multi-tenant

O `organizacao_id` do token é a fonte de autoridade. O cliente não pode escolher livremente uma organização para ler ou alterar dados.

As Functions devem seguir estas regras:

- autenticar antes de executar consulta protegida;
- exigir organização quando o endpoint é tenant-safe;
- comparar organização solicitada com a organização do token, quando o campo existir por compatibilidade;
- incluir `organizacao_id = auth.organizationId` em toda consulta;
- validar também a organização dos registros relacionados;
- nunca confiar em `organizacao_id` enviado pelo corpo;
- não retornar dados de outro tenant em joins, relatórios ou listas;
- impedir que um aluno, conta ou pagamento de outro tenant seja usado como chave de alteração.

`instructor.mjs` aplica esse padrão nas consultas de alunos, pacotes, contas, pagamentos e despesas. `admin.mjs` mantém rotas administrativas e a criação de aulas com validação de organização.

## 10. API de gestão disponível

### `GET /api/instructor?action=dashboard`

Retorna resumo financeiro, contas a receber, despesas, pacotes, alunos ativos e recebimentos recentes do tenant autenticado.

Indicadores:

- recebido no mês;
- contas em aberto;
- contas vencidas;
- despesas do mês;
- despesas pendentes;
- saldo gerencial do mês.

### `POST /api/instructor?action=create-package`

Cria pacote para aluno ativo do tenant e uma conta a receber única. Também cria registro de auditoria. Entradas principais: `alunoId`, `nome`, `quantidade`, `valorCentavos` e `vencimento`.

### `POST /api/instructor?action=create-expense`

Cria despesa com valor em centavos, vencimento e status `PENDENTE` ou `PAGA`. Registra auditoria.

### `POST /api/instructor?action=record-payment`

Registra pagamento parcial ou total. Aceita `PIX`, `DINHEIRO`, `CARTAO`, `TRANSFERENCIA` e `OUTRO`. Usa lock advisory por organização/conta para reduzir corrida concorrente e rejeita pagamento superior ao saldo.

### `GET /api/admin?action=health` ou `ping`

Rota histórica de saúde da API/banco.

### Rotas administrativas de `admin.mjs`

As ações existentes incluem `tenant-data`, `create-lesson`, `record-payment`, `create-expense`, `dashboard`, `subscriptions`, `invites`, `tables`, `db-schema`, `update-subscription` e `create-invite`. Algumas são legadas e devem continuar sendo revisadas para manter o mesmo padrão tenant-safe da API financeira nova.

### `POST /api/demo-admin?action=create-instructor`

Exige `SUPER_ADMIN` e cria organização, instrutor e identidade de demonstração marcados com `modo_demo = TRUE`.

### `POST /api/demo-admin?action=create-student`

Exige `SUPER_ADMIN`, recebe instrutor demo ativo, cria aluno vinculado à organização dele, exige data de nascimento válida e maioridade, cria identidade de senha e registra auditoria.

## 11. Regras financeiras

- valores são inteiros em centavos;
- nenhum cálculo financeiro confiável deve depender apenas do frontend;
- um pacote cria uma conta a receber;
- o consumo de aulas não deve criar novas cobranças automaticamente;
- pagamentos ficam separados da conta original;
- pagamentos parciais mantêm o saldo;
- conta cancelada não aceita pagamento;
- conta quitada não aceita pagamento adicional;
- pagamento acima do saldo é rejeitado;
- lançamentos não devem ser apagados para corrigir histórico;
- estornos futuros devem referenciar o lançamento original e exigir motivo;
- demo não deve contaminar indicadores reais;
- o painel é gerencial e não substitui contabilidade, emissão fiscal ou serviço bancário.

## 12. Agenda e conflitos

O modelo de `aula` contém aluno, instrutor, veículo, início, fim, status e tópico. O conflito de intervalo deve ser tratado como intervalo semiaberto `[início, fim)`.

Não pode haver sobreposição para o mesmo instrutor, aluno ou veículo dentro da mesma organização. A validação deve ocorrer no backend, e a evolução recomendada é reforçar a regra com transação/constraint adequada no PostgreSQL para resistir a requisições concorrentes.

## 13. Cadastro de alunos — estado e regra de negócio

Regra de produto:

- aluno não deve criar conta sem vínculo com instrutor;
- o instrutor pode criar o aluno ou emitir convite;
- o aluno pode iniciar cadastro informando CPF/código do instrutor;
- o backend é responsável por localizar e confirmar o vínculo;
- organização e instrutor não podem ser definidos pelo frontend;
- o convite deve expirar, ser de uso único e ser armazenado como hash quando o fluxo definitivo for concluído;
- o aluno completa dados pendentes, como nascimento, endereço, CPF e senha;
- Google deve ser validado no servidor, nunca aceito apenas por dados enviados pelo navegador;
- nenhum aluno real menor de 18 anos pode ser cadastrado no estado atual.

O banco já possui os campos iniciais para identidade e completude do perfil, mas o fluxo completo de convite, e-mail, recuperação de senha, busca de instrutor por CPF e Google ainda precisa ser finalizado.

## 14. LGPD e proteção de dados

CPF, data de nascimento, endereço, e-mail, telefone, agenda, financeiro e histórico de desempenho podem ser dados pessoais. O produto deve seguir privacidade desde a concepção.

Controles implementados ou iniciados:

- CPF validado e convertido em fingerprint HMAC;
- CPF completo não é retornado pela API;
- senha processada no backend com `scrypt`;
- token JWT assinado no backend;
- organização e papel validados no servidor;
- dados demo marcados e separados logicamente;
- auditoria de criação de pacote, despesa, pagamento e demos;
- maioridade validada na aplicação e no PostgreSQL.

Controles ainda obrigatórios antes de produção ampla:

- política de privacidade e aviso de privacidade publicados;
- finalidade, base legal e retenção por categoria documentadas;
- canal de atendimento aos titulares;
- recuperação de senha e verificação de e-mail seguras;
- convites armazenados com hash, validade e uso único;
- rate limit de login e consultas de vínculo;
- logs sem CPF, senha, token ou endereço completo;
- procedimento de acesso, correção, exportação, eliminação/anônimização e incidentes;
- revisão jurídica de controlador, operador e fornecedores.

Este documento é técnico e não substitui parecer jurídico.

## 15. Maioridade

A regra atual é objetiva: somente maiores de 18 anos podem ser alunos.

Ela é aplicada em dois níveis:

1. `requireAdultBirthDate()` em `netlify/functions/_identity.mjs` valida formato, data futura e idade;
2. trigger `aluno_validar_maioridade` no PostgreSQL rejeita inserções e alterações incompatíveis.

Contas demo também devem usar dados fictícios e maioridade válida. Não usar CPF, e-mail, telefone ou dados de terceiros reais em testes.

## 16. Frontend de gestão e mobile

O frontend atual é vanilla JavaScript e deve permanecer simples enquanto a plataforma não migra para outro framework.

Arquivos principais:

- `src/modules/instructor/app.js`: aplicação principal e telas do instrutor;
- `src/modules/instructor/finance-live.js`: carrega painel financeiro real e envia mutações;
- `src/auth/real-auth.js`: modal de login/cadastro e restauração de sessão;
- `src/auth/unified-auth.js`: estado unificado da interface;
- `src/core/accessibility.js`: foco, navegação, modais e adaptação de tabelas;
- `public/css/accessibility.css`: estilos de acessibilidade;
- `public/css/finance-live.css`: estilos financeiros.

Requisitos de interface:

- operar a partir de 320 CSS pixels;
- reflow com zoom de até 400%;
- foco visível e ordem de teclado lógica;
- controles com área de toque adequada;
- não depender apenas de cor ou hover;
- mensagens de erro ligadas aos campos;
- tabelas convertidas em cartões/listas no celular quando possível;
- modais com foco, `Escape`, retenção e retorno ao acionador;
- respeitar `prefers-reduced-motion`;
- manter navegação de início, agenda, alunos e financeiro clara.

## 17. Testes e validação

Comandos oficiais do projeto:

```bash
npm test
npm run build
npm run db:migrate
node --use-system-ca scripts/verify-foundation.mjs
```

Os testes atuais cobrem:

- segurança administrativa;
- regra de maioridade;
- validação de identidade e senha;
- isolamento e regras da API do instrutor;
- regras puras do domínio.

Na última validação documentada:

- `npm test`: 18 testes aprovados;
- `npm run build`: aprovado;
- migrações `001_identity_foundation` e `002_student_minimum_age`: aplicadas;
- `verify-foundation.mjs`: identidade, campos LGPD/demo e trigger de 18+ confirmados.

## 18. Variáveis de ambiente

As variáveis necessárias são:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão segura com Neon PostgreSQL |
| `AUTH_JWT_SECRET` | Assinatura e verificação dos JWTs |
| `AUTH_JWT_ISSUER` | Emissor esperado dos tokens |
| `AUTH_JWT_AUDIENCE` | Audiência esperada dos tokens |
| `CPF_LOOKUP_SECRET` | HMAC de fingerprints de CPF |
| `ALLOWED_ORIGIN` | Origem permitida para CORS |

Segredos devem existir no `.env` local e nas variáveis protegidas do Netlify. Nunca devem ser commitados. Se um segredo for exposto, deve ser rotacionado imediatamente.

## 19. Deploy atual

Site Netlify: `https://autogestaodirecao.netlify.app/`  
Site ID: `bde2a49e-6ac7-4960-aa73-6cdda3948ccb`  
Repositório conectado: `https://github.com/caconeo/autogestaodirecao`  
Branch: `main`

As variáveis de ambiente foram configuradas no Netlify. O código e as migrações estão no GitHub, mas a publicação da versão mais recente ficou pendente porque os créditos do plano gratuito do Netlify foram esgotados. A produção antiga permanece intacta; não se deve concluir que a API nova está disponível publicamente até um deploy ser realizado e verificado.

Após a renovação dos créditos, o procedimento é:

```bash
npm test
npm run build
git push origin main
```

Depois verificar no domínio:

- carregamento do HTML atualizado;
- `/api/auth?action=me` respondendo `401` sem token, não `404`;
- cadastro/login em ambiente controlado;
- `/api/instructor?action=dashboard` respondendo `401` sem token, não `404`;
- criação de pacote, despesa e pagamento em tenant de teste;
- ausência de acesso cruzado entre organizações.

## 20. Estado por área

| Área | Estado atual | Observação |
|---|---|---|
| Estrutura modular | Implementada | Gestão e simulador estão em áreas separadas |
| Banco Neon | Operacional | Schema inicial e migrações aplicados |
| Cadastro real de instrutor | Implementado | E-mail, CPF, senha, organização e JWT |
| Login por senha | Implementado | `PASSWORD` + `scrypt` |
| Login Google | Preparado no schema | OAuth servidor ainda não finalizado |
| Cadastro demo | Implementado | Restrito a `SUPER_ADMIN` |
| Regra 18+ | Implementada | Código e trigger do banco |
| Isolamento financeiro | Implementado na API nova | Revisar continuamente APIs legadas |
| Painel financeiro real | Implementado | Dashboard, pacote, despesa e pagamento |
| Cadastro real de aluno | Parcial | Campos existem; fluxo completo ainda não concluído |
| Convite por e-mail | Parcial/legado | Existe emissão histórica; falta fluxo seguro definitivo |
| Agenda persistida | Parcial | Modelo e validações existem; CRUD completo ainda evolui |
| Acessibilidade base | Implementada parcialmente | Necessita validação manual WCAG em telas completas |
| Deploy da última versão | Pendente | Bloqueado temporariamente por créditos do Netlify |
| Simulador CTB | Separado e preservado | Fora do escopo da gestão atual |

## 21. Limitações e riscos conhecidos

1. `scripts/init-db.mjs` contém seeds históricos, inclusive credenciais antigas em texto simples; não usar esses dados como autenticação de produção.
2. O modelo histórico possui `senha_hash` em `usuario` e `aluno`; o caminho moderno é `identidade_acesso` com hash `scrypt`.
3. O fluxo de Google, recuperação de senha e verificação de e-mail ainda não está pronto.
4. A API `admin.mjs` contém rotas legadas que precisam ser mantidas sob revisão de tenant e RBAC.
5. O frontend ainda possui partes mockadas/localStorage; o financeiro novo já utiliza API real.
6. A publicação atual pode estar atrás do commit mais recente enquanto os créditos do Netlify não forem renovados.
7. O simulador não deve ser usado como dependência para validar o módulo financeiro.

## 22. Próxima ordem de implementação

1. Publicar e verificar o commit atual quando o Netlify liberar deploy.
2. Finalizar cadastro real de aluno vinculado a instrutor.
3. Implementar convites com token aleatório armazenado por hash, expiração, uso único e e-mail transacional.
4. Criar endpoint seguro de busca/vínculo do instrutor por CPF ou código público, com rate limit e resposta mínima.
5. Implementar verificação de e-mail, recuperação de senha e sessões revogáveis.
6. Migrar alunos, agenda, veículos e relatórios restantes dos mocks para APIs tenant-safe.
7. Reforçar a prevenção de conflito de agenda no banco/transação.
8. Adicionar auditoria e testes de isolamento para toda nova mutação.
9. Validar WCAG e mobile em 320, 360, 390 e 768 pixels, teclado, zoom e leitor de tela.
10. Manter o simulador intocado até existir uma demanda específica para a base separada.

## 23. Prompt mestre para outro agente

Copie o bloco abaixo para outro agente que precise entender e continuar o sistema:

```text
Você está trabalhando no repositório Auto Gestão de Direção.

OBJETIVO ATUAL
Continue exclusivamente o módulo de gestão para instrutores/autoscolas. O objetivo é transformar a gestão em um produto real, seguro, multi-tenant, mobile-first e compatível com LGPD/WCAG. Não altere o simulador CTB ou o Auditor CTB durante tarefas de gestão. O simulador está em simulator/ e é um produto separado.

STACK OBRIGATÓRIA ATUAL
- Frontend: HTML5, CSS e JavaScript vanilla em src/ e public/.
- Backend: Netlify Functions Node.js ESM em netlify/functions/.
- Banco: Neon PostgreSQL usando @neondatabase/serverless.
- Publicação: Netlify, publish=public, functions=netlify/functions.
- Redirect API: /api/* -> /.netlify/functions/:splat.
- Versionamento: Git branch main.

ARQUITETURA
O navegador nunca acessa o banco. O navegador chama /api/auth, /api/instructor, /api/admin ou /api/demo-admin. A Function valida Bearer JWT, extrai sub/papel/organizacao_id e somente então consulta o Neon. Nunca confie em organizacao_id vindo do corpo da requisição.

ARQUIVOS PRINCIPAIS
- netlify/functions/_security.mjs: HttpError, JWT HS256, RBAC, tenant e JSON.
- netlify/functions/_identity.mjs: e-mail, CPF, HMAC do CPF, scrypt e maioridade.
- netlify/functions/auth.mjs: register-instructor, login e me.
- netlify/functions/instructor.mjs: dashboard, create-package, create-expense e record-payment.
- netlify/functions/demo-admin.mjs: criação de instrutor/aluno demo para SUPER_ADMIN.
- netlify/functions/admin.mjs: APIs administrativas e agenda legada; revisar segurança antes de ampliar.
- scripts/init-db.mjs: schema/seed histórico; não usar credenciais seed em produção.
- scripts/migrations/001_identity_foundation.mjs: identidade, CPF protegido, demo e perfil.
- scripts/migrations/002_student_minimum_age.mjs: trigger de maioridade.
- scripts/migrate-all.mjs: executor de migrações.
- src/auth/real-auth.js: login/cadastro real.
- src/modules/instructor/finance-live.js: dashboard financeiro real.
- src/core/accessibility.js e public/css/accessibility.css: base de acessibilidade.

TABELAS ATUAIS
admin_usuario, plano_assinatura, organizacao, usuario, identidade_acesso, convite_aluno, aluno, veiculo, aula, pacote, conta_receber, pagamento, despesa, simulador_sessao, registro_auditoria e schema_migration.

RELACIONAMENTOS ESSENCIAIS
organizacao é o tenant. usuario, aluno, veiculo, aula, pacote, conta_receber, pagamento, despesa e auditoria devem ser filtrados por organizacao_id. aluno pertence ao instrutor_vinculado_id. pacote pertence ao aluno e cria uma conta_receber. pagamento pertence à conta_receber. identidade_acesso pertence a exatamente um usuario ou aluno.

REGRAS INEGOCIÁVEIS
- Somente maiores de 18 anos podem ser alunos.
- A idade é validada no backend e pelo trigger PostgreSQL.
- CPF nunca deve aparecer completo em respostas, logs ou frontend.
- CPF deve ser validado e, para busca, comparado por HMAC fingerprint.
- Senhas somente no backend com hash forte e salt individual.
- Valores monetários sempre em inteiros de centavos.
- Pagamento não pode exceder saldo.
- Dados demo devem ter modo_demo=true e não contaminar indicadores reais.
- Toda mutação relevante deve auditar autor, ação e IDs mínimos.
- Não criar aluno sem vínculo válido com instrutor e organização.
- Google deve ser validado no servidor; ainda não está implementado completamente.
- Não assumir que um deploy foi realizado apenas porque o Git push funcionou.

API FINANCEIRA
- GET /api/instructor?action=dashboard
- POST /api/instructor?action=create-package
- POST /api/instructor?action=create-expense
- POST /api/instructor?action=record-payment
Todas exigem JWT e papel ADMIN_ORG ou INSTRUTOR.

FLUXO DE ALUNO A IMPLEMENTAR
Instrutor cadastra aluno ou emite convite. Convite deve ser aleatório, armazenado como hash, expirar e ser de uso único. Aluno também pode iniciar cadastro informando CPF/código do instrutor; backend resolve o vínculo, revela somente confirmação mínima e aplica rate limit. Aluno completa nascimento, endereço, CPF, senha ou Google e aceita documentos de privacidade. Nunca aceite organizacao_id/instrutor_id como autoridade do frontend.

LGPD E ACESSIBILIDADE
Antes de produção ampla, garantir aviso/política de privacidade, finalidade, base legal, retenção, canal de titular, incidentes e logs minimizados. Interface deve funcionar em 320px, com zoom 400%, teclado, foco visível, leitores de tela, contraste adequado e sem dependência de cor/hover.

VALIDAÇÃO
Execute npm test e npm run build após alterações. Para banco use npm run db:migrate e node --use-system-ca scripts/verify-foundation.mjs quando autorizado e configurado. Não execute comandos destrutivos nem altere o simulador por iniciativa própria.

PROCESSO DE ALTERAÇÃO
1. Ler este dossiê e os arquivos relevantes.
2. Verificar git status e preservar alterações do usuário.
3. Criar migração incremental para mudanças de banco.
4. Implementar autorização/tenant antes da interface.
5. Adicionar testes de sucesso, validação, 401/403 e cross-tenant.
6. Atualizar este dossiê e documentação específica.
7. Rodar testes/build.
8. Informar claramente o que foi implementado e o que depende de deploy/credenciais externas.
```

## 24. Registro de atualização deste dossiê

### 11/10/2026 — Consolidação da gestão atual

- criação deste documento como referência operacional atual;
- separação explícita entre gestão e simulador;
- registro da arquitetura Netlify + Functions + Neon;
- registro das tabelas, migrações, APIs e regras financeiras;
- registro dos controles LGPD, maioridade, tenant e acessibilidade;
- inclusão de prompt mestre para continuidade por outro agente;
- registro do bloqueio temporário de publicação por créditos esgotados no Netlify.

