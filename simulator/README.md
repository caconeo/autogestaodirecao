# Simulador de Direção e Auditor CTB

Módulo isolado do sistema Auto Gestão de Direção para evolução e migração independentes.

## Estrutura

- `src/simulator-engine.js`: motor visual, física e regras de condução.
- `tests/simulator-ctb-audit.cjs`: auditor automatizado das regras CTB.
- `tests/test-demo-mode.cjs`: validação do modo de demonstração.
- `tests/test-continuous-demo.cjs`: validação contínua da progressão de cenários.
- `public/sons/`: recursos de áudio usados pelo motor.

## Validação

```bash
cd simulator
npm test
npm run audit:ctb
```

O pacote ainda preserva APIs globais do protótipo (`AGDSimulator`) e será a base para a futura aplicação independente. A camada visual standalone deve ser extraída em uma próxima evolução.