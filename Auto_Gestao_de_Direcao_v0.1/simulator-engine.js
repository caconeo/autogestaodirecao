/* Auto Gestão de Direção — Motor do Simulador
   Fase 1: Baliza Básica — v0.5
   - Bugfix: Botão Reiniciar agora redefine e repinta o estado com loop ativo garantido.
   - Cinemática de Ré Suave: Pure Pursuit dinâmico que elimina oscilação/balanço da frente do carro.
   - Movimento em fluxo único contínuo com aceleração gradual e desaceleração na vaga.
   Depende de: student-auth.js, student-portal.js */

(() => {

  /* ══════════════════════════════════════════════
     CONSTANTES E CONFIGURAÇÃO
     ══════════════════════════════════════════════ */

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  /* Modelo do veículo — hatch médio */
  const VEHICLE = {
    length: 3.8,
    width: 1.7,
    wheelbase: 2.5,
    frontOverhang: 0.7,
    rearOverhang: 0.6,
    maxSteerAngle: 35,
    turningRadiusMin: 5.0
  };

  /* Cenário: Baliza Básica Realista */
  const SCENARIO = {
    id: 'baliza-basica',
    label: 'Baliza Básica',
    worldW: 14,
    worldH: 24,
    parkedCars: [
      { x: 10.3, y: 7.0,  angle: 0, label: 'Veículo A' },
      { x: 10.3, y: 19.5, angle: 0, label: 'Veículo B' }
    ],
    vagaX: 9.1,
    vagaY: 10.2,
    vagaLen: 6.8,
    vagaW: 2.5,
    targetPos: { x: 10.3, y: 13.6 },
    startPos: { x: 6.8, y: 2.0, angle: 0 },
    alignPos: { x: 6.8, y: 7.0, angle: 0 }
  };

  /* Checkpoints para o Modo Guiado */
  const GUIDED_STEPS = [
    { id: 'approach', label: '🚗 Avance lentamente até alinhar seu retrovisor direito com o retrovisor do <b>Veículo A</b>.', check: (st) => st.y >= 6.4 && st.distanceTraveled > 0.4 },
    { id: 'stop1',    label: '✋ Excelente! Agora <b>pare o veículo</b> completamente.', check: (st) => st.speed < 0.05 && st.y >= 6.4 },
    { id: 'gear-r',   label: '🔄 Engate a <b>Ré</b> — pressione o botão <b>R</b> ou use os controles de marcha.', check: (st) => st.gear === 'R' },
    { id: 'steer',    label: '🔃 Vire o volante <b>totalmente para a direita</b> e recue devagar usando a traseira (~40°).', check: (st) => st.steerAngle > 18 && st.gear === 'R' && st.speed > 0.05 },
    { id: 'observe',  label: '👁 Observe o retrovisor esquerdo. Ao enxergar o <b>Veículo B</b>, desfaça o volante para a esquerda.', check: (st) => st.y >= 11.5 },
    { id: 'correct',  label: '🎯 Centralize o volante e alinhe a traseira paralelamente ao meio-fio.', check: (st) => Math.abs(st.steerAngle) < 10 && st.y >= 12.8 && st.gear === 'R' },
    { id: 'finish',   label: '🏁 Perfeito! <b>Pare o veículo</b> dentro da vaga para finalizar.', check: (st) => st.speed < 0.05 && st.y >= 12.5 && st.y <= 16.5 && st.x >= 9.0 }
  ];

  /* ══════════════════════════════════════════════
     CENÁRIO 2: DIREÇÃO EM VIAS & DISTÂNCIAS (REGRA DA RODA DIANTEIRA)
     ══════════════════════════════════════════════ */

  const ROAD_STAGES = [
    {
      id: 'escolar',
      name: 'ÁREA ESCOLAR (ZONA 30)',
      speedLimit: 30,
      lanes: 2,
      roadWidth: 8.5,
      laneWidth: 4.25,
      desc: 'Área escolar com travessia de crianças, ônibus escolar, guarda apitando e placa A-13',
      bgType: 'school',
      isUrban: true,
      hasPedestrians: true,
      skyTop: '#0c1828',
      skyBottom: '#182b45',
      tarmac: '#202624',
      sideColor: '#1a241f',
      markingColor: 'rgba(255,255,255,0.85)'
    },
    {
      id: 'coletora',
      name: 'VIA COLETORA / BAIRRO',
      speedLimit: 40,
      lanes: 3,
      roadWidth: 10.5,
      laneWidth: 3.5,
      desc: 'Via urbana residencial com cruzamento em nível, placa PARE (R-1) e idosos na faixa',
      bgType: 'neighborhood',
      isUrban: true,
      hasPedestrians: true,
      skyTop: '#0b1626',
      skyBottom: '#16283d',
      tarmac: '#1e2422',
      sideColor: '#182026',
      markingColor: 'rgba(255,255,255,0.75)'
    },
    {
      id: 'arterial',
      name: 'VIA ARTERIAL (AVENIDA)',
      speedLimit: 60,
      lanes: 4,
      roadWidth: 14.0,
      laneWidth: 3.5,
      desc: 'Avenida principal de fluxo contínuo com semáforos e ambulância SAMU em emergência',
      bgType: 'avenue',
      isUrban: true,
      hasPedestrians: true,
      skyTop: '#0a1420',
      skyBottom: '#142436',
      tarmac: '#1c2220',
      sideColor: '#141e22',
      markingColor: 'rgba(255,255,255,0.8)'
    },
    {
      id: 'ferrovia',
      name: 'PASSAGEM DE NÍVEL FERROVIÁRIA',
      speedLimit: 40,
      lanes: 2,
      roadWidth: 8.5,
      laneWidth: 4.25,
      desc: 'Cruzamento rodoferroviário com parada obrigatória (Art. 212), cancela e trem',
      bgType: 'rail',
      isUrban: true,
      hasPedestrians: false,
      skyTop: '#07101a',
      skyBottom: '#101e2c',
      tarmac: '#181e1c',
      sideColor: '#18241e',
      markingColor: 'rgba(255,255,255,0.8)'
    },
    {
      id: 'rapida',
      name: 'VIA DE TRÂNSITO RÁPIDO',
      speedLimit: 80,
      lanes: 4,
      roadWidth: 14.0,
      laneWidth: 3.5,
      desc: 'Via expressa sem cruzamentos em nível e com acessos especiais',
      bgType: 'rapida',
      isUrban: false,
      hasPedestrians: false,
      skyTop: '#08121d',
      skyBottom: '#122638',
      tarmac: '#181e1c',
      sideColor: '#18201a',
      markingColor: 'rgba(255,255,255,0.85)'
    },
    {
      id: 'rodovia',
      name: 'RODOVIA FEDERAL BR-101',
      speedLimit: 100,
      lanes: 3,
      roadWidth: 11.0,
      laneWidth: 3.6,
      desc: 'Rodovia Federal com acostamento, capivaras, viatura da PRF e sem trânsito de pedestres',
      bgType: 'rodovia',
      isUrban: false,
      hasPedestrians: false,
      skyTop: '#050c14',
      skyBottom: '#0e1c2a',
      tarmac: '#141816',
      sideColor: '#141c16',
      markingColor: 'rgba(255,255,255,0.9)'
    }
  ];

  function getLaneCenterX(stage, laneIndex) {
    if (!stage || !stage.lanes) return 0;
    const safeLane = Math.max(0, Math.min(stage.lanes - 1, laneIndex));
    const lw = stage.roadWidth / stage.lanes;
    return -(stage.roadWidth * 0.5) + (safeLane + 0.5) * lw;
  }

  /* ══════════════════════════════════════════════
     BASE JURÍDICA COMPLETA DO CÓDIGO DE TRÂNSITO BRASILEIRO (CTB)
     ══════════════════════════════════════════════ */

  const CTB_ARTICLES = {
    ART_196: {
      article: 'Art. 196 do CTB',
      title: 'Mudança de Faixa sem Seta',
      desc: 'Deixar de indicar com antecedência, mediante seta ou gesto regulamentar, a intenção de mudança de faixa ou conversão.',
      severity: 'grave',
      pts: 5,
      price: 195.23,
      advice: 'Acione a seta com antecedência para alertar os demais veículos e evitar acidentes!'
    },
    ART_208: {
      article: 'Art. 208 do CTB',
      title: 'Avanço de Sinal Vermelho',
      desc: 'Avançar o sinal vermelho do semáforo no cruzamento regulamentado.',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'Imobilize o veículo completamente antes da faixa de retenção ao avistar o sinal vermelho!'
    },
    ART_208_PARE: {
      article: 'Art. 208 do CTB',
      title: 'Desrespeito à Placa R-1 (Parada Obrigatória)',
      desc: 'Avançar sobre cruzamento sem imobilizar completamente o veículo diante da placa de sinalização R-1 (PARE).',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'A placa PARE exige parada total (0 km/h) das rodas, e não mera redução de velocidade!'
    },
    ART_214_I: {
      article: 'Art. 214, Inciso I do CTB',
      title: 'Deixar de Dar Preferência ao Pedestre',
      desc: 'Deixar de dar preferência de passagem a pedestre e a veículo não motorizado em local com faixa delimitada.',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'O pedestre na faixa tem prioridade de travessia absoluta. Reduza e pare suavemente!'
    },
    ART_214_II: {
      article: 'Art. 214, Inciso II do CTB',
      title: 'Não Dar Preferência a Idoso / Criança / PcD',
      desc: 'Deixar de dar preferência de passagem a pedestre portador de deficiência física, criança, idoso e gestante.',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'Idosos e pessoas com mobilidade reduzida têm prioridade legal absoluta e necessitam de tempo e paciência!'
    },
    ART_220_XIV: {
      article: 'Art. 220, Inciso XIV do CTB',
      title: 'Velocidade Incompatível Próximo a Escolas',
      desc: 'Deixar de reduzir a velocidade do veículo de forma compatível com a segurança nas proximidades de escolas, hospitais ou locais de embarque e desembarque.',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'Zona 30 km/h: redobre a atenção e reduza ao avistar escolas, crianças e ônibus escolares!'
    },
    ART_195: {
      article: 'Art. 195 do CTB',
      title: 'Desobedecer às Ordens do Agente de Trânsito',
      desc: 'Desobedecer às ordens emanadas da autoridade competente de trânsito ou de seus agentes na operação da via.',
      severity: 'grave',
      pts: 5,
      price: 195.23,
      advice: 'As ordens gestuais e sonoras do agente prevalecem sobre os semáforos e placas (Art. 89 do CTB)!'
    },
    ART_189: {
      article: 'Art. 189 do CTB',
      title: 'Não Dar Passagem a Veículo de Emergência',
      desc: 'Deixar de dar passagem aos veículos precedidos de batedores, de socorro de incêndio e salvamento, de polícia, de fiscalização e de ambulância, com luzes e sirene acionadas.',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'Ao ouvir a sirene, desloque-se imediatamente para a faixa da direita abrindo o corredor livre para a ambulância!'
    },
    ART_212: {
      article: 'Art. 212 do CTB',
      title: 'Não Parar Antes da Linha Férrea',
      desc: 'Deixar de parar o veículo antes de transpor linha férrea (Passagem de Nível).',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'A parada é obrigatória e completa antes dos trilhos. Trens não conseguem frear em curta distância!'
    },
    ART_201: {
      article: 'Art. 201 do CTB',
      title: 'Distância Menor que 1,50m ao Passar Ciclista',
      desc: 'Deixar de guardar a distância lateral de um metro e cinquenta centímetros ao passar ou ultrapassar bicicleta.',
      severity: 'media',
      pts: 4,
      price: 130.16,
      advice: 'O ciclista é vulnerável. Guarde no mínimo 1,50 metro de distância lateral ao ultrapassar!'
    },
    ART_218_I: {
      article: 'Art. 218, Inciso I do CTB',
      title: 'Velocidade até 20% Acima do Limite',
      desc: 'Transitar em velocidade superior à máxima permitida para a via em até vinte por cento.',
      severity: 'media',
      pts: 4,
      price: 130.16,
      advice: 'Ajuste a velocidade de acordo com a placa R-19 regulamentada para o trecho!'
    },
    ART_218_II: {
      article: 'Art. 218, Inciso II do CTB',
      title: 'Velocidade de 20% a 50% Acima do Limite',
      desc: 'Transitar em velocidade superior à máxima permitida em mais de vinte por cento até cinquenta por cento.',
      severity: 'grave',
      pts: 5,
      price: 195.23,
      advice: 'Excesso de velocidade grave aumenta drasticamente a distância de parada e o risco de colisões fatais!'
    },
    ART_218_III: {
      article: 'Art. 218, Inciso III do CTB',
      title: 'Velocidade Superior a 50% (Suspensão da CNH)',
      desc: 'Transitar em velocidade superior à máxima em mais de 50%. Infração com suspensão direta do direito de dirigir.',
      severity: 'gravissima',
      pts: 7,
      price: 880.41,
      advice: 'Infração gravíssima direta que acarreta abertura de processo de suspensão da sua CNH!'
    },
    ART_192: {
      article: 'Art. 192 do CTB',
      title: 'Não Guardar Distância de Segurança',
      desc: 'Deixar de guardar distância de segurança lateral e frontal entre o seu e os demais veículos.',
      severity: 'grave',
      pts: 5,
      price: 195.23,
      advice: 'Aplique a regra dos 2 segundos e mantenha espaço lateral e frontal compatível com a velocidade!'
    },
    ART_193: {
      article: 'Art. 193 do CTB',
      title: 'Transitar em Calçadas, Ciclovias ou Acostamento',
      desc: 'Transitar com o veículo em calçadas, passeios, passarelas, ciclovias ou acostamento.',
      severity: 'gravissima',
      pts: 7,
      price: 880.41,
      advice: 'Calçadas pertencem aos pedestres e acostamentos são exclusivos para emergências!'
    },
    ART_220_XI: {
      article: 'Art. 220, Inciso XI do CTB',
      title: 'Não Reduzir Velocidade Próximo a Animais/Pedestres',
      desc: 'Deixar de reduzir a velocidade de forma compatível com a segurança na proximidade de pedestres ou animais na pista.',
      severity: 'grave',
      pts: 5,
      price: 195.23,
      advice: 'Animais e pedestres são imprevisíveis. Reduza a velocidade de imediato ao avistá-los!'
    },
    ART_186_I: {
      article: 'Art. 186, Inciso I do CTB',
      title: 'Transitar pela Contramão de Direção',
      desc: 'Transitar pela contramão de direção em vias com duplo sentido de circulação (pista de mão dupla), exceto para ultrapassar com segurança.',
      severity: 'grave',
      pts: 5,
      price: 195.23,
      advice: 'Em pista de mão dupla, permaneça estritamente na sua mão de direção (faixa da direita)!'
    },
    ART_186_II: {
      article: 'Art. 186, Inciso II do CTB',
      title: 'Contramão com Risco Iminente de Colisão Frontal',
      desc: 'Transitar pela contramão de direção invadindo a faixa de sentido oposto de veículos em circulação.',
      severity: 'gravissima',
      pts: 7,
      price: 293.47,
      advice: 'A contramão de direção gera o risco da colisão frontal mais letal do trânsito. Mantenha-se na sua faixa!'
    }
  };

  /* Estado da CNH e Registro de Autos de Infração (AITs) */
  let cnhState = {
    points: 0,
    totalFines: 0,
    aits: [],
    isSuspended: false,
    cooldowns: {},
    officerTimer: 0
  };

  let currentScenario = 'baliza-basica'; // 'baliza-basica' | 'direcao-vias' | 'cidade-ctb'

  let roadState = {
    stageIndex: 0,
    stageTimer: 25.0,
    roadScrollY: 0,
    playerX: 0,               // offset lateral em metros do centro da faixa
    playerLane: 1,            // faixa central
    speedKmh: 30,
    targetSpeedKmh: 30,
    steerAngle: 0,

    // Veículo à direita no fluxo
    rightCar: {
      lane: 2,
      x: 3.5,
      y: 0.5,
      targetY: 0.5,
      speedKmh: 29.5,
      w: 1.8,
      l: 4.2,
      color: '#e74c3c'
    },

    // Veículo à frente na mesma faixa
    frontCar: {
      lane: 1,
      x: 0,
      y: 19.0,
      speedKmh: 30,
      w: 1.85,
      l: 4.4,
      color: '#3498db'
    },

    // Veículo na faixa rápida da esquerda
    leftCar: {
      lane: 0,
      x: -3.5,
      y: -28.0,
      speedKmh: 55,
      w: 1.8,
      l: 4.3,
      color: '#f39c12'
    },

    // Veículo atrás na mesma faixa
    rearCar: {
      lane: 1,
      x: 0,
      y: -22.0,
      speedKmh: 30,
      w: 2.1,
      l: 5.6,
      color: '#7f8c8d'
    },

    // ── SITUAÇÃO 1: ÁREA ESCOLAR (ZONA 30 - CTB Art. 220-XIV) ──
    schoolBus: {
      active: true,
      x: 3.3,
      y: 38.0,
      w: 2.3,
      l: 6.8,
      hazardBlink: false,
      hazardTimer: 0,
      doorOpen: true,
      isBoarding: true
    },
    trafficWarden: {
      active: true,
      hasWarden: true,        // true = guarda apitando / false = travessia autônoma
      x: 0,
      y: 33.5,
      whistleGiven: false,
      stopSignalActive: true,
      hasViolated: false
    },
    schoolChildren: [
      { id: 'c1', x: 2.8, y: 33.5, dir: -1, speed: 0.9, shirt: '#3b82f6', backpack: '#ef4444', isCrossing: true, anim: 0 },
      { id: 'c2', x: 3.5, y: 33.5, dir: -1, speed: 0.85, shirt: '#ec4899', backpack: '#8b5cf6', isCrossing: true, anim: 0 }
    ],

    // ── SITUAÇÃO 2: IDOSO NA FAIXA / ACESSIBILIDADE (CTB Art. 214-II) ──
    elderlyPedestrian: {
      active: true,
      x: -3.8,
      y: 24.0,
      dir: 1,
      speed: 0.42,
      isCrossing: true,
      anim: 0,
      hasPassed: false,
      hasViolated: false
    },

    // ── SITUAÇÃO 3: CRUZAMENTO COM PLACA R-1 (PARADA OBRIGATÓRIA - PARE) ──
    intersection: {
      active: true,
      y: 32.0,
      hasStoppedCompletely: false,
      hasPassedIntersection: false,
      hasViolated: false,
      crossingCar: {
        active: true,
        x: 18.0,
        y: 32.0,
        speed: 8.5,
        color: '#d97706'
      }
    },

    // ── SITUAÇÃO 4: AMBULÂNCIA SAMU PEDINDO PASSAGEM (CTB Art. 189) ──
    ambulance: {
      active: false,
      x: -1.75,
      y: -42.0,
      speedKmh: 85.0,
      sirenOn: false,
      sirenTimer: 0,
      strobeBlink: false,
      hasYielded: false,
      hasViolated: false
    },

    // ── SITUAÇÃO 5: PASSAGEM DE NÍVEL FERROVIÁRIA (CTB Art. 212) ──
    railCrossing: {
      active: true,
      y: 44.0,
      barrierDown: false,
      barrierAngle: 0,
      lightsFlashing: false,
      lightPhase: false,
      bellTimer: 0,
      trainPassing: false,
      trainX: -85.0,
      trainSpeed: 14.0,
      hasStopped: false,
      hasViolated: false
    },

    // Semáforo inteligente do cruzamento urbano
    trafficLight: {
      y: 38.0,
      state: 'green',
      timer: 14.0,
      hasViolated: false
    },

    // Faixa de pedestres
    crosswalk: {
      y: 33.5,
      hasPedestrianCrossing: true
    },

    // Pedestres nas calçadas da cidade (Pixel Art Chibi)
    pedestrians: [
      { id: 1, x: -4.8, y: 16.0, speed: 1.3, dir: 1, shirt: '#ffaa33', pants: '#1e293b', isCrossing: false, animFrame: 0 },
      { id: 2, x: 4.8,  y: 24.0, speed: 1.1, dir: -1, shirt: '#00f2fe', pants: '#0f172a', isCrossing: false, animFrame: 0 },
      { id: 3, x: -1.6, y: 33.5, speed: 0.95, dir: 1, shirt: '#e74c3c', pants: '#334155', isCrossing: true, animFrame: 0 }
    ],

    // Ciclista na lateral / ciclofaixa (Art. 201 CTB - 1,50m de distância)
    cyclist: {
      x: 4.2,
      y: 14.0,
      speedKmh: 18.0,
      color: '#f1c40f',
      wheelRot: 0,
      pedalFrame: 0,
      passedSafely: false
    },

    // Motociclista ágil no corredor
    motorcycle: {
      x: -1.75,
      y: -24.0,
      speedKmh: 58.0,
      color: '#9b59b6'
    },

    // Animal na via (Cachorro caramelo na cidade / Capivara no acostamento da rodovia - Art. 220, XI)
    animal: {
      x: 4.6,
      y: 28.0,
      type: 'dog',            // 'dog' | 'capivara'
      dir: -1,
      speed: 0.5,
      tailWag: 0,
      alertTriggered: false
    },

    // Viatura Policial (PRF / Agente de Trânsito na Rodovia - CTB Art. 189)
    policeCruiser: {
      active: true,
      x: 5.6,
      y: 52.0,
      w: 1.85,
      l: 4.8,
      speedKmh: 0,
      isPursuing: false,
      sirenActive: false,
      flashBlue: true,
      spawnTimer: 18.0
    },

    // Motocicleta (CTB Art. 29 e Art. 40 - Farol aceso de dia/noite e faixa regulamentar)
    motorcycle: {
      active: true,
      lane: 0,
      x: -2.1,
      y: 28.0,
      w: 0.85,
      l: 2.2,
      speedKmh: 35.0,
      color: '#e11d48',
      headlightOn: true,
      braking: false
    },

    // Partículas atmosféricas Dark Pixel (névoa, poeira suspensa e reflexos molhados)
    particles: Array.from({ length: 28 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.2 + Math.random() * 0.5,
      size: 1.2 + Math.random() * 1.8,
      alpha: 0.2 + Math.random() * 0.4
    })),

    // Métricas Pedagógicas
    blindSpotActive: false,
    frontCollisionRisk: false,
    lateralDistance: 3.5,
    frontDistance: 19.0,
    safeTrailingDistance: 16.0,
    statusLevel: 'green',     // 'green' | 'yellow' | 'red'
    statusText: '🟢 SINAL VERDE — Distância Segura e Faixa Desimpedida',
    soundCooldown: 0,
    notificationText: null,
    notificationTimer: 0,

    // Colisões e Física Sólida (CTB Art. 192)
    collisionFlashTimer: 0,
    collidingCarId: null,
    collisionFaultWho: null,    // 'player' | 'other'
    collisionFaultText: '',
    collisionCooldown: 0,

    // Caminhão Pesado / Carreta (BR-101 / Rodovias e Vias Arteriais)
    truck: {
      x: 2.1,
      y: 38.0,
      w: 2.6,
      l: 14.2,
      speedKmh: 75.0,
      color: '#0284c7',          // Cavalo mecânico azul royal
      trailerColor: '#e2e8f0',   // Carreta baú alumínio
      active: true
    },

    // Acidente Fatal Ferroviário (Trem de Carga - Art. 212)
    trainFatalCrash: false,
    trainCrashCountdown: 0,

    // Regime Dinâmico de Pista de Mão Dupla & Contramão (CTB Art. 186)
    isTwoWay: false,
    twoWayTimer: 0,
    twoWayAnnounced: false,
    oncomingCar: {
      x: -2.1,                // Faixa da esquerda (fluxo oposto / contramão)
      y: 50.0,
      w: 1.85,
      l: 4.3,
      speedKmh: 55.0,
      color: '#b91c1c',       // Carro vermelho em sentido oposto
      flashLights: false,
      active: true
    },

    // Controle de Setas (CTB Art. 196) e Dinâmica
    turnSignal: null,         // null | 'left' | 'right'
    turnSignalBlink: false,
    turnSignalTimer: 0,
    lastLaneIndex: 1,
    infractionText: null,
    infractionTimer: 0,
    successText: null,
    successTimer: 0,
    frontBraking: false,
    suspensionPitch: 0
  };

  /* ══════════════════════════════════════════════
     SÍNTESE DE ÁUDIO WEB AUDIO API (APITO POLICIAL & RÁDIO)
     ══════════════════════════════════════════════ */
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx && (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined')) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playPoliceWhistle() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Apito duplo com trinado característico do agente de trânsito
      for (let burst = 0; burst < 2; burst++) {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();

        const bStart = now + burst * 0.15;
        const bDur = 0.11;

        lfo.frequency.setValueAtTime(32, bStart); // trinado da esfera do apito
        lfoGain.gain.setValueAtTime(160, bStart);
        lfo.connect(osc.frequency);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2550, bStart);

        gain.gain.setValueAtTime(0.001, bStart);
        gain.gain.linearRampToValueAtTime(0.15, bStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, bStart + bDur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        lfo.start(bStart);
        osc.start(bStart);
        lfo.stop(bStart + bDur);
        osc.stop(bStart + bDur);
      }
    } catch (_) {}
  }

  function playOfficerStopWhistle() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      lfo.frequency.setValueAtTime(36, now);
      lfoGain.gain.setValueAtTime(180, now);
      lfo.connect(osc.frequency);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2680, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain.gain.setValueAtTime(0.18, now + 0.52);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      lfo.start(now);
      osc.start(now);
      lfo.stop(now + 0.65);
      osc.stop(now + 0.65);
    } catch (_) {}
  }

  function playAmbulanceSiren() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.linearRampToValueAtTime(1050, now + 0.22);
      osc.frequency.linearRampToValueAtTime(650, now + 0.44);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch (_) {}
  }

  function playTrainCrossingBell() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      for (let b = 0; b < 2; b++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1180, now + b * 0.18);
        gain.gain.setValueAtTime(0.08, now + b * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + b * 0.18 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + b * 0.18);
        osc.stop(now + b * 0.18 + 0.15);
      }
    } catch (_) {}
  }

  /* ══════════════════════════════════════════════
     GERENCIADOR DE ÁUDIO REAL MP3 POR PROXIMIDADE (Ambulância, Trem e Polícia)
     ══════════════════════════════════════════════ */
  const realAudio = {
    ambulance: null,
    police: null,
    train: null
  };

  function getRealAudio(key, src) {
    if (!realAudio[key]) {
      try {
        const a = new Audio(src);
        a.loop = true;
        a.preload = 'auto';
        realAudio[key] = a;
      } catch (_) {}
    }
    return realAudio[key];
  }

  function updateProximityAudio(key, src, dist, maxDist, synthFallbackFn) {
    const a = getRealAudio(key, src);
    if (dist >= 0 && dist < maxDist) {
      const norm = Math.max(0, Math.min(1.0, 1.0 - (dist / maxDist)));
      const vol = Math.max(0.12, Math.min(1.0, 0.12 + 0.88 * Math.pow(norm, 1.4)));
      if (a) {
        a.volume = vol;
        if (a.paused) {
          const p = a.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              if (synthFallbackFn) synthFallbackFn();
            });
          }
        }
      } else if (synthFallbackFn) {
        synthFallbackFn();
      }
    } else {
      if (a && !a.paused) {
        a.pause();
        a.currentTime = 0;
      }
    }
  }

  function stopAllProximityAudio() {
    ['ambulance', 'police', 'train'].forEach(k => {
      const a = realAudio[k];
      if (a && !a.paused) {
        a.pause();
        a.currentTime = 0;
      }
    });
  }

  function playPoliceSirenFallback() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.linearRampToValueAtTime(1150, now + 0.35);
      osc.frequency.linearRampToValueAtTime(650, now + 0.7);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    } catch (_) {}
  }

  function unlockRealAudio() {
    ['ambulance', 'police', 'train'].forEach(k => {
      const a = getRealAudio(k, 'sons/' + k + '.mp3');
      if (a) {
        try { a.load(); } catch (_) {}
      }
    });
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }
  window.addEventListener('pointerdown', unlockRealAudio, { once: true });
  window.addEventListener('keydown', unlockRealAudio, { once: true });
  window.addEventListener('touchstart', unlockRealAudio, { once: true });

  function playRadioChirp() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }

  function playCrashSound() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Ruído de impacto e estilhaçamento metálico
      const bufferSize = Math.floor(ctx.sampleRate * 0.38);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.35);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // 2. Pancada grave no chassi
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.32);

      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch (_) {}
  }

  function playAlertBeep(isWarning) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isWarning) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (_) {}
  }

  function playRelayClick(isToc) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isToc ? 640 : 880, now);
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.start(now);
      osc.stop(now + 0.035);
    } catch (_) {}
  }

  function toggleTurnSignal(dir) {
    if (roadState.turnSignal === dir) {
      roadState.turnSignal = null;
      roadState.turnSignalBlink = false;
    } else {
      roadState.turnSignal = dir;
      roadState.turnSignalBlink = true;
      roadState.turnSignalTimer = 0;
      playRelayClick(false);
    }
    const stage = ROAD_STAGES[roadState.stageIndex];
    if (stage) updateRoadHudDom(stage);
  }

  /* ══════════════════════════════════════════════
     ESTADO GLOBAL DO SIMULADOR
     ══════════════════════════════════════════════ */

  let state = null;
  let animId = null;
  let lastTime = 0;
  let collisionCooldown = 0;
  let inputState = { steerLeft: false, steerRight: false, accel: false, brake: false };
  let isBoundEvents = false;

  function freshState(mode = 'trajectory') {
    return {
      mode: mode,
      phase: 'running',
      stepIndex: 0,
      stepActivated: false,

      x: SCENARIO.startPos.x,
      y: SCENARIO.startPos.y,
      angle: SCENARIO.startPos.angle,
      speed: 0,
      steerAngle: 0,
      gear: 'D',

      collisions: 0,
      corrections: 0,
      distanceTraveled: 0,
      startTime: Date.now(),
      endTime: null,
      trajectory: [],

      /* MODO TRAJETÓRIA (COM CONTROLE CINEMÁTICO PURO SEM OSCILAÇÃO) */
      trajectoryState: {
        stage: 'align', // 'align', 'draw', 'ready', 'executing', 'finished'
        isDraggingCar: false,
        dragOffset: { x: 0, y: 0 },
        isDrawingPath: false,
        drawnPoints: [],      // pontos da trajetória da traseira do carro
        pathWaypoints: [],    // caminho suavizado e reamostrado
        totalPathLength: 0,
        progressDist: 0,      // distância percorrida ao longo da trajetória
        currentSpeed: 0,      // velocidade suave calculada
        retrovisoresAligned: false,
        alignedX: null,       // posição exata escolhida pelo aluno
        alignedY: null,
        alignScore: 0,
        maxAngleAchieved: 0,
        curveScore: 0,
        safetyScore: 100,
        parkScore: 0
      },

      demoPath: null,
      demoT: 0,

      score: null,
      breakdown: null
    };
  }

  /* ══════════════════════════════════════════════
     FÍSICA — KINEMATIC BICYCLE MODEL (Para modo manual/guiado)
     ══════════════════════════════════════════════ */

  function updatePhysics(st, dt) {
    const MAX_SPEED = 2.0;
    const ACCEL = 1.4;
    const BRAKE_DEC = 4.0;
    const NATURAL_DEC = 1.0;
    const STEER_RATE = 55;
    const CENTER_RATE = 40;

    /* esterçamento manual */
    if (inputState.steerLeft)  st.steerAngle = Math.max(-VEHICLE.maxSteerAngle, st.steerAngle - STEER_RATE * dt);
    if (inputState.steerRight) st.steerAngle = Math.min(VEHICLE.maxSteerAngle,  st.steerAngle + STEER_RATE * dt);
    if (!inputState.steerLeft && !inputState.steerRight) {
      const d = CENTER_RATE * dt;
      if (Math.abs(st.steerAngle) < d) st.steerAngle = 0;
      else st.steerAngle -= Math.sign(st.steerAngle) * d;
    }

    /* aceleração / frenagem */
    if (inputState.accel && st.gear !== 'N') {
      st.speed = Math.min(MAX_SPEED, st.speed + ACCEL * dt);
    } else if (inputState.brake) {
      st.speed = Math.max(0, st.speed - BRAKE_DEC * dt);
    } else {
      st.speed = Math.max(0, st.speed - NATURAL_DEC * dt);
    }

    if (st.speed < 0.01) st.speed = 0;

    /* deslocamento cinemático */
    if (st.speed > 0) {
      const dir = st.gear === 'R' ? -1 : (st.gear === 'N' ? 0 : 1);
      const v = st.speed * dir;
      const steerRad = st.steerAngle * DEG;

      const angularVel = (v / VEHICLE.wheelbase) * Math.sin(steerRad);
      st.angle += angularVel * RAD * dt;

      const heading = st.angle * DEG;
      st.x += Math.sin(heading) * v * dt;
      st.y -= Math.cos(heading) * v * dt;

      st.distanceTraveled += Math.abs(v) * dt;

      if (!st.trajectory.length || Math.hypot(st.x - st.trajectory[st.trajectory.length - 1].x, st.y - st.trajectory[st.trajectory.length - 1].y) > 0.25) {
        st.trajectory.push({ x: st.x, y: st.y });
      }
    }

    return st;
  }

  /* ══════════════════════════════════════════════
     COLISÕES — DETECÇÃO DE CAIXA ORIENTADA
     ══════════════════════════════════════════════ */

  function checkCollisions(st) {
    if (st.x - VEHICLE.width / 2 < 1.5 || st.x + VEHICLE.width / 2 > 12.0) return true;
    if (st.y - VEHICLE.length / 2 < 0.2 || st.y + VEHICLE.length / 2 > SCENARIO.worldH - 0.2) return true;

    for (const car of SCENARIO.parkedCars) {
      const dx = Math.abs(st.x - car.x);
      const dy = Math.abs(st.y - car.y);
      if (dx < (VEHICLE.width + VEHICLE.width) * 0.44 &&
          dy < (VEHICLE.length + VEHICLE.length) * 0.44) {
        return true;
      }
    }
    return false;
  }

  /* ══════════════════════════════════════════════
     CÁLCULO DE PONTUAÇÃO & AVALIAÇÃO PEDAGÓGICA
     ══════════════════════════════════════════════ */

  function calcTrajectoryScore(st) {
    const ts = st.trajectoryState;
    const alignScore = ts.alignScore || 95;

    const targetX = SCENARIO.targetPos.x;
    const targetY = SCENARIO.targetPos.y;
    const distFinal = Math.hypot(st.x - targetX, st.y - targetY);
    const finalPosScore = Math.max(0, 100 - distFinal * 22);

    const alignFinalAngle = Math.abs(((st.angle % 360) + 360) % 360);
    const minAngle = Math.min(alignFinalAngle, 360 - alignFinalAngle);
    const angleScore = Math.max(0, 100 - minAngle * 3.5);

    const safetyScore = Math.max(0, 100 - st.collisions * 40);

    const maxAngle = ts.maxAngleAchieved || 35;
    const curveScore = (maxAngle >= 25 && maxAngle <= 50) ? 100 : Math.max(50, 100 - Math.abs(maxAngle - 38) * 3);

    const total = Math.round(
      (alignScore * 0.25 + curveScore * 0.20 + safetyScore * 0.25 + finalPosScore * 0.20 + angleScore * 0.10) * 10
    );

    return {
      total: Math.max(0, Math.min(1000, total)),
      breakdown: {
        'Alinhamento retrovisores': Math.round(alignScore),
        'Traçado & Ângulo de ré': Math.round(curveScore),
        'Segurança (sem colisões)': Math.round(safetyScore),
        'Centralização na vaga': Math.round(finalPosScore),
        'Paralelismo ao meio-fio': Math.round(angleScore)
      },
      feedback: generateFeedback(alignScore, curveScore, safetyScore, finalPosScore, angleScore)
    };
  }

  function calcStandardScore(st) {
    const dx = st.x - SCENARIO.targetPos.x, dy = st.y - SCENARIO.targetPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const alignAngle = Math.abs(((st.angle % 360) + 360) % 360);

    const precision  = Math.max(0, 100 - dist * 18);
    const alignment  = Math.max(0, 100 - Math.min(alignAngle, 360 - alignAngle) * 1.8);
    const safety     = Math.max(0, 100 - st.collisions * 35);
    const control    = Math.max(0, 100 - st.corrections * 4);
    const distance   = Math.max(0, 100 - Math.max(0, st.distanceTraveled - 40) * 1.5);

    const total = Math.round(
      (precision * 0.30 + alignment * 0.20 + safety * 0.25 + control * 0.15 + distance * 0.10) * 10
    );

    return {
      total: Math.max(0, Math.min(1000, total)),
      breakdown: {
        'Precisão de posição': Math.round(precision),
        'Alinhamento': Math.round(alignment),
        'Segurança (colisões)': Math.round(safety),
        'Controle (correções)': Math.round(control),
        'Distância percorrida': Math.round(distance)
      },
      feedback: 'Prática concluída com sucesso!'
    };
  }

  function generateFeedback(align, curve, safety, pos, angle) {
    if (safety < 60) return '⚠️ Houve colisão durante a manobra! Aumente o raio da curva de ré para manter distância segura.';
    if (align < 75) return '💡 O alinhamento dos retrovisores não foi perfeito no início. Lembre-se de emparelhar lado a lado antes de engatar a ré.';
    if (curve < 75) return '💡 O ângulo de entrada da ré foi inadequado. O ideal é que a traseira entre a cerca de 35° a 45° antes de alinhar.';
    if (pos < 75 || angle < 75) return '💡 O veículo não finalizou centralizado ou paralelo ao meio-fio. Ajuste a curva final para alinhar reto dentro da vaga.';
    return '🏆 Movimento suave e perfeito! O veículo seguiu a trajetória com a traseira em movimento único e sem oscilações.';
  }

  /* ══════════════════════════════════════════════
     DEMO PATH
     ══════════════════════════════════════════════ */

  function buildDemoPath() {
    return [
      { x: 6.8, y:  2.0, angle:   0, gear: 'D', speed: 1.5 },
      { x: 6.8, y:  5.2, angle:   0, gear: 'D', speed: 1.0 },
      { x: 6.8, y:  7.0, angle:   0, gear: 'D', speed: 0.0 }, // Alinhamento
      { x: 6.8, y:  7.0, angle:   0, gear: 'R', speed: 0.0 }, // Engata Ré
      { x: 7.1, y:  8.6, angle: -14, gear: 'R', speed: 0.6 },
      { x: 7.9, y: 10.3, angle: -34, gear: 'R', speed: 0.8 },
      { x: 8.9, y: 11.9, angle: -36, gear: 'R', speed: 0.8 },
      { x: 9.7, y: 12.9, angle: -20, gear: 'R', speed: 0.6 },
      { x: 10.2, y: 13.5, angle:  -6, gear: 'R', speed: 0.4 },
      { x: 10.3, y: 13.8, angle:   0, gear: 'R', speed: 0.0 }  // Finaliza paralelo
    ];
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return a + d * t;
  }

  /* ══════════════════════════════════════════════
     SUAVIZAÇÃO DA TRAJETÓRIA COM CHAIKIN (Zero Jitter)
     ══════════════════════════════════════════════ */

  function smoothPointsChaikin(points, iterations = 2) {
    if (!points || points.length < 3) return points;
    let current = points;
    for (let it = 0; it < iterations; it++) {
      const next = [];
      next.push(current[0]);
      for (let i = 0; i < current.length - 1; i++) {
        const p0 = current[i];
        const p1 = current[i + 1];
        next.push({
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y
        });
        next.push({
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y
        });
      }
      next.push(current[current.length - 1]);
      current = next;
    }
    return current;
  }

  function processDrawnPath(rawPoints) {
    if (!rawPoints || rawPoints.length < 3) return { waypoints: [], totalLength: 0 };

    /* 1. Suavizar ruído com 4 iterações de Chaikin para eliminar completamente qualquer vibração */
    const smoothed = smoothPointsChaikin(rawPoints, 4);

    /* 2. Reamostrar com espaçamento uniforme fino (STEP = 0.04m) */
    const resampled = [];
    resampled.push({ x: smoothed[0].x, y: smoothed[0].y, dist: 0 });

    let current = smoothed[0];
    let totalDist = 0;
    const STEP = 0.04;

    for (let i = 1; i < smoothed.length; i++) {
      const next = smoothed[i];
      const d = Math.hypot(next.x - current.x, next.y - current.y);
      if (d >= STEP) {
        const steps = Math.floor(d / STEP);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const px = lerp(current.x, next.x, t);
          const py = lerp(current.y, next.y, t);
          totalDist += Math.hypot(px - resampled[resampled.length - 1].x, py - resampled[resampled.length - 1].y);
          resampled.push({ x: px, y: py, dist: totalDist });
        }
        current = next;
      }
    }

    const lastPt = smoothed[smoothed.length - 1];
    totalDist += Math.hypot(lastPt.x - resampled[resampled.length - 1].x, lastPt.y - resampled[resampled.length - 1].y);
    resampled.push({ x: lastPt.x, y: lastPt.y, dist: totalDist });

    /* 3. Pré-calcular orientação suave da tangente ao longo da curva (C¹ contínua) */
    const N = resampled.length;
    const K = Math.max(3, Math.min(10, Math.floor(N * 0.07)));
    for (let i = 0; i < N; i++) {
      const prev = resampled[Math.max(0, i - K)];
      const next = resampled[Math.min(N - 1, i + K)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      /* No canvas: +y é para baixo. 0° aponta para cima (-y).
         Como o carro desce de ré, a tangente da traseira define o ângulo do veículo */
      resampled[i].heading = -Math.atan2(dx, dy) * RAD;
    }

    /* O primeiro waypoint inicia exatamente alinhado com o ângulo do carro */
    if (N > 0) resampled[0].heading = (state ? state.angle : 0);

    /* 4. Calcular ângulo do volante pelo modelo cinemático de bicicleta (Volante segue 100% o movimento) */
    for (let i = 0; i < N; i++) {
      const prev = resampled[Math.max(0, i - 1)];
      const next = resampled[Math.min(N - 1, i + 1)];
      const ds = Math.max(0.01, next.dist - prev.dist);
      let dAngle = next.heading - prev.heading;
      while (dAngle > 180)  dAngle -= 360;
      while (dAngle < -180) dAngle += 360;
      const curvature = (dAngle * DEG) / ds; // rad/m
      /* Na marcha ré, esterçar para a direita faz a traseira ir para a direita (ângulo heading fica negativo) */
      const targetSteerRad = Math.atan(-VEHICLE.wheelbase * curvature);
      resampled[i].steer = Math.max(-VEHICLE.maxSteerAngle, Math.min(VEHICLE.maxSteerAngle, targetSteerRad * RAD));
    }

    return {
      waypoints: resampled,
      totalLength: totalDist
    };
  }

  /* ══════════════════════════════════════════════
     TOP VIEW — RENDERIZAÇÃO 2D PREMIUM
     ══════════════════════════════════════════════ */

  function drawTopView(canvas, st) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (W < 10 || H < 10) return;

    const scale = Math.min(W / SCENARIO.worldW, H / SCENARIO.worldH);
    const offX = (W - SCENARIO.worldW * scale) / 2;
    const offY = (H - SCENARIO.worldH * scale) / 2;

    const wx = x => offX + x * scale;
    const wy = y => offY + y * scale;
    const wl = v => v * scale;

    ctx.clearRect(0, 0, W, H);

    /* Fundo / Calçadas */
    ctx.fillStyle = '#141e19';
    ctx.fillRect(0, 0, W, H);

    /* Pista de asfalto */
    ctx.fillStyle = '#1b2a24';
    ctx.fillRect(wx(1.5), 0, wl(10.5), H);

    /* Calçada esquerda */
    ctx.fillStyle = '#22332c';
    ctx.fillRect(0, 0, wx(1.5), H);

    /* Calçada direita com meio-fio */
    ctx.fillStyle = '#22332c';
    ctx.fillRect(wx(12.0), 0, W - wx(12.0), H);

    /* Linha do meio-fio direito */
    ctx.strokeStyle = '#3e584c';
    ctx.lineWidth = wl(0.08);
    ctx.beginPath(); ctx.moveTo(wx(12.0), 0); ctx.lineTo(wx(12.0), H); ctx.stroke();

    /* Grade sutil do asfalto */
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let xi = 2; xi < SCENARIO.worldW - 1; xi += 1) {
      ctx.beginPath(); ctx.moveTo(wx(xi), 0); ctx.lineTo(wx(xi), H); ctx.stroke();
    }
    for (let yi = 1; yi < SCENARIO.worldH; yi += 1) {
      ctx.beginPath(); ctx.moveTo(0, wy(yi)); ctx.lineTo(W, wy(yi)); ctx.stroke();
    }

    /* Linha divisória amarela central (sentidos opostos) */
    ctx.strokeStyle = 'rgba(240,192,64,0.6)';
    ctx.lineWidth = wl(0.06);
    ctx.setLineDash([wl(0.65), wl(0.45)]);
    ctx.beginPath();
    ctx.moveTo(wx(5.0), 0); ctx.lineTo(wx(5.0), H);
    ctx.stroke();

    /* Linha branca de bordo da faixa de rolamento / estacionamento */
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = wl(0.04);
    ctx.setLineDash([wl(0.5), wl(0.8)]);
    ctx.beginPath();
    ctx.moveTo(wx(9.0), 0); ctx.lineTo(wx(9.0), H);
    ctx.stroke();
    ctx.setLineDash([]);

    /* VAGA-ALVO (Baliza) com glow */
    const vagaX = SCENARIO.vagaX;
    const vagaY = SCENARIO.vagaY;
    const vagaW = SCENARIO.vagaW;
    const vagaLen = SCENARIO.vagaLen;

    /* preenchimento suave da vaga */
    ctx.fillStyle = 'rgba(77,232,154,0.06)';
    ctx.fillRect(wx(vagaX), wy(vagaY), wl(vagaW), wl(vagaLen));

    /* contorno pulsante da vaga */
    ctx.shadowColor = '#4de89a';
    ctx.shadowBlur = wl(0.35);
    ctx.strokeStyle = '#4de89a';
    ctx.lineWidth = wl(0.08);
    ctx.setLineDash([wl(0.3), wl(0.2)]);
    ctx.strokeRect(wx(vagaX), wy(vagaY), wl(vagaW), wl(vagaLen));
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    /* texto dentro da vaga */
    ctx.fillStyle = 'rgba(77,232,154,0.6)';
    ctx.font = `bold ${Math.max(9, wl(0.32))}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VAGA (BALIZA)', wx(SCENARIO.targetPos.x), wy(SCENARIO.targetPos.y));

    /* Carros estacionados (Veículo A e B) */
    for (const car of SCENARIO.parkedCars) {
      drawCarTop(ctx, wx(car.x), wy(car.y), wl(VEHICLE.width), wl(VEHICLE.length), car.angle * DEG, '#2f4336', '#4a6b56', 'P');
      ctx.fillStyle = 'rgba(180,220,190,0.85)';
      ctx.font = `bold ${Math.max(9, wl(0.34))}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(car.label, wx(car.x), wy(car.y - VEHICLE.length / 2 - 0.4));
    }

    /* ── MODO TRAJETÓRIA: ELEMENTOS INTERATIVOS ── */
    if (st.mode === 'trajectory') {
      const ts = st.trajectoryState;

      /* FASE 1: Linha Laser Guia de Alinhamento dos Retrovisores */
      if (ts.stage === 'align') {
        const carA = SCENARIO.parkedCars[0];
        const mirrorPlayerY = st.y - 0.7;
        const mirrorCarAY = carA.y - 0.7;

        const m1x = wx(st.x + VEHICLE.width / 2);
        const m1y = wy(mirrorPlayerY);
        const m2x = wx(carA.x - VEHICLE.width / 2);
        const m2y = wy(mirrorCarAY);

        const isAligned = ts.retrovisoresAligned;

        ctx.save();
        ctx.strokeStyle = isAligned ? '#4de89a' : 'rgba(255,210,60,0.75)';
        ctx.lineWidth = isAligned ? wl(0.08) : wl(0.05);
        ctx.setLineDash([wl(0.2), wl(0.15)]);
        ctx.shadowColor = isAligned ? '#4de89a' : '#ffd23c';
        ctx.shadowBlur = isAligned ? 10 : 4;

        ctx.beginPath();
        ctx.moveTo(m1x, m1y);
        ctx.lineTo(m2x, m2y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        ctx.fillStyle = isAligned ? '#4de89a' : '#ffd23c';
        ctx.beginPath(); ctx.arc(m1x, m1y, wl(0.15), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(m2x, m2y, wl(0.15), 0, Math.PI * 2); ctx.fill();

        const midX = (m1x + m2x) / 2;
        const midY = (m1y + m2y) / 2;
        ctx.fillStyle = isAligned ? 'rgba(23,107,75,0.92)' : 'rgba(30,45,35,0.9)';
        ctx.strokeStyle = isAligned ? '#4de89a' : 'rgba(255,210,60,0.6)';
        ctx.lineWidth = 1;
        roundRect(ctx, midX - 75, midY - 14, 150, 24, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = isAligned ? '#ffffff' : '#ffd23c';
        ctx.font = 'bold 10px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        const deltaM = (st.y - carA.y).toFixed(1);
        ctx.fillText(isAligned ? '✓ Retrovisores Alinhados!' : `Alinhamento: Δ ${deltaM > 0 ? '+' : ''}${deltaM}m`, midX, midY + 2);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(77,232,154,0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(wx(st.x), wy(st.y), wl(1.5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      /* FASE 2 & 3: Trajeto da Traseira Desenhado pelo Usuário */
      if (ts.drawnPoints && ts.drawnPoints.length > 1) {
        ctx.save();
        ctx.shadowColor = '#5ac8fa';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#5ac8fa';
        ctx.lineWidth = wl(0.12);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ts.drawnPoints.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(wx(p.x), wy(p.y));
          else ctx.lineTo(wx(p.x), wy(p.y));
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        const lastP = ts.drawnPoints[ts.drawnPoints.length - 1];
        ctx.fillStyle = '#4de89a';
        ctx.beginPath();
        ctx.arc(wx(lastP.x), wy(lastP.y), wl(0.2), 0, Math.PI * 2);
        ctx.fill();

        if (ts.drawnPoints.length >= 6) {
          const midIdx = Math.floor(ts.drawnPoints.length / 2);
          const p1 = ts.drawnPoints[midIdx];
          const p2 = ts.drawnPoints[midIdx + 1];
          const arrowAngle = Math.atan2(wy(p2.y) - wy(p1.y), wx(p2.x) - wx(p1.x));
          ctx.save();
          ctx.translate(wx(p1.x), wy(p1.y));
          ctx.rotate(arrowAngle);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      /* Indicador de início na TRASEIRA do veículo */
      if (ts.stage === 'draw' && (!ts.drawnPoints || ts.drawnPoints.length === 0)) {
        const rx = wx(st.x);
        const ry = wy(st.y + VEHICLE.length / 2);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#5ac8fa';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(rx, ry, wl(0.22), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#5ac8fa';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(rx, ry, wl(0.9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#5ac8fa';
        ctx.beginPath();
        ctx.moveTo(rx, ry + wl(0.35));
        ctx.lineTo(rx - 7, ry + wl(0.7));
        ctx.lineTo(rx + 7, ry + wl(0.7));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👇 Puxe a ré a partir da traseira', rx, ry + wl(1.2));
        ctx.restore();
      }
    }

    /* Rastro percorrido pelo carro */
    if (st.trajectory.length > 2) {
      ctx.strokeStyle = 'rgba(77,232,154,0.45)';
      ctx.lineWidth = wl(0.08);
      ctx.beginPath();
      st.trajectory.forEach((p, i) => {
        if (i === 0) ctx.moveTo(wx(p.x), wy(p.y));
        else ctx.lineTo(wx(p.x), wy(p.y));
      });
      ctx.stroke();
    }

    /* Carro do Player */
    const hitNow = collisionCooldown > 0;
    drawCarTop(ctx, wx(st.x), wy(st.y), wl(VEHICLE.width), wl(VEHICLE.length), st.angle * DEG,
      hitNow ? '#8a1818' : '#1e6292',
      hitNow ? '#d94040' : '#45aaf2',
      st.gear,
      st.steerAngle);

    drawArrow(ctx, wx(st.x), wy(st.y), st.angle * DEG, wl(1.0));
    drawDistanceOverlay(ctx, st, wx, wy, wl);
    drawLegend(ctx, W, H, st.mode);
  }

  function drawCarTop(ctx, cx, cy, w, h, angle, bodyColor, accentColor, gear = 'D', steerAngle = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.18);
    ctx.fill();
    ctx.shadowBlur = 0;

    /* Teto */
    ctx.fillStyle = accentColor;
    ctx.fillRect(-w / 2 * 0.6, -h * 0.18, w * 0.6, h * 0.38);

    /* Para-brisa dianteiro (Nose) */
    ctx.fillStyle = 'rgba(160,220,255,0.45)';
    ctx.fillRect(-w / 2 * 0.52, -h * 0.44, w * 0.52, h * 0.17);

    /* Vidro traseiro */
    ctx.fillRect(-w / 2 * 0.52, h * 0.26, w * 0.52, h * 0.14);

    /* Retrovisores */
    ctx.fillStyle = accentColor;
    const mirW = w * 0.16, mirH = h * 0.08;
    ctx.fillRect(-w / 2 - mirW * 0.8, -h * 0.24, mirW, mirH);
    ctx.fillRect( w / 2 - mirW * 0.2, -h * 0.24, mirW, mirH);

    /* Faróis dianteiros */
    ctx.fillStyle = '#ffffa0';
    const frl = h * 0.06, frw = w * 0.22;
    ctx.fillRect(-w * 0.45, -h / 2 + h * 0.03, frw, frl);
    ctx.fillRect( w * 0.23, -h / 2 + h * 0.03, frw, frl);

    /* Lanternas traseiras vermelhas */
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(-w * 0.45, h / 2 - h * 0.09, frw, frl);
    ctx.fillRect( w * 0.23, h / 2 - h * 0.09, frw, frl);

    /* LUZES DE RÉ (brancas brilhantes quando a ré estiver engatada) */
    if (gear === 'R') {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = 8;
      ctx.fillRect(-w * 0.20, h / 2 - h * 0.08, w * 0.15, frl * 0.9);
      ctx.fillRect( w * 0.05, h / 2 - h * 0.08, w * 0.15, frl * 0.9);
      ctx.shadowBlur = 0;
    }

    /* Rodas Traseiras (Fixas alinhadas) */
    ctx.fillStyle = '#0d0d0d';
    const ww = w * 0.24, wh = h * 0.13;
    ctx.fillRect(-w * 0.50,  h * 0.17, ww, wh);
    ctx.fillRect( w * 0.26,  h * 0.17, ww, wh);

    /* Rodas Dianteiras (Esterçam acompanhando 100% o volante) */
    const steerRad = steerAngle * DEG;

    /* Roda dianteira esquerda */
    ctx.save();
    ctx.translate(-w * 0.38, -h * 0.24);
    ctx.rotate(steerRad);
    ctx.fillRect(-ww / 2, -wh / 2, ww, wh);
    ctx.restore();

    /* Roda dianteira direita */
    ctx.save();
    ctx.translate(w * 0.38, -h * 0.24);
    ctx.rotate(steerRad);
    ctx.fillRect(-ww / 2, -wh / 2, ww, wh);
    ctx.restore();

    ctx.restore();
  }

  function drawArrow(ctx, cx, cy, angle, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.32);
    ctx.lineTo(0, -size * 0.55);
    ctx.moveTo(-size * 0.22, -size * 0.3);
    ctx.lineTo(0, -size * 0.55);
    ctx.lineTo(size * 0.22, -size * 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawDistanceOverlay(ctx, st, wx, wy, wl) {
    ctx.save();
    const dFront = raycastDist(st.x, st.y, st.angle, 5);
    const dRear  = raycastDist(st.x, st.y, (st.angle + 180) % 360, 5);

    const fEl = document.getElementById('distFront');
    const rEl = document.getElementById('distRear');
    if (fEl) fEl.textContent = dFront < 4.9 ? dFront.toFixed(2) + 'm' : '—';
    if (rEl) rEl.textContent = dRear  < 4.9 ? dRear.toFixed(2)  + 'm' : '—';
    ctx.restore();
  }

  function raycastDist(fromX, fromY, angleDeg, maxD) {
    const aRad = angleDeg * DEG;
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * maxD;
      const tx = fromX + Math.sin(aRad) * t;
      const ty = fromY - Math.cos(aRad) * t;
      for (const car of SCENARIO.parkedCars) {
        if (Math.abs(tx - car.x) < VEHICLE.width / 2 + 0.08 &&
            Math.abs(ty - car.y) < VEHICLE.length / 2 + 0.08) {
          return t;
        }
      }
      if (tx < 1.5 || tx > 12.0 || ty < 0.2 || ty > SCENARIO.worldH - 0.2) return t;
    }
    return maxD + 0.1;
  }

  function drawLegend(ctx, W, H, mode) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 8, H - 65, 195, 58, 6);
    ctx.fill();

    ctx.fillStyle = '#4de89a';
    ctx.fillRect(15, H - 55, 18, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Vaga-alvo da baliza', 40, H - 48);

    ctx.strokeStyle = '#5ac8fa';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, H - 32); ctx.lineTo(33, H - 32); ctx.stroke();
    ctx.fillText(mode === 'trajectory' ? 'Trajetória da Ré (Traseira)' : 'Trajetória percorrida', 40, H - 28);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ══════════════════════════════════════════════
     DRIVER VIEW — PERSPECTIVA DO CONDUTOR (COCKPIT)
     ══════════════════════════════════════════════ */

  function drawDriverView(canvas, st) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (W < 10 || H < 10) return;

    ctx.clearRect(0, 0, W, H);

    /* Céu */
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    sky.addColorStop(0, '#0d1b2e'); sky.addColorStop(1, '#1e3a5a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.42);

    /* Horizonte */
    const fog = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.48);
    fog.addColorStop(0, 'rgba(40,80,60,0)'); fog.addColorStop(1, '#1e3028');
    ctx.fillStyle = fog;
    ctx.fillRect(0, H * 0.38, W, H * 0.1);

    /* Chão / Pista */
    const ground = ctx.createLinearGradient(0, H * 0.42, 0, H);
    ground.addColorStop(0, '#1e3028'); ground.addColorStop(1, '#0d1a13');
    ctx.fillStyle = ground;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    drawDriverRoad(ctx, W, H);
    drawDriverCars(ctx, W, H, st);
    drawCockpit(ctx, W, H, st);
  }

  function drawDriverRoad(ctx, W, H) {
    const hor = H * 0.42;
    const vpX = W / 2, vpY = hor;

    ctx.fillStyle = '#1e2d26';
    ctx.beginPath();
    ctx.moveTo(vpX - 12, vpY);
    ctx.lineTo(vpX + 12, vpY);
    ctx.lineTo(W * 0.93, H * 0.98);
    ctx.lineTo(W * 0.07, H * 0.98);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    [[vpX - 10, vpY, W * 0.10, H * 0.98], [vpX + 10, vpY, W * 0.90, H * 0.98]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
  }

  function drawDriverCars(ctx, W, H, st) {
    const hor = H * 0.42;
    for (const car of SCENARIO.parkedCars) {
      const depth = st.y - car.y;
      if (depth < 0.2 || depth > 18) continue;

      const ps = 1 / depth;
      const latOffset = (car.x - st.x) * ps * W * 0.6;
      const cx = W / 2 + latOffset;
      const cy = hor + (-1 / depth) * 90;
      const cw = Math.max(8, VEHICLE.width * ps * 90);
      const ch = Math.max(6, VEHICLE.length * ps * 45);

      if (cy < -ch) continue;

      ctx.fillStyle = '#2a4035';
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2, cy - ch, cw, ch, cw * 0.1);
      ctx.fill();

      ctx.fillStyle = 'rgba(150,210,255,0.38)';
      ctx.fillRect(cx - cw * 0.38, cy - ch * 0.82, cw * 0.76, ch * 0.28);

      ctx.fillStyle = '#ff2222';
      ctx.fillRect(cx - cw / 2 + 2, cy - ch * 0.18, cw * 0.28, ch * 0.1);
      ctx.fillRect(cx + cw / 2 - cw * 0.28 - 2, cy - ch * 0.18, cw * 0.28, ch * 0.1);
    }
  }

  function drawCockpit(ctx, W, H, st) {
    const panH = H * 0.3;
    const panY = H - panH;

    const panGrad = ctx.createLinearGradient(0, panY, 0, H);
    panGrad.addColorStop(0, 'rgba(8,16,12,0.96)');
    panGrad.addColorStop(1, '#050e08');
    ctx.fillStyle = panGrad;
    ctx.fillRect(0, panY, W, panH);

    ctx.strokeStyle = '#1a3528';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, panY); ctx.lineTo(W, panY); ctx.stroke();

    /* Retrovisores integrados */
    drawRearviewBox(ctx, W * 0.35, panY - H * 0.10, W * 0.30, H * 0.09, st, 'rear', 'RETROVISOR');
    drawRearviewBox(ctx, W * 0.01, panY - H * 0.10, W * 0.13, H * 0.095, st, 'left', 'ESQ');
    drawRearviewBox(ctx, W * 0.86, panY - H * 0.10, W * 0.13, H * 0.095, st, 'right', 'DIR');

    /* Velocímetro */
    ctx.fillStyle = st.speed > 0.05 ? '#4de89a' : '#2e5540';
    ctx.font = `bold ${Math.max(14, H * 0.065)}px Manrope, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText((st.speed * 3.6).toFixed(1), W * 0.04, panY + panH * 0.54);
    ctx.fillStyle = '#2e5540';
    ctx.font = `${Math.max(8, H * 0.03)}px DM Sans, sans-serif`;
    ctx.fillText('km/h', W * 0.04, panY + panH * 0.68);

    /* Marcha */
    const gearColor = { D: '#4de89a', R: '#f0a040', N: '#6a8a7a' }[st.gear] || '#4de89a';
    ctx.fillStyle = gearColor;
    ctx.font = `bold ${Math.max(18, H * 0.08)}px Manrope, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(st.gear, W - W * 0.04, panY + panH * 0.58);

    /* Ângulo do volante */
    ctx.fillStyle = '#3a6050';
    ctx.font = `${Math.max(9, H * 0.03)}px DM Sans, sans-serif`;
    ctx.textAlign = 'center';
    const sa = st.steerAngle;
    ctx.fillText(`Volante: ${sa > 0 ? '+' : ''}${sa.toFixed(0)}°`, W / 2, panY + panH * 0.72);
  }

  function drawRearviewBox(ctx, x, y, w, h, st, side, label) {
    ctx.save();
    ctx.fillStyle = '#0a140e';
    ctx.strokeStyle = '#2a4036';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill(); ctx.stroke();

    ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip();

    ctx.fillStyle = '#0e1a14'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#1a2a20';
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h - 2);
    ctx.lineTo(x + w - 2, y + h - 2);
    ctx.lineTo(x + w * 0.8, y + h * 0.5);
    ctx.lineTo(x + w * 0.2, y + h * 0.5);
    ctx.closePath(); ctx.fill();

    for (const car of SCENARIO.parkedCars) {
      const dy = st.y - car.y;
      const dx = car.x - st.x;
      if (dy > 0.2 && dy < 14) {
        const depth = Math.max(0.2, dy);
        const ps = 0.7 / depth;
        const offsetX = side === 'left' ? -1 : (side === 'right' ? 1 : 0);
        const cx = x + w / 2 + (dx + offsetX) * ps * 35;
        const cy = y + h * 0.5 + (1 / depth) * 18;
        const cw = Math.max(4, VEHICLE.width * ps * 35);
        const ch = Math.max(3, VEHICLE.length * ps * 20);

        ctx.fillStyle = '#344a3c';
        ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(cx - cw / 2 + 1, cy - 2, cw * 0.3, 2);
        ctx.fillRect(cx + cw / 2 - cw * 0.3 - 1, cy - 2, cw * 0.3, 2);
      }
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '7px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h + 8);
  }

  /* ══════════════════════════════════════════════
     CANVAS DO VOLANTE VIRTUAL
     ══════════════════════════════════════════════ */

  function drawSteeringWheel(canvas, angle) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.44;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle * DEG);

    /* aro externo */
    ctx.strokeStyle = '#1e3828';
    ctx.lineWidth = r * 0.2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.stroke();

    ctx.strokeStyle = '#2a5040';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.stroke();

    /* centro */
    ctx.fillStyle = '#172c20';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2); ctx.fill();

    /* raio 3 hastes */
    ctx.strokeStyle = '#2a5040';
    ctx.lineWidth = r * 0.12;
    for (const a of [0, 120, 240]) {
      const rad = (a - 90) * DEG;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * r * 0.34, Math.sin(rad) * r * 0.34);
      ctx.lineTo(Math.cos(rad) * r * 0.84, Math.sin(rad) * r * 0.84);
      ctx.stroke();
    }

    /* detalhe verde no topo */
    ctx.strokeStyle = '#4de89a';
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, -Math.PI / 2 - 0.22, -Math.PI / 2 + 0.22);
    ctx.stroke();

    ctx.restore();
  }

  /* ══════════════════════════════════════════════
     FÍSICA E REGRAS: CENÁRIO DIREÇÃO EM VIAS & DISTÂNCIAS
     ══════════════════════════════════════════════ */

  function updateRoadPhysics(dt) {
    const stage = ROAD_STAGES[roadState.stageIndex];

    // 1. Contador regressivo de 20s para mudança de via
    roadState.stageTimer -= dt;
    if (roadState.stageTimer <= 0) {
      roadState.stageTimer = 20.0;
      roadState.stageIndex = (roadState.stageIndex + 1) % ROAD_STAGES.length;
      const nextStage = ROAD_STAGES[roadState.stageIndex];
      roadState.targetSpeedKmh = nextStage.speedLimit;
      playAlertBeep(false);
      showRoadStageNotification(nextStage);
    }

    // 2. Controle de Setas (Sinalização - CTB Art. 196) e Bip Relé
    if (roadState.turnSignal) {
      roadState.turnSignalTimer += dt;
      if (roadState.turnSignalTimer >= 0.38) {
        roadState.turnSignalTimer = 0;
        roadState.turnSignalBlink = !roadState.turnSignalBlink;
        playRelayClick(roadState.turnSignalBlink);
      }
    } else {
      roadState.turnSignalBlink = false;
      roadState.turnSignalTimer = 0;
    }

    // Timers de notificações e do Agente
    if (roadState.infractionTimer > 0) {
      roadState.infractionTimer -= dt;
      if (roadState.infractionTimer <= 0) roadState.infractionText = null;
    }
    if (roadState.successTimer > 0) {
      roadState.successTimer -= dt;
      if (roadState.successTimer <= 0) roadState.successText = null;
    }
    if (cnhState.officerTimer > 0) {
      cnhState.officerTimer -= dt;
      if (cnhState.officerTimer <= 0) {
        const dlg = document.getElementById('simOfficerDialog');
        if (dlg) dlg.style.display = 'none';
      }
    }

    // 3. Controle de velocidade do jogador (aceleração e frenagem suaves)
    const accelRate = 24; // km/h por segundo
    const decelRate = 36;
    if (inputState.accel) {
      roadState.targetSpeedKmh = Math.min(stage.speedLimit + 35, roadState.targetSpeedKmh + accelRate * dt);
      roadState.suspensionPitch = 0.02;
    } else if (inputState.brake) {
      roadState.targetSpeedKmh = Math.max(0, roadState.targetSpeedKmh - decelRate * dt);
      roadState.suspensionPitch = -0.04;
    } else {
      if (Math.abs(roadState.targetSpeedKmh - stage.speedLimit) > 0.4) {
        roadState.targetSpeedKmh += (stage.speedLimit - roadState.targetSpeedKmh) * 1.8 * dt;
      }
      roadState.suspensionPitch *= 0.9;
    }
    roadState.speedKmh += (roadState.targetSpeedKmh - roadState.speedKmh) * 3.4 * dt;
    if (roadState.speedKmh < 0) roadState.speedKmh = 0;

    // 4. Esterçamento e deslocamento lateral suave entre faixas
    let targetSteer = 0;
    if (inputState.steerLeft)  targetSteer -= 24;
    if (inputState.steerRight) targetSteer += 24;
    roadState.steerAngle += (targetSteer - roadState.steerAngle) * 8.5 * dt;

    const lateralVelocity = (roadState.steerAngle / 24) * 2.8 * (Math.max(10, roadState.speedKmh) / 40);
    roadState.playerX += lateralVelocity * dt;
    const maxOffset = (stage.roadWidth / 2) + 0.6; // permite alcançar acostamento/calçada para fiscalização
    roadState.playerX = Math.max(-maxOffset, Math.min(maxOffset, roadState.playerX));

    // FISCALIZAÇÃO CTB ART. 193: Transitar em calçada, ciclovia ou acostamento
    const offRoadThreshold = (stage.roadWidth / 2) - 0.25;
    if (Math.abs(roadState.playerX) > offRoadThreshold && roadState.speedKmh > 8.0) {
      const isSidewalk = stage.id === 'urbana';
      issueAit('ART_193', isSidewalk ? 'Veículo transitando sobre a calçada destinada a pedestres.' : 'Veículo transitando indevidamente pelo acostamento da rodovia.');
    }

    // 5. INTENÇÃO DE MUDANÇA DE FAIXA E FISCALIZAÇÃO DA SETA (CTB Art. 196)
    let currentLane = 1;
    if (roadState.playerX < -1.75) currentLane = 0;
    else if (roadState.playerX > 1.75) currentLane = 2;

    const isDriftingLeft = (roadState.steerAngle < -4 || lateralVelocity < -0.15);
    const isDriftingRight = (roadState.steerAngle > 4 || lateralVelocity > 0.15);

    if (currentLane === 1) {
      if (roadState.playerX < -0.75 && isDriftingLeft && roadState.turnSignal !== 'left') {
        issueAit('ART_196', 'Iniciou manobra para a faixa da esquerda sem prévia sinalização por seta.');
      } else if (roadState.playerX > 0.75 && isDriftingRight && roadState.turnSignal !== 'right') {
        issueAit('ART_196', 'Iniciou manobra para a faixa da direita sem prévia sinalização por seta.');
      }
    } else if (currentLane === 0) {
      if (roadState.playerX > -2.7 && isDriftingRight && roadState.turnSignal !== 'right') {
        issueAit('ART_196', 'Retornou da faixa esquerda para o centro sem acionar a seta para a direita.');
      }
    } else if (currentLane === 2) {
      if (roadState.playerX < 2.7 && isDriftingLeft && roadState.turnSignal !== 'left') {
        issueAit('ART_196', 'Retornou da faixa direita para o centro sem acionar a seta para a esquerda.');
      }
    }

    if (currentLane !== roadState.lastLaneIndex) {
      if (currentLane < roadState.lastLaneIndex) {
        if (roadState.turnSignal !== 'left') {
          issueAit('ART_196', 'Mudança de faixa para a esquerda concluída sem acionamento prévio da seta.');
        } else {
          roadState.successText = '✓ Mudança de faixa para a esquerda com seta e segurança (Art. 196 cumprido)!';
          roadState.successTimer = 3.5;
          playAlertBeep(false);
          roadState.turnSignal = null;
        }
      } else if (currentLane > roadState.lastLaneIndex) {
        if (roadState.turnSignal !== 'right') {
          issueAit('ART_196', 'Mudança de faixa para a direita concluída sem acionamento prévio da seta.');
        } else {
          const isRightClear = !roadState.blindSpotActive && (roadState.rightCar.y < -3.5 || roadState.rightCar.y > 6.5);
          if (isRightClear) {
            roadState.successText = '✓ Mudança para a direita com seta e faixa desimpedida com segurança!';
            roadState.successTimer = 3.5;
            playAlertBeep(false);
          } else {
            issueAit('ART_192', 'Mudança de faixa perigosa sobre veículo no ponto cego sem guardar distância segura!');
          }
          roadState.turnSignal = null;
        }
      }
      roadState.lastLaneIndex = currentLane;
    }

    // 6. Rolagem contínua do asfalto
    const speedMs = (roadState.speedKmh * 1000) / 3600;
    roadState.roadScrollY = (roadState.roadScrollY + speedMs * dt) % 24;

    // 7. FISCALIZAÇÃO ELETRÔNICA DE VELOCIDADE (CTB ART. 218)
    const limit = stage.speedLimit;
    if (roadState.speedKmh > limit * 1.50) {
      issueAit('ART_218_III', `Velocidade de ${roadState.speedKmh.toFixed(0)} km/h (>50% acima do limite de ${limit} km/h). Processo de suspensão da CNH instaurado!`);
    } else if (roadState.speedKmh > limit * 1.20) {
      issueAit('ART_218_II', `Velocidade aferida de ${roadState.speedKmh.toFixed(0)} km/h (de 20% a 50% acima do limite regulamentado de ${limit} km/h).`);
    } else if (roadState.speedKmh > limit * 1.08 && roadState.speedKmh > limit + 5) {
      issueAit('ART_218_I', `Velocidade aferida de ${roadState.speedKmh.toFixed(0)} km/h (em até 20% acima do limite de ${limit} km/h).`);
    }

    // 8. SEMÁFORO INTELIGENTE (CTB ART. 208 - APENAS NA CIDADE)
    if (stage.isUrban) {
      const tl = roadState.trafficLight;
      tl.timer -= dt;
      if (tl.state === 'green' && tl.timer <= 0) {
        tl.state = 'yellow';
        tl.timer = 3.2;
      } else if (tl.state === 'yellow' && tl.timer <= 0) {
        tl.state = 'red';
        tl.timer = 8.5;
      } else if (tl.state === 'red' && tl.timer <= 0) {
        tl.state = 'green';
        tl.timer = 15.0;
        tl.hasViolated = false;
      }

      tl.y -= speedMs * dt;
      if (tl.y < -12.0) {
        tl.y = 52.0;
        tl.hasViolated = false;
      }

      // Linha de retenção do semáforo
      const stopLineDist = tl.y - 3.5;
      if (tl.state === 'red') {
        if (stopLineDist < 1.0 && stopLineDist > -3.0 && roadState.speedKmh > 5.0 && !tl.hasViolated) {
          tl.hasViolated = true;
          issueAit('ART_208', 'Avançou o sinal vermelho do semáforo no cruzamento regulamentado.');
        } else if (stopLineDist <= 5.0 && stopLineDist >= 1.2 && roadState.speedKmh < 1.0 && !tl.hasViolated) {
          commendDriver('Excelente conduta! Parada total e segura antes da faixa de retenção no sinal vermelho!', 'Art. 208 do CTB');
        }
      }
    }

    // 9. SITUAÇÃO ESCOLAR (ZONA 30 - ÔNIBUS, CRIANÇAS & GUARDA DE TRÂNSITO)
    if (stage.id === 'escolar') {
      const sb = roadState.schoolBus;
      sb.y -= speedMs * dt;
      sb.hazardTimer += dt;
      if (sb.hazardTimer >= 0.42) {
        sb.hazardTimer = 0;
        sb.hazardBlink = !sb.hazardBlink;
      }
      if (sb.y < -18.0) sb.y = 48.0;

      const tw = roadState.trafficWarden;
      tw.y = sb.y - 4.5;
      roadState.crosswalk.y = tw.y;

      // Movimentação das crianças na faixa
      roadState.schoolChildren.forEach(kid => {
        kid.y = tw.y;
        kid.anim += dt * 4.5;
        kid.x += kid.dir * kid.speed * dt;
        if (kid.x < -3.2) kid.dir = 1;
        if (kid.x > 3.2) kid.dir = -1;
      });

      // AVISO DO GUARDA DE TRÂNSITO (APITO COM SILVO LONGO)
      const distToSchool = tw.y;
      if (tw.hasWarden && distToSchool > 10.0 && distToSchool < 32.0 && !tw.whistleGiven) {
        tw.whistleGiven = true;
        playOfficerStopWhistle();
        showInstruction('🛑 <b>Guarda Escolar Apitou (Silvo Longo):</b> Ordem de Parada Obrigatória! Crianças descendo do ônibus e atravessando a faixa.');
      }

      // Fiscalização na área escolar
      if (Math.abs(distToSchool) < 3.2) {
        if (roadState.speedKmh > 30.0) {
          issueAit('ART_220_XIV', `Transitou a ${roadState.speedKmh.toFixed(0)} km/h em área escolar (máximo regulamentado: 30 km/h).`);
        }
        if (tw.hasWarden) {
          if (roadState.speedKmh > 5.0 && !tw.hasViolated) {
            tw.hasViolated = true;
            issueAit('ART_195', 'Desobedeceu à ordem expressa de parada emanada do Guarda de Trânsito.');
          } else if (roadState.speedKmh < 1.0 && !tw.hasViolated) {
            commendDriver('Parada exemplar na área escolar! Respeito absoluto às ordens do guarda e às crianças!', 'Art. 220, XIV do CTB');
          }
        } else {
          // Sem guarda: travessia autônoma das crianças
          if (roadState.speedKmh > 8.0 && !tw.hasViolated) {
            tw.hasViolated = true;
            issueAit('ART_214_I', 'Deixou de dar preferência a crianças em travessia na faixa escolar.');
          } else if (roadState.speedKmh < 1.0 && !tw.hasViolated) {
            commendDriver('Parabéns pela cidadania e prudência! Parou e concedeu preferência às crianças na faixa escolar!', 'Art. 214 do CTB');
          }
        }
      }
      if (distToSchool < -12.0) {
        tw.whistleGiven = false;
        tw.hasViolated = false;
      }
    }

    // 10. SITUAÇÃO IDOSO NA FAIXA / ACESSIBILIDADE (CTB ART. 214, II)
    if (stage.isUrban && stage.id !== 'escolar') {
      const eld = roadState.elderlyPedestrian;
      eld.y -= (speedMs * dt) * 0.95;
      eld.anim += dt * 2.8;
      eld.x += eld.dir * eld.speed * dt;
      if (eld.x > 3.6) eld.dir = -1;
      if (eld.x < -3.6) eld.dir = 1;

      if (eld.y < -15.0) {
        eld.y = 44.0;
        eld.hasPassed = false;
        eld.hasViolated = false;
      }

      if (Math.abs(eld.y) < 3.5 && Math.abs(eld.x) < 3.2) {
        if (roadState.speedKmh > 5.0 && !eld.hasViolated) {
          eld.hasViolated = true;
          issueAit('ART_214_II', 'Deixou de dar preferência a pedestre idoso com bengala em travessia na via.');
        } else if (roadState.speedKmh < 1.0 && !eld.hasPassed) {
          eld.hasPassed = true;
          commendDriver('Respeito exemplar ao pedestre idoso! Aguardou com paciência a conclusão da travessia com segurança.', 'Art. 214, II do CTB');
        }
      }
    }

    // 11. SITUAÇÃO CRUZAMENTO COM PLACA R-1 (PARADA OBRIGATÓRIA - PARE)
    if (stage.id === 'coletora') {
      const inter = roadState.intersection;
      inter.y -= speedMs * dt;
      inter.crossingCar.x -= inter.crossingCar.speed * dt;
      if (inter.crossingCar.x < -18.0) inter.crossingCar.x = 22.0;

      if (inter.y < -14.0) {
        inter.y = 52.0;
        inter.hasStoppedCompletely = false;
        inter.hasPassedIntersection = false;
        inter.hasViolated = false;
      }

      // Parada completa na linha de retenção diante da placa R-1
      const distToStop = inter.y - 2.5;
      if (distToStop <= 4.0 && distToStop >= 0.2 && roadState.speedKmh < 1.0) {
        inter.hasStoppedCompletely = true;
      }

      if (distToStop < 0.5 && distToStop > -3.0 && !inter.hasPassedIntersection) {
        inter.hasPassedIntersection = true;
        if (!inter.hasStoppedCompletely && roadState.speedKmh > 5.0) {
          issueAit('ART_208_PARE', 'Avançou cruzamento sem imobilizar completamente o veículo diante da placa de sinalização R-1 (PARE).');
        } else if (inter.hasStoppedCompletely) {
          commendDriver('Parada total na placa PARE (R-1) cumprida com perfeição! Preferência respeitada.', 'Art. 208 do CTB');
        }
      }
    }

    // 12. SITUAÇÃO AMBULÂNCIA SAMU PEDINDO PASSAGEM (CTB ART. 189)
    const amb = roadState.ambulance;
    if (amb.active) {
      const ambSpeedMs = (amb.speedKmh * 1000) / 3600;
      amb.y += (ambSpeedMs - speedMs) * dt;

      amb.sirenTimer += dt;
      if (amb.sirenTimer >= 1.6) {
        amb.sirenTimer = 0;
        playAmbulanceSiren();
      }

      // O condutor deve ligar seta para a direita e abrir a faixa esquerda/central
      const isYielding = roadState.playerX > 1.25 && roadState.turnSignal === 'right';
      if (isYielding && !amb.hasYielded) {
        amb.hasYielded = true;
        commendDriver('Conduta cidadã impecável! Deu passagem imediata à ambulância do SAMU em socorro (Art. 189 cumprido)!', 'Art. 189 do CTB');
      }

      // Se a ambulância alcançar o veículo sem que este abra passagem
      if (amb.y > -6.0 && amb.y < 3.0 && roadState.playerX < 0.75 && !amb.hasViolated) {
        amb.hasViolated = true;
        issueAit('ART_189', 'Deixou de dar passagem à ambulância do SAMU com sirene e luzes de emergência acionadas.');
      }

      if (amb.y > 60.0) {
        amb.active = false;
        amb.y = -45.0;
        amb.hasYielded = false;
        amb.hasViolated = false;
      }
    }

    // 13. SITUAÇÃO PASSAGEM DE NÍVEL FERROVIÁRIA (CTB ART. 212)
    if (stage.id === 'ferrovia') {
      const rc = roadState.railCrossing;
      rc.y -= speedMs * dt;
      if (rc.y < -20.0) {
        rc.y = 55.0;
        rc.barrierDown = false;
        rc.lightsFlashing = false;
        rc.trainPassing = false;
        rc.trainX = -85.0;
        rc.hasStopped = false;
        rc.hasViolated = false;
      }

      const roadHalfWidth = stage.roadWidth * 0.5 + 4.0;
      const trainLength = 38.0;
      const trainDepth = 3.2; // Espessura física dos trilhos/vagões (m)

      // Quando a linha férrea estiver a menos de 45m à frente
      if (rc.y < 45.0 && rc.y > -10.0) {
        // O trem cruza da esquerda para a direita
        // Se a cauda do trem ainda não ultrapassou totalmente a pista pela direita:
        if (rc.trainX < roadHalfWidth + 6.0) {
          rc.lightsFlashing = true;
          rc.barrierDown = true;
          rc.trainPassing = true;
          rc.trainX += rc.trainSpeed * dt;

          rc.bellTimer += dt;
          if (rc.bellTimer >= 1.2) {
            rc.bellTimer = 0;
            playTrainCrossingBell();
          }
        } else {
          // O trem já passou completamente pela passagem de nível!
          rc.trainPassing = false;
          rc.barrierDown = false; // Cancela sobe liberando o trânsito
          rc.lightsFlashing = false; // Luzes vermelhas apagam
          stopProximityAudio('train');
        }

        // Parada Obrigatória (CTB Art. 212):
        // Linha de retenção fica em rc.y + 3.8. Zona segura de parada: rc.y entre 2.5m e 8.5m com velocidade < 1.0 km/h
        if (rc.y >= 2.5 && rc.y <= 8.5 && roadState.speedKmh < 1.0) {
          rc.hasStopped = true;
        }

        // ── COLISÃO COM O TREM: Ocorre SOMENTE E EXCLUSIVAMENTE se o condutor bater fisicamente no trem! ──
        // Bounding box física do carro do condutor (centro em roadState.playerX, 0.0)
        const carHalfW = 0.95;
        const carHalfL = 2.1;
        const carLeft = roadState.playerX - carHalfW;
        const carRight = roadState.playerX + carHalfW;
        const carFront = carHalfL;   // +2.1m (para-choque dianteiro)
        const carRear = -carHalfL;  // -2.1m (para-choque traseiro)

        // Bounding box física real do trem de carga
        const trainLeft = rc.trainX;
        const trainRight = rc.trainX + trainLength;
        const trainFront = rc.y + trainDepth * 0.5; // Limite mais próximo do carro
        const trainRear = rc.y - trainDepth * 0.5;  // Limite posterior

        // Sobreposição física exata de corpos rígidos (AABB 2D)
        const xOverlap = (carRight >= trainLeft) && (carLeft <= trainRight);
        const yOverlap = (carFront >= trainRear) && (carRear <= trainFront);

        // Impacto físico real: Ocorre SOMENTE se o trem estiver passando E os dois corpos colidirem
        const isPhysicalTrainCollision = rc.trainPassing && xOverlap && yOverlap;

        if (isPhysicalTrainCollision && !roadState.trainFatalCrash) {
          roadState.trainFatalCrash = true;
          roadState.trainCrashCountdown = 4.5;
          roadState.speedKmh = 0;
          roadState.steerAngle = 0;
          roadState.collisionFlashTimer = 4.5;
          roadState.collidingCarId = 'cargoTrain';
          roadState.collisionFaultWho = 'player';
          roadState.collisionFaultText = 'ABALROAMENTO FERROVIÁRIO GRAVÍSSIMO — Vidas podem ter sido perdidas!';
          playCrashSound();

          issueAit('ART_212', 'ACIDENTE GRAVÍSSIMO COM TREM DE CARGA (Art. 212): Vidas podem ter sido perdidas! O condutor colidiu fisicamente com o trem.');

          const modal = document.getElementById('simTrainFatalModal');
          if (modal) modal.style.display = 'flex';
        }

        // Infração administrativa do CTB (Art. 212): Deixar de parar antes de transpor a linha férrea
        // Ocorre quando o condutor transpôs a ferrovia SEM parar, MAS SEM colidir no trem
        const hasTransposedRails = (carRear > rc.y + trainDepth * 0.5);
        if (hasTransposedRails && !rc.hasViolated && !roadState.trainFatalCrash) {
          rc.hasViolated = true;
          if (!rc.hasStopped) {
            issueAit('ART_212', 'Deixou de parar o veículo antes de transpor a linha férrea (Passagem de Nível). Infração Gravíssima.');
          } else {
            commendDriver('Parada obrigatória antes da linha férrea executada com segurança!', 'Art. 212 do CTB');
          }
        }
      }

      // Contagem regressiva para reinício após acidente fatal com trem
      if (roadState.trainFatalCrash) {
        roadState.speedKmh = 0;
        roadState.trainCrashCountdown -= dt;
        const cdEl = document.getElementById('simFatalCountdown');
        if (cdEl) {
          cdEl.textContent = `Reiniciando o simulador em ${Math.max(1, Math.ceil(roadState.trainCrashCountdown))} segundos...`;
        }
        if (roadState.trainCrashCountdown <= 0) {
          roadState.trainFatalCrash = false;
          const modal = document.getElementById('simTrainFatalModal');
          if (modal) modal.style.display = 'none';
          doReset();
          setRoadStage('ferrovia');
        }
      }
    }

    // 14. PEDESTRES CONFORME O CTB (ART. 68 E 69 — NUNCA TRANSITAM NO MEIO DA VIA)
    if (stage.isUrban && stage.hasPedestrians) {
      const halfW = stage.roadWidth * 0.5;
      const leftSidewalkX = -(halfW + 1.25);
      const rightSidewalkX = +(halfW + 1.25);

      roadState.pedestrians.forEach(ped => {
        ped.animFrame += dt * 4.0;
        if (ped.isCrossing) {
          // Travessia EXCLUSIVAMENTE sobre a faixa de pedestres (Art. 69 do CTB)
          ped.y = roadState.crosswalk.y;

          // Pedestre só transita pela faixa se o tráfego parou ou semáforo está vermelho
          const isTrafficStopped = (roadState.speedKmh < 2.5 && Math.abs(roadState.crosswalk.y) < 14.0) ||
                                  (stage.id === 'arterial' && roadState.trafficLight.state === 'red') ||
                                  (stage.id === 'escolar' && roadState.trafficWarden.hasWarden && roadState.trafficWarden.whistleGiven);

          if (isTrafficStopped || Math.abs(ped.x) < (halfW - 0.2)) {
            // Travessia ativa sobre a faixa zebrada
            ped.x += ped.speed * ped.dir * dt;
            if (ped.x > (halfW + 1.2)) { ped.dir = -1; ped.x = halfW + 1.2; }
            if (ped.x < -(halfW + 1.2)) { ped.dir = 1; ped.x = -(halfW + 1.2); }
          } else {
            // Aguarda pacientemente no meio-fio da calçada até os veículos pararem
            ped.x = ped.dir > 0 ? -(halfW + 0.35) : +(halfW + 0.35);
          }

          if (Math.abs(roadState.crosswalk.y) < 2.5 && Math.abs(ped.x) < (halfW - 0.4) && roadState.speedKmh > 5.0) {
            issueAit('ART_214_I', 'Deixou de dar preferência ao pedestre que estava atravessando na faixa delimitada.');
          } else if (roadState.crosswalk.y <= 6.0 && roadState.crosswalk.y >= 2.0 && roadState.speedKmh < 1.0 && Math.abs(ped.x) < (halfW - 0.4)) {
            commendDriver('Parabéns pela cidadania! Deu preferência total ao pedestre na faixa (Art. 214 do CTB).', 'Art. 214 do CTB');
          }
        } else {
          // Pedestres caminhando ESTRITAMENTE pelas calçadas (Art. 68 do CTB — NUNCA na pista de rolamento)
          ped.x = (ped.id % 2 === 0) ? rightSidewalkX : leftSidewalkX;
          ped.y -= (speedMs - 1.2) * dt;
          if (ped.y < -18.0) ped.y = 48.0;
        }
      });
    }

    // 15. CICLISTA: DISTÂNCIA LATERAL MÍNIMA DE 1,50M (CTB ART. 201)
    // O ciclista transita estritamente pelo bordo direito da pista conforme Art. 58 do CTB
    const cyc = roadState.cyclist;
    const cycSpeedMs = (cyc.speedKmh * 1000) / 3600;
    cyc.y -= (speedMs - cycSpeedMs) * dt;
    cyc.pedalFrame += dt * 5.0;
    cyc.x = (stage.roadWidth * 0.5) - 0.35; // Bordo direito regulamentar
    if (cyc.y < -35.0) { cyc.y = 42.0; cyc.passedSafely = false; }
    if (cyc.y > 60.0)  cyc.y = -25.0;

    if (Math.abs(cyc.y) < 3.2) {
      const lateralDistanceToCyclist = Math.abs(cyc.x - roadState.playerX) - (VEHICLE.width / 2);
      if (lateralDistanceToCyclist < 1.50) {
        issueAit('ART_201', `Ultrapassou ciclista mantendo apenas ${lateralDistanceToCyclist.toFixed(2)}m de distância lateral (mínimo legal: 1,50m).`);
      } else if (!cyc.passedSafely && lateralDistanceToCyclist >= 1.65) {
        cyc.passedSafely = true;
        commendDriver(`Perfeito! Guardou ${lateralDistanceToCyclist.toFixed(2)}m de distância ao ultrapassar o ciclista (Art. 201 do CTB cumprido)!`, 'Art. 201 do CTB');
      }
    }

    // 16. ANIMAIS NA PISTA (CTB ART. 220, XI)
    const an = roadState.animal;
    an.y -= (speedMs * dt) * 0.95;
    an.tailWag += dt * 8.0;
    if (an.y < -20.0) { an.y = 48.0; an.alertTriggered = false; }

    if (Math.abs(an.y) < 8.0 && roadState.speedKmh > (stage.speedLimit * 0.85) && !an.alertTriggered) {
      an.alertTriggered = true;
      issueAit('ART_220_XI', `Deixou de reduzir a velocidade (${roadState.speedKmh.toFixed(0)} km/h) nas proximidades de animal na pista.`);
    }

    // 17. PARTÍCULAS ATMOSFÉRICAS DARK PIXEL (NÉVOA & POEIRA)
    roadState.particles.forEach(p => {
      p.y = (p.y + p.speed * dt * (roadState.speedKmh / 30)) % 1.0;
    });

    // 18. TRÁFEGO DINÂMICO CONFORME O CTB (TODOS OS VEÍCULOS SEGUEM RIGOROSAMENTE A LEI)
    // ── Determinação das linhas de retenção e parada obrigatória ativas ──
    const stopObstacles = [];
    if (stage.isUrban && roadState.trafficLight.state === 'red' && roadState.trafficLight.y > -2.0) {
      stopObstacles.push({ y: roadState.trafficLight.y - 3.5, name: 'Semáforo Vermelho' });
    }
    if (stage.id === 'ferrovia' && roadState.railCrossing.barrierDown && roadState.railCrossing.y > -2.0) {
      stopObstacles.push({ y: roadState.railCrossing.y + 4.5, name: 'Cancela Ferroviária' });
    }
    if (stage.id === 'escolar' && roadState.trafficWarden.hasWarden && roadState.trafficWarden.whistleGiven && roadState.trafficWarden.y > -2.0) {
      stopObstacles.push({ y: roadState.trafficWarden.y + 4.5, name: 'Faixa Escolar' });
    }
    if (stage.id === 'coletora' && roadState.intersection.y > 0 && roadState.intersection.y < 35.0) {
      stopObstacles.push({ y: roadState.intersection.y - 3.0, name: 'Placa PARE' });
    }

    // Helper para verificar parada obrigatória adiante de qualquer veículo
    function getVehicleTargetSpeed(vY, maxLegalSpeed) {
      for (let i = 0; i < stopObstacles.length; i++) {
        const obsY = stopObstacles[i].y;
        if (obsY > vY) {
          const distToStop = obsY - vY;
          if (distToStop < 32.0) {
            if (distToStop <= 1.2) return 0;
            return Math.max(0, maxLegalSpeed * (distToStop / 30.0));
          }
        }
      }
      return maxLegalSpeed;
    }

    // ── Configuração das Faixas Regulamentares de Trânsito ──
    if (stage.lanes === 2) {
      roadState.leftCar.lane = 0;
      roadState.leftCar.active = true;
      roadState.frontCar.lane = 1;
      roadState.frontCar.active = true;
      roadState.rearCar.lane = 1;
      roadState.rearCar.active = true;
      roadState.rightCar.active = false;
      roadState.truck.active = false;
      roadState.motorcycle.active = false;
    } else if (stage.lanes === 3) {
      roadState.leftCar.lane = 0;
      roadState.leftCar.active = true;
      roadState.frontCar.lane = 1;
      roadState.frontCar.active = true;
      roadState.rearCar.lane = 1;
      roadState.rearCar.active = true;
      roadState.rightCar.lane = 2;
      roadState.rightCar.active = true;
      roadState.truck.lane = 2;
      roadState.truck.active = (stage.id === 'rodovia');
      roadState.motorcycle.active = false;
    } else {
      roadState.leftCar.lane = 0;
      roadState.leftCar.active = true;
      roadState.motorcycle.lane = 1;
      roadState.motorcycle.active = true;
      roadState.frontCar.lane = 2;
      roadState.frontCar.active = true;
      roadState.rearCar.lane = 2;
      roadState.rearCar.active = true;
      roadState.rightCar.lane = 3;
      roadState.rightCar.active = true;
      roadState.truck.lane = 3;
      roadState.truck.active = (stage.id === 'rapida' || stage.id === 'arterial');
    }

    // Alinhamento suave dos veículos da IA no centro de suas faixas
    [roadState.frontCar, roadState.leftCar, roadState.rightCar, roadState.rearCar, roadState.truck, roadState.motorcycle].forEach(v => {
      if (v && v.active !== false && v.lane !== undefined) {
        const targetX = getLaneCenterX(stage, v.lane);
        v.x += (targetX - v.x) * 6.0 * dt;
      }
    });

    // ── 1. Veículo à Frente (frontCar) ──
    const frontLegalMax = stage.speedLimit * 0.90;
    const frontTargetSpd = getVehicleTargetSpeed(roadState.frontCar.y, frontLegalMax);
    if (frontTargetSpd < roadState.frontCar.speedKmh) {
      roadState.frontCar.speedKmh = Math.max(0, roadState.frontCar.speedKmh - 34.0 * dt);
      roadState.frontBraking = true;
    } else {
      roadState.frontCar.speedKmh += (frontTargetSpd - roadState.frontCar.speedKmh) * 2.8 * dt;
      roadState.frontBraking = false;
    }
    const speedDiffFront = (roadState.speedKmh - roadState.frontCar.speedKmh) * (1000 / 3600);
    roadState.frontCar.y -= speedDiffFront * dt;
    if (roadState.frontCar.y > 60.0) roadState.frontCar.y = 60.0;
    if (roadState.frontCar.y < -15.0) roadState.frontCar.y = 48.0;

    // ── 2. Veículo da Esquerda (leftCar) ──
    if (roadState.leftCar.active) {
      const leftLegalMax = stage.speedLimit * 0.96;
      const leftTargetSpd = getVehicleTargetSpeed(roadState.leftCar.y, leftLegalMax);
      if (leftTargetSpd < roadState.leftCar.speedKmh) {
        roadState.leftCar.speedKmh = Math.max(0, roadState.leftCar.speedKmh - 34.0 * dt);
      } else {
        roadState.leftCar.speedKmh += (leftTargetSpd - roadState.leftCar.speedKmh) * 2.8 * dt;
      }
      const leftSpeedDiff = (roadState.speedKmh - roadState.leftCar.speedKmh) * (1000 / 3600);
      roadState.leftCar.y -= leftSpeedDiff * dt;
      if (roadState.leftCar.y < -38.0) roadState.leftCar.y = 45.0;
      if (roadState.leftCar.y > 60.0)  roadState.leftCar.y = -35.0;
    }

    // ── 3. Veículo da Direita (rightCar) ──
    if (roadState.rightCar.active) {
      const rightLegalMax = stage.speedLimit * 0.84;
      const rightTargetSpd = getVehicleTargetSpeed(roadState.rightCar.y, rightLegalMax);
      if (rightTargetSpd < roadState.rightCar.speedKmh) {
        roadState.rightCar.speedKmh = Math.max(0, roadState.rightCar.speedKmh - 34.0 * dt);
      } else {
        roadState.rightCar.speedKmh += (rightTargetSpd - roadState.rightCar.speedKmh) * 2.8 * dt;
      }
      const rightDiff = (roadState.speedKmh - roadState.rightCar.speedKmh) * (1000 / 3600);
      roadState.rightCar.y -= rightDiff * dt;
      if (roadState.rightCar.y < -38.0) roadState.rightCar.y = 45.0;
      if (roadState.rightCar.y > 60.0)  roadState.rightCar.y = -35.0;
    }

    // ── 4. Veículo Traseiro (rearCar) — Guarda distância rigorosa (Art. 192 CTB) ──
    const rearSafeGap = 8.5;
    if (Math.abs(roadState.rearCar.y) < rearSafeGap || roadState.speedKmh < roadState.rearCar.speedKmh) {
      // O veículo de trás freia imediatamente para nunca colidir na traseira do condutor
      roadState.rearCar.speedKmh = Math.max(0, roadState.speedKmh - 4.0);
      if (roadState.rearCar.y > -5.8) roadState.rearCar.y = -5.8;
    } else {
      roadState.rearCar.speedKmh += (roadState.speedKmh - roadState.rearCar.speedKmh) * 2.5 * dt;
    }
    const rearDiff = (roadState.rearCar.speedKmh - roadState.speedKmh) * (1000 / 3600);
    roadState.rearCar.y += rearDiff * dt;
    if (roadState.rearCar.y > -5.8) roadState.rearCar.y = -5.8;
    if (roadState.rearCar.y < -35.0) roadState.rearCar.y = -18.0;

    // ── 5. Caminhão Pesado / Carreta (truck — CTB Art. 61 e 185) ──
    if (roadState.truck.active) {
      const trkLimit = stage.id === 'rodovia' ? 80.0 : (stage.id === 'rapida' ? 70.0 : 50.0);
      const trkTargetSpd = getVehicleTargetSpeed(roadState.truck.y, trkLimit);
      if (trkTargetSpd < roadState.truck.speedKmh) {
        roadState.truck.speedKmh = Math.max(0, roadState.truck.speedKmh - 26.0 * dt);
      } else {
        roadState.truck.speedKmh += (trkTargetSpd - roadState.truck.speedKmh) * 2.0 * dt;
      }
      const trkDiff = (roadState.speedKmh - roadState.truck.speedKmh) * (1000 / 3600);
      roadState.truck.y -= trkDiff * dt;
      if (roadState.truck.y < -42.0) roadState.truck.y = 52.0;
      if (roadState.truck.y > 65.0)  roadState.truck.y = -38.0;
    }

    // ── 6. Motocicleta (motorcycle — CTB Art. 29 e 40) ──
    if (roadState.motorcycle.active) {
      const motoLimit = stage.speedLimit * 0.92;
      const motoTargetSpd = getVehicleTargetSpeed(roadState.motorcycle.y, motoLimit);
      if (motoTargetSpd < roadState.motorcycle.speedKmh) {
        roadState.motorcycle.speedKmh = Math.max(0, roadState.motorcycle.speedKmh - 36.0 * dt);
        roadState.motorcycle.braking = true;
      } else {
        roadState.motorcycle.speedKmh += (motoTargetSpd - roadState.motorcycle.speedKmh) * 3.2 * dt;
        roadState.motorcycle.braking = false;
      }
      const motoDiff = (roadState.speedKmh - roadState.motorcycle.speedKmh) * (1000 / 3600);
      roadState.motorcycle.y -= motoDiff * dt;
      if (roadState.motorcycle.y < -38.0) roadState.motorcycle.y = 48.0;
      if (roadState.motorcycle.y > 60.0)  roadState.motorcycle.y = -32.0;
    }

    // ── 7. Distância Segura entre os Veículos da IA (Nenhum veículo sobrepõe outro) ──
    const allAiCars = [roadState.frontCar, roadState.leftCar, roadState.rightCar, roadState.truck, roadState.motorcycle].filter(v => v && v.active !== false);
    for (let i = 0; i < allAiCars.length; i++) {
      for (let j = i + 1; j < allAiCars.length; j++) {
        const c1 = allAiCars[i];
        const c2 = allAiCars[j];
        if (Math.abs(c1.x - c2.x) < 1.9 && Math.abs(c1.y - c2.y) < 7.5) {
          if (c1.y > c2.y) {
            c2.y = c1.y - 7.5;
            c2.speedKmh = Math.min(c2.speedKmh, c1.speedKmh);
          } else {
            c1.y = c2.y - 7.5;
            c1.speedKmh = Math.min(c1.speedKmh, c2.speedKmh);
          }
        }
      }
    }

    // 19. FÍSICA DE COLISÃO REALISTA & ATRIBUIÇÃO DE RESPONSABILIDADE (CTB ART. 192)
    // Nenhum carro pode passar por cima do outro, nem pelas laterais
    if (roadState.collisionFlashTimer > 0) roadState.collisionFlashTimer -= dt;
    if (roadState.collisionCooldown > 0) roadState.collisionCooldown -= dt;

    const candidates = [
      { id: 'frontCar', name: 'Veículo à Frente', x: roadState.frontCar.x, y: roadState.frontCar.y, w: roadState.frontCar.w, l: roadState.frontCar.l, speedKmh: roadState.frontCar.speedKmh },
      { id: 'rightCar', name: 'Veículo à Direita', x: roadState.rightCar.x, y: roadState.rightCar.y, w: roadState.rightCar.w, l: roadState.rightCar.l, speedKmh: roadState.rightCar.speedKmh },
      { id: 'leftCar', name: 'Veículo à Esquerda', x: roadState.leftCar.x, y: roadState.leftCar.y, w: roadState.leftCar.w, l: roadState.leftCar.l, speedKmh: roadState.leftCar.speedKmh },
      { id: 'rearCar', name: 'Veículo Traseiro', x: roadState.rearCar.x, y: roadState.rearCar.y, w: roadState.rearCar.w, l: roadState.rearCar.l, speedKmh: roadState.rearCar.speedKmh }
    ];

    if (stage.id === 'escolar') {
      candidates.push({ id: 'schoolBus', name: 'Ônibus Escolar', x: roadState.schoolBus.x, y: roadState.schoolBus.y, w: 2.4, l: 7.2, speedKmh: 0 });
    }
    if (roadState.truck.active && Math.abs(roadState.truck.y) < 40.0) {
      candidates.push({ id: 'truck', name: 'Caminhão Pesado (Carreta)', x: roadState.truck.x, y: roadState.truck.y, w: roadState.truck.w, l: roadState.truck.l, speedKmh: roadState.truck.speedKmh });
    }
    if (stage.id === 'coletora' && Math.abs(roadState.intersection.y) < 20.0) {
      candidates.push({ id: 'crossingCar', name: 'Veículo no Cruzamento', x: roadState.intersection.crossingCar.x, y: roadState.intersection.y, w: 4.2, l: 1.85, speedKmh: 35 });
    }
    if (roadState.ambulance.active && Math.abs(roadState.ambulance.y) < 30.0) {
      candidates.push({ id: 'ambulance', name: 'Ambulância SAMU', x: roadState.ambulance.x, y: roadState.ambulance.y, w: 2.2, l: 5.4, speedKmh: roadState.ambulance.speedKmh });
    }
    if (roadState.isTwoWay && Math.abs(roadState.oncomingCar.y) < 35.0) {
      candidates.push({ id: 'oncomingCar', name: 'Veículo em Sentido Contrário', x: roadState.oncomingCar.x, y: roadState.oncomingCar.y, w: roadState.oncomingCar.w, l: roadState.oncomingCar.l, speedKmh: roadState.oncomingCar.speedKmh });
    }
    if (roadState.motorcycle.active && Math.abs(roadState.motorcycle.y) < 35.0) {
      candidates.push({ id: 'motorcycle', name: 'Motociclista', x: roadState.motorcycle.x, y: roadState.motorcycle.y, w: 1.1, l: 2.4, speedKmh: roadState.motorcycle.speedKmh });
    }

    const halfW_P = VEHICLE.width * 0.5;
    const halfL_P = VEHICLE.length * 0.5;

    for (let c = 0; c < candidates.length; c++) {
      const target = candidates[c];
      const halfW_T = target.w * 0.5;
      const halfL_T = target.l * 0.5;

      const dx = roadState.playerX - target.x;
      const dy = 0 - target.y; // o player está na posição Y = 0

      const overlapX = (halfW_P + halfW_T) - Math.abs(dx);
      const overlapY = (halfL_P + halfL_T) - Math.abs(dy);

      if (overlapX > 0 && overlapY > 0) {
        // ── IMPACTO DETECTADO: IMPEDE QUE UM CARRO TRANSPONHA O OUTRO ──
        if (overlapX < overlapY) {
          // Colisão Lateral: empurra o veículo para fora do contato físico
          const pushDir = dx >= 0 ? 1 : -1;
          roadState.playerX += pushDir * (overlapX + 0.05);
          roadState.steerAngle *= 0.2;
        } else {
          // Colisão Longitudinal: impede sobreposição
          if (dy < 0) {
            // Player atingiu o veículo à frente (target.y > 0)
            if (target.id === 'frontCar') {
              roadState.frontCar.y = Math.max(roadState.frontCar.y, (halfL_P + halfL_T) + 0.15);
            } else if (target.id === 'truck') {
              roadState.truck.y = Math.max(roadState.truck.y, (halfL_P + halfL_T) + 0.25);
            }
            roadState.speedKmh = Math.min(roadState.speedKmh, target.speedKmh * 0.3);
          } else {
            // Veículo atingiu a traseira do player (target.y < 0)
            if (target.id === 'rearCar') {
              roadState.rearCar.y = Math.min(roadState.rearCar.y, -((halfL_P + halfL_T) + 0.25));
            }
            roadState.speedKmh = Math.max(roadState.speedKmh, target.speedKmh * 0.85);
          }
        }

        // ── APURAÇÃO DA RESPONSABILIDADE (CULPABILIDADE DA COLISÃO) ──
        let isPlayerAtFault = true;
        let faultText = '';

        if (target.id === 'frontCar') {
          isPlayerAtFault = true;
          faultText = 'CONDUTOR (Colisão traseira por falta de distância segura de seguimento - Art. 192 CTB)';
        } else if (target.id === 'truck') {
          isPlayerAtFault = true;
          faultText = 'CONDUTOR (Abalroamento em caminhão de carga pesada na rodovia - Art. 192 CTB)';
        } else if (target.id === 'oncomingCar') {
          isPlayerAtFault = true;
          faultText = 'CONDUTOR (Colisão frontal gravíssima por invasão da contramão de direção - Art. 186 CTB)';
        } else if (target.id === 'schoolBus') {
          isPlayerAtFault = true;
          faultText = 'CONDUTOR (Abalroamento em veículo escolar em embarque/desembarque - Art. 192 CTB)';
        } else if (target.id === 'ambulance') {
          isPlayerAtFault = true;
          faultText = 'CONDUTOR (Obstruiu e colidiu com viatura de emergência SAMU - Art. 189 CTB)';
        } else if (target.id === 'crossingCar') {
          if (!roadState.intersection.hasStoppedCompletely) {
            isPlayerAtFault = true;
            faultText = 'CONDUTOR (Avançou sobre cruzamento sem parar na placa PARE R-1 - Art. 208 CTB)';
          } else {
            isPlayerAtFault = false;
            faultText = 'VEÍCULO CRUZADOR (Desrespeitou a preferência de passagem - Condutor isento de culpa)';
          }
        } else if (target.id === 'rearCar') {
          isPlayerAtFault = false;
          faultText = 'VEÍCULO TRASEIRO (Não guardou distância regulamentar - Condutor isento de culpa)';
        } else {
          // rightCar ou leftCar
          if (Math.abs(roadState.steerAngle) > 2.0 || Math.abs(roadState.playerX) > 0.85) {
            isPlayerAtFault = true;
            faultText = 'CONDUTOR (Mudança de faixa com abalroamento lateral culposo - Art. 192/197 CTB)';
          } else {
            isPlayerAtFault = false;
            faultText = 'VEÍCULO TERCEIRO (Aproximação lateral indevida - Condutor isento de culpa)';
          }
        }

        // ── ACIONAMENTO DOS EFEITOS: PISCANDO EM VERMELHO POR 2S + SOM DO ACONTECIMENTO ──
        if (roadState.collisionCooldown <= 0) {
          roadState.collisionFlashTimer = 2.0; // 2 segundos exatos piscando em vermelho
          roadState.collidingCarId = target.id;
          roadState.collisionFaultWho = isPlayerAtFault ? 'player' : 'other';
          roadState.collisionFaultText = faultText;
          roadState.collisionCooldown = 2.4;

          playCrashSound(); // Som gerado apenas no acontecimento!

          if (isPlayerAtFault) {
            issueAit(target.id === 'oncomingCar' ? 'ART_186_II' : 'ART_192', `💥 COLISÃO CULPOSA! ${faultText}`);
          } else {
            roadState.statusLevel = 'yellow';
            roadState.statusText = `💥 COLISÃO SOFRIDA! ${faultText}`;
            commendDriver('Condutor manteve sua faixa. Abalroamento provocado por terceiro (isentado de culpa).', 'CTB - Sem Culpa');
          }
        }
        break;
      }
    }

    // 20. MÉTRICAS NATURAIS DE DISTÂNCIA E PONTO CEGO (CTB ART. 192 - SEM LINHAS FIXAS)
    const latGapRight = (roadState.rightCar.x - roadState.playerX) - VEHICLE.width;
    const latGapLeft  = (roadState.playerX - roadState.leftCar.x) - VEHICLE.width;
    const isAlongsideRight = Math.abs(roadState.rightCar.y) < 3.8;
    const isAlongsideLeft  = Math.abs(roadState.leftCar.y) < 3.8;

    // Ponto cego natural: quando o veículo ao lado está na lateral traseira
    const blindSpotRight = roadState.rightCar.y > -2.2 && roadState.rightCar.y < 2.0 && latGapRight < 2.2;
    roadState.blindSpotActive = blindSpotRight;

    const frontDist = roadState.frontCar.y;
    const frontSafeDist = (roadState.speedKmh * 0.45) + 6.0;
    const frontCritical = frontDist < 8.0 && Math.abs(roadState.playerX - roadState.frontCar.x) < 1.8;
    const frontWarning  = frontDist < (frontSafeDist * 0.75) && Math.abs(roadState.playerX - roadState.frontCar.x) < 1.8;

    const lateralCriticalRight = isAlongsideRight && (latGapRight < 0.85);
    const lateralWarningRight  = isAlongsideRight && (latGapRight < 1.35);
    const lateralCriticalLeft  = isAlongsideLeft  && (latGapLeft < 0.85);
    const lateralWarningLeft   = isAlongsideLeft  && (latGapLeft < 1.35);

    roadState.frontCollisionRisk = frontCritical;
    roadState.frontDistance = frontDist;
    roadState.safeTrailingDistance = frontSafeDist;
    roadState.lateralDistance = latGapRight;

    // 21. REGIME DE PISTA DE MÃO DUPLA & CONTRAMÃO (CTB ART. 186)
    roadState.twoWayTimer += dt;
    const cycleTime = roadState.twoWayTimer % 55.0;
    const isNowTwoWay = cycleTime > 26.0 && cycleTime < 50.0;
    if (isNowTwoWay !== roadState.isTwoWay) {
      roadState.isTwoWay = isNowTwoWay;
      if (isNowTwoWay) {
        showInstruction('⚠️ <b>Placa A-25 (Mão Dupla Adiante):</b> Atenção redobrada! A via passou para <b>duplo sentido de circulação</b> com faixa contínua amarela. A faixa da esquerda agora é <b>CONTRAMÃO</b> (Art. 186 do CTB)!');
        playRadioChirp();
      } else {
        showInstruction('🛣️ <b>Pista Dupla / Mão Única:</b> Faixas no mesmo sentido restabelecidas.');
      }
    }

    if (roadState.isTwoWay) {
      const oc = roadState.oncomingCar;
      const ocSpeedMs = (oc.speedKmh * 1000) / 3600;
      oc.y -= (speedMs + ocSpeedMs) * dt;
      if (oc.y < -25.0) oc.y = 52.0;

      const isPlayerInContramao = roadState.playerX < -0.35;
      if (isPlayerInContramao) {
        if (oc.y > 0 && oc.y < 35.0) {
          oc.flashLights = true;
          roadState.statusLevel = 'red';
          roadState.statusText = `🚨 CONTRAMÃO COM VEÍCULO EM SENTIDO OPOSTO A ${oc.y.toFixed(1)}m (Art. 186, II)! RETORNE À DIREITA!`;
          issueAit('ART_186_II', `Transitou pela contramão com veículo de frente a ${oc.y.toFixed(1)}m (Risco frontal gravíssimo - Art. 186, II).`);
        } else {
          oc.flashLights = false;
          roadState.statusLevel = 'red';
          roadState.statusText = `🚨 TRANSITANDO PELA CONTRAMÃO DE DIREÇÃO EM VIA DE MÃO DUPLA (Art. 186, I)!`;
          issueAit('ART_186_I', 'Transitou pela contramão de direção em via com duplo sentido de circulação (Art. 186, I do CTB).');
        }
      } else {
        oc.flashLights = false;
      }
    }

    // 22. ÁUDIOS REAIS POR PROXIMIDADE (AMBULÂNCIA, TREM E POLÍCIA)
    // 1. Ambulância SAMU se aproximando da tela
    const ambNear = roadState.ambulance.active && roadState.ambulance.y > -35.0 && roadState.ambulance.y < 42.0;
    const ambDist = ambNear ? Math.abs(roadState.ambulance.y) : 999;
    updateProximityAudio('ambulance', 'sons/ambulance.mp3', ambDist, 35.0, playAmbulanceSiren);

    // 2. Trem de carga cruzando a passagem de nível na tela
    const isTrainActive = stage.id === 'ferrovia' && roadState.railCrossing.trainPassing;
    const trainNear = isTrainActive && roadState.railCrossing.y > -15.0 && roadState.railCrossing.y < 45.0;
    const trainDist = trainNear ? Math.abs(roadState.railCrossing.y) : 999;
    updateProximityAudio('train', 'sons/train.mp3', trainDist, 40.0, playTrainCrossingBell);

    // 3. Viatura da Polícia / PRF se aproximando com sirene
    const policeNear = roadState.policeCruiser.active && roadState.policeCruiser.sirenActive && roadState.policeCruiser.y > -35.0 && roadState.policeCruiser.y < 42.0;
    const policeDist = policeNear ? Math.abs(roadState.policeCruiser.y) : 999;
    updateProximityAudio('police', 'sons/police.mp3', policeDist, 35.0, playPoliceSirenFallback);

    if (roadState.collisionFlashTimer > 0) {
      roadState.statusLevel = 'red';
      roadState.statusText = `💥 COLISÃO REGISTRADA — Responsável: ${roadState.collisionFaultText}`;
    } else if (frontCritical) {
      roadState.statusLevel = 'red';
      roadState.statusText = `🔴 ALERTA DE COLISÃO FRONTAL (${frontDist.toFixed(1)}m)! Freie imediatamente!`;
    } else if (lateralCriticalRight) {
      roadState.statusLevel = 'red';
      roadState.statusText = `🔴 ALERTA DE COLISÃO LATERAL DIREITA (${latGapRight.toFixed(2)}m)! Afaste-se do veículo!`;
    } else if (lateralCriticalLeft) {
      roadState.statusLevel = 'red';
      roadState.statusText = `🔴 ALERTA DE COLISÃO LATERAL ESQUERDA (${latGapLeft.toFixed(2)}m)! Afaste-se do veículo!`;
    } else if (roadState.infractionTimer > 0 && roadState.infractionText) {
      roadState.statusLevel = 'red';
      roadState.statusText = roadState.infractionText;
    } else if (roadState.successTimer > 0 && roadState.successText) {
      roadState.statusLevel = 'green';
      roadState.statusText = roadState.successText;
    } else if (amb.active && amb.y > -25.0 && !amb.hasYielded) {
      roadState.statusLevel = 'yellow';
      roadState.statusText = `🚨 AMBULÂNCIA SAMU PEDINDO PASSAGEM — Desloque-se para a direita (Art. 189)!`;
    } else if (stage.id === 'escolar' && Math.abs(roadState.trafficWarden.y) < 30.0) {
      roadState.statusLevel = 'yellow';
      roadState.statusText = roadState.trafficWarden.hasWarden ? `🏫 ÁREA ESCOLAR — Guarda de Trânsito Operando na Faixa (30 km/h)` : `🏫 ÁREA ESCOLAR — Crianças Atravessando na Faixa (30 km/h)`;
    } else if (stage.id === 'ferrovia' && Math.abs(roadState.railCrossing.y) < 35.0) {
      roadState.statusLevel = 'yellow';
      roadState.statusText = `🚂 PASSAGEM DE NÍVEL — Parada Obrigatória antes da Linha Férrea (Art. 212)`;
    } else if (blindSpotRight) {
      roadState.statusLevel = 'yellow';
      roadState.statusText = `🟡 PONTO CEGO LATERAL ATIVO — Veículo ao lado oculto na coluna. Mantenha a faixa!`;
    } else if (lateralWarningRight) {
      roadState.statusLevel = 'yellow';
      roadState.statusText = `🟡 APROXIMAÇÃO LATERAL DIREITA (${latGapRight.toFixed(2)}m) — Centralize o veículo na faixa.`;
    } else if (frontWarning) {
      roadState.statusLevel = 'yellow';
      roadState.statusText = `🟡 APROXIMAÇÃO FRONTAL (${frontDist.toFixed(1)}m) — Reduza a velocidade e guarde distância segura.`;
    } else if (!roadState.isTwoWay || roadState.playerX >= -0.35) {
      roadState.statusLevel = 'green';
      roadState.statusText = `🟢 SINAL VERDE — Distância Segura e Faixa Desimpedida (Art. 192 CTB)`;
    }

    // Removido som intermitente de fundo: sons tocam exclusivamente no acontecimento!

    updateRoadHudDom(stage);
    updateCtbDom();
  }

  /* ══════════════════════════════════════════════
     AUTUAÇÕES CTB, AGENTE DE TRÂNSITO E DOM
     ══════════════════════════════════════════════ */

  function issueAit(artKey, customReason) {
    const art = CTB_ARTICLES[artKey];
    if (!art) return;
    const now = performance.now();
    if (cnhState.cooldowns[artKey] && (now - cnhState.cooldowns[artKey] < 4500)) return;
    cnhState.cooldowns[artKey] = now;

    cnhState.points += art.pts;
    cnhState.totalFines += art.price;

    const ait = {
      id: 'AIT-' + Math.floor(100000 + Math.random() * 900000),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      article: art.article,
      title: art.title,
      desc: customReason || art.desc,
      severity: art.severity,
      pts: art.pts,
      price: art.price,
      advice: art.advice
    };
    cnhState.aits.unshift(ait);

    if (cnhState.points >= 40 && !cnhState.isSuspended) {
      cnhState.isSuspended = true;
    }

    playPoliceWhistle();
    playRadioChirp();

    triggerOfficerNotice(ait);
    updateCtbDom();
  }

  function commendDriver(msg, lawArticle) {
    roadState.successText = `✓ ${msg}`;
    roadState.successTimer = 3.5;
    playAlertBeep(false);

    const officerDlg = document.getElementById('simOfficerDialog');
    const msgEl = document.getElementById('simOfficerMsg');
    const fineCard = document.getElementById('simOfficerFineCard');
    const timeEl = document.getElementById('simOfficerTime');

    if (officerDlg && msgEl) {
      msgEl.innerHTML = `👏 <b>Elogio da Autoridade:</b> ${msg} <i>(${lawArticle})</i>`;
      if (fineCard) fineCard.style.display = 'none';
      if (timeEl) timeEl.textContent = 'Agora';
      officerDlg.style.display = 'block';
      cnhState.officerTimer = 4.0;
    }
  }

  function triggerOfficerNotice(ait) {
    const officerDlg = document.getElementById('simOfficerDialog');
    const msgEl = document.getElementById('simOfficerMsg');
    const fineCard = document.getElementById('simOfficerFineCard');
    const artEl = document.getElementById('simFineArt');
    const sevEl = document.getElementById('simFineSeverity');
    const ptsEl = document.getElementById('simFinePts');
    const priceEl = document.getElementById('simFinePrice');
    const timeEl = document.getElementById('simOfficerTime');

    if (officerDlg && msgEl && fineCard) {
      msgEl.innerHTML = `⚠️ <b>AUTUAÇÃO LAVRADA:</b> ${ait.desc}<br><small style="color:#f39c12">Orientação: ${ait.advice}</small>`;
      if (artEl) artEl.textContent = `${ait.article} — ${ait.title}`;
      if (sevEl) sevEl.textContent = `Gravidade: ${ait.severity.toUpperCase()}`;
      if (ptsEl) ptsEl.textContent = `+${ait.pts} pontos na CNH`;
      if (priceEl) priceEl.textContent = `R$ ${ait.price.toFixed(2).replace('.', ',')}`;
      if (timeEl) timeEl.textContent = ait.time;

      fineCard.style.display = 'flex';
      officerDlg.style.display = 'block';
      cnhState.officerTimer = 6.0;
    }

    roadState.infractionText = `⚠️ AUTO DE INFRAÇÃO: ${ait.article} (+${ait.pts} pts • R$ ${ait.price.toFixed(2)})`;
    roadState.infractionTimer = 4.5;
  }

  function updateCtbDom() {
    const ptsEl = document.getElementById('simCnhPoints');
    const fillEl = document.getElementById('simCnhFill');
    const badgeEl = document.getElementById('simCnhBadge');
    const finesEl = document.getElementById('simFinesVal');
    const countEl = document.getElementById('simAitBadgeCount');

    if (ptsEl) ptsEl.textContent = `${cnhState.points} / 40 pts`;
    if (fillEl) {
      const pct = Math.min(100, (cnhState.points / 40) * 100);
      fillEl.style.width = pct + '%';
      if (cnhState.points >= 40) fillEl.style.background = '#e74c3c';
      else if (cnhState.points >= 30) fillEl.style.background = '#ff6b6b';
      else if (cnhState.points >= 20) fillEl.style.background = '#f1c40f';
      else fillEl.style.background = '#4de89a';
    }

    if (badgeEl) {
      if (cnhState.points >= 40) {
        badgeEl.className = 'sim-cnh-badge suspended';
        badgeEl.textContent = 'CNH SUSPENSA';
      } else if (cnhState.points >= 30) {
        badgeEl.className = 'sim-cnh-badge danger';
        badgeEl.textContent = 'RISCO SUSPENSÃO';
      } else if (cnhState.points >= 20) {
        badgeEl.className = 'sim-cnh-badge warning';
        badgeEl.textContent = 'ADVERTÊNCIA';
      } else {
        badgeEl.className = 'sim-cnh-badge regular';
        badgeEl.textContent = 'CNH REGULAR';
      }
    }

    if (finesEl) {
      finesEl.textContent = `R$ ${cnhState.totalFines.toFixed(2).replace('.', ',')}`;
    }

    if (countEl) {
      countEl.textContent = cnhState.aits.length;
    }
  }

  function openAitModal() {
    const modal = document.getElementById('simAitModal');
    if (!modal) return;
    renderAitModalList();
    modal.style.display = 'flex';
  }

  function closeAitModal() {
    const modal = document.getElementById('simAitModal');
    if (modal) modal.style.display = 'none';
  }

  function renderAitModalList() {
    const listEl = document.getElementById('simAitList');
    const modalPts = document.getElementById('simModalCnhPts');
    const modalFines = document.getElementById('simModalTotalFines');
    const modalStatus = document.getElementById('simModalCnhStatus');

    if (modalPts) modalPts.textContent = `${cnhState.points} / 40`;
    if (modalFines) modalFines.textContent = `R$ ${cnhState.totalFines.toFixed(2).replace('.', ',')}`;
    if (modalStatus) {
      modalStatus.textContent = cnhState.points >= 40 ? 'SUSPENSA' : (cnhState.points >= 20 ? 'EM ALERTA' : 'REGULAR');
      modalStatus.className = 'stat-val ' + (cnhState.points >= 40 ? 'red' : (cnhState.points >= 20 ? 'red' : 'green'));
    }

    if (!listEl) return;
    if (!cnhState.aits.length) {
      listEl.innerHTML = `
        <div class="sim-ait-empty">
          <span>🛡️ Nenhuma infração registrada nesta sessão. Condução exemplar conforme o CTB!</span>
        </div>`;
      return;
    }

    listEl.innerHTML = cnhState.aits.map(ait => `
      <div class="sim-ait-item ${ait.severity}">
        <div class="sim-ait-item-header">
          <span class="sim-ait-item-art">${ait.article} — ${ait.title}</span>
          <span class="sim-ait-item-time">${ait.time}</span>
        </div>
        <div class="sim-ait-item-desc">${ait.desc}</div>
        <div class="sim-ait-item-footer">
          <span>Gravidade: <b>${ait.severity.toUpperCase()}</b></span> • 
          <span>Penalidade: <b>+${ait.pts} pontos</b></span> • 
          <span>Valor: <b>R$ ${ait.price.toFixed(2).replace('.', ',')}</b></span>
        </div>
      </div>
    `).join('');
  }

  function updateRoadHudDom(stage) {
    const spdSign = document.getElementById('simSpeedSignNum');
    if (spdSign) spdSign.textContent = stage.speedLimit;

    const roadBadge = document.getElementById('simRoadBadge');
    if (roadBadge) roadBadge.textContent = '🛣️ ' + stage.name;

    const timerFill = document.getElementById('simRoadTimerFill');
    if (timerFill) {
      const pct = Math.max(0, Math.min(100, (roadState.stageTimer / 20.0) * 100));
      timerFill.style.width = pct + '%';
    }

    const timerText = document.getElementById('simRoadTimerText');
    if (timerText) {
      timerText.innerHTML = `Próxima via em: <b>${Math.ceil(roadState.stageTimer)}s</b>`;
    }

    const statusPill = document.getElementById('simStatusPill');
    if (statusPill) {
      statusPill.className = `sim-status-pill ${roadState.statusLevel}`;
      statusPill.textContent = roadState.statusText;
    }

    const spdDisplay = document.getElementById('simSpeedDisplay');
    if (spdDisplay) spdDisplay.textContent = roadState.speedKmh.toFixed(1) + ' km/h';

    const steerDisp = document.getElementById('simSteeringAngle');
    if (steerDisp) steerDisp.textContent = (roadState.steerAngle > 0 ? '+' : '') + roadState.steerAngle.toFixed(0) + '°';

    const distF = document.getElementById('distFront');
    if (distF) distF.textContent = roadState.frontDistance.toFixed(1) + 'm';
    const distR = document.getElementById('distRear');
    if (distR) distR.textContent = Math.max(0, roadState.lateralDistance).toFixed(2) + 'm (Lat)';

    // Sincronizar pílula ativa da situação no painel
    document.querySelectorAll('.sim-sit-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.stage === stage.id);
    });

    // Botões de Setas
    const btnLeft = document.getElementById('simTurnLeftBtn');
    if (btnLeft) btnLeft.classList.toggle('active', roadState.turnSignal === 'left');

    const btnRight = document.getElementById('simTurnRightBtn');
    if (btnRight) btnRight.classList.toggle('active', roadState.turnSignal === 'right');

    const sigStatus = document.getElementById('simSignalStatus');
    if (sigStatus) {
      if (roadState.turnSignal === 'left') {
        sigStatus.textContent = '⇦ Seta Esquerda Ativa';
        sigStatus.className = 'sim-signal-status active-left';
      } else if (roadState.turnSignal === 'right') {
        sigStatus.textContent = 'Seta Direita Ativa ⇨';
        sigStatus.className = 'sim-signal-status active-right';
      } else {
        sigStatus.textContent = 'Seta Desligada (Teclas Q / E)';
        sigStatus.className = 'sim-signal-status';
      }
    }
  }

  function showRoadStageNotification(stage) {
    showInstruction(`🛣️ <b>Nova Via: ${stage.name} (${stage.speedLimit} km/h)</b> — ${stage.desc}. Respeite pedestres, regras de preferência e sinalização do CTB!`);
  }

  /* ══════════════════════════════════════════════
     RENDERIZAÇÃO TOP VIEW: CENÁRIO DIREÇÃO EM VIAS
     ══════════════════════════════════════════════ */

  function drawRoadTopView(canvas, rs) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (W < 10 || H < 10) return;

    const stage = ROAD_STAGES[rs.stageIndex];
    const totalW = stage.roadWidth + 4.0;
    const totalH = 46.0;
    const scale = Math.min(W / totalW, H / totalH);
    const offX = (W - totalW * scale) / 2;
    const offY = (H - totalH * scale) / 2;

    const wx = x => offX + (x + totalW / 2) * scale;
    const wy = y => offY + (totalH - (y + 12)) * scale;
    const wl = v => v * scale;

    ctx.clearRect(0, 0, W, H);

    // 1. Dark Pixel Background & Calçadas / Acostamento
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, W, H);

    const roadLeft = -stage.roadWidth / 2;
    const roadRight = stage.roadWidth / 2;

    // Calçada esquerda e direita com textura Dark Pixel
    const isCity = stage.isUrban;
    ctx.fillStyle = isCity ? '#121824' : stage.sideColor;
    ctx.fillRect(0, 0, wx(roadLeft), H);
    ctx.fillRect(wx(roadRight), 0, W - wx(roadRight), H);

    // Meio-fio (Curb stone) com realce
    ctx.fillStyle = isCity ? '#243247' : '#2b3628';
    ctx.fillRect(wx(roadLeft) - Math.max(2, wl(0.18)), 0, Math.max(2, wl(0.18)), H);
    ctx.fillRect(wx(roadRight), 0, Math.max(2, wl(0.18)), H);

    // Postes de iluminação pública com cones de luz âmbar nas calçadas (apenas em vias urbanas)
    if (isCity) {
      const lampSpacing = 24.0;
      const lampPhase = (rs.roadScrollY % lampSpacing);
      for (let ly = -10 + lampPhase; ly < 50; ly += lampSpacing) {
        const py = wy(ly);
        ctx.save();
        const lampGradR = ctx.createRadialGradient(wx(roadRight + 0.9), py, wl(0.3), wx(roadRight + 0.9), py, wl(3.8));
        lampGradR.addColorStop(0, 'rgba(255, 180, 60, 0.28)');
        lampGradR.addColorStop(0.5, 'rgba(255, 180, 60, 0.08)');
        lampGradR.addColorStop(1, 'rgba(255, 180, 60, 0)');
        ctx.fillStyle = lampGradR;
        ctx.beginPath();
        ctx.arc(wx(roadRight + 0.9), py, wl(3.8), 0, Math.PI * 2);
        ctx.fill();

        const lampGradL = ctx.createRadialGradient(wx(roadLeft - 0.9), py, wl(0.3), wx(roadLeft - 0.9), py, wl(3.8));
        lampGradL.addColorStop(0, 'rgba(255, 180, 60, 0.28)');
        lampGradL.addColorStop(0.5, 'rgba(255, 180, 60, 0.08)');
        lampGradL.addColorStop(1, 'rgba(255, 180, 60, 0)');
        ctx.fillStyle = lampGradL;
        ctx.beginPath();
        ctx.arc(wx(roadLeft - 0.9), py, wl(3.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Pista de asfalto com brilho especular
    ctx.fillStyle = stage.tarmac;
    ctx.fillRect(wx(roadLeft), 0, wl(stage.roadWidth), H);

    // Borda esquerda (amarela) e borda direita (branca)
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = Math.max(2, wl(0.12));
    ctx.beginPath(); ctx.moveTo(wx(roadLeft), 0); ctx.lineTo(wx(roadLeft), H); ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, wl(0.12));
    ctx.beginPath(); ctx.moveTo(wx(roadRight), 0); ctx.lineTo(wx(roadRight), H); ctx.stroke();

    // Faixas seccionadas com rolagem contínua
    ctx.strokeStyle = stage.markingColor;
    ctx.lineWidth = Math.max(1.5, wl(0.08));
    ctx.setLineDash([wl(1.6), wl(1.4)]);
    ctx.lineDashOffset = -wl(rs.roadScrollY);

    const laneCount = stage.lanes;
    for (let i = 1; i < laneCount; i++) {
      const lx = roadLeft + i * stage.laneWidth;
      ctx.beginPath();
      ctx.moveTo(wx(lx), 0);
      ctx.lineTo(wx(lx), H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ── SITUAÇÃO 3: CRUZAMENTO COM VIA PERPENDICULAR & PLACA R-1 (PARADA OBRIGATÓRIA - PARE) ──
    if (stage.id === 'coletora' && rs.intersection.y > -15 && rs.intersection.y < 50) {
      const intY = wy(rs.intersection.y);
      const intH = wl(7.0);

      ctx.save();
      // Asfalto da via transversal cruzando de fora a fora
      ctx.fillStyle = '#182024';
      ctx.fillRect(0, intY - intH / 2, W, intH);

      // Meio-fios do cruzamento
      ctx.strokeStyle = '#2b3642';
      ctx.lineWidth = Math.max(2, wl(0.15));
      ctx.beginPath();
      ctx.moveTo(0, intY - intH / 2); ctx.lineTo(wx(roadLeft), intY - intH / 2);
      ctx.moveTo(wx(roadRight), intY - intH / 2); ctx.lineTo(W, intY - intH / 2);
      ctx.moveTo(0, intY + intH / 2); ctx.lineTo(wx(roadLeft), intY + intH / 2);
      ctx.moveTo(wx(roadRight), intY + intH / 2); ctx.lineTo(W, intY + intH / 2);
      ctx.stroke();

      // Linha de retenção (Stop Bar) antes do cruzamento
      const stopBarY = wy(rs.intersection.y + 4.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx(roadLeft), stopBarY, wl(stage.roadWidth), Math.max(3, wl(0.48)));

      // Pintura "PARE" no asfalto em letras brancas
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, wl(1.2))}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P A R E', wx(0), stopBarY + Math.max(8, wl(1.4)));

      // Placa R-1 Octogonal Vermelha na calçada direita
      const signX = wx(roadRight + 0.8);
      const signY = stopBarY;
      const signR = Math.max(7, wl(0.65));
      ctx.fillStyle = '#cc0000';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a < 8; a++) {
        const ang = (a * 45 + 22.5) * DEG;
        const sx = signX + Math.cos(ang) * signR;
        const sy = signY + Math.sin(ang) * signR;
        if (a === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(5, signR * 0.7)}px Manrope, sans-serif`;
      ctx.fillText('PARE', signX, signY);

      // Veículo transversal cruzando com preferência (Art. 29-III)
      if (rs.intersection.crossingCar.active) {
        const cc = rs.intersection.crossingCar;
        const ccX = wx(cc.x);
        const ccY = intY;
        const ccW = wl(4.2);
        const ccH = wl(1.85);

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(ccX, ccY + 2, ccW * 0.52, ccH * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        drawCarTop(ctx, ccX, ccY, ccW, ccH, 90 * DEG, '#b45309', cc.color, '#fef3c7', '#dc2626', 'D');

        // Badge de preferência
        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        roundRect(ctx, ccX - 60, ccY - 26, 120, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b'; ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 8px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚗 Veículo com Preferência (Dir)', ccX, ccY - 14);
        ctx.restore();
      }
      ctx.restore();
    }

    // ── SITUAÇÃO 5: PASSAGEM DE NÍVEL FERROVIÁRIA (PASSAGEM DE NÍVEL - TREM DE CARGA - ART. 212) ──
    if (stage.id === 'ferrovia' && rs.railCrossing.y > -15 && rs.railCrossing.y < 50) {
      const rcY = wy(rs.railCrossing.y);
      const rcH = wl(5.5);

      ctx.save();
      // Leito de brita / cascalho escuro
      ctx.fillStyle = '#22292f';
      ctx.fillRect(wx(roadLeft) - wl(1.5), rcY - rcH / 2, wl(stage.roadWidth + 3.0), rcH);

      // Dormentes de madeira perpendiculares à rodovia (paralelos aos trilhos)
      ctx.fillStyle = '#423122';
      const tieW = wl(0.35);
      const tieGap = wl(0.75);
      for (let tx = wx(roadLeft) - wl(1.2); tx < wx(roadRight) + wl(1.2); tx += tieGap) {
        ctx.fillRect(tx, rcY - rcH * 0.45, tieW, rcH * 0.9);
      }

      // Trilhos de aço prateados cruzando toda a via
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(2, wl(0.12));
      const rail1Y = rcY - wl(1.1);
      const rail2Y = rcY + wl(1.1);
      ctx.beginPath();
      ctx.moveTo(0, rail1Y); ctx.lineTo(W, rail1Y);
      ctx.moveTo(0, rail2Y); ctx.lineTo(W, rail2Y);
      ctx.stroke();

      // Linha de retenção férrea
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx(roadLeft), wy(rs.railCrossing.y + 3.8), wl(stage.roadWidth), Math.max(3, wl(0.45)));

      // Sinalização Rodoferroviária: Cruz de Santo André (A-39) com luzes piscantes (wig-wag)
      const cxX = wx(roadRight + 0.9);
      const cxY = rcY;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cxX - 9, cxY - 9); ctx.lineTo(cxX + 9, cxY + 9);
      ctx.moveTo(cxX + 9, cxY - 9); ctx.lineTo(cxX - 9, cxY + 9);
      ctx.stroke();

      // Luzes vermelhas alternadas
      const wigWagPhase = rs.railCrossing.lightPhase;
      ctx.fillStyle = wigWagPhase ? '#ff2222' : '#450a0a';
      if (wigWagPhase) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(cxX - 6, cxY + 11, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = !wigWagPhase ? '#ff2222' : '#450a0a';
      if (!wigWagPhase) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(cxX + 6, cxY + 11, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Cancela Rodoferroviária (se abaixada bloqueando a pista)
      if (rs.railCrossing.barrierDown) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(3, wl(0.24));
        ctx.beginPath();
        ctx.moveTo(wx(roadRight + 0.4), rcY + wl(2.6));
        ctx.lineTo(wx(roadLeft), rcY + wl(2.6));
        ctx.stroke();

        ctx.strokeStyle = '#dc2626';
        ctx.setLineDash([wl(0.8), wl(0.8)]);
        ctx.beginPath();
        ctx.moveTo(wx(roadRight + 0.4), rcY + wl(2.6));
        ctx.lineTo(wx(roadLeft), rcY + wl(2.6));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Trem de Carga passando
      if (rs.railCrossing.trainPassing) {
        const trainPx = wx(rs.railCrossing.trainX);
        const trainW = wl(38.0);
        const trainH = wl(3.2);

        // Locomotiva pesada azul escuro
        ctx.fillStyle = '#0f2942';
        roundRect(ctx, trainPx, rcY - trainH / 2, trainW, trainH, 4);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Farol amarelo brilhante da locomotiva
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#facc15'; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(trainPx + trainW, rcY, Math.max(3, wl(0.45)), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Vagões de carga com detalhes
        ctx.fillStyle = '#1e3a5f';
        const numWagons = 5;
        const wagonW = trainW / numWagons;
        for (let w = 0; w < numWagons; w++) {
          ctx.strokeStyle = '#0284c7';
          ctx.strokeRect(trainPx + w * wagonW + 2, rcY - trainH / 2 + 2, wagonW - 4, trainH - 4);
        }

        // Tag do Trem
        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        roundRect(ctx, trainPx + trainW * 0.4, rcY - trainH - 18, 140, 20, 4);
        ctx.fill();
        ctx.strokeStyle = '#ef4444'; ctx.stroke();
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 8.5px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚂 Trem de Carga em Trânsito (Art. 212)', trainPx + trainW * 0.4 + 70, rcY - trainH - 5);
      }
      ctx.restore();
    }

    // ── SITUAÇÃO 1: ÁREA ESCOLAR (ZONA 30 - ÔNIBUS ESCOLAR, GUARDA APITANDO E CRIANÇAS - CTB ART. 220-XIV) ──
    if (stage.id === 'escolar' && rs.schoolBus.y > -15 && rs.schoolBus.y < 50) {
      const sb = rs.schoolBus;
      const sbX = wx(sb.x);
      const sbY = wy(sb.y);
      const sbW = wl(sb.w);
      const sbL = wl(sb.l);

      ctx.save();
      // Sombra projetada do ônibus
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(sbX, sbY + 3, sbW * 0.58, sbL * 0.52, 0, 0, Math.PI * 2); ctx.fill();

      // Carroceria Amarelo Escolar Oficial
      ctx.fillStyle = '#f59e0b';
      roundRect(ctx, sbX - sbW / 2, sbY - sbL / 2, sbW, sbL, Math.max(3, sbW * 0.15));
      ctx.fill();

      // Teto branco com saídas de ar
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, sbX - sbW * 0.35, sbY - sbL * 0.38, sbW * 0.7, sbL * 0.72, 3);
      ctx.fill();

      // Faixa preta lateral com dístico "ESCOLAR"
      ctx.fillStyle = '#111827';
      ctx.fillRect(sbX - sbW * 0.48, sbY - sbL * 0.15, sbW * 0.96, sbL * 0.28);
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${Math.max(6, sbW * 0.22)}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ESCOLAR', sbX, sbY);

      // Luzes de advertência e pisca-alerta piscando em vermelho/âmbar
      const flash = (Math.floor(performance.now() / 250) % 2) === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#7f1d1d';
      if (flash) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(sbX - sbW * 0.35, sbY - sbL * 0.46, Math.max(2, sbW * 0.1), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sbX + sbW * 0.35, sbY - sbL * 0.46, Math.max(2, sbW * 0.1), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Tag do Ônibus Escolar
      ctx.fillStyle = 'rgba(20,20,10,0.92)';
      roundRect(ctx, sbX - 60, sbY - sbL * 0.58, 120, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 8px Manrope, sans-serif';
      ctx.fillText('🚌 Ônibus Escolar • Embarque', sbX, sbY - sbL * 0.58 + 12);
      ctx.restore();

      // Faixa Escolar zebrada com "ESCOLAR" no asfalto
      const cwY = wy(rs.trafficWarden.y);
      const cwH = wl(3.4);

      ctx.save();
      // Linha de retenção
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx(roadLeft), wy(rs.trafficWarden.y + 2.4), wl(stage.roadWidth), Math.max(2, wl(0.42)));

      // Pintura no chão: "ESCOLAR" em amarelo
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${Math.max(9, wl(1.0))}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('E S C O L A R', wx(0), wy(rs.trafficWarden.y + 4.2));

      // Zebras amarelas e brancas alternadas
      const stripeW = wl(0.46);
      const stripeGap = wl(0.46);
      const numStripes = Math.floor(wl(stage.roadWidth) / (stripeW + stripeGap));
      for (let s = 0; s < numStripes; s++) {
        const sx = wx(roadLeft) + s * (stripeW + stripeGap) + stripeGap * 0.5;
        ctx.fillStyle = (s % 2 === 0) ? 'rgba(255, 255, 255, 0.95)' : 'rgba(251, 191, 36, 0.92)';
        ctx.fillRect(sx, cwY - cwH / 2, stripeW, cwH);
      }

      // Guarda de Trânsito no meio da pista
      if (rs.trafficWarden.hasWarden) {
        const tw = rs.trafficWarden;
        const twX = wx(tw.x);
        const twY = cwY;

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(twX, twY + 2, wl(0.42), wl(0.22), 0, 0, Math.PI * 2); ctx.fill();

        // Calça azul marinho
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(twX - wl(0.16), twY - wl(0.25), wl(0.12), wl(0.3));
        ctx.fillRect(twX + wl(0.04), twY - wl(0.25), wl(0.12), wl(0.3));

        // Colete Amarelo Fluorescente de Alta Visibilidade (Refletivo)
        ctx.fillStyle = '#eab308';
        roundRect(ctx, twX - wl(0.26), twY - wl(0.68), wl(0.52), wl(0.44), 3);
        ctx.fill();

        // Faixas refletivas prata
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(twX - wl(0.22), twY - wl(0.52), wl(0.44), 2);

        // Braço erguido fazendo sinal regulamentar GA-01 (Parada para todos os veículos)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, wl(0.1));
        ctx.beginPath();
        ctx.moveTo(twX, twY - wl(0.55));
        ctx.lineTo(twX + wl(0.38), twY - wl(0.95));
        ctx.stroke();

        // Placa ou luva branca na ponta do braço
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(twX + wl(0.38), twY - wl(0.95), Math.max(3, wl(0.14)), 0, Math.PI * 2); ctx.fill();

        // Cabeça com quepe policial
        ctx.fillStyle = '#ffdfba';
        ctx.beginPath(); ctx.arc(twX, twY - wl(0.85), wl(0.22), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f2942'; // quepe
        ctx.beginPath(); ctx.arc(twX, twY - wl(0.92), wl(0.24), Math.PI, 0); ctx.fill();

        // Tag do Guarda com som de apito
        ctx.fillStyle = 'rgba(15,23,42,0.94)';
        roundRect(ctx, twX - 68, twY - wl(1.35), 136, 22, 4);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8'; ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 8px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👮 Guarda de Trânsito • APITO (PARE)', twX, twY - wl(1.35) + 14);
      }

      // Crianças com mochilas atravessando
      rs.schoolChildren.forEach((child, idx) => {
        const chX = wx(child.x);
        const chY = cwY + (idx === 0 ? -wl(0.4) : wl(0.4));

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(chX, chY + 2, wl(0.25), wl(0.14), 0, 0, Math.PI * 2); ctx.fill();

        // Pernas
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(chX - wl(0.1), chY - wl(0.18), wl(0.08), wl(0.2));
        ctx.fillRect(chX + wl(0.02), chY - wl(0.18), wl(0.08), wl(0.2));

        // Tronco da criança
        ctx.fillStyle = child.shirt;
        roundRect(ctx, chX - wl(0.16), chY - wl(0.45), wl(0.32), wl(0.28), 2);
        ctx.fill();

        // Mochila escolar nas costas
        ctx.fillStyle = child.backpack;
        roundRect(ctx, chX + wl(0.1), chY - wl(0.42), wl(0.14), wl(0.24), 2);
        ctx.fill();

        // Cabeça
        ctx.fillStyle = '#ffdfba';
        ctx.beginPath(); ctx.arc(chX, chY - wl(0.58), wl(0.16), 0, Math.PI * 2); ctx.fill();
      });

      ctx.restore();
    }

    // ── SITUAÇÃO 2: IDOSO COM BENGALA (ACESSIBILIDADE & PRIORIDADE - CTB ART. 214-II) ──
    if (stage.isUrban && rs.elderlyPedestrian.y > -10 && rs.elderlyPedestrian.y < 45) {
      const ep = rs.elderlyPedestrian;
      const epX = wx(ep.x);
      const epY = wy(ep.y);

      ctx.save();
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(epX, epY + 2, wl(0.36), wl(0.18), 0, 0, Math.PI * 2); ctx.fill();

      // Pernas
      ctx.fillStyle = '#334155';
      ctx.fillRect(epX - wl(0.14), epY - wl(0.2), wl(0.1), wl(0.25));
      ctx.fillRect(epX + wl(0.04), epY - wl(0.2), wl(0.1), wl(0.25));

      // Sobretudo marrom
      ctx.fillStyle = '#78350f';
      roundRect(ctx, epX - wl(0.22), epY - wl(0.58), wl(0.44), wl(0.38), 2);
      ctx.fill();

      // Cabeça com cabelos brancos / prateados
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath(); ctx.arc(epX, epY - wl(0.74), wl(0.2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e2e8f0'; // Cabelo branco
      ctx.beginPath(); ctx.arc(epX, epY - wl(0.80), wl(0.2), Math.PI, 0); ctx.fill();

      // Bengala de madeira
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = Math.max(1.5, wl(0.06));
      ctx.beginPath();
      ctx.moveTo(epX + wl(0.24), epY - wl(0.45));
      ctx.lineTo(epX + wl(0.28), epY);
      ctx.stroke();

      // Tag de Prioridade Absoluta
      ctx.fillStyle = 'rgba(30,20,10,0.92)';
      roundRect(ctx, epX - 58, epY - wl(1.15), 116, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👴 Idoso com Bengala (Art. 214-II)', epX, epY - wl(1.15) + 12);
      ctx.restore();
    }

    // ── SITUAÇÃO 4: AMBULÂNCIA SAMU PEDINDO PASSAGEM (CTB ART. 189) ──
    if (rs.ambulance.active && rs.ambulance.y > -35 && rs.ambulance.y < 50) {
      const amb = rs.ambulance;
      const ambX = wx(amb.x);
      const ambY = wy(amb.y);
      const ambW = wl(2.2);
      const ambL = wl(5.6);

      ctx.save();
      // Aura de reflexo azul nos arredores da pista
      const strobeState = (Math.floor(performance.now() / 120) % 2) === 0;
      const ambAura = ctx.createRadialGradient(ambX, ambY, wl(0.5), ambX, ambY, wl(5.5));
      ambAura.addColorStop(0, strobeState ? 'rgba(0, 190, 255, 0.45)' : 'rgba(255, 30, 30, 0.35)');
      ambAura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ambAura;
      ctx.beginPath(); ctx.arc(ambX, ambY, wl(5.5), 0, Math.PI * 2); ctx.fill();

      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.ellipse(ambX, ambY + 2, ambW * 0.55, ambL * 0.52, 0, 0, Math.PI * 2); ctx.fill();

      // Furgão Branco SAMU
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, ambX - ambW / 2, ambY - ambL / 2, ambW, ambL, 4);
      ctx.fill();

      // Faixas refletivas Laranja e Vermelha do SAMU 192
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(ambX - ambW / 2, ambY - ambL * 0.25, ambW, ambL * 0.12);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(ambX - ambW / 2, ambY - ambL * 0.13, ambW, ambL * 0.12);

      // Estrela da Vida Azul no teto
      ctx.fillStyle = '#0284c7';
      ctx.beginPath(); ctx.arc(ambX, ambY, Math.max(3, ambW * 0.2), 0, Math.PI * 2); ctx.fill();

      // Giroflex Estroboscópico Azul / Vermelho no teto
      ctx.fillStyle = strobeState ? '#00f2fe' : '#033366';
      if (strobeState) { ctx.shadowColor = '#00f2fe'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(ambX - ambW * 0.28, ambY - ambL * 0.35, Math.max(3, ambW * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = !strobeState ? '#ff2222' : '#660a0a';
      if (!strobeState) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(ambX + ambW * 0.28, ambY - ambL * 0.35, Math.max(3, ambW * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Tag de Prioridade de Emergência
      ctx.fillStyle = 'rgba(30,10,12,0.94)';
      roundRect(ctx, ambX - 65, ambY - ambL * 0.65, 130, 20, 4);
      ctx.fill();
      ctx.strokeStyle = '#ef4444'; ctx.stroke();
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 8px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 SAMU 192 • Dê Passagem (Art. 189)', ambX, ambY - ambL * 0.65 + 13);
      ctx.restore();
    }

    // 4. SEMÁFORO INTELIGENTE (CTB ART. 208) - em vias arteriais
    if (stage.id === 'arterial' && rs.trafficLight.y > -10 && rs.trafficLight.y < 45) {
      const tl = rs.trafficLight;
      const tY = wy(tl.y);
      const tX = wx(roadRight + 0.6);

      ctx.save();
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(tX - 2, tY - wl(2), 4, wl(4));
      ctx.fillRect(wx(roadRight - 1.5), tY - wl(2), wl(2.1), 3);

      const boxW = Math.max(14, wl(0.65));
      const boxH = Math.max(34, wl(1.8));
      const boxX = wx(roadRight - 1.2) - boxW / 2;
      const boxY = tY - wl(2.2);

      ctx.fillStyle = '#111822';
      ctx.strokeStyle = '#3b4d66';
      ctx.lineWidth = 1;
      roundRect(ctx, boxX, boxY, boxW, boxH, 3);
      ctx.fill(); ctx.stroke();

      const radius = Math.max(3, boxW * 0.28);
      const isRed = tl.state === 'red';
      const isYel = tl.state === 'yellow';
      const isGrn = tl.state === 'green';

      ctx.fillStyle = isRed ? '#ff2222' : '#3d0a0a';
      if (isRed) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(boxX + boxW / 2, boxY + boxH * 0.22, radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isYel ? '#f1c40f' : '#423508';
      if (isYel) { ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(boxX + boxW / 2, boxY + boxH * 0.50, radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isGrn ? '#4de89a' : '#083318';
      if (isGrn) { ctx.shadowColor = '#4de89a'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(boxX + boxW / 2, boxY + boxH * 0.78, radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 5. PEDESTRES CHIBI (SOMENTE DENTRO DA CIDADE, NUNCA EM RODOVIAS)
    if (stage.hasPedestrians) {
      rs.pedestrians.forEach(ped => {
        if (ped.y > -8 && ped.y < 42) {
          const px = wx(ped.x);
          const py = wy(ped.y);
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath(); ctx.ellipse(px, py + 2, wl(0.35), wl(0.18), 0, 0, Math.PI * 2); ctx.fill();

          const stepOffset = Math.sin(ped.animFrame) * wl(0.15);
          ctx.fillStyle = ped.pants;
          ctx.fillRect(px - wl(0.14) + stepOffset, py - wl(0.2), wl(0.1), wl(0.25));
          ctx.fillRect(px + wl(0.04) - stepOffset, py - wl(0.2), wl(0.1), wl(0.25));

          ctx.fillStyle = ped.shirt;
          roundRect(ctx, px - wl(0.22), py - wl(0.55), wl(0.44), wl(0.35), 2);
          ctx.fill();

          ctx.fillStyle = '#ffdfba';
          ctx.beginPath(); ctx.arc(px, py - wl(0.72), wl(0.22), 0, Math.PI * 2); ctx.fill();

          ctx.fillStyle = '#2c1810';
          ctx.beginPath(); ctx.arc(px, py - wl(0.78), wl(0.22), Math.PI, 0); ctx.fill();

          if (ped.isCrossing) {
            ctx.fillStyle = '#ffaa33';
            ctx.font = 'bold 8px Manrope, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🚶 Travessia (Art. 214)', px, py - wl(1.05));
          }
          ctx.restore();
        }
      });
    }

    // 6. CICLISTA COM RAIO LEGAL DE 1,50M (CTB ART. 201)
    if (stage.isUrban && rs.cyclist.y > -8 && rs.cyclist.y < 42) {
      const cyc = rs.cyclist;
      const cx = wx(cyc.x);
      const cy = wy(cyc.y);
      const latDist = Math.abs(cyc.x - rs.playerX) - (VEHICLE.width / 2);
      const isTooClose = Math.abs(cyc.y) < 4.0 && latDist < 1.50;

      ctx.save();
      ctx.strokeStyle = isTooClose ? '#e74c3c' : 'rgba(0, 242, 254, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      if (isTooClose) { ctx.shadowColor = '#e74c3c'; ctx.shadowBlur = 8; }
      ctx.beginPath();
      ctx.arc(cx, cy, wl(1.50 + 0.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      ctx.fillStyle = '#111111';
      ctx.fillRect(cx - wl(0.08), cy - wl(0.75), wl(0.16), wl(0.4));
      ctx.fillRect(cx - wl(0.08), cy + wl(0.35), wl(0.16), wl(0.4));
      ctx.strokeStyle = cyc.color;
      ctx.lineWidth = Math.max(2, wl(0.08));
      ctx.beginPath();
      ctx.moveTo(cx, cy - wl(0.5)); ctx.lineTo(cx, cy + wl(0.5));
      ctx.stroke();

      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - wl(0.28), cy + wl(0.3)); ctx.lineTo(cx + wl(0.28), cy + wl(0.3)); ctx.stroke();

      ctx.fillStyle = '#22c55e';
      roundRect(ctx, cx - wl(0.22), cy - wl(0.2), wl(0.44), wl(0.35), 2);
      ctx.fill();

      ctx.fillStyle = cyc.color;
      ctx.beginPath(); ctx.arc(cx, cy - wl(0.05), wl(0.2), 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(cx, cy - wl(0.75), Math.max(2, wl(0.1)), 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = isTooClose ? 'rgba(231,76,60,0.92)' : 'rgba(8,24,32,0.85)';
      roundRect(ctx, cx + 8, cy - 10, 115, 20, 4);
      ctx.fill();
      ctx.strokeStyle = isTooClose ? '#ff6b6b' : '#00f2fe';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Manrope, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(isTooClose ? '⚠️ PERIGO < 1,50m' : '🚴 Ciclista: 1,50m', cx + 13, cy + 3);
      ctx.restore();
    }

    // 7. ANIMAL NA VIA (CTB ART. 220-XI - CÃO CARAMELO NA CIDADE / CAPIVARA NO ACOSTAMENTO DA RODOVIA)
    if (rs.animal.y > -8 && rs.animal.y < 42) {
      const an = rs.animal;
      const ax = wx(an.x);
      const ay = wy(an.y);

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(ax, ay + 2, wl(0.4), wl(0.22), 0, 0, Math.PI * 2); ctx.fill();

      const isDog = stage.isUrban;
      if (isDog) {
        ctx.fillStyle = '#d97706';
        roundRect(ctx, ax - wl(0.22), ay - wl(0.38), wl(0.44), wl(0.6), 3);
        ctx.fill();
        ctx.beginPath(); ctx.arc(ax, ay + wl(0.32), wl(0.2), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.arc(ax - wl(0.16), ay + wl(0.36), wl(0.08), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ax + wl(0.16), ay + wl(0.36), wl(0.08), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, ay - wl(0.38)); ctx.lineTo(ax + Math.sin(an.tailWag) * wl(0.25), ay - wl(0.65)); ctx.stroke();
      } else {
        ctx.fillStyle = '#78350f';
        roundRect(ctx, ax - wl(0.32), ay - wl(0.42), wl(0.64), wl(0.75), 4);
        ctx.fill();
        ctx.beginPath(); ctx.arc(ax, ay + wl(0.4), wl(0.26), 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = 'rgba(20,15,5,0.88)';
      roundRect(ctx, ax - 50, ay - wl(0.85), 100, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isDog ? '🐾 Cão (Reduza Art. 220)' : '🐾 Capivara (Art. 220)', ax, ay - wl(0.85) + 12);
      ctx.restore();
    }

    // 8. VIATURA DA POLÍCIA / PRF NO ACOSTAMENTO
    if (rs.policeCruiser.y > -8 && rs.policeCruiser.y < 42) {
      const pc = rs.policeCruiser;
      const px = wx(pc.x);
      const py = wy(pc.y);
      const pw = wl(VEHICLE.width);
      const pl = wl(VEHICLE.length);

      ctx.save();
      drawCarTop(ctx, px, py, pw, pl, 0, '#091522', '#1b2a4a', '#cbd5e1', '#ff2222', 'D');

      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(px - pw * 0.35, py - pl * 0.15, pw * 0.7, pl * 0.08);

      const timeMs = performance.now();
      const flashState = (Math.floor(timeMs / 180) % 2) === 0;

      ctx.fillStyle = flashState ? '#00f2fe' : '#033366';
      if (flashState) { ctx.shadowColor = '#00f2fe'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(px - pw * 0.22, py, Math.max(3, pw * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = !flashState ? '#ff2222' : '#660a0a';
      if (!flashState) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(px + pw * 0.22, py, Math.max(3, pw * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(7,16,28,0.92)';
      roundRect(ctx, px - 60, py - pl * 0.65, 120, 20, 4);
      ctx.fill();
      ctx.strokeStyle = '#00f2fe'; ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚔 Fiscalização PRF Silva', px, py - pl * 0.65 + 13);
      ctx.restore();
    }

    // 9. Sinal de velocidade pintado no asfalto (R-19)
    const signY = 22 - (rs.roadScrollY % 24);
    ctx.save();
    ctx.strokeStyle = '#e74c3c';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, wl(0.15));
    ctx.beginPath();
    ctx.arc(wx(0), wy(signY), wl(1.1), 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.font = `bold ${Math.max(9, wl(0.95))}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stage.speedLimit, wx(0), wy(signY));
    ctx.restore();

    // 10. Veículos do tráfego (com efeito de colisão: piscam em vermelho por 2s)
    const isRedBlink = rs.collisionFlashTimer > 0 && (Math.floor(rs.collisionFlashTimer * 8) % 2 === 0);

    const drawSurroundingCarWithFlash = (cand, baseBg, roofBg, trimBg, tailBg) => {
      const isThisColliding = isRedBlink && (rs.collidingCarId === cand.id);
      if (isThisColliding) {
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 22;
        drawCarTop(ctx, wx(cand.x), wy(cand.y), wl(cand.w), wl(cand.l), 0, '#991b1b', '#ef4444', '#fca5a5', '#ff0000', 'D');
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        roundRect(ctx, wx(cand.x) - wl(cand.w) / 2, wy(cand.y) - wl(cand.l) / 2, wl(cand.w), wl(cand.l), 4);
        ctx.fill();
        ctx.restore();
      } else {
        drawCarTop(ctx, wx(cand.x), wy(cand.y), wl(cand.w), wl(cand.l), 0, baseBg, roofBg, trimBg, tailBg, 'D');
      }
    };

    if (rs.frontCar.active !== false) drawSurroundingCarWithFlash(rs.frontCar, '#1b4f72', rs.frontCar.color, '#d4e6f1', '#e74c3c');
    if (rs.rightCar.active !== false) drawSurroundingCarWithFlash(rs.rightCar, '#78281f', rs.rightCar.color, '#fadbd8', '#e74c3c');
    if (rs.leftCar.active !== false) drawSurroundingCarWithFlash(rs.leftCar, '#7e5109', rs.leftCar.color, '#fdebd0', '#e74c3c');
    if (rs.rearCar.active !== false) drawSurroundingCarWithFlash(rs.rearCar, '#34495e', rs.rearCar.color, '#ebedef', '#e74c3c');

    // 10A. Motociclista em Top View (CTB Art. 29 e 40)
    if (rs.motorcycle.active && rs.motorcycle.y > -25.0 && rs.motorcycle.y < 50.0) {
      const moto = rs.motorcycle;
      const mX = wx(moto.x);
      const mY = wy(moto.y);
      const mW = Math.max(7, wl(moto.w));
      const mL = Math.max(16, wl(moto.l));
      ctx.save();
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(mX, mY, mW * 0.7, mL * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      // Chassi da moto
      ctx.fillStyle = moto.color;
      roundRect(ctx, mX - mW * 0.35, mY - mL * 0.5, mW * 0.7, mL, 3);
      ctx.fill();
      // Rodas dianteira e traseira
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mX - 2, mY - mL * 0.5, 4, Math.max(4, mL * 0.25));
      ctx.fillRect(mX - 2, mY + mL * 0.25, 4, Math.max(4, mL * 0.25));
      // Guidão e retrovisores
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mX - mW * 0.7, mY - mL * 0.25); ctx.lineTo(mX + mW * 0.7, mY - mL * 0.25); ctx.stroke();
      // Capacete do motociclista
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(mX, mY, Math.max(3, mW * 0.42), 0, Math.PI * 2); ctx.fill();
      // Viseira escura
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mX - mW * 0.25, mY - mW * 0.45, mW * 0.5, 2.5);
      // Farol dianteiro aceso (Art. 40, § 1º)
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(mX, mY - mL * 0.5, 3, 0, Math.PI * 2); ctx.fill();
      // Lanterna traseira vermelha
      ctx.fillStyle = moto.braking ? '#ef4444' : '#b91c1c';
      ctx.fillRect(mX - 3, mY + mL * 0.5 - 2, 6, 3);
      ctx.restore();
    }

    // 10B. Caminhão Pesado / Carreta em Top View (CONTRAN Art. 61: 80 km/h)
    if (rs.truck.active && rs.truck.y > -35.0 && rs.truck.y < 55.0) {
      const trk = rs.truck;
      const tX = wx(trk.x);
      const tY = wy(trk.y);
      const tW = wl(trk.w);
      const tL = wl(trk.l);

      ctx.save();
      const isTrkColliding = isRedBlink && (rs.collidingCarId === 'truck');
      if (isTrkColliding) {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 24;
      }

      // Sombra do caminhão
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(tX, tY, tW * 0.6, tL * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cavalo mecânico (cabine frontal)
      const cabL = tL * 0.28;
      const cabY = tY - tL * 0.5 + cabL * 0.5;
      ctx.fillStyle = isTrkColliding ? '#dc2626' : trk.color;
      roundRect(ctx, tX - tW * 0.46, cabY - cabL * 0.5, tW * 0.92, cabL, 5);
      ctx.fill();

      // Para-brisa da cabine
      ctx.fillStyle = 'rgba(160,220,255,0.55)';
      ctx.fillRect(tX - tW * 0.38, cabY - cabL * 0.44, tW * 0.76, cabL * 0.25);

      // Carreta / Baú
      const trailerL = tL * 0.70;
      const trailerY = tY + tL * 0.5 - trailerL * 0.5;
      ctx.fillStyle = isTrkColliding ? '#b91c1c' : trk.trailerColor;
      roundRect(ctx, tX - tW * 0.48, trailerY - trailerL * 0.5, tW * 0.96, trailerL, 4);
      ctx.fill();

      // Faixas refletivas CONTRAN laterais (vermelho e branco)
      const numFlankStripes = Math.floor(trailerL / Math.max(3, wl(0.6)));
      for (let s = 0; s < numFlankStripes; s++) {
        const sy = (trailerY - trailerL * 0.5) + s * Math.max(3, wl(0.6));
        ctx.fillStyle = (s % 2 === 0) ? '#ef4444' : '#ffffff';
        ctx.fillRect(tX - tW * 0.48, sy, 2, Math.max(3, wl(0.6)));
        ctx.fillRect(tX + tW * 0.48 - 2, sy, 2, Math.max(3, wl(0.6)));
      }

      // Parachoque traseiro com faixas zebradas CONTRAN
      const numRearStripes = Math.floor(tW / Math.max(3, wl(0.4)));
      for (let s = 0; s < numRearStripes; s++) {
        const sx = (tX - tW * 0.48) + s * Math.max(3, wl(0.4));
        ctx.fillStyle = (s % 2 === 0) ? '#ef4444' : '#ffffff';
        ctx.fillRect(sx, trailerY + trailerL * 0.5 - 3, Math.max(3, wl(0.4)), 3);
      }

      // Tag do Caminhão Pesado
      ctx.fillStyle = 'rgba(15,23,42,0.92)';
      roundRect(ctx, tX - 65, tY - tL * 0.56, 130, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#0284c7'; ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚛 Carreta (Art. 61: 80 km/h)', tX, tY - tL * 0.56 + 12);

      ctx.restore();
    }

    // 11. Veículo do Jogador (com efeito de colisão: pisca em vermelho por 2s)
    const playerPx = wx(rs.playerX);
    const playerPy = wy(0);
    const playerW = wl(VEHICLE.width);
    const playerL = wl(VEHICLE.length);

    // Fachos de farol iluminando a via
    ctx.save();
    const beamGrad = ctx.createRadialGradient(playerPx, playerPy - playerL * 0.4, wl(1), playerPx, playerPy - playerL * 2.8, wl(8));
    beamGrad.addColorStop(0, 'rgba(255,255,220,0.35)');
    beamGrad.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(playerPx - playerW * 0.45, playerPy - playerL * 0.4);
    ctx.lineTo(playerPx - playerW * 1.5, playerPy - playerL * 3.2);
    ctx.lineTo(playerPx + playerW * 1.5, playerPy - playerL * 3.2);
    ctx.lineTo(playerPx + playerW * 0.45, playerPy - playerL * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (isRedBlink) {
      ctx.save();
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 26;
      drawCarTop(ctx, playerPx, playerPy, playerW, playerL, (rs.steerAngle * 0.15) * DEG, '#991b1b', '#ef4444', '#fecaca', '#ff0000', 'D', rs.steerAngle);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.48)';
      roundRect(ctx, playerPx - playerW / 2, playerPy - playerL / 2, playerW, playerL, 4);
      ctx.fill();
      ctx.restore();
    } else {
      drawCarTop(ctx, playerPx, playerPy, playerW, playerL, (rs.steerAngle * 0.15) * DEG, '#0e4331', '#1f9d68', '#4de89a', '#e74c3c', 'D', rs.steerAngle);
    }

    // 13. Medidor de distância do carro à frente
    if (rs.frontCar.y > 0 && rs.frontCar.y < 40) {
      const frontCenterY = wy(rs.frontCar.y - rs.frontCar.l * 0.5);
      const playerBumperY = playerPy - playerL * 0.5;

      ctx.save();
      ctx.strokeStyle = rs.frontCollisionRisk ? '#e74c3c' : 'rgba(77, 232, 154, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(playerPx, playerBumperY);
      ctx.lineTo(playerPx, frontCenterY);
      ctx.stroke();

      const midY = (playerBumperY + frontCenterY) / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = rs.frontCollisionRisk ? '#e74c3c' : '#143022';
      ctx.fillRect(playerPx - 32, midY - 9, 64, 18);
      ctx.strokeStyle = rs.frontCollisionRisk ? '#ff6b6b' : '#4de89a';
      ctx.strokeRect(playerPx - 32, midY - 9, 64, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${rs.frontDistance.toFixed(1)}m`, playerPx, midY + 3);
      ctx.restore();
    }

    // 14. Banner de Culpabilidade de Colisão no Topo do Canvas
    if (rs.collisionFlashTimer > 0) {
      ctx.save();
      const colBlink = Math.floor(rs.collisionFlashTimer * 8) % 2 === 0;
      ctx.fillStyle = colBlink ? 'rgba(185, 28, 28, 0.96)' : 'rgba(127, 29, 29, 0.92)';
      const bw = Math.min(520, W * 0.94);
      const bh = 48;
      const bx = (W - bw) / 2;
      const by = 16;
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = colBlink ? '#fef08a' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥 COLISÃO DETECTADA — APURAÇÃO DE CULPABILIDADE', W / 2, by + 18);

      ctx.fillStyle = rs.collisionFaultWho === 'player' ? '#fecaca' : '#bbf7d0';
      ctx.font = 'bold 9.5px Manrope, sans-serif';
      ctx.fillText(rs.collisionFaultText, W / 2, by + 35);
      ctx.restore();
    }

    // 15. Partículas Dark Pixel (Poeira e névoa suspensa)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    rs.particles.forEach(p => {
      ctx.fillRect(p.x * W, p.y * H, p.size, p.size);
    });
  }

  /* ══════════════════════════════════════════════
     RENDERIZAÇÃO DRIVER VIEW: CENÁRIO DIREÇÃO EM VIAS & CIDADE
     ══════════════════════════════════════════════ */

  function drawRoadDriverView(canvas, rs) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (W < 10 || H < 10) return;

    const stage = ROAD_STAGES[rs.stageIndex];
    const hor = H * 0.42;
    const vpX = W * 0.5;

    ctx.clearRect(0, 0, W, H);

    // 1. CÉU E HORIZONTE DINÂMICO
    const sky = ctx.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, stage.skyTop);
    sky.addColorStop(1, stage.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hor);

    drawRoadHorizonScenery(ctx, W, hor, stage);

    // 2. CHÃO / MARGENS
    ctx.fillStyle = stage.sideColor;
    ctx.fillRect(0, hor, W, H - hor);

    // 3. PISTA EM PERSPECTIVA
    const roadTopW = W * 0.14;
    const roadBotW = W * 1.35;
    ctx.fillStyle = stage.tarmac;
    ctx.beginPath();
    ctx.moveTo(vpX - roadTopW / 2, hor);
    ctx.lineTo(vpX + roadTopW / 2, hor);
    ctx.lineTo(vpX + roadBotW / 2, H);
    ctx.lineTo(vpX - roadBotW / 2, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vpX - roadTopW / 2, hor); ctx.lineTo(vpX - roadBotW / 2, H); ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vpX + roadTopW / 2, hor); ctx.lineTo(vpX + roadBotW / 2, H); ctx.stroke();

    // Faixas seccionadas com velocidade
    const lanes = stage.lanes;
    const scrollFrac = (rs.roadScrollY % 4.0) / 4.0;
    ctx.strokeStyle = stage.markingColor;
    ctx.lineWidth = 2;

    for (let l = 1; l < lanes; l++) {
      const topFrac = l / lanes;
      const botFrac = l / lanes;
      const x1 = (vpX - roadTopW / 2) + topFrac * roadTopW;
      const x2 = (vpX - roadBotW / 2) + botFrac * roadBotW;

      const numSegments = 9;
      for (let s = 0; s < numSegments; s++) {
        const t1 = Math.pow((s + scrollFrac) / numSegments, 2.2);
        const t2 = Math.pow((s + 0.55 + scrollFrac) / numSegments, 2.2);
        if (t1 > 1.0) continue;
        const sx1 = x1 + (x2 - x1) * t1;
        const sy1 = hor + (H - hor) * t1;
        const sx2 = x1 + (x2 - x1) * Math.min(1.0, t2);
        const sy2 = hor + (H - hor) * Math.min(1.0, t2);

        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
      }
    }

    // 4. SITUAÇÃO 3: CRUZAMENTO COM PLACA R-1 PARE EM PERSPECTIVA (VIA COLETORA)
    if (stage.id === 'coletora' && rs.intersection.y > 1.2 && rs.intersection.y < 50.0) {
      const intDist = rs.intersection.y;
      const tInt = Math.min(1.0, 14.0 / (intDist + 10.0));
      const intY = hor + (H - hor) * tInt;
      const curRoadW = (roadTopW + (roadBotW - roadTopW) * tInt);
      const ps = Math.min(1.4, 14.0 / intDist);

      ctx.save();
      // Faixa transversal do cruzamento no asfalto
      ctx.fillStyle = '#1c242b';
      ctx.fillRect(0, intY - Math.max(3, 14 * ps), W, Math.max(6, 28 * ps));

      // Linha de retenção transversal
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(vpX - curRoadW * 0.48, intY + Math.max(3, 12 * ps), curRoadW * 0.96, Math.max(2, 6 * ps));

      // Pintura "PARE" na pista em perspectiva
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${Math.max(8, 22 * ps)}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('P A R E', vpX, intY + Math.max(8, 24 * ps));

      // Placa R-1 Octogonal (Parada Obrigatória) no acostamento direito
      const poleX = vpX + curRoadW * 0.54;
      const poleH = Math.max(28, 90 * ps);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(poleX - 1.5, intY - poleH, 3, poleH);

      const signR = Math.max(8, 22 * ps);
      const signY = intY - poleH;
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 2 * ps);
      ctx.beginPath();
      for (let a = 0; a < 8; a++) {
        const ang = (a * 45 + 22.5) * DEG;
        const sx = poleX + Math.cos(ang) * signR;
        const sy = signY + Math.sin(ang) * signR;
        if (a === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(5, signR * 0.65)}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PARE', poleX, signY);

      // Carro transversal cruzando com preferência
      if (rs.intersection.crossingCar.active) {
        const cc = rs.intersection.crossingCar;
        const ccX = vpX + (cc.x - rs.playerX) * ps * W * 0.16;
        const ccW = Math.max(18, 55 * ps);
        const ccH = Math.max(12, 34 * ps);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(ccX, intY, ccW * 0.5, ccH * 0.25, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = cc.color;
        roundRect(ctx, ccX - ccW / 2, intY - ccH * 0.85, ccW, ccH * 0.85, 3);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        roundRect(ctx, ccX - ccW * 0.35, intY - ccH * 0.8, ccW * 0.7, ccH * 0.38, 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        roundRect(ctx, ccX - 45, intY - ccH - 18, 90, 16, 4);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b'; ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 7.5px Manrope, sans-serif';
        ctx.fillText('🚗 Preferência (Dir)', ccX, intY - ccH - 7);
      }
      ctx.restore();
    }

    // 5. SITUAÇÃO 5: PASSAGEM DE NÍVEL FERROVIÁRIA & TREM EM PERSPECTIVA
    if (stage.id === 'ferrovia' && rs.railCrossing.y > 1.2 && rs.railCrossing.y < 55.0) {
      const rcDist = rs.railCrossing.y;
      const tRc = Math.min(1.0, 14.0 / (rcDist + 10.0));
      const rcY = hor + (H - hor) * tRc;
      const curRoadW = (roadTopW + (roadBotW - roadTopW) * tRc);
      const ps = Math.min(1.4, 14.0 / rcDist);

      ctx.save();
      // Brita escura e dormentes
      ctx.fillStyle = '#1e242a';
      ctx.fillRect(0, rcY - Math.max(4, 18 * ps), W, Math.max(8, 36 * ps));

      // Trilhos de aço prateados
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.5, 3 * ps);
      ctx.beginPath();
      ctx.moveTo(0, rcY - Math.max(2, 6 * ps)); ctx.lineTo(W, rcY - Math.max(2, 6 * ps));
      ctx.moveTo(0, rcY + Math.max(2, 6 * ps)); ctx.lineTo(W, rcY + Math.max(2, 6 * ps));
      ctx.stroke();

      // Linha de parada obrigatória
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(vpX - curRoadW * 0.48, rcY + Math.max(4, 18 * ps), curRoadW * 0.96, Math.max(2, 5 * ps));

      // Sinal rodoferroviário: Cruz de Santo André
      const poleX = vpX + curRoadW * 0.54;
      const poleH = Math.max(30, 95 * ps);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(poleX - 1.5, rcY - poleH, 3, poleH);

      // Cruz X
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, 3 * ps);
      const crR = Math.max(6, 16 * ps);
      ctx.beginPath();
      ctx.moveTo(poleX - crR, rcY - poleH - crR); ctx.lineTo(poleX + crR, rcY - poleH + crR);
      ctx.moveTo(poleX + crR, rcY - poleH - crR); ctx.lineTo(poleX - crR, rcY - poleH + crR);
      ctx.stroke();

      // Luzes vermelhas wig-wag
      const wigWagPhase = rs.railCrossing.lightPhase;
      ctx.fillStyle = wigWagPhase ? '#ff2222' : '#450a0a';
      if (wigWagPhase) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(poleX - crR * 0.7, rcY - poleH + crR * 1.2, Math.max(2, 5 * ps), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = !wigWagPhase ? '#ff2222' : '#450a0a';
      if (!wigWagPhase) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(poleX + crR * 0.7, rcY - poleH + crR * 1.2, Math.max(2, 5 * ps), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Cancela abaixada
      if (rs.railCrossing.barrierDown) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(3, 8 * ps);
        ctx.beginPath();
        ctx.moveTo(poleX, rcY + Math.max(2, 10 * ps));
        ctx.lineTo(vpX - curRoadW * 0.52, rcY + Math.max(2, 10 * ps));
        ctx.stroke();

        ctx.strokeStyle = '#dc2626';
        ctx.setLineDash([12 * ps, 12 * ps]);
        ctx.beginPath();
        ctx.moveTo(poleX, rcY + Math.max(2, 10 * ps));
        ctx.lineTo(vpX - curRoadW * 0.52, rcY + Math.max(2, 10 * ps));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Trem de Carga passando na horizontal
      if (rs.railCrossing.trainPassing) {
        const trainX = vpX + (rs.railCrossing.trainX - rs.playerX) * ps * W * 0.08;
        const trainW = Math.max(60, 240 * ps);
        const trainH = Math.max(25, 95 * ps);

        // Locomotiva pesada
        ctx.fillStyle = '#0f2942';
        roundRect(ctx, trainX, rcY - trainH * 0.95, trainW, trainH, 4);
        ctx.fill();

        // Farol brilhante
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#facc15'; ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(trainX + trainW, rcY - trainH * 0.45, Math.max(3, 10 * ps), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        roundRect(ctx, trainX + 20, rcY - trainH - 22, 140, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#ef4444'; ctx.stroke();
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 8px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚂 Trem de Carga (Art. 212)', trainX + 90, rcY - trainH - 9);
      }
      ctx.restore();
    }

    // 6. SITUAÇÃO 1: ÁREA ESCOLAR, ÔNIBUS, GUARDA APITANDO E CRIANÇAS
    if (stage.id === 'escolar' && rs.schoolBus.y > 1.2 && rs.schoolBus.y < 55.0) {
      const sbDist = rs.schoolBus.y;
      const tSb = Math.min(1.0, 14.0 / (sbDist + 10.0));
      const sbY = hor + (H - hor) * tSb;
      const curRoadW = (roadTopW + (roadBotW - roadTopW) * tSb);
      const ps = Math.min(1.4, 14.0 / sbDist);

      ctx.save();
      // Faixa de pedestres escolar com zebras amarelas/brancas
      const cwW = curRoadW * 0.96;
      const cwH = Math.max(3, 35 * ps);

      // Linha de retenção
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(vpX - cwW * 0.48, sbY + cwH * 0.6, cwW * 0.96, Math.max(2, cwH * 0.2));

      // Texto "ESCOLAR" na pista
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.font = `bold ${Math.max(8, 20 * ps)}px Manrope, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('E S C O L A R', vpX, sbY + cwH * 1.1);

      // Zebras amarelas e brancas
      const zCount = 14;
      const zW = (cwW * 0.96) / (zCount * 2);
      for (let z = 0; z < zCount; z++) {
        const zx = (vpX - cwW * 0.48) + z * (zW * 2);
        ctx.fillStyle = (z % 2 === 0) ? 'rgba(255,255,255,0.85)' : 'rgba(251,191,36,0.85)';
        ctx.fillRect(zx, sbY - cwH * 0.5, zW, cwH);
      }

      // Ônibus Escolar parado no acostamento direito
      const busX = vpX + curRoadW * 0.48;
      const busW = Math.max(25, 75 * ps);
      const busH = Math.max(30, 95 * ps);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(busX, sbY, busW * 0.5, busH * 0.2, 0, 0, Math.PI * 2); ctx.fill();

      // Carroceria do ônibus amarelo
      ctx.fillStyle = '#f59e0b';
      roundRect(ctx, busX - busW * 0.5, sbY - busH * 0.9, busW, busH * 0.9, 4);
      ctx.fill();

      // Teto branco
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, busX - busW * 0.42, sbY - busH * 0.98, busW * 0.84, busH * 0.15, 2);
      ctx.fill();

      // Faixa preta "ESCOLAR"
      ctx.fillStyle = '#111827';
      ctx.fillRect(busX - busW * 0.48, sbY - busH * 0.55, busW * 0.96, busH * 0.2);
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${Math.max(6, 12 * ps)}px Manrope, sans-serif`;
      ctx.fillText('ESCOLAR', busX, sbY - busH * 0.42);

      // Pisca-alerta piscando em vermelho/âmbar
      const flash = (Math.floor(performance.now() / 250) % 2) === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#7f1d1d';
      if (flash) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(busX - busW * 0.35, sbY - busH * 0.85, Math.max(2, 6 * ps), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(busX + busW * 0.35, sbY - busH * 0.85, Math.max(2, 6 * ps), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Guarda de Trânsito no centro da faixa
      if (rs.trafficWarden.hasWarden) {
        const twX = vpX;
        const twY = sbY;
        const twW = Math.max(16, 42 * ps);
        const twH = Math.max(26, 75 * ps);

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(twX, twY, twW * 0.4, twH * 0.15, 0, 0, Math.PI * 2); ctx.fill();

        // Calça azul marinho
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(twX - twW * 0.25, twY - twH * 0.4, twW * 0.22, twH * 0.4);
        ctx.fillRect(twX + twW * 0.03, twY - twH * 0.4, twW * 0.22, twH * 0.4);

        // Colete amarelo fluorescente refletivo
        ctx.fillStyle = '#eab308';
        roundRect(ctx, twX - twW * 0.35, twY - twH * 0.8, twW * 0.7, twH * 0.42, 3);
        ctx.fill();

        // Faixas refletivas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(twX - twW * 0.3, twY - twH * 0.65, twW * 0.6, 2);

        // Braço estendido fazendo sinal regulamentar de parada GA-01
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, 4 * ps);
        ctx.beginPath();
        ctx.moveTo(twX, twY - twH * 0.7);
        ctx.lineTo(twX + twW * 0.45, twY - twH * 0.95);
        ctx.stroke();

        // Luva branca
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(twX + twW * 0.45, twY - twH * 0.95, Math.max(3, 6 * ps), 0, Math.PI * 2); ctx.fill();

        // Quepe azul
        ctx.fillStyle = '#ffdfba';
        ctx.beginPath(); ctx.arc(twX, twY - twH * 0.88, twW * 0.26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f2942';
        ctx.beginPath(); ctx.arc(twX, twY - twH * 0.94, twW * 0.28, Math.PI, 0); ctx.fill();

        // Badge do Guarda apitando
        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        roundRect(ctx, twX - 60, twY - twH - 22, 120, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8'; ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 8px Manrope, sans-serif';
        ctx.fillText('👮 Guarda de Trânsito • PARE!', twX, twY - twH - 9);
      }

      // Crianças com mochilas atravessando
      rs.schoolChildren.forEach((child, idx) => {
        const chX = vpX + (child.x - rs.playerX) * ps * W * 0.16;
        const chY = sbY + (idx === 0 ? -12 * ps : 12 * ps);
        const chW = Math.max(12, 30 * ps);
        const chH = Math.max(18, 50 * ps);

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(chX, chY, chW * 0.4, chH * 0.15, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(chX - chW * 0.25, chY - chH * 0.35, chW * 0.2, chH * 0.35);
        ctx.fillRect(chX + chW * 0.05, chY - chH * 0.35, chW * 0.2, chH * 0.35);

        ctx.fillStyle = child.shirt;
        roundRect(ctx, chX - chW * 0.3, chY - chH * 0.75, chW * 0.6, chH * 0.4, 2);
        ctx.fill();

        // Mochila escolar
        ctx.fillStyle = child.backpack;
        roundRect(ctx, chX + chW * 0.25, chY - chH * 0.7, chW * 0.25, chH * 0.35, 2);
        ctx.fill();

        ctx.fillStyle = '#ffdfba';
        ctx.beginPath(); ctx.arc(chX, chY - chH * 0.85, chW * 0.25, 0, Math.PI * 2); ctx.fill();
      });

      ctx.restore();
    }

    // 7. SITUAÇÃO 2: IDOSO COM BENGALA (ACESSIBILIDADE - ART. 214-II)
    if (stage.isUrban && rs.elderlyPedestrian.y > 1.2 && rs.elderlyPedestrian.y < 45.0) {
      const ep = rs.elderlyPedestrian;
      const ps = Math.min(1.4, 14.0 / ep.y);
      const px = vpX + (ep.x - rs.playerX) * ps * W * 0.16;
      const py = hor + (H - hor) * (14.0 / (ep.y + 10.0));
      const pw = Math.max(14, 38 * ps);
      const ph = Math.max(24, 68 * ps);

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(px, py, pw * 0.45, ph * 0.15, 0, 0, Math.PI * 2); ctx.fill();

      // Calça escura
      ctx.fillStyle = '#334155';
      ctx.fillRect(px - pw * 0.25, py - ph * 0.4, pw * 0.22, ph * 0.4);
      ctx.fillRect(px + pw * 0.03, py - ph * 0.4, pw * 0.22, ph * 0.4);

      // Sobretudo marrom
      ctx.fillStyle = '#78350f';
      roundRect(ctx, px - pw * 0.35, py - ph * 0.8, pw * 0.7, ph * 0.42, 2);
      ctx.fill();

      // Cabeça com cabelos brancos
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath(); ctx.arc(px, py - ph * 0.9, pw * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e2e8f0'; // Cabelo branco
      ctx.beginPath(); ctx.arc(px, py - ph * 0.95, pw * 0.28, Math.PI, 0); ctx.fill();

      // Bengala de madeira
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = Math.max(1.5, 3 * ps);
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.35, py - ph * 0.55);
      ctx.lineTo(px + pw * 0.45, py);
      ctx.stroke();

      // Badge Art. 214-II
      ctx.fillStyle = 'rgba(30,15,5,0.92)';
      roundRect(ctx, px - 55, py - ph - 22, 110, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👴 Idoso com Bengala (Art. 214-II)', px, py - ph - 9);
      ctx.restore();
    }

    // 8. SEMÁFORO INTELIGENTE (VIA ARTERIAL)
    if (stage.id === 'arterial' && rs.trafficLight.y > 1.5 && rs.trafficLight.y < 55.0) {
      const tlDist = rs.trafficLight.y;
      const tTl = Math.min(1.0, 14.0 / (tlDist + 10.0));
      const tlY = hor + (H - hor) * tTl;
      const curRoadW = (roadTopW + (roadBotW - roadTopW) * tTl);
      const poleX = vpX + curRoadW * 0.54;
      const ps = Math.min(1.5, 14.0 / tlDist);

      ctx.save();
      const poleH = Math.max(35, 130 * ps);
      ctx.fillStyle = '#334155';
      ctx.fillRect(poleX, tlY - poleH, Math.max(3, 8 * ps), poleH);

      const armW = curRoadW * 0.38;
      ctx.fillRect(poleX - armW, tlY - poleH, armW + 6, Math.max(3, 6 * ps));

      const boxW = Math.max(12, 24 * ps);
      const boxH = Math.max(28, 64 * ps);
      const boxX = poleX - armW * 0.7 - boxW / 2;
      const boxY = tlY - poleH;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      roundRect(ctx, boxX, boxY, boxW, boxH, 4);
      ctx.fill(); ctx.stroke();

      const rRad = Math.max(2, boxW * 0.26);
      const isRed = rs.trafficLight.state === 'red';
      const isYel = rs.trafficLight.state === 'yellow';
      const isGrn = rs.trafficLight.state === 'green';

      ctx.fillStyle = isRed ? '#ff2222' : '#330808';
      if (isRed) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(boxX + boxW / 2, boxY + boxH * 0.24, rRad, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isYel ? '#f1c40f' : '#3d3205';
      if (isYel) { ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(boxX + boxW / 2, boxY + boxH * 0.50, rRad, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isGrn ? '#4de89a' : '#083318';
      if (isGrn) { ctx.shadowColor = '#4de89a'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(boxX + boxW / 2, boxY + boxH * 0.76, rRad, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 9. CICLISTA EM PERSPECTIVA (CTB ART. 201)
    if (stage.isUrban && rs.cyclist.y > 1.2 && rs.cyclist.y < 45.0) {
      const cycDist = rs.cyclist.y;
      const ps = Math.min(1.4, 14.0 / cycDist);
      const cx = vpX + (rs.cyclist.x - rs.playerX) * ps * W * 0.16;
      const cy = hor + (H - hor) * (14.0 / (cycDist + 10.0));
      const cw = Math.max(16, 42 * ps);
      const ch = Math.max(26, 75 * ps);

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(cx, cy, cw * 0.5, ch * 0.15, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#111827';
      roundRect(ctx, cx - cw * 0.12, cy - ch * 0.35, cw * 0.24, ch * 0.35, 2);
      ctx.fill();

      ctx.fillStyle = '#22c55e';
      roundRect(ctx, cx - cw * 0.35, cy - ch * 0.75, cw * 0.7, ch * 0.45, 3);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx - cw * 0.3, cy - ch * 0.65, cw * 0.6, 2);

      ctx.fillStyle = rs.cyclist.color;
      ctx.beginPath(); ctx.arc(cx, cy - ch * 0.88, cw * 0.3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ff2222';
      ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy - ch * 0.32, Math.max(2, cw * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(10,25,35,0.88)';
      roundRect(ctx, cx - 46, cy - ch - 18, 92, 16, 4);
      ctx.fill();
      ctx.strokeStyle = '#00f2fe'; ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚴 Ciclista (Art. 201)', cx, cy - ch - 6);
      ctx.restore();
    }

    // 10. PEDESTRES CHIBI EM PERSPECTIVA (SOMENTE NA CIDADE, NUNCA EM RODOVIAS)
    if (stage.hasPedestrians) {
      rs.pedestrians.forEach(ped => {
        if (ped.y > 1.2 && ped.y < 42.0) {
          const ps = Math.min(1.4, 14.0 / ped.y);
          const px = vpX + (ped.x - rs.playerX) * ps * W * 0.16;
          const py = hor + (H - hor) * (14.0 / (ped.y + 10.0));
          const pw = Math.max(14, 38 * ps);
          const ph = Math.max(24, 68 * ps);

          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath(); ctx.ellipse(px, py, pw * 0.45, ph * 0.15, 0, 0, Math.PI * 2); ctx.fill();

          const legOffset = Math.sin(ped.animFrame) * (pw * 0.2);
          ctx.fillStyle = ped.pants;
          ctx.fillRect(px - pw * 0.28 + legOffset, py - ph * 0.4, pw * 0.24, ph * 0.4);
          ctx.fillRect(px + pw * 0.04 - legOffset, py - ph * 0.4, pw * 0.24, ph * 0.4);

          ctx.fillStyle = ped.shirt;
          roundRect(ctx, px - pw * 0.35, py - ph * 0.8, pw * 0.7, ph * 0.42, 3);
          ctx.fill();

          ctx.fillStyle = '#ffdfba';
          ctx.beginPath(); ctx.arc(px, py - ph * 0.92, pw * 0.3, 0, Math.PI * 2); ctx.fill();

          ctx.fillStyle = '#331a00';
          ctx.beginPath(); ctx.arc(px, py - ph * 0.98, pw * 0.3, Math.PI, 0); ctx.fill();

          if (ped.isCrossing) {
            ctx.fillStyle = 'rgba(231,76,60,0.92)';
            roundRect(ctx, px - 45, py - ph - 22, 90, 18, 4);
            ctx.fill();
            ctx.strokeStyle = '#ff6b6b'; ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 7.5px Manrope, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🚶 Travessia (Art. 214)', px, py - ph - 9);
          }
          ctx.restore();
        }
      });
    }

    // 11. ANIMAL EM PERSPECTIVA (CÃO NA CIDADE / CAPIVARA NA RODOVIA)
    if (rs.animal.y > 1.2 && rs.animal.y < 42.0) {
      const an = rs.animal;
      const ps = Math.min(1.4, 14.0 / an.y);
      const ax = vpX + (an.x - rs.playerX) * ps * W * 0.16;
      const ay = hor + (H - hor) * (14.0 / (an.y + 10.0));
      const aw = Math.max(16, 44 * ps);
      const ah = Math.max(12, 34 * ps);

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(ax, ay, aw * 0.5, ah * 0.25, 0, 0, Math.PI * 2); ctx.fill();

      const isDog = stage.isUrban;
      ctx.fillStyle = isDog ? '#d97706' : '#78350f';
      roundRect(ctx, ax - aw * 0.45, ay - ah * 0.85, aw * 0.9, ah * 0.7, 3);
      ctx.fill();
      ctx.beginPath(); ctx.arc(ax + aw * 0.25, ay - ah * 0.7, aw * 0.26, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(30,15,5,0.9)';
      roundRect(ctx, ax - 45, ay - ah - 18, 90, 16, 4);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isDog ? '🐾 Cão (Art. 220)' : '🐾 Capivara (Art. 220)', ax, ay - ah - 6);
      ctx.restore();
    }

    // 12. VIATURA DA PRF NO ACOSTAMENTO EM PERSPECTIVA
    if (rs.policeCruiser.y > 1.5 && rs.policeCruiser.y < 50.0) {
      const pc = rs.policeCruiser;
      const ps = Math.min(1.3, 14.0 / pc.y);
      const px = vpX + (pc.x - rs.playerX) * ps * W * 0.16;
      const py = hor + (H - hor) * (14.0 / (pc.y + 10.0));
      const pw = Math.max(22, 65 * ps);
      const ph = Math.max(16, 44 * ps);

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.ellipse(px, py, pw * 0.55, ph * 0.2, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#0f172a';
      roundRect(ctx, px - pw * 0.48, py - ph * 0.85, pw * 0.96, ph * 0.85, 4);
      ctx.fill();

      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(px - pw * 0.44, py - ph * 0.45, pw * 0.88, ph * 0.15);

      const timeMs = performance.now();
      const flash = (Math.floor(timeMs / 180) % 2) === 0;

      ctx.fillStyle = flash ? '#00f2fe' : '#033366';
      if (flash) { ctx.shadowColor = '#00f2fe'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(px - pw * 0.24, py - ph * 0.95, pw * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = !flash ? '#ff2222' : '#660a0a';
      if (!flash) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(px + pw * 0.24, py - ph * 0.95, pw * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(7,16,28,0.92)';
      roundRect(ctx, px - 50, py - ph - 22, 100, 16, 4);
      ctx.fill();
      ctx.strokeStyle = '#00f2fe'; ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚔 Fiscalização PRF', px, py - ph - 10);
      ctx.restore();
    }

    // 10. VEÍCULO À FRENTE (RENDERIZAÇÃO REALISTA EM 3D)
    if (rs.frontCar.y > 1.0 && rs.frontCar.y < 55.0) {
      drawRealisticFrontCar(ctx, W, H, hor, rs);
    }

    // 10B. CAMINHÃO PESADO / CARRETA (BR-101 / RODOVIAS)
    if (rs.truck.active && rs.truck.y > 1.0 && rs.truck.y < 55.0) {
      drawRealisticTruck(ctx, W, H, hor, rs);
    }

    // 10C. MOTOCICLETA EM PERSPECTIVA 3D (FAROL ACESO — ART. 40 CTB)
    if (rs.motorcycle.active && rs.motorcycle.y > 1.2 && rs.motorcycle.y < 55.0) {
      const depth = rs.motorcycle.y;
      const ps = Math.min(1.3, 14.0 / depth);
      const cx = (W * 0.5) + (rs.motorcycle.x - rs.playerX) * ps * W * 0.16;
      const cy = hor + (H - hor) * (14.0 / (depth + 10.0));
      const mw = Math.max(14, 32 * ps);
      const mh = Math.max(22, 58 * ps);

      ctx.save();
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(cx, cy, mw * 0.6, mh * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      // Pneu traseiro
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - mw * 0.18, cy - mh * 0.28, mw * 0.36, mh * 0.28);
      // Rabeta e Chassi
      ctx.fillStyle = rs.motorcycle.color;
      roundRect(ctx, cx - mw * 0.32, cy - mh * 0.55, mw * 0.64, mh * 0.32, 2);
      ctx.fill();
      // Lanterna traseira de freio/posição
      ctx.fillStyle = rs.motorcycle.braking ? '#ef4444' : '#b91c1c';
      if (rs.motorcycle.braking) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; }
      ctx.fillRect(cx - mw * 0.22, cy - mh * 0.52, mw * 0.44, 4);
      ctx.shadowBlur = 0;
      // Motociclista (jaqueta e capacete)
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, cx - mw * 0.38, cy - mh * 0.82, mw * 0.76, mh * 0.32, 4);
      ctx.fill();
      // Capacete
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.arc(cx, cy - mh * 0.90, mw * 0.26, 0, Math.PI * 2); ctx.fill();
      // Faixa refletiva no capacete
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - mw * 0.22, cy - mh * 0.92, mw * 0.44, 2.5);
      ctx.restore();
    }

    // 11. VEÍCULO À DIREITA (FLANCO REALISTA EM PERSPECTIVA & REGRA DA RODA DIANTEIRA)
    if (rs.rightCar.y >= -3.8 && rs.rightCar.y <= 16.0) {
      drawRealisticRightCarFlank(ctx, W, H, hor, rs);
    }

    // 12. COCKPIT DO JOGADOR COM INSTRUMENTOS, SETAS E ALERTA DE PONTO CEGO
    drawCockpitRoad(ctx, W, H, rs, stage);

    // 13. Partículas Dark Pixel na visão do motorista
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    rs.particles.forEach(p => {
      ctx.fillRect(p.x * W, hor + p.y * (H - hor), p.size, p.size);
    });

    // 14. Efeito de Colisão na Visão do Condutor (Piscando em Vermelho por 2s)
    if (rs.collisionFlashTimer > 0) {
      const isRedFlash = Math.floor(rs.collisionFlashTimer * 8) % 2 === 0;
      if (isRedFlash) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, W, H);
        ctx.restore();
      }

      ctx.save();
      const colBlink = Math.floor(rs.collisionFlashTimer * 8) % 2 === 0;
      ctx.fillStyle = colBlink ? 'rgba(185, 28, 28, 0.96)' : 'rgba(127, 29, 29, 0.92)';
      const bw = Math.min(500, W * 0.92);
      const bh = 50;
      const bx = (W - bw) / 2;
      const by = 20;
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = colBlink ? '#fef08a' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥 COLISÃO DETECTADA — APURAÇÃO DE CULPABILIDADE', W / 2, by + 19);

      ctx.fillStyle = rs.collisionFaultWho === 'player' ? '#fecaca' : '#bbf7d0';
      ctx.font = 'bold 9.5px Manrope, sans-serif';
      ctx.fillText(rs.collisionFaultText, W / 2, by + 37);
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════
     RENDERIZADOR REALISTA DO VEÍCULO À FRENTE (3D PERSPECTIVE)
     ══════════════════════════════════════════════ */

  function drawRealisticFrontCar(ctx, W, H, hor, rs) {
    const depth = rs.frontCar.y;
    const ps = Math.min(1.25, 14.0 / depth);
    const cx = (W * 0.5) + (rs.frontCar.x - rs.playerX) * ps * W * 0.16;
    const cy = hor + (H - hor) * (14.0 / (depth + 10.0));
    const cw = Math.max(24, VEHICLE.width * ps * 76);
    const ch = Math.max(18, 1.45 * ps * 68);

    ctx.save();

    // 1. Sombra de oclusão ambiente no asfalto sob os pneus
    const shadowGrad = ctx.createRadialGradient(cx, cy + 2, cw * 0.1, cx, cy + 2, cw * 0.7);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.88)');
    shadowGrad.addColorStop(0.55, 'rgba(0,0,0,0.52)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, cw * 0.64, ch * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Pneus traseiros com banda de rodagem e ranhuras
    const tireW = cw * 0.18;
    const tireH = ch * 0.32;
    const tireY = cy - tireH * 0.88;
    ctx.fillStyle = '#111316';
    roundRect(ctx, cx - cw * 0.46, tireY, tireW, tireH, 3);
    ctx.fill();
    roundRect(ctx, cx + cw * 0.46 - tireW, tireY, tireW, tireH, 3);
    ctx.fill();

    // 3. Difusor traseiro e ponteiras de escapamento duplas cromadas
    ctx.fillStyle = '#161a1d';
    roundRect(ctx, cx - cw * 0.47, cy - ch * 0.32, cw * 0.94, ch * 0.32, cw * 0.05);
    ctx.fill();

    // Aletas verticais do difusor
    ctx.fillStyle = '#0f1214';
    for (let f = -2; f <= 2; f++) {
      ctx.fillRect(cx + f * (cw * 0.08) - 1.5, cy - ch * 0.22, 3, ch * 0.18);
    }

    // Escapamentos cromados duplos com profundidade interna
    const exW = cw * 0.085;
    const exH = ch * 0.075;
    const exY = cy - ch * 0.12;
    ctx.fillStyle = '#c5d0dc';
    ctx.strokeStyle = '#5c6670';
    ctx.lineWidth = 1;
    // Ponteira esquerda
    roundRect(ctx, cx - cw * 0.38, exY, exW, exH, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#080a0c';
    roundRect(ctx, cx - cw * 0.38 + 1, exY + 1, exW - 2, exH - 2, 1);
    ctx.fill();
    // Ponteira direita
    ctx.fillStyle = '#c5d0dc';
    roundRect(ctx, cx + cw * 0.38 - exW, exY, exW, exH, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#080a0c';
    roundRect(ctx, cx + cw * 0.38 - exW + 1, exY + 1, exW - 2, exH - 2, 1);
    ctx.fill();

    // 4. Carroceria principal (SUV / Hatchback Moderno com pintura metálica)
    const bodyGrad = ctx.createLinearGradient(cx - cw / 2, cy - ch, cx + cw / 2, cy);
    bodyGrad.addColorStop(0, '#10334c');
    bodyGrad.addColorStop(0.25, '#1e547a');
    bodyGrad.addColorStop(0.5, '#3498db');
    bodyGrad.addColorStop(0.75, '#1e547a');
    bodyGrad.addColorStop(1, '#0e2b40');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.38, cy - ch * 0.98); // teto esquerdo
    ctx.lineTo(cx + cw * 0.38, cy - ch * 0.98); // teto direito
    ctx.lineTo(cx + cw * 0.44, cy - ch * 0.62); // pilar C direito
    ctx.lineTo(cx + cw * 0.48, cy - ch * 0.36); // ombro traseiro direito
    ctx.lineTo(cx + cw * 0.47, cy - ch * 0.08); // para-choque direito
    ctx.lineTo(cx - cw * 0.47, cy - ch * 0.08); // para-choque esquerdo
    ctx.lineTo(cx - cw * 0.48, cy - ch * 0.36); // ombro esquerdo
    ctx.lineTo(cx - cw * 0.44, cy - ch * 0.62); // pilar C esquerdo
    ctx.closePath();
    ctx.fill();

    // Linha de vinco metálico no porta-malas
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.42, cy - ch * 0.42);
    ctx.lineTo(cx + cw * 0.42, cy - ch * 0.42);
    ctx.stroke();

    // 5. Vidro traseiro escurecido (Insulfilm) com reflexo e desembaçador
    const glassW = cw * 0.72;
    const glassH = ch * 0.36;
    const glassY = cy - ch * 0.94;

    const glassGrad = ctx.createLinearGradient(cx, glassY, cx, glassY + glassH);
    glassGrad.addColorStop(0, '#0a1622');
    glassGrad.addColorStop(0.65, '#1b3246');
    glassGrad.addColorStop(1, '#0c1824');
    ctx.fillStyle = glassGrad;
    roundRect(ctx, cx - glassW / 2, glassY, glassW, glassH, cw * 0.05);
    ctx.fill();

    // Linhas horizontais do desembaçador térmico
    ctx.strokeStyle = 'rgba(220,150,90,0.32)';
    ctx.lineWidth = 0.8;
    for (let d = 1; d <= 3; d++) {
      const dy = glassY + (glassH / 4) * d;
      ctx.beginPath();
      ctx.moveTo(cx - glassW * 0.42, dy);
      ctx.lineTo(cx + glassW * 0.42, dy);
      ctx.stroke();
    }

    // Silhuetas dos encostos de cabeça internos
    ctx.fillStyle = 'rgba(10,18,25,0.72)';
    roundRect(ctx, cx - glassW * 0.32, glassY + glassH * 0.32, glassW * 0.22, glassH * 0.44, 3);
    ctx.fill();
    roundRect(ctx, cx + glassW * 0.10, glassY + glassH * 0.32, glassW * 0.22, glassH * 0.44, 3);
    ctx.fill();

    // 6. Terceira luz de freio (CHMSL) no topo do vidro
    const chmslW = cw * 0.26;
    const chmslH = Math.max(2, ch * 0.04);
    const chmslY = glassY + 1;
    ctx.fillStyle = rs.frontBraking ? '#ff1111' : '#661111';
    if (rs.frontBraking) {
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 10;
    }
    roundRect(ctx, cx - chmslW / 2, chmslY, chmslW, chmslH, 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 7. Lanternas traseiras LED modernas (Assinatura luminosa em C com brilho na frenagem)
    const tailW = cw * 0.24;
    const tailH = ch * 0.16;
    const tailY = cy - ch * 0.46;

    drawModernTaillight(ctx, cx - cw * 0.46, tailY, tailW, tailH, rs.frontBraking, false);
    drawModernTaillight(ctx, cx + cw * 0.46 - tailW, tailY, tailW, tailH, rs.frontBraking, true);

    // Barra de LED transversal contínua entre as lanternas
    ctx.strokeStyle = rs.frontBraking ? 'rgba(255,40,40,0.95)' : 'rgba(200,30,30,0.6)';
    ctx.lineWidth = Math.max(1, ch * 0.03);
    if (rs.frontBraking) {
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.22, tailY + tailH * 0.45);
    ctx.lineTo(cx + cw * 0.22, tailY + tailH * 0.45);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 8. Placa Mercosul Oficial Brasil (Faixa azul + Letras AGD 2026)
    const plateW = cw * 0.28;
    const plateH = ch * 0.13;
    const plateY = cy - ch * 0.25;

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cx - plateW / 2, plateY, plateW, plateH, 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    const plateHeaderH = plateH * 0.32;
    ctx.fillStyle = '#003399';
    roundRect(ctx, cx - plateW / 2, plateY, plateW, plateHeaderH, 1);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.font = `bold ${Math.max(6, plateH * 0.58)}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AGD 2026', cx, plateY + plateHeaderH + (plateH - plateHeaderH) / 2);

    // 9. Emblema cromado da montadora
    ctx.fillStyle = '#e4edf5';
    ctx.beginPath();
    ctx.arc(cx, cy - ch * 0.50, Math.max(2, cw * 0.035), 0, Math.PI * 2);
    ctx.fill();

    // 10. Tag Holográfica de Distância e Radar de Aproximação
    const badgeW = 92;
    const badgeH = 22;
    const badgeY = cy - ch - 26;
    const isCrit = rs.frontCollisionRisk;

    ctx.fillStyle = isCrit ? 'rgba(231,76,60,0.95)' : 'rgba(10,25,18,0.88)';
    roundRect(ctx, cx - badgeW / 2, badgeY, badgeW, badgeH, 5);
    ctx.fill();
    ctx.strokeStyle = isCrit ? '#ff6b6b' : '#4de89a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isCrit ? 'FREIE AGORA!' : (rs.frontBraking ? '▼ FREANDO' : '▲ FLUXO');
    ctx.fillText(`${rs.frontDistance.toFixed(1)}m • ${statusText}`, cx, badgeY + badgeH / 2);

    ctx.restore();
  }

  /* ══════════════════════════════════════════════
     RENDERIZADOR REALISTA DE CAMINHÃO PESADO / CARRETA (3D)
     ══════════════════════════════════════════════ */

  function drawRealisticTruck(ctx, W, H, hor, rs) {
    const depth = rs.truck.y;
    const ps = Math.min(1.25, 14.0 / depth);
    const cx = (W * 0.5) + (rs.truck.x - rs.playerX) * ps * W * 0.16;
    const cy = hor + (H - hor) * (14.0 / (depth + 10.0));
    const cw = Math.max(34, rs.truck.w * ps * 76);
    const ch = Math.max(32, 3.4 * ps * 68);

    ctx.save();

    const isColliding = rs.collisionFlashTimer > 0 && rs.collidingCarId === 'truck' && (Math.floor(rs.collisionFlashTimer * 8) % 2 === 0);
    if (isColliding) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 24;
    }

    // 1. Sombra pesada no asfalto
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, cw * 0.65, ch * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Rodado duplo traseiro da carreta (4 pneus)
    const tireW = cw * 0.14;
    const tireH = ch * 0.22;
    const tireY = cy - tireH * 0.9;
    ctx.fillStyle = '#0f1115';
    // Pneus esquerdos
    ctx.fillRect(cx - cw * 0.48, tireY, tireW * 0.9, tireH);
    ctx.fillRect(cx - cw * 0.48 + tireW, tireY, tireW * 0.9, tireH);
    // Pneus direitos
    ctx.fillRect(cx + cw * 0.48 - tireW * 1.9, tireY, tireW * 0.9, tireH);
    ctx.fillRect(cx + cw * 0.48 - tireW * 0.9, tireY, tireW * 0.9, tireH);

    // Barrotes (Lameiros) com faixas refletivas
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(cx - cw * 0.48, cy - tireH * 0.4, tireW * 2.0, tireH * 0.6);
    ctx.fillRect(cx + cw * 0.48 - tireW * 2.0, cy - tireH * 0.4, tireW * 2.0, tireH * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - cw * 0.45, cy - tireH * 0.1, tireW * 1.4, 2);
    ctx.fillRect(cx + cw * 0.45 - tireW * 1.4, cy - tireH * 0.1, tireW * 1.4, 2);

    // 3. Carroceria Baú / Carreta (Alumínio com nervuras verticais)
    const bodyY = cy - ch;
    ctx.fillStyle = isColliding ? '#dc2626' : '#e2e8f0';
    roundRect(ctx, cx - cw * 0.48, bodyY, cw * 0.96, ch * 0.88, 4);
    ctx.fill();

    // Nervuras / linhas de reforço do baú
    ctx.strokeStyle = isColliding ? '#7f1d1d' : '#94a3b8';
    ctx.lineWidth = Math.max(1, 1.5 * ps);
    const numRibs = 6;
    for (let r = 1; r < numRibs; r++) {
      const rx = (cx - cw * 0.48) + (r / numRibs) * (cw * 0.96);
      ctx.beginPath(); ctx.moveTo(rx, bodyY + 4); ctx.lineTo(rx, bodyY + ch * 0.84); ctx.stroke();
    }

    // Portas traseiras e trincos em aço escovado
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, bodyY + 4); ctx.lineTo(cx, bodyY + ch * 0.84); ctx.stroke();

    // 4. Faixas Refletivas de Segurança CONTRAN (Parachoque e Contorno)
    const barY = bodyY + ch * 0.78;
    const barH = Math.max(3, ch * 0.08);
    const numStripes = Math.floor((cw * 0.96) / Math.max(4, 7 * ps));
    for (let s = 0; s < numStripes; s++) {
      const sx = (cx - cw * 0.48) + s * Math.max(4, 7 * ps);
      ctx.fillStyle = s % 2 === 0 ? '#ef4444' : '#f8fafc';
      ctx.fillRect(sx, barY, Math.max(4, 7 * ps), barH);
    }

    // 5. Lanterna traseira dupla (Freio e Posição)
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - cw * 0.44, barY - 6, Math.max(4, cw * 0.12), Math.max(3, ch * 0.06));
    ctx.fillRect(cx + cw * 0.32, barY - 6, Math.max(4, cw * 0.12), Math.max(3, ch * 0.06));

    // 6. Três Marias (Luzes superiores de identificação de veículo longo no teto)
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 6;
    const topLightR = Math.max(2, 2.5 * ps);
    ctx.beginPath(); ctx.arc(cx - cw * 0.1, bodyY + 6, topLightR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, bodyY + 6, topLightR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + cw * 0.1, bodyY + 6, topLightR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 7. Placa de Sinalização CONTRAN: "VEÍCULO LONGO"
    const plateW = Math.max(24, cw * 0.55);
    const plateH = Math.max(8, ch * 0.12);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - plateW * 0.5, bodyY + ch * 0.56, plateW, plateH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - plateW * 0.5, bodyY + ch * 0.56, plateW, plateH);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.max(6, 6.5 * ps)}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VEÍCULO LONGO', cx, bodyY + ch * 0.56 + plateH * 0.75);

    // Tag identificadora superior
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    roundRect(ctx, cx - 65, bodyY - 22, 130, 18, 4);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8'; ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px Manrope, sans-serif';
    ctx.fillText('🚛 Carreta Rodoviária (Art. 61: 80 km/h)', cx, bodyY - 10);

    ctx.restore();
  }

  function drawModernTaillight(ctx, x, y, w, h, isBraking, isRight) {
    ctx.save();
    ctx.fillStyle = '#22080a';
    roundRect(ctx, x, y, w, h, 3);
    ctx.fill();

    ctx.strokeStyle = isBraking ? '#ff2222' : '#d63031';
    ctx.fillStyle = isBraking ? '#ff3333' : '#a82020';
    ctx.lineWidth = 2;

    if (isBraking) {
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 14;
    }

    ctx.beginPath();
    if (!isRight) {
      ctx.moveTo(x + w, y + 2);
      ctx.lineTo(x + 2, y + 2);
      ctx.lineTo(x + 2, y + h - 2);
      ctx.lineTo(x + w, y + h - 2);
    } else {
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + w - 2, y + 2);
      ctx.lineTo(x + w - 2, y + h - 2);
      ctx.lineTo(x, y + h - 2);
    }
    ctx.stroke();

    if (isBraking) {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.5, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════
     RENDERIZADOR REALISTA DO FLANCO LATERAL (REGRA DA RODA DIANTEIRA)
     ══════════════════════════════════════════════ */

  function drawRealisticRightCarFlank(ctx, W, H, hor, rs) {
    const dy = rs.rightCar.y;
    const depth = Math.max(0.6, dy + 2.0);
    const ps = Math.min(1.4, 6.5 / depth);

    const cx = W * 0.74 + (1.0 / depth) * (W * 0.1);
    const cy = hor + (H - hor) * 0.58 + (dy > 0 ? (1.0 / depth) * 20 : 50);
    const cw = Math.max(70, 240 * ps);
    const ch = Math.max(50, 135 * ps);

    ctx.save();

    // 1. Sombra projetada do veículo na pista com suavização
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ch * 0.38, cw * 0.54, ch * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Coordenadas das Rodas Dianteira e Traseira
    const rearWheelX  = cx - cw * 0.28;
    const frontWheelX = cx + cw * 0.26;
    const wheelY = cy + ch * 0.32;
    const wheelR = cw * 0.12;

    // 3. Carroceria Lateral Esculpida (Sedan Vermelho Metálico)
    const flankGrad = ctx.createLinearGradient(cx, cy - ch * 0.5, cx, cy + ch * 0.4);
    flankGrad.addColorStop(0, '#5a0c0e');
    flankGrad.addColorStop(0.2, '#961c20');
    flankGrad.addColorStop(0.45, '#d63031');
    flankGrad.addColorStop(0.7, '#a82020');
    flankGrad.addColorStop(1, '#3b0608');

    ctx.fillStyle = flankGrad;
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.46, cy + ch * 0.24); // bico dianteiro
    ctx.lineTo(cx + cw * 0.44, cy + ch * 0.08); // capô frente
    ctx.lineTo(cx + cw * 0.24, cy - ch * 0.18); // base para-brisa
    ctx.lineTo(cx + cw * 0.08, cy - ch * 0.44); // coluna A / teto frente
    ctx.lineTo(cx - cw * 0.22, cy - ch * 0.42); // teto traseiro
    ctx.lineTo(cx - cw * 0.38, cy - ch * 0.12); // vidro traseiro / coluna C
    ctx.lineTo(cx - cw * 0.47, cy - ch * 0.06); // tampa porta-malas
    ctx.lineTo(cx - cw * 0.48, cy + ch * 0.24); // para-choque traseiro
    ctx.closePath();
    ctx.fill();

    // Vinco de ombro com reflexo specular
    ctx.strokeStyle = 'rgba(255,220,220,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.42, cy + ch * 0.06);
    ctx.lineTo(cx - cw * 0.44, cy - ch * 0.04);
    ctx.stroke();

    // Saias laterais (Side skirts) pretas texturizadas
    ctx.fillStyle = '#1a1e20';
    ctx.fillRect(cx - cw * 0.45, cy + ch * 0.26, cw * 0.90, ch * 0.08);

    // 4. Área Envidraçada com Insulfilm e moldura cromada
    const winGrad = ctx.createLinearGradient(cx, cy - ch * 0.4, cx, cy - ch * 0.1);
    winGrad.addColorStop(0, '#0c1b26');
    winGrad.addColorStop(0.7, '#1e384d');
    winGrad.addColorStop(1, '#0e202e');
    ctx.fillStyle = winGrad;

    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.22, cy - ch * 0.16);
    ctx.lineTo(cx + cw * 0.07, cy - ch * 0.40);
    ctx.lineTo(cx - cw * 0.20, cy - ch * 0.38);
    ctx.lineTo(cx - cw * 0.34, cy - ch * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(240,245,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Coluna B preto fosco
    ctx.fillStyle = '#101416';
    ctx.fillRect(cx - cw * 0.05, cy - ch * 0.40, cw * 0.04, ch * 0.26);

    // Maçanetas das portas cromadas
    ctx.fillStyle = '#e8ecf0';
    roundRect(ctx, cx + cw * 0.08, cy - ch * 0.06, cw * 0.06, ch * 0.035, 1);
    ctx.fill();
    roundRect(ctx, cx - cw * 0.14, cy - ch * 0.05, cw * 0.06, ch * 0.035, 1);
    ctx.fill();

    // Retrovisor externo com repetidor de seta âmbar
    ctx.fillStyle = '#7a1416';
    roundRect(ctx, cx + cw * 0.18, cy - ch * 0.22, cw * 0.07, ch * 0.07, 2);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(cx + cw * 0.18, cy - ch * 0.19, cw * 0.035, ch * 0.02);

    // Farol dianteiro projetor LED
    ctx.fillStyle = '#eef8ff';
    ctx.shadowColor = '#a8e6ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.44, cy + ch * 0.08);
    ctx.lineTo(cx + cw * 0.38, cy + ch * 0.05);
    ctx.lineTo(cx + cw * 0.41, cy + ch * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Lanterna traseira envolvente
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(cx - cw * 0.47, cy - ch * 0.05, cw * 0.06, ch * 0.09);

    // 5. Rodas de Liga Leve Esportivas, Discos Perfurados e Pinças Brembo
    drawRealisticWheel(ctx, rearWheelX, wheelY, wheelR);
    drawRealisticWheel(ctx, frontWheelX, wheelY, wheelR);

    // 6. TAG TELEMÉTRICA NATURAL DE DISTÂNCIA LATERAL E FLUXO (SEM LINHAS ARTIFICIAIS)
    const isBlind = rs.blindSpotActive;
    const tagBoxW = 186;
    const tagBoxH = 34;
    const tagBoxX = Math.min(W - tagBoxW - 12, cx - tagBoxW / 2);
    const tagBoxY = cy - ch * 0.44 - tagBoxH - 8;

    ctx.save();
    ctx.fillStyle = isBlind ? 'rgba(42, 10, 12, 0.94)' : 'rgba(8, 28, 18, 0.94)';
    roundRect(ctx, tagBoxX, tagBoxY, tagBoxW, tagBoxH, 6);
    ctx.fill();
    ctx.strokeStyle = isBlind ? '#e74c3c' : '#4de89a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isBlind ? '#ff6b6b' : '#4de89a';
    ctx.font = 'bold 9.5px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isBlind ? '⚠️ VEÍCULO NO PONTO CEGO' : '✓ FAIXA LATERAL SEGURA', tagBoxX + tagBoxW / 2, tagBoxY + 13);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '8px DM Sans, sans-serif';
    ctx.fillText(`Dist. Lateral: ${Math.max(0, rs.lateralDistance).toFixed(2)}m • Y: ${(rs.rightCar.y).toFixed(1)}m`, tagBoxX + tagBoxW / 2, tagBoxY + 26);
    ctx.restore();
  }

  function drawRealisticWheel(ctx, wx, wy, r) {
    ctx.save();
    // Pneu externo em borracha vulcanizada
    ctx.fillStyle = '#14171a';
    ctx.beginPath();
    ctx.arc(wx, wy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22272b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sulco do perfil esportivo
    ctx.strokeStyle = '#0d0f11';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();

    // Disco de freio perfurado em liga metálica
    ctx.fillStyle = '#8a9299';
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Furos de ventilação do disco de alta performance
    ctx.fillStyle = '#505860';
    for (let h = 0; h < 6; h++) {
      const ha = (h * 60) * DEG;
      ctx.beginPath();
      ctx.arc(wx + Math.cos(ha) * r * 0.48, wy + Math.sin(ha) * r * 0.48, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pinça de freio esportiva Brembo Vermelha
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.66, -0.6, 0.4);
    ctx.arc(wx, wy, r * 0.44, 0.4, -0.6, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Roda de liga leve diamantada com 5 raios duplos
    ctx.fillStyle = '#d8e0e8';
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1.2;
    for (let s = 0; s < 5; s++) {
      const sa = (s * 72) * DEG;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(sa - 0.12) * r * 0.22, wy + Math.sin(sa - 0.12) * r * 0.22);
      ctx.lineTo(wx + Math.cos(sa - 0.08) * r * 0.76, wy + Math.sin(sa - 0.08) * r * 0.76);
      ctx.lineTo(wx + Math.cos(sa + 0.08) * r * 0.76, wy + Math.sin(sa + 0.08) * r * 0.76);
      ctx.lineTo(wx + Math.cos(sa + 0.12) * r * 0.22, wy + Math.sin(sa + 0.12) * r * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Cubo central da roda
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawRoadHorizonScenery(ctx, W, hor, stage) {
    ctx.save();
    if (stage.id === 'escolar') {
      // Área Escolar: Fachada de escola, cerca do pátio, árvores e placa A-13
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(W * 0.15, hor - 38, W * 0.7, 38);
      // Telhado da escola
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(W * 0.12, hor - 38);
      ctx.lineTo(W * 0.50, hor - 60);
      ctx.lineTo(W * 0.88, hor - 38);
      ctx.closePath();
      ctx.fill();

      // Janelas da escola
      ctx.fillStyle = '#fde047';
      for (let j = 0; j < 7; j++) {
        ctx.fillRect(W * (0.2 + j * 0.08), hor - 26, W * 0.045, 14);
      }

      // Placa de advertência A-13 (Crianças)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(W * 0.82, hor - 32, 54, 18);
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
      ctx.strokeRect(W * 0.82, hor - 32, 54, 18);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 7px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏫 ZONA 30', W * 0.82 + 27, hor - 20);

    } else if (stage.id === 'coletora') {
      // Bairro Residencial: Casas com telhados coloniais, janelas aconchegantes e postes
      const houseCount = 12;
      const houseW = W / houseCount;
      for (let i = 0; i < houseCount; i++) {
        const hh = 20 + (i % 3) * 8;
        ctx.fillStyle = (i % 2 === 0) ? '#131e2b' : '#1a2738';
        ctx.fillRect(i * houseW + 2, hor - hh, houseW - 4, hh);

        // Telhado
        ctx.fillStyle = (i % 2 === 0) ? '#9a3412' : '#7c2d12';
        ctx.beginPath();
        ctx.moveTo(i * houseW, hor - hh);
        ctx.lineTo(i * houseW + houseW * 0.5, hor - hh - 12);
        ctx.lineTo(i * houseW + houseW, hor - hh);
        ctx.closePath();
        ctx.fill();

        // Janela iluminada
        ctx.fillStyle = '#ffaa33';
        ctx.fillRect(i * houseW + houseW * 0.35, hor - hh + 6, houseW * 0.3, 7);
      }

    } else if (stage.id === 'arterial') {
      // Avenida Arterial: Silhueta de edifícios altos com luzes
      const bldCount = 20;
      const bldW = W / bldCount;
      const timeSec = performance.now() / 1000;

      ctx.fillStyle = '#070a12';
      for (let i = 0; i < bldCount; i++) {
        const bh = 30 + Math.sin(i * 1.3) * 35 + (i % 4) * 18;
        ctx.fillRect(i * bldW, hor - bh, bldW + 1, bh);
        if (i % 3 === 0) {
          ctx.strokeStyle = '#27354a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(i * bldW + bldW * 0.5, hor - bh);
          ctx.lineTo(i * bldW + bldW * 0.5, hor - bh - 12);
          ctx.stroke();

          const beaconFlash = (Math.floor(timeSec * 2 + i) % 2) === 0;
          ctx.fillStyle = beaconFlash ? '#ff2222' : '#550808';
          ctx.beginPath();
          ctx.arc(i * bldW + bldW * 0.5, hor - bh - 12, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let i = 0; i < bldCount; i++) {
        const bh = 18 + Math.cos(i * 1.8) * 22 + (i % 3) * 12;
        ctx.fillStyle = '#0e1624';
        ctx.fillRect(i * bldW + 2, hor - bh, bldW - 1, bh);

        const floors = Math.floor(bh / 9);
        for (let f = 1; f < floors; f++) {
          const wy = hor - bh + f * 9;
          const isLit1 = ((i * 3 + f * 5) % 4) !== 0;
          const isLit2 = ((i * 7 + f * 2) % 3) === 0;

          if (isLit1) {
            ctx.fillStyle = (f % 2 === 0) ? '#ffaa33' : '#f39c12';
            ctx.fillRect(i * bldW + 4, wy, 3, 4);
          }
          if (isLit2) {
            ctx.fillStyle = '#ffcc66';
            ctx.fillRect(i * bldW + bldW - 7, wy, 3, 4);
          }
        }
      }

    } else if (stage.id === 'ferrovia') {
      // Passagem de Nível: Silos agrícolas, torres elétricas de alta tensão e postes de ferrovia
      ctx.fillStyle = '#111827';
      // Silos
      ctx.fillRect(W * 0.15, hor - 55, 34, 55);
      ctx.fillRect(W * 0.22, hor - 48, 28, 48);
      ctx.fillRect(W * 0.72, hor - 52, 32, 52);

      // Torre de transmissão
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.85, hor); ctx.lineTo(W * 0.88, hor - 65); ctx.lineTo(W * 0.91, hor);
      ctx.stroke();

      // Placa de advertência ferroviária no horizonte
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(W * 0.05, hor - 26, 62, 16);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 7px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚂 VIA FÉRREA', W * 0.05 + 31, hor - 15);

    } else if (stage.id === 'rapida') {
      // Via Expressa: Pórtico de fiscalização e radares 80 km/h
      ctx.fillStyle = '#102217';
      ctx.fillRect(W * 0.25, hor - 42, W * 0.5, 22);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(W * 0.25, hor - 42, W * 0.5, 22);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⬆ VIA EXPRESSA • RADAR ATIVO 80 km/h (CTB Art. 218)', W * 0.5, hor - 28);

    } else {
      // Rodovia Federal BR-101: Montanhas noturnas, árvores e placas reflexivas
      ctx.fillStyle = '#071510';
      ctx.beginPath();
      ctx.moveTo(0, hor);
      ctx.lineTo(W * 0.18, hor - 42);
      ctx.lineTo(W * 0.42, hor - 20);
      ctx.lineTo(W * 0.68, hor - 48);
      ctx.lineTo(W * 0.88, hor - 24);
      ctx.lineTo(W, hor - 30);
      ctx.lineTo(W, hor);
      ctx.closePath();
      ctx.fill();

      // Placa verde oficial da Rodovia Federal BR-101
      ctx.fillStyle = '#155724';
      ctx.fillRect(W * 0.72, hor - 36, 60, 22);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(W * 0.72, hor - 36, 60, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BR-101 SUL', W * 0.72 + 30, hor - 22);
    }

    // Névoa atmosférica de horizonte (Dark Mist)
    const mistGrad = ctx.createLinearGradient(0, hor - 15, 0, hor);
    mistGrad.addColorStop(0, 'rgba(8, 12, 20, 0)');
    mistGrad.addColorStop(1, 'rgba(8, 12, 20, 0.85)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, hor - 15, W, 15);
    ctx.restore();
  }

  /* ══════════════════════════════════════════════
     COCKPIT DO CONDUTOR (PAINEL DIGITAL, SETAS E BSM)
     ══════════════════════════════════════════════ */

  function drawCockpitRoad(ctx, W, H, rs, stage) {
    const panH = H * 0.28;
    const panY = H - panH;

    // Fundo do Painel com textura e degradê
    const panGrad = ctx.createLinearGradient(0, panY, 0, H);
    panGrad.addColorStop(0, 'rgba(8, 18, 14, 0.98)');
    panGrad.addColorStop(1, '#040b06');
    ctx.fillStyle = panGrad;
    ctx.fillRect(0, panY, W, panH);

    ctx.strokeStyle = '#1e3828';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, panY); ctx.lineTo(W, panY); ctx.stroke();

    // Colunas A do para-brisa com monitores de ponto cego (BSM)
    ctx.fillStyle = '#08120c';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W * 0.06, 0); ctx.lineTo(W * 0.12, panY); ctx.lineTo(0, panY);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(W, 0); ctx.lineTo(W - W * 0.06, 0); ctx.lineTo(W - W * 0.12, panY); ctx.lineTo(W, panY);
    ctx.closePath(); ctx.fill();

    // LED de Ponto Cego (BSM) na coluna A esquerda
    const bsmLeftActive = Math.abs(rs.leftCar.y) < 6.0;
    ctx.fillStyle = bsmLeftActive ? '#f39c12' : '#22382b';
    if (bsmLeftActive) {
      ctx.shadowColor = '#f39c12';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(W * 0.10, panY - 25, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // LED de Ponto Cego (BSM) na coluna A direita
    const bsmRightActive = rs.blindSpotActive || (rs.rightCar.y > -2.5 && rs.rightCar.y < 2.5);
    ctx.fillStyle = bsmRightActive ? '#e74c3c' : '#22382b';
    if (bsmRightActive) {
      ctx.shadowColor = '#e74c3c';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(W - W * 0.10, panY - 25, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Alerta de Emergência da Ambulância no Para-brisa / Painel
    if (rs.ambulance.active && rs.ambulance.y < 18.0) {
      const ambBlink = (Math.floor(performance.now() / 150) % 2) === 0;
      ctx.fillStyle = ambBlink ? 'rgba(2, 132, 199, 0.95)' : 'rgba(220, 38, 38, 0.95)';
      roundRect(ctx, W * 0.25, panY - 30, W * 0.5, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 SAMU EM EMERGÊNCIA — Desloque para a Direita (Art. 189)', W * 0.5, panY - 16);
    }

    // Cluster de Instrumentos Central
    // 1. SETA ESQUERDA ANIMADA NO PAINEL (◀)
    const isLeftBlinking = rs.turnSignal === 'left' && rs.turnSignalBlink;
    ctx.fillStyle = isLeftBlinking ? '#4de89a' : 'rgba(77,232,154,0.18)';
    if (isLeftBlinking) {
      ctx.shadowColor = '#4de89a';
      ctx.shadowBlur = 12;
    }
    ctx.font = `bold ${Math.max(16, H * 0.068)}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('◀', W * 0.36, panY + panH * 0.44);
    ctx.shadowBlur = 0;

    // 2. SETA DIREITA ANIMADA NO PAINEL (▶)
    const isRightBlinking = rs.turnSignal === 'right' && rs.turnSignalBlink;
    ctx.fillStyle = isRightBlinking ? '#4de89a' : 'rgba(77,232,154,0.18)';
    if (isRightBlinking) {
      ctx.shadowColor = '#4de89a';
      ctx.shadowBlur = 12;
    }
    ctx.fillText('▶', W * 0.64, panY + panH * 0.44);
    ctx.shadowBlur = 0;

    // Velocidade Digital
    ctx.fillStyle = rs.speedKmh > stage.speedLimit + 5 ? '#e74c3c' : '#4de89a';
    ctx.font = `bold ${Math.max(16, H * 0.070)}px Manrope, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(rs.speedKmh.toFixed(0), W * 0.06, panY + panH * 0.52);

    ctx.fillStyle = '#7a9f8c';
    ctx.font = `${Math.max(8, H * 0.026)}px DM Sans, sans-serif`;
    ctx.fillText('km/h', W * 0.06, panY + panH * 0.70);

    // Indicador da Via Ativa no Painel
    ctx.fillStyle = '#4de89a';
    ctx.font = `bold ${Math.max(9, H * 0.03)}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${stage.name} (${stage.speedLimit} km/h)`, W / 2, panY + panH * 0.38);

    // Status da Via / Alerta Pedagógico
    const statusColor = rs.statusLevel === 'green' ? '#4de89a' : (rs.statusLevel === 'yellow' ? '#f1c40f' : '#e74c3c');
    ctx.fillStyle = statusColor;
    ctx.font = `bold ${Math.max(9, H * 0.028)}px Manrope, sans-serif`;
    ctx.fillText(rs.statusText, W / 2, panY + panH * 0.64);

    // Radar de Proximidade Frontal (Barra PDC)
    const pdcW = 120;
    const pdcH = 4;
    const pdcY = panY + panH * 0.78;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, W / 2 - pdcW / 2, pdcY, pdcW, pdcH, 2);
    ctx.fill();

    const pdcRatio = Math.max(0, Math.min(1, rs.frontDistance / 30.0));
    ctx.fillStyle = rs.frontCollisionRisk ? '#e74c3c' : (rs.frontDistance < 14 ? '#f1c40f' : '#4de89a');
    roundRect(ctx, W / 2 - pdcW / 2, pdcY, pdcW * pdcRatio, pdcH, 2);
    ctx.fill();

    // Marcha D
    ctx.fillStyle = '#4de89a';
    ctx.font = `bold ${Math.max(18, H * 0.08)}px Manrope, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('D', W - W * 0.06, panY + panH * 0.56);
  }

  /* ══════════════════════════════════════════════
     RENDERIZAÇÃO DOS 3 RETROVISORES DINÂMICOS (VIAS & BALIZA)
     ══════════════════════════════════════════════ */

  function drawRoadMirrors(rs) {
    const leftCanvas   = document.getElementById('mirrorLeftCanvas');
    const centerCanvas = document.getElementById('mirrorCenterCanvas');
    const rightCanvas  = document.getElementById('mirrorRightCanvas');

    // 1. RETROVISOR ESQUERDO
    if (leftCanvas) {
      const ctx = leftCanvas.getContext('2d');
      const W = leftCanvas.width, H = leftCanvas.height;
      if (W > 5 && H > 5) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0b1610';
        ctx.fillRect(0, 0, W, H);

        const mHor = H * 0.45;
        ctx.fillStyle = '#14221a';
        ctx.fillRect(0, mHor, W, H - mHor);

        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(W * 0.7, mHor); ctx.lineTo(W * 0.9, H); ctx.stroke();

        const dy = rs.leftCar.y;
        if (dy < 10.0 && dy > -35.0) {
          const depth = Math.max(0.5, -dy);
          const ps = Math.min(1.2, 5.0 / depth);
          const cx = W * 0.45;
          const cy = mHor + (H - mHor) * 0.5;
          const cw = Math.max(12, 45 * ps);
          const ch = Math.max(8, 28 * ps);

          ctx.fillStyle = rs.leftCar.color;
          roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 3);
          ctx.fill();

          ctx.fillStyle = '#fffae0';
          ctx.fillRect(cx - cw * 0.42, cy - 2, cw * 0.22, 4);
          ctx.fillRect(cx + cw * 0.20, cy - 2, cw * 0.22, 4);
        }

        ctx.fillStyle = 'rgba(77,232,154,0.75)';
        ctx.font = '7px Manrope, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('ESQ • FAIXA 1', 5, 10);
      }
    }

    // 2. RETROVISOR CENTRAL
    if (centerCanvas) {
      const ctx = centerCanvas.getContext('2d');
      const W = centerCanvas.width, H = centerCanvas.height;
      if (W > 5 && H > 5) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0a140e';
        ctx.fillRect(0, 0, W, H);

        const mHor = H * 0.42;
        ctx.fillStyle = '#17281f';
        ctx.fillRect(0, mHor, W, H - mHor);

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W * 0.5 - 10, mHor); ctx.lineTo(W * 0.15, H);
        ctx.moveTo(W * 0.5 + 10, mHor); ctx.lineTo(W * 0.85, H);
        ctx.stroke();

        const dy = rs.rearCar.y;
        if (dy < -2.0) {
          const depth = Math.max(1.0, -dy);
          const ps = Math.min(1.0, 7.0 / depth);
          const cx = W * 0.5;
          const cy = mHor + (H - mHor) * 0.52;
          const cw = Math.max(16, 60 * ps);
          const ch = Math.max(10, 36 * ps);

          ctx.fillStyle = rs.rearCar.color;
          roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 4);
          ctx.fill();

          ctx.fillStyle = '#fffdd0';
          ctx.fillRect(cx - cw * 0.44, cy - 2, cw * 0.22, 4);
          ctx.fillRect(cx + cw * 0.22, cy - 2, cw * 0.22, 4);
        }

        // Ambulância SAMU em aproximação no retrovisor central
        if (rs.ambulance.active && rs.ambulance.y < -1.0) {
          const ambDepth = Math.max(1.0, -rs.ambulance.y);
          const ambPs = Math.min(1.2, 8.0 / ambDepth);
          const ambCx = W * 0.40;
          const ambCy = mHor + (H - mHor) * 0.52;
          const ambCw = Math.max(18, 65 * ambPs);
          const ambCh = Math.max(12, 42 * ambPs);

          ctx.fillStyle = '#f8fafc';
          roundRect(ctx, ambCx - ambCw / 2, ambCy - ambCh / 2, ambCw, ambCh, 4);
          ctx.fill();

          ctx.fillStyle = '#dc2626';
          ctx.fillRect(ambCx - ambCw / 2, ambCy - 2, ambCw, 4);

          const flash = (Math.floor(performance.now() / 120) % 2) === 0;
          ctx.fillStyle = flash ? '#00f2fe' : '#ef4444';
          ctx.beginPath(); ctx.arc(ambCx, ambCy - ambCh * 0.48, Math.max(2, 6 * ambPs), 0, Math.PI * 2); ctx.fill();

          ctx.fillStyle = flash ? '#00f2fe' : '#f87171';
          ctx.font = 'bold 7px Manrope, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🚨 SAMU (Art. 189)', W / 2, H - 4);
        }

        ctx.fillStyle = 'rgba(77,232,154,0.75)';
        ctx.font = '7.5px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RETROVISOR CENTRAL', W / 2, 10);
      }
    }

    // 3. RETROVISOR DIREITO
    if (rightCanvas) {
      const ctx = rightCanvas.getContext('2d');
      const W = rightCanvas.width, H = rightCanvas.height;
      if (W > 5 && H > 5) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0b1610';
        ctx.fillRect(0, 0, W, H);

        const mHor = H * 0.45;
        ctx.fillStyle = '#14221a';
        ctx.fillRect(0, mHor, W, H - mHor);

        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(W * 0.3, mHor); ctx.lineTo(W * 0.1, H); ctx.stroke();

        const dy = rs.rightCar.y;
        if (dy < 0 && dy > -25.0) {
          const depth = Math.max(0.5, -dy);
          const ps = Math.min(1.2, 5.0 / depth);
          const cx = W * 0.55;
          const cy = mHor + (H - mHor) * 0.5;
          const cw = Math.max(12, 45 * ps);
          const ch = Math.max(8, 28 * ps);

          ctx.fillStyle = rs.rightCar.color;
          roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 3);
          ctx.fill();

          ctx.fillStyle = '#fffdd0';
          ctx.fillRect(cx - cw * 0.42, cy - 2, cw * 0.22, 4);
          ctx.fillRect(cx + cw * 0.20, cy - 2, cw * 0.22, 4);

          ctx.fillStyle = '#4de89a';
          ctx.beginPath(); ctx.arc(cx + cw * 0.35, cy + ch * 0.3, 3, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = 'rgba(77,232,154,0.75)';
        ctx.font = '7px Manrope, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('DIR • FAIXA 3', W - 5, 10);
      }
    }
  }

  function drawBalizaMirrors(st) {
    const leftCanvas   = document.getElementById('mirrorLeftCanvas');
    const centerCanvas = document.getElementById('mirrorCenterCanvas');
    const rightCanvas  = document.getElementById('mirrorRightCanvas');

    const renderMirror = (canvas, side, label) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      if (W < 5 || H < 5) return;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0a140e';
      ctx.fillRect(0, 0, W, H);

      const mHor = H * 0.45;
      ctx.fillStyle = '#14221a';
      ctx.fillRect(0, mHor, W, H - mHor);

      for (const car of SCENARIO.parkedCars) {
        const dy = st.y - car.y;
        const dx = car.x - st.x;
        if (dy > 0.2 && dy < 15) {
          const depth = Math.max(0.2, dy);
          const ps = 0.7 / depth;
          const offsetX = side === 'left' ? -1 : (side === 'right' ? 1 : 0);
          const cx = W / 2 + (dx + offsetX) * ps * 25;
          const cy = mHor + (1 / depth) * 16;
          const cw = Math.max(6, VEHICLE.width * ps * 28);
          const ch = Math.max(4, VEHICLE.length * ps * 16);

          ctx.fillStyle = '#344a3c';
          ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
          ctx.fillStyle = '#ff2222';
          ctx.fillRect(cx - cw / 2 + 1, cy - 2, cw * 0.3, 2);
          ctx.fillRect(cx + cw / 2 - cw * 0.3 - 1, cy - 2, cw * 0.3, 2);
        }
      }

      ctx.fillStyle = 'rgba(77,232,154,0.7)';
      ctx.font = '7px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, 10);
    };

    renderMirror(leftCanvas, 'left', 'ESQUERDO');
    renderMirror(centerCanvas, 'center', 'CENTRAL');
    renderMirror(rightCanvas, 'right', 'DIREITO');
  }

  /* Troca de Cenário: Baliza Básica vs Direção em Vias vs Cidade CTB */
  function switchScenario(scenarioId) {
    if (scenarioId === currentScenario) return;
    currentScenario = scenarioId;

    const btnBaliza = document.getElementById('simBtnBaliza');
    const btnVias   = document.getElementById('simBtnVias');
    const btnCidade = document.getElementById('simBtnCidade');
    const balizaHud = document.getElementById('simBalizaHudInfo');
    const roadHud   = document.getElementById('simRoadHud');
    const balizaTabs= document.getElementById('simBalizaModeSwitcher');
    const ctbBar    = document.getElementById('simCtbBar');
    const sitPanel  = document.getElementById('simSituationPanel');

    if (btnBaliza) btnBaliza.classList.toggle('active', scenarioId === 'baliza-basica');
    if (btnVias)   btnVias.classList.toggle('active', scenarioId === 'direcao-vias');
    if (btnCidade) btnCidade.classList.toggle('active', scenarioId === 'cidade-ctb');

    if (scenarioId === 'direcao-vias' || scenarioId === 'cidade-ctb') {
      if (balizaHud)  balizaHud.style.display  = 'none';
      if (balizaTabs) balizaTabs.style.display = 'none';
      if (roadHud)    roadHud.style.display    = 'flex';
      if (ctbBar)     ctbBar.style.display     = 'flex';
      if (sitPanel)   sitPanel.style.display   = 'block';

      roadState.stageIndex = 0;
      roadState.stageTimer = 25.0;
      roadState.playerX = 0;
      roadState.speedKmh = ROAD_STAGES[0].speedLimit;
      roadState.targetSpeedKmh = ROAD_STAGES[0].speedLimit;
      roadState.rightCar.y = 0.5;
      roadState.frontCar.y = 19.0;
      roadState.leftCar.y = -28.0;
      roadState.rearCar.y = -24.0;
      roadState.trafficLight.y = 35.0;
      roadState.crosswalk.y = 31.5;

      updateActionButtons();
      if (scenarioId === 'cidade-ctb') {
        showInstruction('🏙️ <b>Simulador de Trânsito Real & CTB:</b> Você está sob fiscalização estrita do <b>Agente Silva</b>! Respeite áreas escolares (30 km/h), placa PARE (R-1), passagens férreas, idosos e dê passagem ao SAMU 192 (Art. 189)!');
        playRadioChirp();
      } else {
        showInstruction('🛣️ <b>Treinamento em Vias do Cotidiano:</b> Pratique velocidades reais, preferências de cruzamento e distâncias seguras de seguimento (Art. 192 CTB). A velocidade muda a cada 25s!');
      }
      updateRoadHudDom(ROAD_STAGES[0]);
      updateCtbDom();
    } else {
      if (balizaHud)  balizaHud.style.display  = 'flex';
      if (balizaTabs) balizaTabs.style.display = 'flex';
      if (roadHud)    roadHud.style.display    = 'none';
      if (ctbBar)     ctbBar.style.display     = 'none';
      if (sitPanel)   sitPanel.style.display   = 'none';

      doReset();
    }

    resizeCanvases();
    if (state || currentScenario !== 'baliza-basica') redraw();
  }

  /* ══════════════════════════════════════════════
     LOOP PRINCIPAL DE ANIMAÇÃO
     ══════════════════════════════════════════════ */

  function simLoop(timestamp) {
    if (!state || state.phase !== 'running') return;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (currentScenario === 'direcao-vias' || currentScenario === 'cidade-ctb') {
      updateRoadPhysics(dt);
    } else {
      if (state.mode === 'trajectory') {
        runTrajectoryPurePursuit(dt);
      } else if (state.mode === 'demo') {
        runDemo(dt);
      } else {
        state = updatePhysics(state, dt);

        if (collisionCooldown > 0) {
          collisionCooldown--;
        } else if (checkCollisions(state)) {
          state.collisions++;
          collisionCooldown = 45;
          const a = state.angle * DEG;
          const dir = state.gear === 'R' ? -1 : 1;
          state.x -= Math.sin(a) * 0.12 * dir;
          state.y += Math.cos(a) * 0.12 * dir;
          state.speed = 0;
          showInstruction('⚠️ Atenção — você tocou em outro veículo ou no meio-fio! Corrija a rota.');
        }

        if (state.mode === 'guided') tryAdvanceStep();
      }
    }

    redraw();
    animId = requestAnimationFrame(simLoop);
  }

  /* ══════════════════════════════════════════════
     CONTROLE CINEMÁTICO REALISTA DE RÉ (SEM BALANÇO)
     ══════════════════════════════════════════════ */

  function runTrajectoryPurePursuit(dt) {
    const ts = state.trajectoryState;
    if (ts.stage !== 'executing') return;

    const waypoints = ts.pathWaypoints;
    const totalDist = ts.totalPathLength;

    if (!waypoints || waypoints.length < 3 || totalDist < 0.3) {
      finishTrajectoryExecution();
      return;
    }

    /* Perfil Suave de Aceleração e Desaceleração */
    const MAX_SPEED = 0.78; // ~2.8 km/h (velocidade ideal e segura de baliza)
    const ACCEL = 0.45;     // m/s² (arranque suave sem tranco)
    const DECEL = 0.55;     // m/s² (frenagem gradual e elegante)

    const currentDist = ts.progressDist || 0;
    const distRemaining = totalDist - currentDist;

    /* Condição de parada: veículo completou o percurso até a vaga */
    if (distRemaining <= 0.04) {
      finishTrajectoryExecution();
      return;
    }

    const stoppingDist = (ts.currentSpeed * ts.currentSpeed) / (2 * DECEL) + 0.08;
    if (distRemaining <= stoppingDist) {
      ts.currentSpeed = Math.max(0.08, ts.currentSpeed - DECEL * dt);
    } else if (ts.currentSpeed < MAX_SPEED) {
      ts.currentSpeed = Math.min(MAX_SPEED, ts.currentSpeed + ACCEL * dt);
    }

    ts.progressDist = Math.min(totalDist, currentDist + ts.currentSpeed * dt);
    state.speed = ts.currentSpeed;
    state.gear = 'R';

    /* Interpolar posição ao longo dos waypoints reamostrados */
    let idx = 0;
    while (idx < waypoints.length - 1 && waypoints[idx + 1].dist < ts.progressDist) {
      idx++;
    }
    const p1 = waypoints[idx];
    const p2 = idx + 1 < waypoints.length ? waypoints[idx + 1] : p1;
    const segLen = Math.max(0.0001, p2.dist - p1.dist);
    const t = Math.max(0, Math.min(1, (ts.progressDist - p1.dist) / segLen));

    /* Posição suave da traseira do veículo */
    const rx = lerp(p1.x, p2.x, t);
    const ry = lerp(p1.y, p2.y, t);

    /* Orientação suave da carroceria (C¹ contínua, sem oscilações) */
    const targetHeading = lerpAngle(p1.heading, p2.heading, t);
    state.angle = lerpAngle(state.angle, targetHeading, Math.min(1.0, 16 * dt));

    /* Volante segue 100% o esterçamento da manobra */
    const targetSteer = lerp(p1.steer, p2.steer, t);
    state.steerAngle = lerp(state.steerAngle, targetSteer, Math.min(1.0, 15 * dt));

    /* O centro do veículo é posicionado rigidamente a partir da traseira e do ângulo */
    const halfL = VEHICLE.length / 2; // 1.9m
    const hRad = state.angle * DEG;
    state.x = rx + Math.sin(hRad) * halfL;
    state.y = ry - Math.cos(hRad) * halfL;
    state.distanceTraveled += ts.currentSpeed * dt;

    /* Rastrear ângulo máximo de entrada para avaliação pedagógica */
    const absAngle = Math.abs(state.angle);
    if (absAngle > ts.maxAngleAchieved) {
      ts.maxAngleAchieved = absAngle;
    }

    /* Rastro percorrido pelo centro */
    if (!state.trajectory.length || Math.hypot(state.x - state.trajectory[state.trajectory.length - 1].x, state.y - state.trajectory[state.trajectory.length - 1].y) > 0.15) {
      state.trajectory.push({ x: state.x, y: state.y });
    }

    /* Detecção de colisão contínua */
    if (collisionCooldown > 0) {
      collisionCooldown--;
    } else if (checkCollisions(state)) {
      state.collisions++;
      collisionCooldown = 35;
      showInstruction('⚠️ Cuidado: a traseira ou a lateral do veículo se aproximou excessivamente de um obstáculo!');
    }
  }

  function finishTrajectoryExecution() {
    state.speed = 0;
    state.steerAngle = 0;
    state.phase = 'finished';
    state.endTime = Date.now();
    state.trajectoryState.stage = 'finished';
    updateActionButtons();
    doShowTrajectoryResult();
  }

  function runDemo(dt) {
    const path = state.demoPath;
    if (!path || !path.length) return;
    state.demoT = Math.min(state.demoT + dt * 0.38, path.length - 1);
    const idx = Math.floor(state.demoT);
    const t = state.demoT - idx;
    const a = path[idx], b = idx + 1 < path.length ? path[idx + 1] : path[idx];
    state.x = lerp(a.x, b.x, t);
    state.y = lerp(a.y, b.y, t);
    state.angle = lerpAngle(a.angle, b.angle, t);
    state.gear = a.gear;
    state.speed = lerp(a.speed || 0, b.speed || 0, t);

    /* Volante segue 100% o movimento no modo Demo */
    let dAngle = b.angle - a.angle;
    while (dAngle > 180)  dAngle -= 360;
    while (dAngle < -180) dAngle += 360;
    const demoSteerTarget = a.gear === 'R' ? Math.max(-35, Math.min(35, -dAngle * 2.8)) : Math.max(-35, Math.min(35, dAngle * 2.0));
    state.steerAngle = lerp(state.steerAngle, demoSteerTarget, Math.min(1.0, 12 * dt));

    if (state.demoT >= path.length - 1 - 0.01) {
      state.steerAngle = 0;
      state.phase = 'finished';
      state.endTime = Date.now();
      doShowResult(state);
    }
  }

  function tryAdvanceStep() {
    if (state.stepIndex >= GUIDED_STEPS.length) return;
    const step = GUIDED_STEPS[state.stepIndex];
    if (!step.check(state)) return;

    state.stepIndex++;
    if (state.stepIndex < GUIDED_STEPS.length) {
      showInstruction(GUIDED_STEPS[state.stepIndex].label);
    } else {
      state.phase = 'finished';
      state.endTime = Date.now();
      doShowResult(state);
    }
  }

  function redraw() {
    if (currentScenario === 'direcao-vias' || currentScenario === 'cidade-ctb') {
      const topC = document.getElementById('topCanvas');
      const drvC = document.getElementById('driverCanvas');
      const stC  = document.getElementById('steeringCanvas');
      if (topC) drawRoadTopView(topC, roadState);
      if (drvC) drawRoadDriverView(drvC, roadState);
      if (stC)  drawSteeringWheel(stC, roadState.steerAngle);
      drawRoadMirrors(roadState);
      return;
    }

    const topC  = document.getElementById('topCanvas');
    const drvC  = document.getElementById('driverCanvas');
    const stC   = document.getElementById('steeringCanvas');
    if (topC) drawTopView(topC, state);
    if (drvC) drawDriverView(drvC, state);
    if (stC)  drawSteeringWheel(stC, state.steerAngle);
    if (state) drawBalizaMirrors(state);

    const spd = document.getElementById('simSpeedDisplay');
    if (spd) spd.textContent = (state.speed * 3.6).toFixed(1) + ' km/h';
    const ang = document.getElementById('simSteeringAngle');
    if (ang) ang.textContent = (state.steerAngle > 0 ? '+' : '') + state.steerAngle.toFixed(0) + '°';
  }

  /* ══════════════════════════════════════════════
     TELAS DE RESULTADO & FEEDBACK
     ══════════════════════════════════════════════ */

  function doShowTrajectoryResult() {
    cancelAnimationFrame(animId);
    const { total, breakdown, feedback } = calcTrajectoryScore(state);
    state.score = total;
    state.breakdown = breakdown;

    const overlay = document.getElementById('simResultOverlay');
    if (!overlay) return;

    const titleEl = document.getElementById('simResultTitle');
    const scoreEl = document.getElementById('simResultScore');
    const detailEl = document.getElementById('simResultDetail');

    const emoji = total >= 900 ? '🏆' : total >= 700 ? '🎖️' : total >= 500 ? '⭐' : '🔄';
    if (titleEl) titleEl.textContent = `${emoji} ${total >= 700 ? 'Baliza de Ré Concluída!' : 'Continue Praticando a Ré!'}`;
    if (scoreEl) scoreEl.textContent = `${total} / 1000`;
    if (detailEl) {
      detailEl.innerHTML = `
        <div style="font-size:12px; color:#4de89a; margin-bottom:12px; line-height:1.4">${feedback}</div>
        ${Object.entries(breakdown).map(([k, v]) => `
          <div class="sim-result-row">
            <span>${k}</span>
            <div class="sim-result-bar-wrap"><div class="sim-result-bar" style="width:${v}%"></div></div>
            <span>${v}%</span>
          </div>`).join('')}
      `;
    }
    overlay.style.display = 'flex';
    overlay.hidden = false;
  }

  function doShowResult(st) {
    cancelAnimationFrame(animId);
    const { total, breakdown } = calcStandardScore(st);
    st.score = total;
    st.breakdown = breakdown;

    const overlay = document.getElementById('simResultOverlay');
    if (!overlay) return;

    const titleEl = document.getElementById('simResultTitle');
    const scoreEl = document.getElementById('simResultScore');
    const detailEl = document.getElementById('simResultDetail');

    const emoji = total >= 900 ? '🏆' : total >= 700 ? '🎖️' : total >= 500 ? '⭐' : '🔄';
    if (titleEl) titleEl.textContent = `${emoji} ${total >= 700 ? 'Manobra Concluída!' : 'Continue Praticando!'}`;
    if (scoreEl) scoreEl.textContent = `${total} / 1000`;
    if (detailEl) {
      detailEl.innerHTML = Object.entries(breakdown).map(([k, v]) => `
        <div class="sim-result-row">
          <span>${k}</span>
          <div class="sim-result-bar-wrap"><div class="sim-result-bar" style="width:${v}%"></div></div>
          <span>${v}%</span>
        </div>`).join('');
    }
    overlay.style.display = 'flex';
    overlay.hidden = false;
  }

  function hideOverlay() {
    const ol = document.getElementById('simResultOverlay');
    if (ol) {
      ol.style.display = 'none';
      ol.hidden = true;
    }
  }

  /* ══════════════════════════════════════════════
     COORDENADAS DO MOUSE / TOUCH NO TOP CANVAS
     ══════════════════════════════════════════════ */

  function getCanvasWorldCoords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);

    const scale = Math.min(canvas.width / SCENARIO.worldW, canvas.height / SCENARIO.worldH);
    const offX = (canvas.width - SCENARIO.worldW * scale) / 2;
    const offY = (canvas.height - SCENARIO.worldH * scale) / 2;

    return {
      wx: (px - offX) / scale,
      wy: (py - offY) / scale,
      px, py
    };
  }

  /* ══════════════════════════════════════════════
     EVENTOS DE POINTER (MOUSE & TOUCH) NO TOP CANVAS
     ══════════════════════════════════════════════ */

  function onTopPointerDown(e) {
    if (currentScenario === 'direcao-vias') {
      const canvas = document.getElementById('topCanvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const relX = (clientX - rect.left) / rect.width;
        const stage = ROAD_STAGES[roadState.stageIndex];
        const maxOffset = (stage.roadWidth / 2) - 1.2;
        const targetX = (relX - 0.5) * (stage.roadWidth + 2.0);
        roadState.playerX = Math.max(-maxOffset, Math.min(maxOffset, targetX));
        roadState.steerAngle = (targetX > roadState.playerX ? 16 : -16);
        e.preventDefault();
      }
      return;
    }

    if (!state || state.mode !== 'trajectory') return;
    const canvas = document.getElementById('topCanvas');
    if (!canvas) return;

    const { wx, wy } = getCanvasWorldCoords(canvas, e);
    const ts = state.trajectoryState;

    /* FASE 1: Arrastar carro até alinhar retrovisores */
    if (ts.stage === 'align') {
      const distToCar = Math.hypot(wx - state.x, wy - state.y);
      if (distToCar < 2.5) {
        ts.isDraggingCar = true;
        ts.dragOffset = { x: state.x - wx, y: state.y - wy };
        document.getElementById('simViewTop')?.classList.add('cursor-grabbing');
        e.preventDefault();
      }
    }
    /* FASE 2: Desenhar percurso da ré a partir da TRASEIRA do carro */
    else if (ts.stage === 'draw') {
      const rearX = state.x;
      const rearY = state.y + VEHICLE.length / 2;
      const distToRear = Math.hypot(wx - rearX, wy - rearY);
      const distToCar = Math.hypot(wx - state.x, wy - state.y);

      if (distToRear < 2.5 || distToCar < 2.5) {
        ts.isDrawingPath = true;
        ts.drawnPoints = [{ x: rearX, y: rearY }];
        showInstruction('🔄 <b>Traçando a ré com a traseira:</b> Desenhe o percurso entrando na vaga verde.');
        e.preventDefault();
      }
    }
  }

  function onTopPointerMove(e) {
    if (currentScenario === 'direcao-vias') {
      if (e.buttons === 1 || (e.touches && e.touches.length > 0)) {
        const canvas = document.getElementById('topCanvas');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const relX = (clientX - rect.left) / rect.width;
          const stage = ROAD_STAGES[roadState.stageIndex];
          const maxOffset = (stage.roadWidth / 2) - 1.2;
          const targetX = (relX - 0.5) * (stage.roadWidth + 2.0);
          roadState.playerX = Math.max(-maxOffset, Math.min(maxOffset, targetX));
          roadState.steerAngle = (targetX > roadState.playerX ? 16 : -16);
          e.preventDefault();
        }
      }
      return;
    }

    if (!state || state.mode !== 'trajectory') return;
    const canvas = document.getElementById('topCanvas');
    if (!canvas) return;

    const { wx, wy } = getCanvasWorldCoords(canvas, e);
    const ts = state.trajectoryState;

    /* Arrastando o carro */
    if (ts.isDraggingCar) {
      const newX = Math.max(4.0, Math.min(9.2, wx + ts.dragOffset.x));
      const newY = Math.max(1.5, Math.min(14.0, wy + ts.dragOffset.y));
      state.x = newX;
      state.y = newY;

      const carA = SCENARIO.parkedCars[0];
      const deltaY = Math.abs(state.y - carA.y);
      const latGap = (carA.x - VEHICLE.width / 2) - (state.x + VEHICLE.width / 2);
      const aligned = deltaY < 1.1 && state.x >= 5.2 && state.x <= 9.0;

      ts.retrovisoresAligned = aligned;
      if (aligned) {
        showInstruction(`✨ <b>Retrovisores Alinhados!</b> (Afastamento lateral: <b>${Math.max(0, latGap).toFixed(2)}m</b>). Solte o mouse para confirmar.`);
      } else {
        const dStr = (state.y - carA.y).toFixed(1);
        showInstruction(`🚗 Posicione o carro ao lado do <b>Veículo A</b>. (Deslocamento longitudinal: ${dStr > 0 ? '+' : ''}${dStr}m)`);
      }
      e.preventDefault();
    }
    /* Desenhando o trajeto com a traseira */
    else if (ts.isDrawingPath) {
      const last = ts.drawnPoints[ts.drawnPoints.length - 1];
      const dist = Math.hypot(wx - last.x, wy - last.y);
      if (dist > 0.18) {
        ts.drawnPoints.push({ x: wx, y: wy });
      }
      e.preventDefault();
    }
    /* Hover feedback */
    else {
      const viewTop = document.getElementById('simViewTop');
      if (!viewTop) return;
      const distToCar = Math.hypot(wx - state.x, wy - state.y);
      if (ts.stage === 'align' && distToCar < 2.5) {
        viewTop.classList.add('cursor-grab');
      } else if (ts.stage === 'draw' && distToCar < 2.2) {
        viewTop.classList.add('cursor-draw');
      } else {
        viewTop.classList.remove('cursor-grab', 'cursor-draw', 'cursor-grabbing');
      }
    }
  }

  function onTopPointerUp(e) {
    if (currentScenario === 'direcao-vias') {
      roadState.steerAngle = 0;
      return;
    }
    if (!state || state.mode !== 'trajectory') return;
    const ts = state.trajectoryState;
    const viewTop = document.getElementById('simViewTop');
    if (viewTop) viewTop.classList.remove('cursor-grabbing');

    /* Soltou o arraste do carro — MANTÉM EXATAMENTE ONDE O ALUNO POSICIONOU */
    if (ts.isDraggingCar) {
      ts.isDraggingCar = false;
      const carA = SCENARIO.parkedCars[0];
      const deltaY = Math.abs(state.y - carA.y);
      const latGap = Math.max(0.2, (carA.x - VEHICLE.width / 2) - (state.x + VEHICLE.width / 2));
      const aligned = deltaY < 1.2 && state.x >= 5.2 && state.x <= 9.0;

      if (aligned) {
        /* O posicionamento fica estritamente onde o aluno posicionou */
        ts.retrovisoresAligned = true;
        ts.alignedX = state.x;
        ts.alignedY = state.y;
        const latScore = Math.max(0, 100 - Math.abs(latGap - 0.75) * 35);
        const yScore = Math.max(0, 100 - deltaY * 25);
        ts.alignScore = Math.round((latScore + yScore) / 2);
        ts.stage = 'draw';

        showInstruction(`✨ <b>Passo 2:</b> Posição confirmada! (Afastamento lateral: <b>${latGap.toFixed(2)}m</b>). Agora <b>clique na traseira do carro azul</b> e desenhe o percurso de ré até a <b>vaga verde</b>.`);
        updateActionButtons();
        redraw();
      } else {
        showInstruction('💡 Arraste o carro um pouco mais até alinhar exatamente ao lado do <b>Veículo A</b>.');
      }
    }
    /* Soltou o desenho do trajeto */
    else if (ts.isDrawingPath) {
      ts.isDrawingPath = false;
      if (ts.drawnPoints.length >= 4) {
        const lastP = ts.drawnPoints[ts.drawnPoints.length - 1];
        const inVaga = lastP.x >= 8.2 && lastP.x <= 12.0 && lastP.y >= 10.0 && lastP.y <= 18.5;

        if (inVaga) {
          ts.stage = 'ready';
          const processed = processDrawnPath(ts.drawnPoints);
          ts.pathWaypoints = processed.waypoints;
          ts.totalPathLength = processed.totalLength;
          ts.currentSpeed = 0;
          showInstruction('✅ <b>Trajetória de ré definida!</b> Clique em <b>▶ Executar Manobra</b> para assistir ao veículo manobrar pela traseira.');
          updateActionButtons();
        } else {
          showInstruction('⚠️ O percurso desenhado não alcançou a <b>vaga verde</b>. Clique na traseira do carro e trace novamente até dentro da vaga.');
          ts.drawnPoints = [];
        }
      } else {
        ts.drawnPoints = [];
      }
    }
  }

  function updateActionButtons() {
    const execBtn    = document.getElementById('simExecuteDrawBtn');
    const clearBtn   = document.getElementById('simClearDrawBtn');
    const realignBtn = document.getElementById('simRealignBtn');
    if (!state || state.mode !== 'trajectory') {
      if (execBtn) execBtn.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
      if (realignBtn) realignBtn.style.display = 'none';
      return;
    }

    const stage = state.trajectoryState.stage;
    if (execBtn)    execBtn.style.display    = stage === 'ready' ? 'inline-block' : 'none';
    if (clearBtn)   clearBtn.style.display   = (stage === 'ready' || stage === 'finished') ? 'inline-block' : 'none';
    if (realignBtn) realignBtn.style.display = (stage === 'draw' || stage === 'ready' || stage === 'finished') ? 'inline-block' : 'none';
  }

  /* ══════════════════════════════════════════════
     AÇÕES DE CONTROLE DE MODO & REINICIALIZAÇÃO TOTAL
     ══════════════════════════════════════════════ */

  function doReset() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    inputState = { steerLeft: false, steerRight: false, accel: false, brake: false };
    collisionCooldown = 0;
    hideOverlay();

    stopAllProximityAudio();
    roadState.trainFatalCrash = false;
    roadState.trainCrashCountdown = 0;
    const fatalModal = document.getElementById('simTrainFatalModal');
    if (fatalModal) fatalModal.style.display = 'none';

    if (currentScenario === 'direcao-vias' || currentScenario === 'cidade-ctb') {
      roadState.stageIndex = 0;
      roadState.stageTimer = 25.0;
      roadState.playerX = 0;
      const initialLimit = ROAD_STAGES[0].speedLimit;
      roadState.speedKmh = initialLimit;
      roadState.targetSpeedKmh = initialLimit;
      roadState.steerAngle = 0;
      roadState.collisionFlashTimer = 0;
      roadState.collidingCarId = null;
      roadState.isTwoWay = false;
      roadState.twoWayTimer = 0;
      roadState.ambulance.active = false;
      roadState.ambulance.y = -45.0;
      roadState.policeCruiser.active = false;
      roadState.policeCruiser.sirenActive = false;
      roadState.policeCruiser.y = 55.0;
      roadState.railCrossing.trainPassing = false;
      roadState.railCrossing.barrierDown = false;
      roadState.railCrossing.y = 52.0;
      roadState.railCrossing.hasStopped = false;
      roadState.railCrossing.hasViolated = false;
      roadState.rightCar.y = 0.5;
      roadState.frontCar.y = 19.0;
      roadState.leftCar.y = -28.0;
      roadState.rearCar.y = -24.0;
      if (currentScenario === 'cidade-ctb') {
        showInstruction('🏙️ <b>Cidade Realista & CTB:</b> Você está sob fiscalização estrita do <b>Agente Silva</b>! Respeite semáforos (Art. 208), faixa de pedestres (Art. 214), ciclistas a 1,50m (Art. 201), use seta (Art. 196) e velocidade da via (Art. 218).');
      } else {
        showInstruction('🛣️ <b>Treinamento de Vias & Distâncias:</b> Observe a <b>roda dianteira e lateral do veículo à sua direita</b>. Enquanto ela for visível, o sinal permanece <b>VERDE</b> sem risco de colisão. A velocidade mudará a cada 20s!');
      }
      updateRoadHudDom(ROAD_STAGES[0]);
      redraw();
      lastTime = performance.now();
      animId = requestAnimationFrame(simLoop);
      return;
    }

    const mode = (state && state.mode) ? state.mode : 'trajectory';
    state = freshState(mode);

    document.querySelectorAll('.sim-mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const mb = document.getElementById('simModeBadge');
    if (mb) {
      if (mode === 'trajectory') { mb.textContent = 'TRAJETÓRIA'; mb.style.background = '#1a3028'; }
      else if (mode === 'guided') { mb.textContent = 'GUIADO'; mb.style.background = ''; }
      else if (mode === 'free') { mb.textContent = 'LIVRE'; mb.style.background = '#1a3050'; }
    }

    if (mode === 'trajectory') {
      showInstruction('<b>Passo 1:</b> Arraste o carro com o mouse até a lateral do <b>Veículo A</b> para alinhar os retrovisores.');
    } else if (mode === 'guided') {
      showInstruction(GUIDED_STEPS[0].label);
    } else {
      showInstruction('🟢 Modo livre — pratique com os pedais, volante e setas do teclado.');
    }

    updateActionButtons();
    redraw();
    lastTime = performance.now();
    animId = requestAnimationFrame(simLoop);
  }

  function switchMode(newMode) {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    inputState = { steerLeft: false, steerRight: false, accel: false, brake: false };
    collisionCooldown = 0;
    hideOverlay();

    state = freshState(newMode);

    document.querySelectorAll('.sim-mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === newMode);
    });

    const mb = document.getElementById('simModeBadge');
    if (mb) {
      if (newMode === 'trajectory') { mb.textContent = 'TRAJETÓRIA'; mb.style.background = '#1a3028'; }
      else if (newMode === 'guided') { mb.textContent = 'GUIADO'; mb.style.background = ''; }
      else if (newMode === 'free') { mb.textContent = 'LIVRE'; mb.style.background = '#1a3050'; }
    }

    if (newMode === 'trajectory') {
      showInstruction('<b>Passo 1:</b> Arraste o carro com o mouse até a lateral do <b>Veículo A</b> para alinhar os retrovisores.');
    } else if (newMode === 'guided') {
      showInstruction(GUIDED_STEPS[0].label);
    } else {
      showInstruction('🟢 Modo livre — pratique com os pedais, volante e setas do teclado.');
    }

    updateActionButtons();
    redraw();
    lastTime = performance.now();
    animId = requestAnimationFrame(simLoop);
  }

  function doExecuteTrajectory() {
    if (!state || state.mode !== 'trajectory') return;
    const ts = state.trajectoryState;
    if (ts.stage !== 'ready') return;

    ts.stage = 'executing';
    ts.currentSpeed = 0;
    state.speed = 0;
    state.gear = 'R';
    state.trajectory = [];
    state.collisions = 0;
    state.startTime = Date.now();
    updateActionButtons();
    showInstruction('🔄 <b>Executando baliza de ré...</b> O veículo segue a trajetória utilizando sua traseira com aceleração suave.');
  }

  function doClearTrajectory() {
    if (!state || state.mode !== 'trajectory') return;
    if (animId) cancelAnimationFrame(animId);
    const ts = state.trajectoryState;
    ts.stage = 'draw';
    ts.drawnPoints = [];
    ts.pathWaypoints = [];
    ts.totalPathLength = 0;
    ts.progressDist = 0;
    ts.currentSpeed = 0;
    state.x = ts.alignedX || SCENARIO.alignPos.x;
    state.y = ts.alignedY || SCENARIO.alignPos.y;
    state.angle = 0;
    state.steerAngle = 0;
    state.speed = 0;
    state.gear = 'R';
    state.trajectory = [];
    state.collisions = 0;
    state.phase = 'running';
    hideOverlay();
    updateActionButtons();
    showInstruction('✏️ Desenho limpo. <b>Clique na traseira do carro azul</b> e desenhe a curva de ré até a vaga verde.');
    redraw();
    lastTime = performance.now();
    animId = requestAnimationFrame(simLoop);
  }

  function doRealignCar() {
    doReset();
  }

  function doStartDemo() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    inputState = { steerLeft: false, steerRight: false, accel: false, brake: false };
    collisionCooldown = 0;
    state = freshState('demo');
    state.demoPath = buildDemoPath();
    state.demoT = 0;
    hideOverlay();
    updateActionButtons();

    const mb = document.getElementById('simModeBadge');
    if (mb) { mb.textContent = 'DEMO'; mb.style.background = '#1a3a20'; }
    showInstruction('🎬 Demonstração em andamento — observe a manobra de ré feita pela traseira do veículo.');
    lastTime = performance.now();
    animId = requestAnimationFrame(simLoop);
  }

  function doSave() {
    if (!state || !state.score) return;
    const session = AGDStudent.currentSession();
    if (!session) return;

    const delta = {
      xp: Math.round(state.score / 10),
      skills: {
        baliza:    Math.min(10, Math.round(state.score / 100)),
        controle:  state.collisions < 1 ? 6 : 3,
        precisao:  Math.min(10, Math.round((state.breakdown?.['Centralização na vaga'] || state.breakdown?.['Precisão de posição'] || 60) / 12)),
        seguranca: state.collisions === 0 ? 8 : 3
      },
      session: {
        scenarioId: SCENARIO.id, scenarioLabel: SCENARIO.label,
        score: state.score, collisions: state.collisions, mode: state.mode
      }
    };

    if (state.score >= 700) delta.scenarioId = SCENARIO.id;
    if (state.collisions === 0) delta.medal = 'sem-colisao';
    if (state.score >= 900) delta.medal = 'baliza-perfeita';

    const acc = AGDStudent.getAccount(session.studentId);
    if (acc && !acc.progress?.sessions?.length) delta.medal = 'iniciante';

    AGDStudent.updateProgress(session.studentId, delta);

    hideOverlay();
    document.dispatchEvent(new CustomEvent('agd:sim-result-saved', { detail: delta }));
  }

  function showInstruction(html) {
    const el = document.getElementById('simInstText');
    if (el) el.innerHTML = html;
  }

  /* ══════════════════════════════════════════════
     RESIZE
     ══════════════════════════════════════════════ */

  function resizeCanvases() {
    const pairs = [
      ['topCanvas', 'simViewTop', 420, 300],
      ['driverCanvas', 'simViewDriver', 420, 300],
      ['mirrorLeftCanvas', 'mirrorLeft', 100, 60],
      ['mirrorCenterCanvas', 'mirrorCenter', 140, 48],
      ['mirrorRightCanvas', 'mirrorRight', 100, 60]
    ];
    pairs.forEach(([cid, vid, defW, defH]) => {
      const canvas = document.getElementById(cid);
      const view   = document.getElementById(vid);
      if (!canvas || !view) return;
      const rect = view.getBoundingClientRect();
      const w = Math.floor(rect.width)  || view.offsetWidth  || defW;
      const h = Math.floor(rect.height) || view.offsetHeight || defH;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }
    });
  }

  /* ══════════════════════════════════════════════
     TECLADO & ENTRADA
     ══════════════════════════════════════════════ */

  function onKeyDown(e) {
    const isRoad = currentScenario === 'direcao-vias' || currentScenario === 'cidade-ctb';
    if (!isRoad && (!state || state.phase !== 'running')) return;

    const k = e.key.toLowerCase();

    // Controle de Setas (Sinalização - CTB Art. 196) com as teclas Q e E
    if (k === 'q') {
      toggleTurnSignal('left');
      e.preventDefault();
      return;
    }
    if (k === 'e') {
      toggleTurnSignal('right');
      e.preventDefault();
      return;
    }

    const map = { 
      arrowleft: 'steerLeft', a: 'steerLeft',
      arrowright: 'steerRight', d: 'steerRight',
      arrowup: 'accel', w: 'accel',
      arrowdown: 'brake', s: 'brake'
    };
    if (map[k]) {
      inputState[map[k]] = true;
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    const map = { 
      arrowleft: 'steerLeft', a: 'steerLeft',
      arrowright: 'steerRight', d: 'steerRight',
      arrowup: 'accel', w: 'accel',
      arrowdown: 'brake', s: 'brake'
    };
    if (map[k]) {
      inputState[map[k]] = false;
    }
  }

  /* ══════════════════════════════════════════════
     LAYOUT DE CÂMERAS & RESPONSIVIDADE
     ══════════════════════════════════════════════ */

  let currentViewLayout = 'top';

  function setViewLayout(layout) {
    currentViewLayout = layout;
    const container = document.getElementById('simViewsContainer');
    if (container) {
      container.classList.remove('layout-top', 'layout-both', 'layout-driver');
      container.classList.add(`layout-${layout}`);
    }

    document.querySelectorAll('.sim-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viewMode === layout);
    });

    requestAnimationFrame(() => {
      resizeCanvases();
      if (state || currentScenario === 'direcao-vias') redraw();
    });
  }

  /* ══════════════════════════════════════════════
     BIND EVENTS
     ══════════════════════════════════════════════ */

  function bindEvents() {
    if (isBoundEvents) return;
    isBoundEvents = true;

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    document.getElementById('simTabTrajectory')?.addEventListener('click', () => switchMode('trajectory'));
    document.getElementById('simTabGuided')?.addEventListener('click', () => switchMode('guided'));
    document.getElementById('simTabFree')?.addEventListener('click', () => switchMode('free'));

    document.getElementById('simExecuteDrawBtn')?.addEventListener('click', doExecuteTrajectory);
    document.getElementById('simClearDrawBtn')?.addEventListener('click', doClearTrajectory);
    document.getElementById('simRealignBtn')?.addEventListener('click', doRealignCar);

    /* Botões de Seta (CTB Art. 196) */
    document.getElementById('simTurnLeftBtn')?.addEventListener('click', () => toggleTurnSignal('left'));
    document.getElementById('simTurnRightBtn')?.addEventListener('click', () => toggleTurnSignal('right'));

    /* Câmeras / Modos de visualização */
    document.querySelectorAll('.sim-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.viewMode;
        if (mode) setViewLayout(mode);
      });
    });

    const topCanvas = document.getElementById('topCanvas');
    if (topCanvas) {
      topCanvas.addEventListener('mousedown', onTopPointerDown);
      topCanvas.addEventListener('mousemove', onTopPointerMove);
      window.addEventListener('mouseup', onTopPointerUp);

      topCanvas.addEventListener('touchstart', onTopPointerDown, { passive: false });
      topCanvas.addEventListener('touchmove', onTopPointerMove, { passive: false });
      window.addEventListener('touchend', onTopPointerUp);
    }

    const bindPedal = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const dn = () => { inputState[key] = true; };
      const up = () => { inputState[key] = false; };
      el.addEventListener('mousedown', dn);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', up);
      el.addEventListener('touchstart', ev => { dn(); ev.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', up);
    };
    bindPedal('pedalAccel', 'accel');
    bindPedal('pedalBrake', 'brake');

    const sw = document.getElementById('simSteering');
    if (sw) {
      let dragX = null;
      sw.addEventListener('mousedown', ev => { dragX = ev.clientX; });
      document.addEventListener('mousemove', ev => {
        if (dragX === null) return;
        const d = (ev.clientX - dragX) * 0.6;
        if (currentScenario === 'direcao-vias' || currentScenario === 'cidade-ctb') {
          roadState.steerAngle = Math.max(-28, Math.min(28, d));
        } else if (state && state.phase === 'running') {
          state.steerAngle = Math.max(-VEHICLE.maxSteerAngle, Math.min(VEHICLE.maxSteerAngle, d));
        }
      });
      document.addEventListener('mouseup', () => { dragX = null; });
    }

    document.querySelectorAll('.sim-gear-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!state || state.phase !== 'running') return;
        const g = btn.dataset.gear;
        state.gear = g;
        document.querySelectorAll('.sim-gear-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (state.mode === 'guided' && g === 'R' && state.stepIndex === 2) {
          tryAdvanceStep();
        }
      });
    });

    document.getElementById('simBtnBaliza')?.addEventListener('click', () => switchScenario('baliza-basica'));
    document.getElementById('simBtnVias')?.addEventListener('click', () => switchScenario('direcao-vias'));
    document.getElementById('simBtnCidade')?.addEventListener('click', () => switchScenario('cidade-ctb'));

    /* Botões da Fiscalização CTB e Agente de Trânsito */
    document.getElementById('simOpenAitBtn')?.addEventListener('click', openAitModal);
    document.getElementById('simAitModalCloseBtn')?.addEventListener('click', closeAitModal);
    document.getElementById('simAitOkBtn')?.addEventListener('click', closeAitModal);
    document.getElementById('simAitClearBtn')?.addEventListener('click', () => {
      cnhState.points = 0;
      cnhState.totalFines = 0;
      cnhState.aits = [];
      cnhState.isSuspended = false;
      updateCtbDom();
      renderAitModalList();
    });
    document.getElementById('simOfficerCloseBtn')?.addEventListener('click', () => {
      const dlg = document.getElementById('simOfficerDialog');
      if (dlg) dlg.style.display = 'none';
      cnhState.officerTimer = 0;
    });

    document.getElementById('simDemoBtn')?.addEventListener('click', doStartDemo);
    document.getElementById('simResetBtn')?.addEventListener('click', doReset);

    document.getElementById('simTryAgainBtn')?.addEventListener('click', () => {
      hideOverlay();
      doReset();
    });
    document.getElementById('simSaveResultBtn')?.addEventListener('click', doSave);

    document.getElementById('simHelpBtn')?.addEventListener('click', () => {
      if (currentScenario === 'cidade-ctb') {
        showInstruction('🏙️ <b>Cidade Realista & CTB:</b> Você está sob fiscalização estrita do <b>Agente Silva</b>! Respeite semáforos (Art. 208), faixa de pedestres (Art. 214), ciclistas a 1,50m (Art. 201), use seta (Art. 196) e mantenha a velocidade regulamentada (Art. 218). Infrações acumulam multas e pontos na CNH!');
      } else if (currentScenario === 'direcao-vias') {
        showInstruction('🛣️ <b>Regra da Roda Dianteira:</b> Mantenha a visão da <b>roda dianteira e lateral do veículo à sua direita</b>. Enquanto você visualizá-la, você NÃO colidirá com ele e o sinal fica 🟢 <b>VERDE</b>. Se ela for ocultada pelo pilar, você está no Ponto Cego (🔴 Alerta). Lembre-se de ligar a seta (Q/E) antes de mudar de faixa!');
      } else {
        showInstruction('🎯 <b>Baliza de Ré:</b> 1) Arraste o carro até emparelhar com o Veículo A. O carro permanece exatamente onde você o colocar. 2) Clique na traseira do veículo e desenhe a rota de ré até a vaga verde. 3) Clique em ▶ Executar para assistir ao veículo entrar pela traseira com aceleração suave e o volante acompanhando 100%!');
      }
    });

    /* Fallback global por delegação para garantir que o botão reiniciar, botões de seta e modais nunca falhem */
    document.addEventListener('click', e => {
      if (e.target.closest('#simResetBtn')) {
        doReset();
      }
      if (e.target.closest('#simTurnLeftBtn')) {
        toggleTurnSignal('left');
      }
      if (e.target.closest('#simTurnRightBtn')) {
        toggleTurnSignal('right');
      }
      if (e.target.closest('#simOpenAitBtn')) {
        openAitModal();
      }
      if (e.target.closest('#simAitModalCloseBtn') || e.target.closest('#simAitOkBtn')) {
        closeAitModal();
      }
      if (e.target.closest('#simAitClearBtn')) {
        cnhState.points = 0;
        cnhState.totalFines = 0;
        cnhState.aits = [];
        cnhState.isSuspended = false;
        updateCtbDom();
        renderAitModalList();
      }
      if (e.target.closest('#simOfficerCloseBtn')) {
        const dlg = document.getElementById('simOfficerDialog');
        if (dlg) dlg.style.display = 'none';
        cnhState.officerTimer = 0;
      }
      const viewBtn = e.target.closest('.sim-view-btn');
      if (viewBtn && viewBtn.dataset.viewMode) {
        setViewLayout(viewBtn.dataset.viewMode);
      }
      const scenBtn = e.target.closest('.sim-scen-btn');
      if (scenBtn && scenBtn.dataset.scenario) {
        switchScenario(scenBtn.dataset.scenario);
      }
      const sitPill = e.target.closest('.sim-sit-pill');
      if (sitPill && sitPill.dataset.stage) {
        setRoadStage(sitPill.dataset.stage);
      }
      if (e.target.closest('#simTriggerAmbulance')) {
        triggerAmbulance();
      }
      if (e.target.closest('#simTriggerPolice')) {
        triggerPolice();
      }
      if (e.target.closest('#simTriggerTrain')) {
        triggerTrain();
      }
      if (e.target.closest('#simToggleWarden')) {
        toggleSchoolWarden();
      }
      if (e.target.closest('#simFatalRestartBtn')) {
        roadState.trainFatalCrash = false;
        const modal = document.getElementById('simTrainFatalModal');
        if (modal) modal.style.display = 'none';
        doReset();
        setRoadStage('ferrovia');
      }
    });
  }

  /* ══════════════════════════════════════════════
     INIT / DESTROY
     ══════════════════════════════════════════════ */

  function initSimulator() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    state = null;
    collisionCooldown = 0;
    inputState = { steerLeft: false, steerRight: false, accel: false, brake: false };
    isBoundEvents = false;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      /* Selecionar top view prioritária por padrão */
      setViewLayout('top');
      resizeCanvases();
      bindEvents();

      state = freshState('trajectory');
      hideOverlay();
      updateActionButtons();

      roadState.trainFatalCrash = false;
      roadState.trainCrashCountdown = 0;
      const fatalModal = document.getElementById('simTrainFatalModal');
      if (fatalModal) fatalModal.style.display = 'none';

      if (currentScenario === 'cidade-ctb') {
        showInstruction('🏙️ <b>Cidade Realista & CTB:</b> Você está sob fiscalização estrita do <b>Agente Silva</b>! Respeite semáforos (Art. 208), faixa de pedestres (Art. 214), ciclistas a 1,50m (Art. 201), use seta (Art. 196) e velocidade da via (Art. 218).');
        updateRoadHudDom(ROAD_STAGES[0]);
        updateCtbDom();
      } else if (currentScenario === 'direcao-vias') {
        showInstruction('🛣️ <b>Treinamento de Vias & Distâncias:</b> Observe a <b>roda dianteira e lateral do veículo à sua direita</b>. Enquanto ela for visível, o sinal permanece <b>VERDE</b> sem risco de colisão. A velocidade mudará a cada 20s!');
        updateRoadHudDom(ROAD_STAGES[0]);
      } else {
        showInstruction('<b>Passo 1:</b> Arraste o carro com o mouse ou toque na tela até a lateral do <b>Veículo A</b> para alinhar os retrovisores.');
      }
      redraw();
      lastTime = performance.now();
      animId = requestAnimationFrame(simLoop);
    }));

    window._simResizeHandler = () => { resizeCanvases(); if (state || currentScenario === 'direcao-vias') redraw(); };
    window.addEventListener('resize', window._simResizeHandler);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { resizeCanvases(); if (state || currentScenario === 'direcao-vias') redraw(); }, 150);
    });
  }

  function destroySimulator() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    if (window._simResizeHandler) { window.removeEventListener('resize', window._simResizeHandler); window._simResizeHandler = null; }
    inputState = { steerLeft: false, steerRight: false, accel: false, brake: false };
    state = null;
    isBoundEvents = false;
  }

  function setRoadStage(stageId) {
    const idx = ROAD_STAGES.findIndex(s => s.id === stageId);
    if (idx !== -1) {
      if (stageId !== 'ferrovia') {
        roadState.trainFatalCrash = false;
        roadState.trainCrashCountdown = 0;
        const modal = document.getElementById('simTrainFatalModal');
        if (modal) modal.style.display = 'none';
      }
      roadState.stageIndex = idx;
      roadState.stageTimer = 25.0;
      const nextStage = ROAD_STAGES[idx];
      roadState.targetSpeedKmh = nextStage.speedLimit;
      playAlertBeep(false);
      showRoadStageNotification(nextStage);
      updateRoadHudDom(nextStage);
      updateCtbDom();
    }
  }

  function triggerAmbulance() {
    roadState.ambulance.active = true;
    roadState.ambulance.y = -35.0;
    roadState.ambulance.hasYielded = false;
    roadState.ambulance.hasViolated = false;
    playAmbulanceSiren();
    showInstruction('🚨 <b>Ambulância SAMU 192 se aproximando com sirene e giroflex!</b> Desloque seu veículo para a faixa da direita e dê passagem (Art. 189 CTB)!');
    roadState.statusLevel = 'yellow';
    roadState.statusText = '🚨 SAMU EM EMERGÊNCIA — Desloque para a Direita (Art. 189)!';
  }

  function triggerPolice() {
    roadState.policeCruiser.active = true;
    roadState.policeCruiser.isPursuing = true;
    roadState.policeCruiser.sirenActive = true;
    roadState.policeCruiser.x = getLaneCenterX(ROAD_STAGES[roadState.stageIndex], 0);
    roadState.policeCruiser.y = -35.0;
    roadState.policeCruiser.speedKmh = Math.max(90.0, roadState.speedKmh + 35.0);
    showInstruction('🚓 <b>Viatura Policial / PRF em aproximação com sirene oficial!</b> Desloque seu veículo para a faixa da direita e dê passagem (Art. 189 CTB)!');
    roadState.statusLevel = 'yellow';
    roadState.statusText = '🚓 POLÍCIA EM EMERGÊNCIA — Desloque para a Direita (Art. 189)!';
  }

  function triggerTrain() {
    setRoadStage('ferrovia');
    roadState.railCrossing.y = 28.0;
    roadState.railCrossing.trainX = -60.0;
    roadState.railCrossing.trainPassing = true;
    roadState.railCrossing.barrierDown = true;
    roadState.railCrossing.hasStopped = false;
    roadState.railCrossing.hasViolated = false;
    playTrainCrossingBell();
    showInstruction('🚂 <b>Trem de carga se aproximando da passagem de nível!</b> Parada Obrigatória antes dos trilhos (Art. 212 CTB)!');
  }

  function toggleSchoolWarden() {
    roadState.trafficWarden.hasWarden = !roadState.trafficWarden.hasWarden;
    const hasW = roadState.trafficWarden.hasWarden;
    if (hasW) {
      playOfficerStopWhistle();
      showInstruction('👮 <b>Guarda de Trânsito na Faixa:</b> Silvo regulamentar de parada (GA-01) emitido! Aguarde o sinal do guarda (Art. 195 e 220-XIV)!');
    } else {
      showInstruction('🎒 <b>Travessia Escolar Autônoma:</b> Crianças desembarcando do ônibus e atravessando. Parada obrigatória espontânea (Art. 214 e 220-XIV)!');
    }
  }

  globalThis.AGDSimulator = { 
    init: initSimulator, 
    destroy: destroySimulator, 
    setViewLayout, 
    switchScenario,
    setRoadStage,
    triggerAmbulance,
    triggerPolice,
    triggerTrain,
    toggleSchoolWarden,
    getRoadStages: () => ROAD_STAGES,
    getRoadState: () => roadState
  };

})();
