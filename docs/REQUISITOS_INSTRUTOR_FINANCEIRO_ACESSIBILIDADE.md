# Requisitos do módulo do instrutor

## Prioridade do produto

O módulo do instrutor é a prioridade da plataforma. Seu objetivo é reduzir trabalho administrativo e oferecer visão financeira simples, confiável e utilizável durante a rotina móvel do profissional.

O sistema não substitui contabilidade, emissão fiscal ou serviços bancários. Valores exibidos representam controles gerenciais internos e devem deixar essa limitação clara.

## Padrão de acessibilidade

Todas as telas novas ou alteradas devem buscar conformidade com WCAG 2.2 nível AA. A validação deve incluir análise automática e testes manuais com teclado, leitor de tela, zoom e dispositivos móveis.

### Critérios mínimos do produto

- funcionamento completo a partir de 320 CSS pixels sem perda de conteúdo ou função;
- suporte a zoom de 400% com reflow adequado;
- orientação retrato e paisagem;
- contraste mínimo de 4,5:1 para texto comum e 3:1 para texto grande e componentes gráficos relevantes;
- nenhum significado transmitido apenas por cor;
- foco de teclado sempre visível e não encoberto;
- ordem de foco lógica e ausência de armadilhas de teclado;
- todos os controles operáveis por teclado e toque;
- área de toque adotada pelo produto de pelo menos 44 por 44 CSS pixels;
- rótulos visíveis e associados aos campos;
- mensagens de erro específicas, ligadas ao campo e anunciadas por tecnologia assistiva;
- títulos, regiões, listas e tabelas com HTML semântico;
- textos e valores compreensíveis por leitores de tela;
- modais com foco inicial, retenção de foco, fechamento por `Escape` e retorno ao acionador;
- status dinâmicos anunciados sem deslocar foco indevidamente;
- respeito a `prefers-reduced-motion`;
- nenhum gesto complexo como único meio de executar uma ação;
- navegação e autenticação sem depender de memória ou redigitação desnecessária.

## Mobile-first

O celular não será uma versão reduzida do desktop. Ele será um canal principal.

### Navegação

- acesso rápido a Início, Agenda, Alunos e Financeiro;
- menu acessível com nome, estado aberto/fechado e controle de foco;
- ações primárias posicionadas ao alcance e sem cobrir conteúdo;
- nenhuma funcionalidade exclusiva de hover;
- sessão e organização atual sempre identificáveis.

### Conteúdo financeiro

Tabelas extensas devem virar cartões ou listas resumidas no celular. Rolagem horizontal pode existir apenas quando a estrutura tabular for indispensável, acompanhada de alternativa legível.

Os valores devem usar formatação brasileira e permanecer legíveis com ampliação. Ações financeiras destrutivas ou irreversíveis exigem confirmação clara.

## Escopo financeiro prioritário

### Painel financeiro

- recebido no período;
- previsto a receber;
- vencido;
- despesas pagas e pendentes;
- saldo gerencial;
- próximos vencimentos;
- alunos com pendências;
- comparação simples com período anterior.

### Contas a receber

- origem da cobrança;
- aluno vinculado;
- valor original, valor recebido e saldo;
- vencimento;
- status aberta, parcial, vencida, quitada ou cancelada;
- histórico de pagamentos e estornos;
- filtros por período, aluno e status;
- registro de pagamento parcial sem ultrapassar o saldo.

### Pacotes de aulas

- quantidade contratada;
- saldo de aulas;
- valor total;
- conta a receber única vinculada;
- histórico de consumo;
- impedimento de saldo negativo;
- separação entre consumo de aula e cobrança financeira.

### Despesas

- descrição e categoria;
- valor em centavos;
- vencimento e pagamento;
- status;
- recorrência futura, sem automatismo no primeiro MVP;
- anexos somente em etapa posterior com armazenamento protegido.

### Relatórios

- fluxo de caixa gerencial por período;
- contas vencidas;
- recebimentos por meio de pagamento;
- receitas por aluno;
- despesas por categoria;
- exportação acessível em CSV;
- aviso de que o relatório não é documento fiscal ou contábil.

## Regras de integridade

- cálculos financeiros acontecem no backend;
- valores são inteiros em centavos;
- `organizacao_id` vem exclusivamente da sessão;
- pagamentos, estornos e cancelamentos mantêm histórico;
- registro quitado não é apagado;
- operações concorrentes usam bloqueio ou transação segura;
- toda alteração relevante registra autor, data, ação e identificador, sem copiar dados pessoais desnecessários para o log;
- registros demo ficam fora de indicadores reais.

## Problemas atuais identificados

- a gestão financeira ainda depende de dados no `localStorage`;
- há textos funcionais entre 8 e 11 pixels;
- existem controles com 28 a 36 pixels de altura;
- as tabelas dependem de rolagem horizontal no celular;
- foco visível está definido principalmente para campos, não para todos os controles;
- modais não implementam ciclo de foco e fechamento completo por teclado;
- falta atalho para pular diretamente ao conteúdo;
- componentes dinâmicos precisam de nomes, estados e anúncios mais claros;
- a interface financeira ainda não possui filtros e visão de vencidos suficientes.

## Primeira entrega recomendada

1. Criar base visual acessível: tipografia, contraste, foco, toque e redução de movimento.
2. Corrigir navegação móvel, menu, modais, formulários e mensagens.
3. Criar API tenant-safe para o painel financeiro real.
4. Substituir KPIs e contas a receber mockados por dados do Neon.
5. Criar cartões financeiros mobile e manter tabela acessível no desktop.
6. Implementar pagamento parcial, despesa e histórico usando as regras existentes no backend.
7. Validar em 320, 360, 390 e 768 CSS pixels, teclado, zoom e leitor de tela.

## Critério de conclusão

Uma funcionalidade não está pronta apenas porque funciona no desktop. Ela somente pode ser concluída quando for utilizável no celular, por teclado, com ampliação, sem depender de cor e com mensagens compreensíveis por tecnologia assistiva.
