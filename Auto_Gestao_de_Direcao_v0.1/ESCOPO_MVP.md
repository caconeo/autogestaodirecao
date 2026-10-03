# Escopo do MVP — Auto Gestão de Direção

**Versão:** 0.1 · **Estado:** protótipo navegável, sem backend · **Fuso:** America/Sao_Paulo

## Usuários e objetivo

Permitir a um instrutor autônomo ou a uma autoescola controlar alunos, veículos, agenda e recebimentos em uma única operação. Cada organização tem seus próprios dados. O sistema não consulta nem registra dados no RENACH/Detran.

## Jornada desta fatia

1. Selecionar organização de demonstração (instrutor ou CFC).
2. Consultar resumo operacional e agenda.
3. Cadastrar aluno/veículo ou agendar aula.
4. Bloquear conflito de horário por aluno, instrutor ou veículo.
5. Finalizar aula localmente sem marcar como registrada oficialmente.
6. Criar pacote e receber pagamento parcial sem cobrar novamente por aula consumida.
7. Consultar lançamentos e histórico da organização ativa.

## Critérios de aceite

- Os dados de demonstração são fictícios e têm rótulo visível.
- A aula só pode ser agendada quando aluno, instrutor e veículo não tiverem outra aula ativa no intervalo.
- Concluir aula altera apenas o estado local para `FINALIZADA_LOCALMENTE`.
- Um pacote gera uma conta a receber; aulas consumidas reduzem saldo sem gerar nova cobrança.
- Pagamento parcial reduz o saldo em aberto, mantendo o valor original e o histórico.
- A troca de organização mostra somente os registros daquela organização.
- Os estados e lançamentos persistem no navegador via LocalStorage; isso não equivale a autenticação ou isolamento seguro entre usuários.

## Fora desta fatia

Autenticação real, API/backend, multiusuário, sincronização, integrações oficiais, cobrança PIX, emissão fiscal, anexos de documentos, política comercial para faltas/cancelamentos e portal do aluno. Não inserir dados pessoais reais neste protótipo.
