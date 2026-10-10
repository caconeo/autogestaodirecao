'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeSandbox() {
  const noop = () => {};
  const fakeCtx = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (prop === 'measureText') {
        return () => ({ width: 50 });
      }
      return noop;
    }
  });
  const fakeEl = () => ({
    classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
    addEventListener: noop,
    style: {},
    getContext: () => fakeCtx
  });
  const sandbox = {
    console,
    Math, Date, JSON, Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    document: {
      getElementById: fakeEl, querySelector: fakeEl, querySelectorAll: () => [],
      addEventListener: noop, removeEventListener: noop,
      createElement: () => fakeEl()
    },
    Audio: class { constructor() { this.volume = 0; this.loop = false; this.paused = true; this.currentTime = 0; }
      play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } addEventListener() {} },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: 'node-audit' }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = noop;
  sandbox.window.removeEventListener = noop;
  return vm.createContext(sandbox);
}

function loadEngine() {
  const ctx = makeSandbox();
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'simulator-engine.js'), 'utf8');
  vm.runInContext(code, ctx, { filename: 'simulator-engine.js' });
  return ctx.AGDSimulator;
}

const sim = loadEngine();
sim.init();

const stages = ['escolar', 'coletora', 'arterial', 'ferrovia', 'rapida', 'rodovia'];
let totalFailures = 0;

console.log('═══════════════════════════════════════════════════════════════');
console.log('🤖 TESTE DE CONDUÇÃO AUTÔNOMA DO MODO DEMO (CTB 100% SEM FALHAS)');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const stageId of stages) {
  sim.setRoadStage(stageId);
  sim.setDriveMode('demo');

  const rs = sim.getRoadState();
  rs.stageTimer = 99999; // Mantém o cenário fixo durante o teste do estágio
  const initialAits = (rs.aitsIssued || []).length;
  let maxSpeedRecorded = 0;
  let violations = [];
  const dt = 1 / 30; // 30 FPS
  const totalFrames = 30 * 45; // 45 segundos simulados por cenário

  // Triggers aleatórios para testar SAMU, Polícia, Trem durante o percurso
  const triggerSamuFrame = 30 * 10;
  const triggerPoliceFrame = 30 * 25;

  for (let frame = 0; frame < totalFrames; frame++) {
    if (frame === triggerSamuFrame && sim.triggerAmbulance) sim.triggerAmbulance();
    if (frame === triggerPoliceFrame && sim.triggerPolice) sim.triggerPolice();

    sim._test.step(dt);

    const currentStage = sim.getRoadStages()[rs.stageIndex];
    if (rs.speedKmh > maxSpeedRecorded) maxSpeedRecorded = rs.speedKmh;

    if (rs.speedKmh > currentStage.speedLimit + 0.1) {
      violations.push(`Excesso de velocidade: ${rs.speedKmh.toFixed(1)} km/h em via de ${currentStage.speedLimit} km/h (frame ${frame})`);
    }
  }

  const finalAits = (rs.aitsIssued || []).length - initialAits;
  const aits = (rs.aitsIssued || []).slice(initialAits);

  console.log(`▶ Cenário: [${stageId.toUpperCase()}]`);
  console.log(`   Velocidade Máxima registrada: ${maxSpeedRecorded.toFixed(1)} km/h`);
  console.log(`   AITs emitidos: ${finalAits}`);
  if (finalAits > 0) {
    aits.forEach(a => console.log(`      ❌ ${a.article}: ${a.desc}`));
    totalFailures += finalAits;
  }
  if (violations.length > 0) {
    console.log(`      ❌ Violações de velocidade: ${violations.length}`);
    violations.slice(0, 3).forEach(v => console.log(`         ↳ ${v}`));
    totalFailures += violations.length;
  }
  if (finalAits === 0 && violations.length === 0) {
    console.log(`   ✅ 100% Aprovado — Nenhuma falha cometida pela IA!`);
  }
  console.log('───────────────────────────────────────────────────────────────');
}

// Teste do Modo Conduzir (Condutor humano)
console.log('\n🚗 TESTE DE TRANSIÇÃO PARA MODO CONDUZIR (CONDUTOR HUMANO)...');
sim.setDriveMode('manual');
const rs = sim.getRoadState();
const spdBefore = rs.speedKmh;
// Sem input do condutor, o carro não deve acelerar sozinho
for (let f = 0; f < 30; f++) {
  sim._test.step(1 / 30);
}
if (rs.targetSpeedKmh === 0 || rs.speedKmh <= spdBefore) {
  console.log('✅ Modo Conduzir aguarda comandos do motorista e não acelera sozinho!');
} else {
  console.log('❌ Falha: Modo Conduzir acelerou sem comando do condutor!');
  totalFailures++;
}

console.log(`\n═══════════════════════════════════════════════════════════════`);
if (totalFailures === 0) {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO! IA DO MODO DEMO PERFEITA.');
  process.exit(0);
} else {
  console.log(`💥 TOTAL DE FALHAS DETECTADAS: ${totalFailures}`);
  process.exit(1);
}
