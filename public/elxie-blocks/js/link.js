// Robot link: frames, command queue, USB (Web Serial) and Bluetooth (Web Bluetooth)
// transports. Same protocol as spec/03-protocol.md and tools/elxie_cli.py.
(function (root) {
  'use strict';
  const SVC = '8d3a0001-5e1c-4a8e-9b2d-e1a1e0c0de01', RXU = '8d3a0002-5e1c-4a8e-9b2d-e1a1e0c0de01', TXU = '8d3a0003-5e1c-4a8e-9b2d-e1a1e0c0de01';
  const C = { HELLO: 1, UP_BEGIN: 0x10, UP_CHUNK: 0x11, UP_END: 0x12, RUN: 0x13, STOP: 0x14, LIST: 0x15, DELETE: 0x16, AUTORUN: 0x17, TELEMETRY: 0x20, TRACE: 0x21, CAL: 0x30 };
  const M = { ACK: 0x80, INFO: 0x81, SLOTS: 0x85, NAK: 0x8f, TEL: 0x90, TRACE: 0x91, STATUS: 0x92, ERROR: 0x93 };
  const S = root.ELX_SPEC;
  const LOAD_ERR = Object.fromEntries(Object.entries(S.errors.load).map(([k, v]) => [v, k]));
  const RT_ERR = Object.fromEntries(Object.entries(S.errors.runtime).map(([k, v]) => [v, k]));
  const LINK_ERR = { 0x41: 'BAD_SLOT', 0x42: 'BAD_SEQUENCE', 0x43: 'TOO_LARGE', 0x44: 'CRC_MISMATCH', 0x45: 'STORAGE', 0x46: 'EMPTY_SLOT', 0x47: 'UNKNOWN_CMD', 0x48: 'BAD_ARGS' };

  function crc16(b) {
    let c = 0xffff;
    for (const x of b) { c ^= x << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
    return c;
  }
  function frame(type, p = new Uint8Array()) {
    const b = new Uint8Array(p.length + 7);
    b[0] = 0xa5; b[1] = 0x5a; b[2] = type; b[3] = p.length & 255; b[4] = p.length >> 8; b.set(p, 5);
    const c = crc16(b.subarray(2, 5 + p.length)); b[5 + p.length] = c & 255; b[6 + p.length] = c >> 8;
    return b;
  }
  class Parser {
    constructor(onMsg, onText) { this.buf = []; this.onMsg = onMsg; this.onText = onText; this.text = ''; }
    feed(data) {
      for (const x of data) this.buf.push(x);
      for (;;) {
        let i = -1;
        for (let k = 0; k + 1 < this.buf.length; k++) if (this.buf[k] === 0xa5 && this.buf[k + 1] === 0x5a) { i = k; break; }
        const junk = i < 0 ? (this.buf.length && this.buf[this.buf.length - 1] === 0xa5 ? this.buf.length - 1 : this.buf.length) : i;
        if (junk > 0) {
          this.text += String.fromCharCode(...this.buf.splice(0, junk).filter((c) => c === 10 || (c >= 32 && c < 127)));
          let n;
          while ((n = this.text.indexOf('\n')) >= 0) { const l = this.text.slice(0, n).trim(); this.text = this.text.slice(n + 1); if (l) this.onText(l); }
          if (i >= 0) i = 0;
        }
        if (i < 0 || this.buf.length < 5) return;
        const len = this.buf[3] | (this.buf[4] << 8);
        if (len > 512) { this.buf.splice(0, 2); continue; }
        if (this.buf.length < len + 7) return;
        const body = this.buf.slice(2, 5 + len), c = this.buf[5 + len] | (this.buf[6 + len] << 8);
        if (crc16(body) === c) { this.buf.splice(0, len + 7); this.onMsg(body[0], new Uint8Array(body.slice(3))); } else this.buf.splice(0, 2);
      }
    }
  }

  class Robot {
    constructor() { this.t = null; this.waiters = []; this.busy = Promise.resolve(); this.listeners = {}; this.info = null; }
    on(ev, f) { (this.listeners[ev] = this.listeners[ev] || []).push(f); }
    emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }
    get connected() { return !!this.t; }

    _onMsg(t, p) {
      if (t === M.TEL) return this.emit('telemetry', decodeTelemetry(p));
      if (t === M.TRACE) return this.emit('trace', decodeTrace(p));
      if (t === M.STATUS) return this.emit('status', { running: !!p[0], slot: p[1], lastError: RT_ERR[p[2]] });
      if (t === M.ERROR) return this.emit('runtimeError', { error: RT_ERR[p[0]] || p[0], script: p[1], pc: p[2] | (p[3] << 8) });
      const w = this.waiters.shift();
      if (w) w(t, p);
    }
    request(cmd, payload = new Uint8Array(), timeout = 4000) {
      const job = this.busy.then(() => new Promise((res, rej) => {
        if (!this.t) return rej(new Error('Elxie is not connected'));
        const h = (t, p) => { clearTimeout(to); if (t === M.NAK) rej(new Error(LOAD_ERR[p[1]] || LINK_ERR[p[1]] || 'NAK ' + p[1])); else res(p); };
        const to = setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== h); rej(new Error('Elxie did not answer')); }, timeout);
        this.waiters.push(h);
        this.t.write(frame(cmd, payload)).catch((e) => { clearTimeout(to); rej(e); });
      }));
      this.busy = job.catch(() => {});
      return job;
    }

    async connectUsb() {
      if (!('serial' in navigator)) throw new Error('USB needs Chrome or Edge on a computer.');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      try { await port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (e) { /* not all ports */ }
      const parser = new Parser((t, p) => this._onMsg(t, p), (l) => this.emit('log', l));
      const writer = port.writable.getWriter();
      const reader = port.readable.getReader();
      this.t = { kind: 'USB', write: (b) => writer.write(b), close: async () => { try { await reader.cancel(); } catch (e) {} writer.releaseLock(); await port.close(); } };
      (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; parser.feed(value); } } catch (e) {} this._lost(); })();
      await new Promise((r) => setTimeout(r, 300));
      return this._hello();
    }
    async connectBle() {
      if (!('bluetooth' in navigator)) throw new Error('Bluetooth needs Chrome or Edge.');
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [SVC] }, { namePrefix: 'ELXIE' }, { namePrefix: 'Elxie' }], optionalServices: [SVC] });
      const gatt = await dev.gatt.connect();
      let svc;
      try { svc = await gatt.getPrimaryService(SVC); } catch (e) { gatt.disconnect(); throw new Error('This Elxie does not have the Blocks firmware yet.'); }
      const rx = await svc.getCharacteristic(RXU), tx = await svc.getCharacteristic(TXU);
      const parser = new Parser((t, p) => this._onMsg(t, p), (l) => this.emit('log', l));
      tx.addEventListener('characteristicvaluechanged', (e) => parser.feed(new Uint8Array(e.target.value.buffer)));
      await tx.startNotifications();
      dev.addEventListener('gattserverdisconnected', () => this._lost());
      this.t = { kind: 'Bluetooth', write: async (b) => { for (let i = 0; i < b.length; i += 20) await rx.writeValueWithResponse(b.slice(i, i + 20)); }, close: async () => gatt.disconnect() };
      return this._hello();
    }
    // Borrow the host app's Bluetooth connection (see AppBridge). Closing only
    // detaches Blocks; the app stays connected to Elxie.
    async connectBridge(bridge) {
      const parser = new Parser((t, p) => this._onMsg(t, p), (l) => this.emit('log', l));
      bridge.onData = (b) => parser.feed(b);
      this.t = { kind: 'App Bluetooth', shared: true, write: (b) => bridge.write(b), close: async () => { bridge.onData = null; } };
      try { return await this._hello(); } catch (e) { bridge.onData = null; this._lost(); throw e; }
    }
    get shared() { return !!(this.t && this.t.shared); }
    async _hello() {
      const p = await this.request(C.HELLO);
      const dv = new DataView(p.buffer, p.byteOffset);
      const caps = new Set();
      for (let id = 0; id < 256; id++) if (p[8 + (id >> 3)] & (1 << (id & 7))) caps.add(id);
      this.info = { name: new TextDecoder().decode(p.subarray(44, 64)).replace(/\0.*$/s, ''), fw: `${p[0]}.${p[1]}`, bytecode: p[2],
        maxProgram: dv.getUint16(3, true), slots: p[5], caps, events: dv.getUint16(40, true), leds: p[42], kind: this.t.kind };
      await this.request(C.TELEMETRY, new Uint8Array([150, 0]));
      await this.request(C.TRACE, new Uint8Array([1]));
      this.emit('connected', this.info);
      return this.info;
    }
    _lost() { if (!this.t) return; this.t = null; this.waiters = []; this.emit('disconnected'); }
    async disconnect() { const t = this.t; this._lost(); if (t) await t.close(); }

    async upload(image, slot, onProgress) {
      const pb = new Uint8Array(7), dv = new DataView(pb.buffer);
      pb[0] = slot; dv.setUint16(1, image.length, true); dv.setUint32(3, root.ElxAsm.crc32(image), true);
      await this.request(C.UP_BEGIN, pb);
      let off = 0;
      while (off < image.length) {
        const chunk = image.subarray(off, off + 128), p = new Uint8Array(chunk.length + 2);
        p[0] = off & 255; p[1] = off >> 8; p.set(chunk, 2);
        const a = await this.request(C.UP_CHUNK, p);
        off = a[1] | (a[2] << 8);
        if (onProgress) onProgress(off / image.length);
      }
      await this.request(C.UP_END, new Uint8Array(), 6000);
    }
    run(slot) { return this.request(C.RUN, new Uint8Array([slot])); }
    stop() { return this.request(C.STOP); }
    setAutorun(slot) { return this.request(C.AUTORUN, new Uint8Array([slot === null ? 0xff : slot])); }
    deleteSlot(slot) { return this.request(C.DELETE, new Uint8Array([slot])); }
    calibrate(what) { return this.request(C.CAL, new Uint8Array([{ lineStart: 1, lineEnd: 2, gyro: 3, compass: 4 }[what]]), 6000); }
    async listSlots() {
      const p = await this.request(C.LIST), out = [];
      for (let i = 0; i < p[0]; i++) {
        const e = p.subarray(1 + i * 20, 21 + i * 20);
        out.push({ slot: e[0], used: !!(e[1] & 1), autorun: !!(e[1] & 2), size: e[2] | (e[3] << 8), name: new TextDecoder().decode(e.subarray(4, 20)).replace(/\0.*$/s, '') });
      }
      return out;
    }
  }

  function decodeTelemetry(p) {
    const dv = new DataView(p.buffer, p.byteOffset), f = p[34];
    return {
      line: [...p.subarray(4, 12)], edge: [...p.subarray(12, 16)], depth: [...p.subarray(16, 20)],
      distance: dv.getUint16(20, true) / 10, pitch: dv.getInt16(22, true) / 10, roll: dv.getInt16(24, true) / 10,
      touched: !!(p[28] & 1), joyX: dv.getInt8(30), joyY: dv.getInt8(31), buttons: dv.getUint16(32, true),
      remote: !!(f & 1), imuOk: !!(f & 2), shaken: !!(f & 4), cliffGuard: !!(f & 8),
      motorL: dv.getInt8(35), motorR: dv.getInt8(36), mood: p[38], battery: p[39],
      heading: p.length >= 44 ? dv.getUint16(40, true) / 10 : null, magnet: p.length >= 44 ? p[42] : null, magOk: p.length >= 44 ? !!p[43] : false,
    };
  }
  function decodeTrace(p) {
    const n = p[1], threads = [];
    for (let i = 0; i < n; i++) threads.push({ state: p[2 + i * 3], pc: p[3 + i * 3] | (p[4 + i * 3] << 8) });
    const k = 2 + n * 3, nv = p[k], dv = new DataView(p.buffer, p.byteOffset), vars = [];
    for (let i = 0; i < nv; i++) vars.push(dv.getFloat32(k + 1 + i * 4, true));
    return { running: !!p[0], threads, vars };
  }

  // Byte pipe to the host app's BLE link over a MessagePort, used when Blocks
  // runs embedded in the Elxie app (components/games/ElxieBlocksFrame.tsx).
  // Port messages: in {t:'state', connected, vm, name} | {t:'data', bytes} | {t:'written', id, error?};
  // out {t:'write', id, bytes}.
  class AppBridge {
    constructor(port) {
      this.port = port; this.seq = 0; this.pending = new Map();
      this.state = { connected: false, vm: false, name: null };
      this.onData = null; this.onState = null;
      port.onmessage = ({ data: m }) => {
        if (m.t === 'data') { if (this.onData) this.onData(m.bytes); return; }
        if (m.t === 'written') {
          const w = this.pending.get(m.id); if (!w) return;
          this.pending.delete(m.id);
          if (m.error) w.rej(new Error(m.error)); else w.res();
          return;
        }
        if (m.t === 'state') {
          this.state = m;
          if (!m.connected) { for (const w of this.pending.values()) w.rej(new Error('Elxie is not connected')); this.pending.clear(); }
          if (this.onState) this.onState(m);
        }
      };
    }
    get usable() { return this.state.connected && this.state.vm; }
    write(bytes) {
      return new Promise((res, rej) => { const id = ++this.seq; this.pending.set(id, { res, rej }); this.port.postMessage({ t: 'write', id, bytes }); });
    }
  }

  root.ElxLink = { Robot, AppBridge, frame, Parser, crc16 };
})(typeof window !== 'undefined' ? window : globalThis);
