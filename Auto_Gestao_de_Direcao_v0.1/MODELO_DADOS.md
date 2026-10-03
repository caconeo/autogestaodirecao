# Modelo de dados inicial

Modelo lógico proposto para backend PostgreSQL futuro. O protótipo guarda estrutura reduzida no navegador e usa conteúdo inteiramente fictício.

```text
organizacao (id, tipo, nome, fuso, ativa)
usuario (id, nome, email, status)
vinculo_usuario (organizacao_id, usuario_id, papel, permissoes)
aluno (id, organizacao_id, nome, telefone?, categoria, processo_status_interno)
instrutor (id, organizacao_id, nome, categoria, validade_informada?)
veiculo (id, organizacao_id, placa, modelo, categoria, validade_informada?)
aula (id, organizacao_id, aluno_id, instrutor_id, veiculo_id, inicio, fim,
      status_local, status_integracao, ocorrencia?, criada_por)
historico_aula (id, aula_id, evento, de, para, ocorrido_em, ator_id)
pacote (id, organizacao_id, aluno_id, nome, quantidade, saldo_aulas, valor_centavos, status)
conta_receber (id, organizacao_id, aluno_id, pacote_id?, descricao, valor_centavos,
               vencimento, status, origem)
pagamento (id, organizacao_id, conta_receber_id, valor_centavos, recebido_em, meio, referencia?)
despesa (id, organizacao_id, descricao, valor_centavos, vencimento, pago_em?, status)
estorno (id, organizacao_id, lancamento_original_id, valor_centavos, motivo, criado_em)
evento_integracao (id, organizacao_id, aula_id, provedor, acao, idempotency_key,
                  status, protocolo_externo?, tentativas, criado_em)
auditoria (id, organizacao_id, ator_id, entidade, entidade_id, acao, instante, metadados_minimos)
```

## Integridade e regras

- Toda entidade operacional e toda consulta de servidor deve ser escopada por `organizacao_id`; autorização no backend é obrigatória.
- Índices de agenda em `organizacao_id`, instrutor, veículo, aluno e intervalo. Conflito de intervalo semiaberto `[início, fim)` deve ser serializado/validado no servidor para resistir a concorrência.
- Valores monetários em centavos inteiros (ou `numeric(12,2)`); nunca ponto flutuante.
- Pacote cria uma única conta a receber. Consumo altera saldo do pacote e trilha de consumo, sem nova conta.
- Pagamento é registro separado, permite parcelas; `saldo_aberto = valor - pagamentos válidos + reversões aplicáveis`.
- Lançamento quitado não é apagado. Estorno referencia o original e exige motivo.
- `status_local` de aula é independente de `status_integracao`; terminar localmente não confirma transmissão.
- CPF, documentos e localização não entram no MVP. Dados pessoais futuros exigem finalidade, base legal, minimização, retenção e controles revisados.
