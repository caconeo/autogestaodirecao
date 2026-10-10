# Pesquisa de integrações — Auto Gestão de Direção

**Verificação:** 27/09/2026 · Fontes oficiais consultadas pela pesquisa web.

| Capacidade | Estado | Evidência e limite |
|---|---|---|
| Consulta WSDenatran de veículos, condutores e infrações | `CONDICIONAL` | Catálogo Conecta informa que a API acessa dados RENAVAM/RENACH/RENAINF mediante termo de autorização no Denatran e contratação da Consulta Online com o SERPRO. Não prova acesso automático por instrutor ou SaaS, nem acesso a todo campo ou finalidade. |
| Consulta específica de candidato, processo ou LADV | `NÃO ENCONTRADA` | O catálogo consultado não documenta, na página pública analisada, endpoint, campos e escopos para essas operações. Requer confirmação formal com SENATRAN/SERPRO e órgão estadual. |
| Registro/transmissão de aulas práticas via API aberta | `NÃO ENCONTRADA` | Não foi encontrada documentação pública de API, endpoint, payload, credenciamento de software fornecedor ou homologação para registrar aulas. O portal de consulta do SERPRO não é especificação técnica. |
| Credenciamento de instrutor autônomo em MG | `CONFIRMADA` para existência do processo no SCE | Página oficial do SCE lista conta Gov.br Prata ou Ouro para instrutores autônomos e documentação do art. 5º da Portaria 92/2021. Isso é acesso ao credenciamento, não integração de dados do produto. |
| Aulas com instrutor autônomo no novo modelo nacional | `CONFIRMADA` como possibilidade geral | Página do Ministério dos Transportes, atualizada em 13/07/2026, informa opção por autoescola ou instrutor autônomo autorizado pelo Detran. Não especifica API nem procedimento técnico mineiro. |

## Decisão de produto

O MVP registra apenas atividades internas. Qualquer área de integração deverá apresentar estado próprio (`PENDENTE`, `ENVIADA`, `CONFIRMADA`, `REJEITADA` etc.) e comprovante externo antes de declarar uma aula registrada oficialmente. Provedor de demonstração deve ser rotulado como simulação com dados fictícios. Nenhum endpoint, payload ou credencial governamental será inventado.

## Fontes

- Catálogo Conecta, WSDenatran: https://www.gov.br/conecta/catalogo/apis/wsdenatran (consultado em 27/09/2026).
- SCE Detran-MG: https://credenciamento.transito.mg.gov.br/ (consultado em 27/09/2026).
- Ministério dos Transportes, “Saiba mais sobre o programa”: https://www.gov.br/transportes/pt-br/conteudos-cnh-do-brasil/saiba-mais-sobre-o-programa (página informa atualização em 13/07/2026; consultada em 27/09/2026).
- Portal Consulta Online Denatran/SERPRO: https://wsdenatran.estaleiro.serpro.gov.br/ (página acessível, mas sem especificação técnica pública extraída nesta verificação).

## Perguntas de pesquisa pendentes

1. O Detran-MG já publicou procedimento atualizado de registro de aula pelo instrutor autônomo no cenário CNH do Brasil?
2. Há sistema ou API de registro e qual autoridade aceita fornecedor terceiro, com quais termos, escopos e homologação?
3. O serviço WSDenatran é aplicável a empresa privada com finalidade comercial neste caso? Quais dados e bases legais são autorizados?

Até resposta oficial, as capacidades permanecem indisponíveis no produto.
