# Progresso

## Ciclo 1 — Jornada local de operação e financeiro

**Data:** 27/09/2026

### Hipótese e valor

Instrutores precisam organizar alunos, veículos, agenda e dinheiro mesmo antes de uma integração oficial. Um protótipo local permite validar essa jornada com dados fictícios.

### Critérios de aceite

1. Demonstrar dados fictícios para duas organizações e restringir a visão ao tenant selecionado.
2. Cadastrar aluno e veículo.
3. Agendar aula e recusar sobreposição de aluno/instrutor/veículo.
4. Finalizar localmente com indicação visível de que não houve registro oficial.
5. Criar pacote, receber parcela e não cobrar novamente as aulas consumidas.
6. Persistir alterações durante reload no mesmo navegador.

### Implementação

Criados `index.html`, `styles.css`, `app.js` e documentos de escopo, pesquisa, modelo de dados e decisões. A interface usa JavaScript simples e LocalStorage; não há API ou dados reais.

### Evidência

- `node --check app.js` — passou.
- `node --check domain.js` — passou.
- `node test-domain.cjs` — passou: sobreposição, horário adjacente, recursos diferentes, conflito entre tenants, aula cancelada, recebimentos em parcelas, limite de saldo, tenant de pagamento e consumo de pacote.
- `python3 -m http.server 8000` + `curl -I http://localhost:8000/index.html` — servidor respondeu HTTP 200. Não foi possível executar QA visual de navegador: não há binário Chrome/Chromium/Firefox instalado no ambiente.
- O histórico inicial compartilhado foi adicionado em `ORIGEM_IDEIA.md`; o acesso automatizado ao conteúdo falhou, então não atribuí requisitos àquela conversa.

### Revisão e limites

Não há PHP/Composer no ambiente, nem repositório ou infraestrutura backend. Portanto, esta entrega é um protótipo, não um SaaS seguro. Verificações automatizadas cobrem funções puras de domínio, mas não substituem teste visual e de integração. Documentação técnica oficial para registro de aulas não foi localizada nesta pesquisa. A finalização local e o consumo do pacote são ações distintas neste protótipo.

### Aprendizado e próxima prioridade

Consultas WSDenatran e registro de aula são capacidades distintas. O próximo incremento deve migrar esta jornada para API autenticada com persistência relacional, autorização multi-tenant e testes de concorrência, depois de validar ambiente de deploy e regras operacionais de faltas/cancelamentos.
