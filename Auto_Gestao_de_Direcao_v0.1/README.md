# Auto Gestão de Direção — protótipo v0.1

Primeira fatia executável do MVP: alunos, veículos, agenda, financeiro e relatórios em interface responsiva. Foi feita sem dependências de build para rodar no ambiente disponível.

## Executar

Com Python 3 instalado, na pasta do projeto:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`. As mudanças ficam em LocalStorage no navegador utilizado. Para reiniciar a demonstração, remova o item `agd-prototype-v01` do LocalStorage.

Rode as verificações de regra de domínio com:

```bash
node --check app.js
node test-domain.cjs
```

## Limites

Isto é um protótipo local, não um SaaS pronto para uso operacional. Não há autenticação, backend, sincronização, cópia de segurança nem isolamento seguro entre pessoas. Não insira dados reais. A indicação “finalizada localmente” não representa registro ou validação oficial no Detran, RENACH ou SENATRAN. O protótipo usa fontes do Google Fonts se a conexão estiver disponível; o restante funciona sem dependências externas.

## Arquivos de produto

- `ESCOPO_MVP.md`: fronteira e critérios da primeira fatia.
- `PESQUISA_INTEGRACOES.md`: evidências públicas e incertezas de integração.
- `MODELO_DADOS.md`: modelo lógico para backend futuro.
- `DECISOES.md`: decisões técnicas e operacionais.
- `PROGRESSO.md`: ciclo, testes e próxima prioridade.
- `ORIGEM_IDEIA.md`: referência ao histórico compartilhado e situação de acesso.
