/* ════════════════════════════════════════════════════════════════════
   AUDITORIA AUTOMATIZADA CTB — Simulador "Auto Gestão de Direção"
   Executa o motor real (simulator-engine.js) em Node, sem navegador,
   e verifica, quadro a quadro, se TODOS os personagens não controlados
   pelo aluno cumprem o Código de Trânsito Brasileiro.

   Uso:  npm run audit:ctb
   Saída: relatório por regra/cenário. Código de saída 1 se houver infração.

   Convenção de eixos do motor: o condutor (aluno) está em y = 0.
   y > 0 é À FRENTE do condutor; o tráfego no mesmo sentido anda para +y.
   ════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ── 1. Ambiente de navegador mínimo (stubs) ── */
function makeSandbox() {
  const noop = () => {};
  const fakeEl = () => null;
  const sandbox = {
    console,
    Math, Date, JSON, Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    document: {
      getElementById: fakeEl, querySelector: fakeEl, querySelectorAll: () => [],
      addEventListener: noop, removeEventListener: noop,
      createElement: () => ({ style: {}, appendChild: noop, setAttribute: noop, getContext: () => null })
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

/* ── 2. Geometria legal de referência (a "lei" que o teste cobra) ── */
const G = {
  ZEBRA_HALF: 1.5,          // faixa de pedestres: 3,0 m de profundidade
  TL_ZEBRA_OFFSET: -1.7,    // faixa de pedestres do semáforo: centro em tl.y - 1,7
  TL_STOP_LINE: -3.2,       // nenhum para-choque além de tl.y - 3,2 com sinal vermelho
  PARE_BOX_HALF: 3.5,       // cruzamento transversal: tl.y ± 3,5
  RAIL_HALF: 2.75,          // leito ferroviário: rc.y ± 2,75
  VISIBLE_MIN: -14, VISIBLE_MAX: 42
};

function crosswalkY(rs, stage) {
  if (stage.id === 'arterial') return rs.trafficLight.y + G.TL_ZEBRA_OFFSET;
  if (stage.id === 'escolar') return rs.trafficWarden.y;
  if (stage.id === 'coletora') return rs.crosswalk.y;
  return null; // ferrovia / rodovias: sem faixa de pedestres
}

/* ── 3. Coleta de agentes ── */
function aiVehicles(rs) {
  const list = [];
  const add = (id, v, extra = {}) => {
    if (!v || v.active === false) return;
    list.push(Object.assign({ id, ref: v, x: v.x, y: v.y, w: v.w || 1.8, l: v.l || 4.3, speedKmh: v.speedKmh || 0, dir: 1 }, extra));
  };
  add('frontCar', rs.frontCar);
  add('leftCar', rs.leftCar);
  add('rightCar', rs.rightCar);
  add('rearCar', rs.rearCar);
  add('truck', rs.truck);
  add('motorcycle', rs.motorcycle);
  if (rs.isTwoWay) add('oncomingCar', rs.oncomingCar, { dir: -1 });
  return list;
}

function pedestriansOf(rs, stage) {
  const peds = [];
  if (stage.hasPedestrians) rs.pedestrians.forEach(p => peds.push({ id: 'pedestre#' + p.id, x: p.x, y: p.y }));
  if (stage.isUrban && rs.elderlyPedestrian && rs.elderlyPedestrian.active !== false) {
    peds.push({ id: 'idoso', x: rs.elderlyPedestrian.x, y: rs.elderlyPedestrian.y });
  }
  if (stage.id === 'escolar') rs.schoolChildren.forEach(k => peds.push({ id: 'criança-' + k.id, x: k.x, y: k.y }));
  return peds.filter(p => p.y > G.VISIBLE_MIN && p.y < G.VISIBLE_MAX);
}

const front = v => v.dir > 0 ? v.y + v.l / 2 : v.y - v.l / 2;
const overlap1D = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
function boxesOverlap(a, b, margin = 0) {
  return overlap1D(a.x - a.w / 2 - margin, a.x + a.w / 2 + margin, b.x - b.w / 2, b.x + b.w / 2) &&
         overlap1D(a.y - a.l / 2 - margin, a.y + a.l / 2 + margin, b.y - b.l / 2, b.y + b.l / 2);
}

/* ── 4. Condutor automático (perfis) ── */
function laneForPlayer(stage) { return stage.lanes === 4 ? 2 : 1; }

function driveLegal(sim, rs, stage, mem, dt) {
  const T = sim._test;
  const laneX = T.getLaneCenterX(stage, laneForPlayer(stage));
  rs.playerX = laneX; rs.steerAngle = 0;
  let target = stage.speedLimit * 0.9;
  const VL = T.vehicle.length / 2;
  const stopAt = (lineY) => { // lineY: posição do para-choque dianteiro para parar
    const d = lineY - VL;     // distância livre do para-choque do aluno até a linha
    if (d < -0.3) return;     // já passou da linha
    const vAllowed = Math.sqrt(2 * 3.0 * Math.max(0, d - 0.6)) * 3.6;
    target = Math.min(target, vAllowed);
  };
  // semáforo
  if (stage.id === 'arterial' && rs.trafficLight.state !== 'green') stopAt(rs.trafficLight.y + G.TL_STOP_LINE - 0.3);
  // PARE
  if (stage.id === 'coletora') {
    const line = rs.intersection.y - G.PARE_BOX_HALF - 0.5;
    if (mem.pareCycle !== Math.round(rs.intersection.y > 40 ? 1 : 0) && line - VL > 8) mem.pareDone = false;
    if (!mem.pareDone) {
      stopAt(line);
      if (line - VL < 1.5 && rs.speedKmh < 0.5) { mem.pareWait = (mem.pareWait || 0) + dt; if (mem.pareWait > 1.5) { mem.pareDone = true; mem.pareWait = 0; } }
    }
    if (line - VL < -6) mem.pareDone = false;
  }
  // ferrovia
  if (stage.id === 'ferrovia' && (rs.railCrossing.barrierDown || rs.railCrossing.trainPassing)) stopAt(rs.railCrossing.y - G.RAIL_HALF - 0.8);
  // faixa de pedestres com pedestre na pista
  const cwY = crosswalkY(rs, stage);
  if (cwY !== null) {
    const halfW = stage.roadWidth / 2;
    const anyOnRoad = pedestriansOf(rs, stage).some(p => Math.abs(p.x) < halfW + 0.9 && Math.abs(p.y - cwY) <= G.ZEBRA_HALF + 0.3);
    if (anyOnRoad) stopAt(cwY - G.ZEBRA_HALF - 0.8);
  }
  // veículo à frente na mesma faixa
  aiVehicles(rs).forEach(v => {
    if (v.dir > 0 && v.y > 0 && Math.abs(v.x - laneX) < (v.w + T.vehicle.width) / 2) {
      stopAt(v.y - v.l / 2 - 2.0);
    }
  });
  if (stage.id === 'escolar') {
    const sb = rs.schoolBus;
    if (Math.abs(sb.x - laneX) < (sb.w + T.vehicle.width) / 2 && sb.y > 0) stopAt(sb.y - sb.l / 2 - 2.0);
  }
  // ciclista: só ultrapassa se houver 1,5 m; senão segue atrás
  const cyc = rs.cyclist;
  if (stage.isUrban && cyc.y > 0 && Math.abs(cyc.x - laneX) - T.vehicle.width / 2 < 1.6) stopAt(cyc.y - 0.9 - 2.0);
  const cur = rs.speedKmh;
  const next = target < cur ? Math.max(target, cur - 8 * 3.6 * dt) : Math.min(target, cur + 2.5 * 3.6 * dt);
  rs.speedKmh = next; rs.targetSpeedKmh = next;
}

/* ── 5. Auditoria ── */
function runScenario(stageId, mode, seconds) {
  const sim = loadEngine();
  const rs = sim.getRoadState();
  sim.setRoadStage(stageId);
  const stages = sim.getRoadStages();
  const stage = stages.find(s => s.id === stageId);
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  const viol = {};
  const add = (rule, msg) => { (viol[rule] = viol[rule] || { count: 0, examples: [] }).count++; if (viol[rule].examples.length < 3) viol[rule].examples.push(msg); };
  const prev = {};
  const pareStopped = {};
  const stuck = {};
  const mem = {};
  let redOnsetFront = null, lastTlState = rs.trafficLight.state;
  let twoWaySince = null;
  const halfW = stage.roadWidth / 2;
  const T = sim._test;

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    rs.stageTimer = 1e9; // fixa o cenário durante o teste
    if (stage.id !== stageId) break;
    if (Math.abs(t - 8) < dt / 2) sim.triggerAmbulance();
    if (Math.abs(t - 40) < dt / 2) sim.triggerPolice();
    if (stageId === 'ferrovia' && Math.abs(t - 3) < dt / 2) sim.triggerTrain();

    if (mode === 'legal') driveLegal(sim, rs, stage, mem, dt);
    else if (mode === 'parado') { rs.speedKmh = 0; rs.targetSpeedKmh = 0; rs.playerX = T.getLaneCenterX(stage, laneForPlayer(stage)); rs.steerAngle = 0; }
    else if (mode === 'imprudente') { rs.speedKmh = stage.speedLimit * 1.25; rs.targetSpeedKmh = rs.speedKmh; rs.playerX = T.getLaneCenterX(stage, laneForPlayer(stage)); rs.steerAngle = 0; }

    // estado do semáforo antes do passo (para detectar início do vermelho)
    T.step(dt);
    const now = ROAD_SNAPSHOT(rs, stage);
    const tl = rs.trafficLight;

    if (rs.isTwoWay) { if (twoWaySince === null) twoWaySince = t; } else twoWaySince = null;

    const vehicles = aiVehicles(rs).filter(v => v.y > -45 && v.y < 70);
    const visible = vehicles.filter(v => v.y > G.VISIBLE_MIN && v.y < G.VISIBLE_MAX);

    // R1 — Velocidade máxima da via (Art. 218)
    visible.forEach(v => { if (v.speedKmh > stage.speedLimit + 0.5) add('R01 Velocidade acima do limite (Art. 218)', `${v.id} a ${v.speedKmh.toFixed(1)} km/h (limite ${stage.speedLimit}) t=${t.toFixed(1)}s`); });

    // R2 — Permanecer na pista (não invadir calçada/acostamento — Art. 193)
    visible.forEach(v => { if (Math.abs(v.x) + v.w / 2 > halfW + 0.05) add('R02 Veículo fora da pista / na calçada (Art. 193)', `${v.id} x=${v.x.toFixed(2)} (meia-largura ${halfW}) t=${t.toFixed(1)}s`); });

    // R3 — Nenhuma sobreposição entre veículos da IA (Art. 192 — distância de segurança)
    for (let a = 0; a < visible.length; a++) for (let b = a + 1; b < visible.length; b++) {
      if (boxesOverlap(visible[a], visible[b])) add('R03 Colisão/sobreposição entre veículos da IA (Art. 192)', `${visible[a].id} × ${visible[b].id} y=${visible[a].y.toFixed(1)}/${visible[b].y.toFixed(1)} t=${t.toFixed(1)}s`);
    }
    // R4 — IA não pode bater na traseira do aluno
    const player = { x: rs.playerX, y: 0, w: T.vehicle.width, l: T.vehicle.length };
    visible.forEach(v => { if (v.dir > 0 && v.y < 0 && boxesOverlap(v, player)) add('R04 IA colidiu na traseira do aluno (Art. 192)', `${v.id} y=${v.y.toFixed(2)} t=${t.toFixed(1)}s`); });

    // R5 — Semáforo vermelho (Art. 208)
    if (stage.id === 'arterial') {
      if (tl.state === 'red' && lastTlState !== 'red') {
        redOnsetFront = {};
        vehicles.forEach(v => { redOnsetFront[v.id] = v.dir > 0 ? front(v) < tl.y + G.TL_STOP_LINE : front(v) > tl.y + 0.5; });
      }
      if (tl.state !== 'red') redOnsetFront = null;
      if (redOnsetFront) vehicles.forEach(v => {
        const wasBefore = redOnsetFront[v.id];
        const p = prev[v.id];
        if (!wasBefore || !p || Math.abs(v.y - p.y) > 8) return;
        const crossed = v.dir > 0 ? front(v) > tl.y + G.TL_STOP_LINE + 0.05 : front(v) < tl.y + 0.45;
        if (crossed) { add('R05 Avançou sinal vermelho (Art. 208)', `${v.id} front=${front(v).toFixed(2)} linha=${(tl.y + G.TL_STOP_LINE).toFixed(2)} t=${t.toFixed(1)}s`); redOnsetFront[v.id] = false; }
      });
      lastTlState = tl.state;
    } else if (tl.state === 'red' && stage.isUrban) {
      // Semáforo "fantasma": não existe visualmente fora da avenida, mas a IA não pode parar por ele
      vehicles.forEach(v => { if (v.speedKmh < 0.5 && Math.abs(front(v) - (tl.y - 3.5)) < 2.0 && v.y > 0) add('R05b IA parando em semáforo inexistente', `${v.id} t=${t.toFixed(1)}s`); });
    }

    // R6 — Passagem de nível com cancela baixada (Art. 212)
    if (stage.id === 'ferrovia') {
      const rc = rs.railCrossing;
      if (rc.barrierDown || rc.trainPassing) vehicles.forEach(v => {
        const p = prev[v.id]; if (!p || Math.abs(v.y - p.y) > 8 || !p.barrier) return;
        const line = v.dir > 0 ? rc.y - G.RAIL_HALF : rc.y + G.RAIL_HALF;
        const wasBefore = v.dir > 0 ? p.front <= p.rcLine : p.front >= p.rcLine;
        const isPast = v.dir > 0 ? front(v) > line + 0.05 : front(v) < line - 0.05;
        if (wasBefore && isPast) add('R06 Invadiu a linha férrea com cancela baixada (Art. 212)', `${v.id} front=${front(v).toFixed(2)} trilho=${rc.y.toFixed(2)} t=${t.toFixed(1)}s`);
      });
      vehicles.forEach(v => { prev[v.id] = Object.assign(prev[v.id] || {}, { barrier: rc.barrierDown || rc.trainPassing, rcLine: v.dir > 0 ? rc.y - G.RAIL_HALF : rc.y + G.RAIL_HALF }); });
    }

    // R7 — Placa PARE (R-1): parada total antes do cruzamento (Art. 208)
    if (stage.id === 'coletora') {
      const inter = rs.intersection;
      vehicles.forEach(v => {
        const line = v.dir > 0 ? inter.y - G.PARE_BOX_HALF : inter.y + G.PARE_BOX_HALF;
        const dist = v.dir > 0 ? line - front(v) : front(v) - line;
        if (dist > 12) pareStopped[v.id] = false;
        if (dist >= -0.1 && dist < 5 && v.speedKmh < 0.6) pareStopped[v.id] = true;
        const p = prev[v.id];
        if (p && Math.abs(v.y - p.y) < 8 && p.pareDist !== undefined && p.pareDist >= 0 && dist < 0 && !pareStopped[v.id]) {
          add('R07 Avançou a placa PARE sem parada total (Art. 208)', `${v.id} t=${t.toFixed(1)}s`);
        }
        prev[v.id] = Object.assign(prev[v.id] || {}, { pareDist: dist });
      });
      // R7b — veículo transversal não pode atravessar veículo que já está no cruzamento
      const cc = inter.crossingCar;
      const ccBox = { x: cc.x, y: inter.y, w: 4.2, l: 1.85 };
      visible.forEach(v => { if (boxesOverlap(v, ccBox)) add('R07b Veículo transversal colidiu com veículo da via (Art. 29/192)', `${v.id} t=${t.toFixed(1)}s`); });
    }

    // R8 — Pedestres: somente calçada; pista só sobre a faixa (Art. 68/69)
    const cwY = crosswalkY(rs, stage);
    const peds = pedestriansOf(rs, stage);
    peds.forEach(p => {
      if (Math.abs(p.x) < halfW - 0.05) {
        const onZebra = cwY !== null && Math.abs(p.y - cwY) <= G.ZEBRA_HALF + 0.1;
        if (!onZebra) add('R08 Pedestre andando na pista fora da faixa (Art. 68/69)', `${p.id} x=${p.x.toFixed(2)} y=${p.y.toFixed(1)} faixa=${cwY === null ? 'inexistente' : cwY.toFixed(1)} t=${t.toFixed(1)}s`);
      }
    });

    // R9 — Preferência do pedestre na faixa (Art. 214/70) e atropelamento
    if (cwY !== null) {
      const onZebraPeds = peds.filter(p => Math.abs(p.x) < halfW && Math.abs(p.y - cwY) <= G.ZEBRA_HALF + 0.1);
      vehicles.forEach(v => {
        const p = prev[v.id];
        const zebraStart = v.dir > 0 ? cwY - G.ZEBRA_HALF : cwY + G.ZEBRA_HALF;
        const f = front(v);
        if (onZebraPeds.length && p && Math.abs(v.y - p.y) < 8 && p.cwFront !== undefined) {
          const crossed = v.dir > 0 ? (p.cwFront <= p.cwStart && f > zebraStart + 0.05) : (p.cwFront >= p.cwStart && f < zebraStart - 0.05);
          if (crossed) add('R09 Não deu preferência a pedestre na faixa (Art. 214)', `${v.id} t=${t.toFixed(1)}s`);
        }
        onZebraPeds.forEach(pd => { if (boxesOverlap(v, { x: pd.x, y: pd.y, w: 0.5, l: 0.5 })) add('R09b ATROPELAMENTO de pedestre pela IA', `${v.id} × ${pd.id} t=${t.toFixed(1)}s`); });
        prev[v.id] = Object.assign(prev[v.id] || {}, { cwFront: f, cwStart: zebraStart });
      });
    }

    // R10 — Ciclista: bordo direito e 1,50 m de distância lateral (Art. 58/201)
    if (stage.isUrban) {
      const c = rs.cyclist;
      if (c.y > G.VISIBLE_MIN && c.y < G.VISIBLE_MAX) {
        if (Math.abs(c.x) > halfW || c.x < halfW - 1.2) add('R10 Ciclista fora do bordo direito da pista (Art. 58)', `x=${c.x.toFixed(2)} t=${t.toFixed(1)}s`);
        visible.forEach(v => {
          if (overlap1D(v.y - v.l / 2, v.y + v.l / 2, c.y - 0.9, c.y + 0.9)) {
            const gap = Math.abs(v.x - c.x) - v.w / 2 - 0.3;
            if (gap < 1.5) add('R10b Ultrapassou ciclista a menos de 1,50 m (Art. 201)', `${v.id} gap=${gap.toFixed(2)}m t=${t.toFixed(1)}s`);
          }
        });
        if (c.speedKmh > stage.speedLimit) add('R10c Ciclista acima do limite', '');
      }
    }

    // R11 — Animal fora das faixas de rolamento (ou a IA deve parar)
    const an = rs.animal;
    if (an.y > G.VISIBLE_MIN && an.y < G.VISIBLE_MAX && Math.abs(an.x) < halfW - 0.1) {
      visible.forEach(v => { if (boxesOverlap(v, { x: an.x, y: an.y, w: 0.6, l: 0.9 })) add('R11 IA atropelou animal na pista (Art. 220-XI)', `${v.id} t=${t.toFixed(1)}s`); });
    }

    // R12 — Mão dupla: nenhum veículo no mesmo sentido na faixa da contramão (Art. 186)
    if (rs.isTwoWay && twoWaySince !== null && t - twoWaySince > 6) {
      const nOnc = Math.max(1, Math.floor(stage.lanes / 2));
      const boundary = -halfW + nOnc * (stage.roadWidth / stage.lanes);
      visible.forEach(v => {
        if (v.dir > 0 && v.x < boundary) add('R12 IA trafegando na contramão em via de mão dupla (Art. 186)', `${v.id} x=${v.x.toFixed(2)} t=${t.toFixed(1)}s`);
        if (v.dir < 0 && v.x > boundary) add('R12b Veículo em sentido oposto fora da sua mão (Art. 186)', `x=${v.x.toFixed(2)} t=${t.toFixed(1)}s`);
      });
    }

    // R13 — Ônibus escolar parado: IA não pode atravessá-lo
    if (stage.id === 'escolar') {
      const sb = rs.schoolBus;
      visible.forEach(v => { if (boxesOverlap(v, { x: sb.x, y: sb.y, w: sb.w, l: sb.l })) add('R13 IA atravessou o ônibus escolar parado', `${v.id} t=${t.toFixed(1)}s`); });
    }

    // R14 — Veículos de emergência não podem atravessar outros veículos
    [['ambulance', rs.ambulance, 2.2, 5.4], ['police', rs.policeCruiser, 1.85, 4.8]].forEach(([id, e, w, l]) => {
      if (!e.active || (id === 'police' && !e.isPursuing)) return;
      if (e.y < G.VISIBLE_MIN || e.y > G.VISIBLE_MAX) return;
      const eb = { x: e.x, y: e.y, w, l };
      visible.forEach(v => { if (boxesOverlap(v, eb)) add('R14 Viatura de emergência atravessou outro veículo', `${id} × ${v.id} t=${t.toFixed(1)}s`); });
      if (Math.abs(e.x) + w / 2 > halfW + 0.05) add('R14b Viatura de emergência fora da pista', `${id} x=${e.x.toFixed(2)} t=${t.toFixed(1)}s`);
    });
    // R14c — viatura acionada deve se mover
    if (rs.policeCruiser.isPursuing && t > 46 && t < 47 && Math.abs(rs.policeCruiser.y - (-35)) < 0.01) add('R14c Viatura policial acionada não se move', '');

    // R15 — Deadlock: veículo visível parado por mais de 45 s
    visible.forEach(v => {
      if (v.speedKmh < 0.5) stuck[v.id] = (stuck[v.id] || 0) + dt; else stuck[v.id] = 0;
      if (stuck[v.id] > 45) { add('R15 Veículo travado indefinidamente (deadlock)', `${v.id} y=${v.y.toFixed(1)} t=${t.toFixed(1)}s`); stuck[v.id] = -1e9; }
    });

    vehicles.forEach(v => { prev[v.id] = Object.assign(prev[v.id] || {}, { y: v.y, front: front(v) }); });
    void now;
  }
  return viol;
}
function ROAD_SNAPSHOT() { return null; }

/* ── 6. Execução ── */
const STAGES = (process.env.AUDIT_STAGES || 'escolar,coletora,arterial,ferrovia,rapida,rodovia').split(',');
const MODES = (process.env.AUDIT_MODES || 'legal,parado,imprudente').split(',');
const SECONDS = Number(process.env.AUDIT_SECONDS || 120);
let total = 0;
const summary = {};
for (const st of STAGES) for (const md of MODES) {
  let v;
  try { v = runScenario(st, md, SECONDS); }
  catch (e) { v = { 'R00 ERRO DE EXECUÇÃO DO MOTOR': { count: 1, examples: [String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')] } }; }
  const keys = Object.keys(v).sort();
  const n = keys.reduce((s, k) => s + v[k].count, 0);
  total += n;
  console.log(`\n■ Cenário ${st.toUpperCase()} · condutor ${md} — ${n === 0 ? '✅ 0 infrações' : '❌ ' + n + ' quadros com infração'}`);
  keys.forEach(k => {
    console.log(`   ${k}: ${v[k].count}`);
    v[k].examples.forEach(e => console.log(`      ↳ ${e}`));
    summary[k] = (summary[k] || 0) + v[k].count;
  });
}
console.log('\n════════ RESUMO POR REGRA ════════');
const sk = Object.keys(summary).sort();
if (!sk.length) console.log('  ✅ Nenhuma infração em nenhuma regra.');
sk.forEach(k => console.log(`  ${k}: ${summary[k]}`));
console.log(`\nTOTAL: ${total} quadros com infração · ${STAGES.length * MODES.length} execuções de ${SECONDS}s simulados`);
process.exit(total ? 1 : 0);
