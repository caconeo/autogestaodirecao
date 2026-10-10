# Decisões do projeto

## D-001 — Primeira entrega como protótipo navegador

**Data:** 27/09/2026 · **Estado:** adotada para a primeira fatia.

O workspace não contém aplicação existente, repositório, PHP/Composer ou dependências Vue instaladas. Node 24 está disponível. Para entregar uma jornada executável sem depender de instalação ou serviço externo, a primeira fatia será HTML/CSS/JavaScript sem build, com persistência local demonstrativa. Não é backend nem ambiente multiusuário.

## D-002 — Integração oficial fora do MVP executável

O catálogo WSDenatran descreve serviço condicionado a autorização e contratação; a pesquisa não encontrou especificação pública de registro de aulas nem credenciamento técnico de fornecedor. A aplicação não simula sucesso oficial.

## D-003 — PostgreSQL e Vue 3 + Vuetify 3 como destino

Manter stack indicada no prompt para migração após validar jornada e ambiente de deploy. Antes do backend, estabelecer política de autenticação, autorização multi-tenant e hospedagem. Laravel não pôde ser executado aqui por ausência de PHP.

## D-004 — Dinheiro inteiro em centavos

Regras financeiras no protótipo usam centavos inteiros; no banco futuro, centavos inteiros ou `numeric`, nunca `float`.

## D-005 — Protótipo não serve para dados reais

LocalStorage não oferece isolamento confiável entre pessoas/dispositivos, autorização no servidor, backup ou proteção adequada de dados pessoais. Demonstração contém somente dados fictícios.
