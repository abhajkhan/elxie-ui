// Elxie Blocks — the editor app: Blockly workspace, compile, run on the robot,
// highlight running blocks, live sensors, projects and saved tricks.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const robot = new ElxLink.Robot();
  const STORE = 'elxie.blocks.project.v1';
  const COMPACT = window.matchMedia('(max-width: 720px), (max-height: 500px)');
  // Embedded in the Elxie app (components/games/ElxieBlocksFrame.tsx): back button + shared Bluetooth.
  const EMBEDDED = window.parent !== window && new URLSearchParams(location.search).has('embed');
  let bridge = null, detached = false;
  let workspace = null, lastCompile = null, running = false, highlighted = [], warned = [];

  // ---------------------------------------------------------------- helpers
  let toastTimer = null;
  function toast(msg, bad) {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), bad ? 5000 : 2600);
  }
  function log(msg, bad) {
    const d = document.createElement('div'); if (bad) d.className = 'err'; d.textContent = msg;
    const l = $('log'); l.appendChild(d); while (l.childNodes.length > 300) l.removeChild(l.firstChild); l.scrollTop = l.scrollHeight;
  }
  const friendly = (e) => ({
    'Elxie is not connected': 'Connect Elxie first.', 'Elxie did not answer': 'Elxie did not answer. Is it turned on?',
    BAD_SYSCALL: 'This Elxie firmware does not know one of your blocks. Update Elxie.', TOO_LARGE: 'Your program is too big for Elxie.',
  }[e.message] || e.message);

  // ---------------------------------------------------------------- workspace
  const STARTER = { blocks: { languageVersion: 0, blocks: [{ type: 'elx_when_start', x: 60, y: 60, next: { block: { type: 'elx_face_show', fields: { FACE: '1' }, next: { block: { type: 'elx_play_sound', fields: { SOUND: '2' } } } } } }] } };

  function injectWorkspace() {
    const state = workspace ? Blockly.serialization.workspaces.save(workspace) : null;
    if (workspace) workspace.dispose();
    const theme = ElxBlocks.register(Blockly);
    workspace = Blockly.inject('blocklyDiv', {
      toolbox: ElxBlocks.toolbox(), theme, renderer: 'zelos', media: 'vendor/blockly/media/',
      grid: { spacing: 40, length: 2, colour: '#e3e6ee', snap: true }, trashcan: true, sounds: location.protocol !== 'file:',
      zoom: { controls: true, wheel: true, startScale: COMPACT.matches ? 0.6 : 0.75, maxScale: 2, minScale: 0.35, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    ElxBlocks.attachWorkspace(Blockly, workspace);
    if (state) Blockly.serialization.workspaces.load(state, workspace);
    workspace.addChangeListener((e) => { if (!e.isUiEvent) autosave(); });
    return workspace;
  }
  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(projectJson())); } catch (e) { /* storage off: ignore */ }
    }, 600);
  }
  function projectJson() {
    return { format: 1, app: 'elxie-blocks', name: $('projName').value, workspace: Blockly.serialization.workspaces.save(workspace) };
  }
  function loadProject(p) {
    $('projName').value = p.name || 'My Elxie program';
    injectWorkspace();
    workspace.clear();
    Blockly.serialization.workspaces.load(p.workspace || STARTER, workspace);
    workspace.scrollCenter();
  }

  // ---------------------------------------------------------------- compile
  function clearWarnings() {
    for (const id of warned) { const b = workspace.getBlockById(id); if (b) b.setWarningText(null); }
    warned = [];
  }
  function compile() {
    clearWarnings();
    const r = ElxCompiler.compile(workspace, $('projName').value);
    for (const w of r.warnings) { const b = workspace.getBlockById(w.blockId); if (b) { b.setWarningText(w.msg); warned.push(b.id); } }
    if (!r.ok) {
      const e = r.errors[0];
      const b = e.blockId && workspace.getBlockById(e.blockId);
      if (b) { b.setWarningText(e.msg); warned.push(b.id); b.select(); workspace.centerOnBlock(b.id); }
      toast(e.msg, true);
      return null;
    }
    lastCompile = { ...r, varNames: workspace.getVariableMap().getAllVariables().filter((v) => v.type !== 'List').map((v) => v.name) };
    return r;
  }

  // ---------------------------------------------------------------- run / stop
  async function run() {
    const r = compile();
    if (!r) return;
    if (!robot.connected) { toast('Your program is ready (' + r.stats.bytes + ' bytes). Connect Elxie to run it.'); openConnect(); return; }
    try {
      $('runState').textContent = 'Sending…';
      await robot.upload(r.image, 0);
      await robot.run(0);
      log(`Running "${$('projName').value}" (${r.stats.bytes} bytes)`);
    } catch (e) { toast(friendly(e), true); $('runState').textContent = 'Ready'; }
  }
  async function stop() {
    if (!robot.connected) return;
    try { await robot.stop(); } catch (e) { toast(friendly(e), true); }
  }

  function setRunning(on) {
    running = on;
    $('runState').textContent = on ? 'Running on Elxie' : 'Ready';
    $('runState').className = 'runstate' + (on ? ' on' : '');
    if (!on) highlight([]);
  }
  function highlight(ids) {
    const key = ids.join(',');
    if (key === highlighted.join(',')) return;
    workspace.highlightBlock(null);
    for (const id of ids) if (workspace.getBlockById(id)) workspace.highlightBlock(id, true);
    highlighted = ids;
  }

  // ---------------------------------------------------------------- robot events
  robot.on('connected', async (info) => {
    $('led').classList.add('on');
    $('panelLed').classList.add('on');
    $('connText').textContent = 'Elxie connected';
    $('robotInfo').innerHTML = `<b>${info.name}</b> · firmware ${info.fw} · ${info.kind}`;
    $('btnSaveRobot').disabled = false;
    document.querySelectorAll('[data-cal]').forEach((b) => (b.disabled = false));
    toast('Elxie is connected!');
    refreshSlots();
  });
  robot.on('disconnected', () => {
    $('led').classList.remove('on');
    $('panelLed').classList.remove('on');
    $('connText').textContent = 'Connect Elxie';
    $('robotInfo').innerHTML = 'Not connected. Press <b>Connect Elxie</b>.';
    $('btnSaveRobot').disabled = true;
    document.querySelectorAll('[data-cal]').forEach((b) => (b.disabled = true));
    setRunning(false);
    toast('Elxie disconnected', true);
  });
  robot.on('status', (s) => { setRunning(s.running); });
  robot.on('runtimeError', (e) => {
    const id = lastCompile && ElxCompiler.blockAtPc(lastCompile.sourceMap, Math.max(0, e.pc - 1));
    const b = id && workspace.getBlockById(id);
    const msg = e.error === 'STACK_OVERFLOW' ? 'Too many things inside each other here.' : 'Something went wrong here (' + e.error + ').';
    if (b) { b.setWarningText(msg); warned.push(b.id); b.select(); }
    toast('Elxie stopped: ' + msg, true);
  });
  robot.on('trace', (t) => {
    if (!lastCompile || !t.running) return highlight([]);
    const ids = [];
    for (const th of t.threads) if (th.state !== 0) {
      const id = ElxCompiler.blockAtPc(lastCompile.sourceMap, Math.max(0, th.pc - 1));
      if (id && !ids.includes(id)) ids.push(id);
    }
    highlight(ids);
    showVars(t.vars);
  });
  robot.on('telemetry', showSensors);
  robot.on('log', (l) => log(l));

  // ---------------------------------------------------------------- sensor panel
  const TILES = [['dist', 'Distance'], ['touch', 'Touch'], ['head', 'Heading'], ['tilt', 'Tilt'], ['mag', 'Magnet'], ['batt', 'Battery']];
  $('tiles').innerHTML = TILES.map(([k, l]) => `<div class="tile"><small>${l}</small><b id="t_${k}">–</b></div>`).join('');
  $('lineBars').innerHTML = '<i></i>'.repeat(8);
  $('edgeDots').innerHTML = ['FL', 'FR', 'BL', 'BR'].map((s) => `<span>${s}</span>`).join('');
  function showSensors(s) {
    $('t_dist').textContent = s.distance >= 399 ? 'clear' : Math.round(s.distance) + ' cm';
    $('t_touch').textContent = s.touched ? 'yes!' : 'no';
    $('t_head').textContent = s.heading === null ? '–' : Math.round(s.heading) + '°';
    $('t_tilt').textContent = `${Math.round(s.pitch)}° / ${Math.round(s.roll)}°`;
    $('t_mag').textContent = s.magOk ? s.magnet : '–';
    $('t_batt').textContent = s.battery + '%';
    [...$('lineBars').children].forEach((el, i) => { el.style.height = Math.max(4, s.line[i] * 0.34) + 'px'; el.classList.toggle('hit', s.line[i] >= 50); });
    [...$('edgeDots').children].forEach((el, i) => el.classList.toggle('hit', s.edge[i] >= 85));
  }
  function showVars(values) {
    if (!lastCompile || !lastCompile.varNames.length) { $('varPanel').hidden = true; return; }
    $('varPanel').hidden = false;
    $('vars').innerHTML = lastCompile.varNames.map((n, i) => {
      const v = values[i] === undefined ? 0 : values[i];
      const txt = Number.isInteger(v) ? v : Math.round(v * 100) / 100;
      return `<div class="var"><span>${n.replace(/</g, '&lt;')}</span><b>${txt}</b></div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- saved tricks
  async function refreshSlots() {
    if (!robot.connected) return;
    try {
      const slots = await robot.listSlots();
      const used = slots.filter((s) => s.used && s.slot > 0);
      const el = $('slots');
      el.className = used.length ? '' : 'muted';
      el.innerHTML = used.length ? '' : 'No tricks saved yet.';
      for (const s of used) {
        const row = document.createElement('div'); row.className = 'slot';
        row.innerHTML = `<span class="nm">${s.slot}. <b></b>${s.autorun ? ' ★' : ''}</span>`;
        row.querySelector('b').textContent = s.name || '(no name)';
        const btns = document.createElement('span');
        const mk = (t, title, f) => { const b = document.createElement('button'); b.textContent = t; b.title = title; b.onclick = f; btns.appendChild(b); };
        mk('▶', 'Run', () => robot.run(s.slot).catch((e) => toast(friendly(e), true)));
        mk('★', s.autorun ? 'Stop starting at power-on' : 'Start at power-on', () => robot.setAutorun(s.autorun ? null : s.slot).then(refreshSlots));
        mk('✕', 'Delete', () => { if (confirm(`Delete "${s.name}" from Elxie?`)) robot.deleteSlot(s.slot).then(refreshSlots); });
        row.appendChild(btns); el.appendChild(row);
      }
      return slots;
    } catch (e) { log('Could not list tricks: ' + e.message, true); return []; }
  }
  async function openSave() {
    const r = compile();
    if (!r) return;
    const slots = await refreshSlots();
    const box = $('saveSlots'); box.innerHTML = '';
    for (let i = 1; i < 8; i++) {
      const s = slots.find((x) => x.slot === i) || { used: false };
      const b = document.createElement('button');
      b.innerHTML = `<b>Slot ${i}</b> · <span></span>`;
      b.querySelector('span').textContent = s.used ? `replace "${s.name}"` : 'empty';
      b.onclick = async () => {
        $('dlgSave').close();
        try {
          await robot.upload(r.image, i);
          if ($('saveAutorun').checked) await robot.setAutorun(i);
          toast(`Saved to Elxie as trick ${i}!`);
          refreshSlots();
        } catch (e) { toast(friendly(e), true); }
      };
      box.appendChild(b);
    }
    $('dlgSave').showModal();
  }

  // ---------------------------------------------------------------- connect
  function openConnect() { $('dlgConnect').showModal(); }
  $('btnConnect').onclick = () => {
    if (robot.connected) {
      if (!confirm('Disconnect Elxie?')) return;
      if (robot.shared) detached = true; // stay detached until the child presses Connect again
      robot.disconnect();
    } else if (bridge && bridge.usable) {
      detached = false;
      connectShared();
    } else openConnect();
  };
  if (!('serial' in navigator)) { $('cUsb').hidden = true; $('choices').classList.add('single'); }
  $('cUsb').onclick = async () => { $('dlgConnect').close(); try { await robot.connectUsb(); } catch (e) { if (e.name !== 'NotFoundError') toast(friendly(e), true); } };
  $('cBle').onclick = async () => { $('dlgConnect').close(); try { await robot.connectBle(); } catch (e) { if (e.name !== 'NotFoundError') toast(friendly(e), true); } };

  // ---------------------------------------------------------------- files
  $('mNew').onclick = () => {
    if (!confirm('Start a new project? Save this one first if you want to keep it.')) return;
    loadProject({ name: 'My Elxie program', workspace: STARTER });
  };
  $('mSave').onclick = () => {
    const blob = new Blob([JSON.stringify(projectJson(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ($('projName').value || 'elxie').replace(/[^\w\- ]+/g, '').trim() + '.elxie.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('mOpen').onclick = () => $('fileIn').click();
  $('fileIn').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { loadProject(JSON.parse(await f.text())); toast('Opened ' + f.name); } catch (err) { toast('That file is not an Elxie project.', true); }
    e.target.value = '';
  };
  $('projName').oninput = autosave;

  // ---------------------------------------------------------------- buttons
  $('btnRun').onclick = run;
  $('btnStop').onclick = stop;
  $('btnSaveRobot').onclick = openSave;
  document.querySelectorAll('[data-cal]').forEach((b) => (b.onclick = async () => {
    try {
      await robot.calibrate(b.dataset.cal);
      toast({ lineStart: 'Slide Elxie over the line and the floor, then press "Line: done".', lineEnd: 'Line sensors calibrated!', gyro: 'Gyro calibrated!', compass: 'Elxie spins for 6 seconds to learn the compass.' }[b.dataset.cal]);
    } catch (e) { toast(friendly(e), true); }
  }));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && running) stop();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
  });

  // ---------------------------------------------------------------- app bridge (embedded)
  // When the app is already connected to firmware with the Blocks service,
  // reuse that link instead of opening a second Bluetooth connection.
  async function connectShared() {
    if (robot.connected || !bridge || !bridge.usable) return;
    try { await robot.connectBridge(bridge); } catch (e) { toast(friendly(e), true); }
  }
  function onBridgeState() {
    if (robot.shared && !bridge.usable) robot.disconnect();
    else if (!robot.connected && bridge.usable && !detached) connectShared();
  }
  if (EMBEDDED) {
    document.body.classList.add('embed');
    $('btnBack').hidden = false;
    $('btnBack').onclick = () => window.parent.postMessage({ type: 'elxie-blocks:exit' }, location.origin);
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.type !== 'elxie-blocks:bridge') return;
      bridge = new ElxLink.AppBridge(e.ports[0]);
      bridge.onState = onBridgeState;
    });
    window.parent.postMessage({ type: 'elxie-blocks:ready' }, location.origin);
  }

  // ---------------------------------------------------------------- compact layout
  function setPanel(open) {
    $('side').classList.toggle('open', open);
    $('btnPanel').setAttribute('aria-expanded', String(open));
  }
  function setMenu(open) {
    $('menu').classList.toggle('open', open);
    $('btnMenu').setAttribute('aria-expanded', String(open));
  }
  $('btnPanel').onclick = () => setPanel(!$('side').classList.contains('open'));
  $('sheetHandle').onclick = () => setPanel(false);
  $('btnMenu').onclick = (e) => { e.stopPropagation(); setMenu(!$('menu').classList.contains('open')); };
  $('menu').addEventListener('click', () => setMenu(false));
  document.addEventListener('click', (e) => { if (!$('menu').contains(e.target)) setMenu(false); });
  COMPACT.addEventListener('change', () => { setPanel(false); setMenu(false); });
  // Blockly only listens for window resizes; also catch rotation, iframe and layout changes.
  new ResizeObserver(() => { if (workspace) Blockly.svgResize(workspace); }).observe($('blocklyArea'));

  // ---------------------------------------------------------------- start
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
  loadProject(saved && saved.workspace ? saved : { name: 'My Elxie program', workspace: STARTER });
  if (!('serial' in navigator) && !('bluetooth' in navigator)) toast('Open Elxie Blocks in Chrome or Edge to connect to the robot.', true);
})();
