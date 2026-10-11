# Plano de preparação para cadastros reais

## Objetivo inicial

Transformar o módulo de gestão em uma aplicação com usuários reais, mantendo o frontend estático no Netlify, as Netlify Functions como backend e o Neon PostgreSQL como banco de dados.

O simulador e o Auditor CTB ficam fora deste trabalho.

## Regra de negócio principal

1. O instrutor cria a própria conta ou entra com Google.
2. No primeiro acesso, o sistema cria ou conclui o perfil do instrutor e sua organização.
3. Todo instrutor informa o CPF, que deve ser único entre instrutores ativos.
4. O instrutor pode:
   - cadastrar um aluno diretamente; ou
   - gerar um convite individual com prazo de validade.
5. O aluno somente pode criar ou ativar uma conta quando houver vínculo válido com um instrutor.
6. O vínculo pode ser comprovado por:
   - token de convite emitido pelo instrutor; ou
   - CPF válido de um instrutor ativo informado pelo aluno.
7. Quando o instrutor inicia o cadastro, o aluno recebe um convite por e-mail e completa os dados pendentes.
8. O aluno pode definir uma senha ou entrar com Google. O login Google não elimina a obrigação de concluir o perfil e aceitar o vínculo.
9. `organizacao_id` e `instrutor_vinculado_id` são definidos exclusivamente pelo backend. O navegador nunca escolhe nem altera esses identificadores diretamente.

## Estado atual encontrado

- O schema Neon já possui `organizacao`, `usuario`, `convite_aluno` e `aluno`.
- A API já valida JWT recebido e aplica isolamento por `organizacao_id` em parte das operações.
- O sistema ainda não possui endpoints reais de cadastro, login, renovação de sessão ou recuperação de senha.
- O frontend determina o papel pelo texto do e-mail e aceita qualquer senha.
- As sessões e contas de aluno ficam no `localStorage`.
- A gestão do instrutor usa coleções mockadas no `localStorage` para alunos, aulas, veículos e financeiro.
- Os JWTs exigidos pela API não são emitidos atualmente por nenhum fluxo de autenticação da aplicação.
- Os scripts de inicialização ainda inserem usuários e alunos demonstrativos com senhas em texto simples.
- O convite existente é administrado pelo perfil master; ele ainda não implementa aceitação, envio de e-mail e conclusão de cadastro pelo aluno.

## Preparação obrigatória

### 1. Migrações versionadas

Parar de evoluir o banco apenas com `CREATE TABLE IF NOT EXISTS` e criar migrações SQL incrementais, executadas explicitamente.

Alterações mínimas previstas:

- `usuario.cpf_normalizado` ou referência a uma identidade protegida e única;
- campos de perfil do instrutor e aceite dos termos;
- dados pendentes do aluno: CPF, nascimento e endereço;
- estado de conclusão do perfil;
- tabela de identidades externas para Google;
- tabela de sessões e/ou tokens de renovação revogáveis;
- tokens de verificação de e-mail e recuperação de senha;
- convite com hash do token, validade, uso único e auditoria;
- índices e restrições de unicidade adequados ao tenant.

### 2. Autenticação real no backend

Implementar uma função dedicada de autenticação, separada da função administrativa:

- cadastro de instrutor;
- login com e-mail e senha;
- login Google validado no servidor;
- emissão e renovação de sessão;
- logout e revogação;
- verificação de e-mail;
- recuperação de senha;
- endpoint `GET /me` para carregar usuário, papel e organização.

Senhas devem ser processadas no servidor com algoritmo apropriado. Senha, hash, CPF completo e segredo de sessão nunca devem ser enviados em respostas da API nem armazenados no navegador.

### 3. Fluxo do instrutor

No cadastro do instrutor, o backend deve executar de forma atômica:

1. validar nome, e-mail e CPF;
2. impedir duplicidade de identidade;
3. criar a organização do instrutor autônomo;
4. criar o usuário com papel `ADMIN_ORG` ou `INSTRUTOR`;
5. criar a identidade de login;
6. registrar aceite e evento de auditoria;
7. iniciar uma sessão vinculada à organização criada.

### 4. Fluxo de convite do aluno

O instrutor autenticado informa apenas os dados mínimos necessários. O backend obtém o instrutor e a organização pela sessão, cria o aluno com estado `CONVITE_PENDENTE`, gera um token aleatório de uso único e solicita o envio do e-mail.

Ao abrir o link, o aluno:

1. valida o convite sem receber dados internos do tenant;
2. confirma o e-mail;
3. escolhe senha ou autentica com Google;
4. completa os dados obrigatórios;
5. aceita termos e política de privacidade;
6. ativa a conta;
7. consome definitivamente o convite.

### 5. Cadastro iniciado pelo aluno

O aluno informa o CPF do instrutor. O backend normaliza o CPF, procura somente instrutores ativos e retorna uma confirmação mínima, por exemplo nome abreviado, sem expor CPF, e-mail, telefone ou organização completa.

Após confirmação, o backend cria o aluno já vinculado ao `instrutor_id` e `organizacao_id` encontrados. O frontend não envia esses dois valores como fonte de verdade.

Para reduzir enumeração de CPFs, esse endpoint precisa de limite de tentativas, resposta genérica e registro de abuso. No futuro, um código público curto do instrutor deve ser oferecido como alternativa preferencial ao CPF.

### 6. API real da gestão

Antes de remover os mocks visuais, criar endpoints tenant-safe para:

- listar e cadastrar alunos;
- listar e criar convites;
- reenviar e cancelar convite;
- listar instrutores e veículos da própria organização;
- carregar o painel do instrutor;
- criar e atualizar os demais registros já existentes.

Todas as mutações devem extrair `organizacao_id` do token validado e conferir que os registros relacionados pertencem à mesma organização.

### 7. E-mail transacional

Criar uma abstração de envio para que o provedor possa ser trocado sem alterar a regra de negócio. Em desenvolvimento, o link pode ser registrado de forma segura; em produção, o convite e a recuperação de senha dependem de um provedor de e-mail configurado.

### 8. Proteção de dados

CPF, nascimento e endereço são dados pessoais. Antes de coletá-los:

- publicar política de privacidade e termos;
- definir finalidade e retenção;
- restringir leitura por papel;
- mascarar CPF na interface e nos logs;
- não usar CPF como senha;
- registrar eventos sensíveis na auditoria;
- criar procedimento de correção e exclusão/anominização quando aplicável.

## Ordem recomendada de implementação

### Fase 1 — Fundação

- criar migrações e ajustar o schema;
- definir contratos de API e estados de cadastro;
- remover senhas demonstrativas do seed;
- implementar autenticação por e-mail e sessão real;
- criar testes de autorização e isolamento entre tenants.

### Fase 2 — Instrutor real

- cadastro e login do instrutor;
- criação automática da organização;
- endpoint `GET /me`;
- painel carregado do Neon, sem organização selecionável no navegador.

### Fase 3 — Aluno vinculado

- cadastro mínimo pelo instrutor;
- convite de uso único;
- aceitação e conclusão do perfil;
- cadastro pelo aluno usando CPF do instrutor;
- login e área do aluno com dados reais.

### Fase 4 — Google e e-mail

- vinculação segura da identidade Google;
- verificação de e-mail;
- envio, reenvio e expiração de convites;
- recuperação de senha.

### Fase 5 — Remoção dos mocks

- substituir os repositórios em `localStorage` pela API;
- manter `localStorage` apenas para preferências não sensíveis de interface;
- remover usuários rápidos, detecção de papel por e-mail e contas demo;
- retirar seeds pessoais e dados fictícios do ambiente de produção.

## Critérios para aceitar cadastros reais

- nenhum login aceita senha sem validação no servidor;
- nenhum papel é inferido pelo e-mail no frontend;
- nenhuma sessão confiável vive somente no `localStorage`;
- nenhum aluno existe sem vínculo válido com instrutor e organização;
- nenhum endpoint aceita `organizacao_id` do corpo como autoridade;
- convites expiram, são de uso único e ficam armazenados como hash;
- CPF nunca aparece completo em logs ou respostas de busca;
- testes comprovam que usuários de uma organização não acessam outra;
- ambientes de demonstração e produção usam bancos e configurações separados.

## Primeira entrega técnica sugerida

A primeira implementação deve conter apenas a fundação: migração do schema, autenticação real por e-mail/senha, `GET /me`, cadastro de instrutor com criação de organização e testes de isolamento. O cadastro de aluno deve começar depois que essa identidade confiável existir.
