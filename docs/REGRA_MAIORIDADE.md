# Regra de maioridade para alunos

## Regra do produto

O Auto Gestão de Direção aceita somente alunos com 18 anos completos ou mais na data do cadastro.

- menores de 18 anos não podem iniciar nem concluir cadastro;
- a regra vale para cadastro próprio, convite, cadastro pelo instrutor e cadastro demo pelo administrador;
- a interface deve informar a restrição antes do envio;
- o backend deve validar a data, sem confiar no navegador;
- o banco deve rejeitar inserções sem data de nascimento ou abaixo da idade mínima;
- alterar a data de nascimento deve executar novamente a validação e gerar auditoria.

## Proteção no banco

A migração `002_student_minimum_age` cria um gatilho em `aluno`. Novos registros exigem `data_nascimento` válida e idade mínima de 18 anos.

Os registros demonstrativos antigos não são alterados automaticamente, mas qualquer novo aluno fica sujeito à regra.

## Implantação

As migrações pendentes devem ser aplicadas em ordem com `node scripts/migrate-all.mjs` após revisão do ambiente e backup.
