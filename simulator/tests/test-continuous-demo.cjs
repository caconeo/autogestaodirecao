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
    getContext: () => fakeCtx,
    getBoundingClientRect: () => ({ width: 800, height: 600 })
  });
  const sandbox = {
    console,
    Math, Date, JSON, Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    addEventListener: noop, removeEventListener: noop,
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
  return vm.createContext(sandbox);
}

const ctx = makeSandbox();
let code = fs.readFileSync(path.join(__dirname, '..', 'src', 'simulator-engine.js'), 'utf8');

// Hook issueAit to capture all infractions
code = code.replace(
  'function issueAit(artKey, customReason) {',
  'function issueAit(artKey, customReason) { if (!globalThis._recordedAits) globalThis._recordedAits = []; globalThis._recordedAits.push({ artKey, customReason, stage: ROAD_STAGES[roadState.stageIndex].id, speed: roadState.speedKmh, x: roadState.playerX });'
);

vm.runInContext(code, ctx, { filename: 'simulator-engine.js' });
const sim = ctx.AGDSimulator;
sim.init();
sim.switchScenario('direcao-vias');
sim.setDriveMode('demo');

const rs = sim.getRoadState();
console.log('Running 300s test in Demo Mode across natural stage progression...');
const dt = 1 / 30;
for (let f = 0; f < 30 * 300; f++) {
  sim._test.step(dt);
}

const recorded = ctx._recordedAits || [];
console.log('\n================ RESULT ================');
console.log('Total AITs issued in Demo Mode:', recorded.length);
recorded.forEach((a, i) => {
  console.log(`[#${i + 1}] Stage: ${a.stage} | Art: ${a.artKey} | Speed: ${a.speed.toFixed(1)} km/h | X: ${a.x.toFixed(2)} | Reason: ${a.customReason}`);
});
