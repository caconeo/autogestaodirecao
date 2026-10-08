# Modelo de dados relacional (Neon PostgreSQL 18)

Esquema físico e relacional parametrizado e ativo no banco de dados Neon (`autogestaodirecao`).

```text
1. admin_usuario (id, nome, email, senha_hash, papel, ativo, criado_em, ultimo_login)
2. plano_assinatura (id, nome, tipo_publico, valor_mensal_centavos, limite_alunos, limite_veiculos, recursos_json, ativo, criado_em)
3. organizacao (id, tipo, nome, documento_fiscal?, telefone?, email_contato?, status_assinatura, plano_id, assinatura_valida_ate, ativa, criado_em)
4. usuario (id, organizacao_id, nome, email, senha_hash, papel, status, criado_em, ultimo_acesso)
5. convite_aluno (id, organizacao_id, instrutor_id, nome_aluno, email_aluno, telefone_aluno, categoria, token_convite, status, expira_em, aluno_id?, criado_em)
6. aluno (id, organizacao_id, instrutor_vinculado_id, nome, email, senha_hash?, telefone?, categoria, status, origem_convite_id?, xp_total, nivel, habilidades_json, conquistas_json, criado_em, ultimo_acesso)
7. veiculo (id, organizacao_id, placa, model, categoria, status, criado_em)
8. aula (id, organizacao_id, aluno_id, instrutor_id, veiculo_id, inicio, fim, status_local, topico, criado_em)
9. pacote (id, organizacao_id, aluno_id, nome, quantidade, saldo_aulas, valor_centavos, status, criado_em)
10. conta_receber (id, organizacao_id, aluno_id, pacote_id?, descricao, valor_centavos, vencimento, status, origem, criado_em)
11. pagamento (id, organizacao_id, conta_receber_id, valor_centavos, recebido_em, meio, referencia?, criado_em)
12. despesa (id, organizacao_id, descricao, valor_centavos, vencimento, pago_em?, status, criado_em)
13. simulador_sessao (id, aluno_id, cenario, modo, score, duracao_segundos, infracoes_cometidas, criado_em)
14. registro_auditoria (id, autor_tipo, autor_id, acao, tabela_afetada, detalhes_json, criado_em)
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
