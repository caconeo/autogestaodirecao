# Governança de privacidade e LGPD

## Regra obrigatória

Nenhum dado real de instrutor ou aluno deve ser coletado em produção antes da aprovação dos textos de privacidade, da definição das finalidades e bases legais e da implantação dos controles técnicos descritos neste documento.

Contas demo devem usar dados inteiramente fictícios. CPF, endereço, telefone e e-mail de terceiros reais não podem ser usados para testes.

## Privacidade desde a concepção

O sistema deve observar finalidade, adequação, necessidade, livre acesso, qualidade, transparência, segurança, prevenção, não discriminação e responsabilização durante todo o ciclo de vida dos dados.

Cada novo campo exige resposta documentada para:

- qual finalidade legítima ele atende;
- qual base legal sustenta o tratamento;
- quem pode consultá-lo;
- por quanto tempo será mantido;
- com quem será compartilhado;
- como o titular poderá corrigir, exportar ou solicitar eliminação quando aplicável.

## Papéis e responsabilidades

A definição contratual de controlador, operador e eventuais controladores conjuntos deve ser validada juridicamente antes da operação comercial. Netlify, Neon, provedor de e-mail e autenticação devem constar no inventário de fornecedores e subprocessadores.

O produto deve disponibilizar um canal de privacidade e identificar o responsável pelo atendimento aos titulares.

## Inventário mínimo de dados

### Instrutor

- nome;
- e-mail;
- telefone, quando necessário;
- CPF protegido;
- dados de autenticação;
- organização e papel de acesso;
- registros de aceite e auditoria.

### Aluno

- nome;
- e-mail;
- telefone, quando necessário;
- CPF protegido, somente quando indispensável;
- data de nascimento;
- endereço, somente quando indispensável;
- instrutor e organização vinculados;
- dados de autenticação;
- registros de aceite e auditoria.

Dados de telemetria, acesso, agenda, financeiro e desempenho também podem ser dados pessoais quando relacionados a uma pessoa identificada ou identificável e devem entrar no inventário.

## Crianças e adolescentes

O fluxo deve identificar a faixa etária antes de concluir o cadastro. O tratamento de dados de crianças e adolescentes exige desenho específico orientado ao melhor interesse, linguagem adequada e, quando aplicável, participação verificável do responsável legal.

Até que esse fluxo seja implementado e validado juridicamente, cadastros reais de menores não devem ser habilitados.

## Controles técnicos obrigatórios

- HTTPS em todos os ambientes públicos;
- senhas processadas exclusivamente no backend com algoritmo forte e salt individual;
- CPF não armazenado em texto puro quando a finalidade permitir comparação por fingerprint;
- criptografia adicional para dados que precisem ser recuperados em formato original;
- segregação rígida por `organizacao_id`;
- autorização por papel validada no servidor;
- logs sem CPF, senha, token, endereço completo ou corpo integral de requisições;
- tokens de convite e recuperação armazenados como hash, com expiração e uso único;
- limitação de tentativas em login, recuperação e pesquisa de instrutor por CPF;
- sessões revogáveis e com expiração;
- backups protegidos e testados;
- ambientes demo, desenvolvimento e produção separados;
- trilha de auditoria para leitura ou alteração de dados críticos;
- revisão periódica de acessos e fornecedores.

## CPF do instrutor

O CPF não deve ser apresentado como informação pública nem usado como senha. Para localizar um instrutor, o backend deve normalizar o documento, calcular um HMAC com segredo exclusivo e comparar apenas o fingerprint.

A resposta da pesquisa deve revelar somente o mínimo necessário para confirmação e deve ser protegida contra enumeração. Um código público do instrutor deve ser oferecido como alternativa preferencial.

## Transparência e aceite

Antes do cadastro, a interface deve apresentar aviso de privacidade com linguagem clara, contendo pelo menos:

- identidade e contato do agente responsável;
- dados coletados e finalidades;
- bases legais aplicáveis;
- compartilhamentos e fornecedores;
- retenção;
- direitos do titular e canal de atendimento;
- informações sobre transferências internacionais, quando existentes;
- versão e data dos documentos.

Aceites devem registrar usuário, versão do documento, data, finalidade e evidência técnica estritamente necessária. Consentimento não deve ser usado automaticamente como base legal para todas as operações e deve permitir revogação quando for a base escolhida.

## Direitos dos titulares

O produto deve permitir um fluxo autenticado para solicitações de:

- confirmação de tratamento;
- acesso;
- correção;
- portabilidade, quando regulamentada e aplicável;
- informação sobre compartilhamento;
- revisão de decisões automatizadas, quando existirem;
- anonimização, bloqueio ou eliminação nos casos aplicáveis;
- revogação de consentimento quando essa for a base legal.

Cada solicitação deve possuir protocolo, prazo, responsável, histórico e resposta registrada sem expor o titular a fraude.

## Retenção e descarte

Não deve existir retenção indefinida por padrão. Uma tabela de temporalidade deve definir prazo por categoria e finalidade. Ao terminar a finalidade, o sistema deve eliminar ou anonimizar os dados, preservando apenas o que tiver obrigação legal ou necessidade legítima documentada.

Exclusão lógica não é suficiente como política definitiva. Backups e integrações também precisam de procedimento de expiração ou sobrescrita controlada.

## Incidentes

Deve existir procedimento documentado para detectar, conter, investigar e registrar incidentes. O responsável deve avaliar risco ou dano relevante e cumprir as comunicações aplicáveis à ANPD e aos titulares conforme a regulamentação vigente.

## Bloqueios para produção

- política e aviso de privacidade inexistentes;
- finalidade ou base legal não documentada;
- dados reais em ambiente demo;
- cadastro de menor sem fluxo específico;
- CPF ou senha em logs ou `localStorage`;
- ausência de canal para direitos dos titulares;
- ausência de política de retenção e resposta a incidentes;
- acesso cross-tenant possível;
- fornecedor sem avaliação mínima de privacidade e segurança.

## Observação jurídica

Este documento orienta a implementação técnica, mas não substitui análise jurídica específica da operação, dos contratos e das bases legais adotadas.
