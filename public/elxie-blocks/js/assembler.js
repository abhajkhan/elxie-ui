// Elxie assembler (JavaScript port of tools/elxasm.py — must stay byte-identical;
// tests/studio/test_assembler.js checks every spec/test-vectors program).
// Extra directive for the editor:  .src <blockId>  maps the current pc to a block.
(function (root) {
  'use strict';
  const S = root.ELX_SPEC;
  const OPS = {}, SYS = {}, EVENTS = {};
  for (const o of S.opcodes) OPS[o.name.toLowerCase()] = o;
  for (const s of S.syscalls) SYS[s.name] = s;
  for (const e of S.events) EVENTS[e.name.toLowerCase()] = e;
  const ENUMS = S.enums;
  const EVENT_ENUM = { touched: 'pad', line: 'zone', edge: 'corner', tilted: 'tilt', remote_button: 'button' };

  class AsmError extends Error {}

  // shlex-like tokenizer: whitespace separated, "double quoted" strings with \ escapes
  function tokenize(line) {
    const out = [];
    let i = 0;
    while (i < line.length) {
      while (i < line.length && /\s/.test(line[i])) i++;
      if (i >= line.length) break;
      let tok = '';
      while (i < line.length && !/\s/.test(line[i])) {
        if (line[i] === '"') {
          i++;
          while (i < line.length && line[i] !== '"') {
            if (line[i] === '\\' && i + 1 < line.length) i++;
            tok += line[i++];
          }
          if (i >= line.length) throw new AsmError('unterminated string');
          i++;
        } else tok += line[i++];
      }
      out.push(tok);
    }
    return out;
  }

  function stripComment(raw) {  // ';' outside quotes starts a comment
    let q = false;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '"' && raw[i - 1] !== '\\') q = !q;
      else if (raw[i] === ';' && !q) return raw.slice(0, i);
    }
    return raw;
  }

  function enumValue(token, defEnum) {
    const dot = token.indexOf('.');
    if (dot > 0) {
      const e = token.slice(0, dot), k = token.slice(dot + 1);
      if (ENUMS[e] && k in ENUMS[e]) return ENUMS[e][k];
    }
    if (defEnum && token in ENUMS[defEnum]) return ENUMS[defEnum][token];
    return null;
  }

  function number(t, strings) {
    if (t[0] === '#' && t.length === 7) return parseInt(t.slice(1), 16);
    if (t.startsWith('str.')) {
      const n = t.slice(4);
      if (!(n in strings)) throw new AsmError(`unknown string '${n}'`);
      return strings[n];
    }
    const lt = t.toLowerCase();
    if (lt === 'true' || lt === 'false') return lt === 'true' ? 1 : 0;
    const ev = enumValue(t);
    if (ev !== null) return ev;
    if (/^[+-]?(0x[0-9a-f]+|\d+)$/i.test(t)) return parseInt(t, /0x/i.test(t) ? 16 : 10);
    const f = Number(t);
    if (t.trim() === '' || Number.isNaN(f)) throw new AsmError(`unknown value '${t}'`);
    return f;
  }

  const f32 = new Float32Array(1);
  function pushBytes(value) {
    if (Number.isInteger(value)) {
      if (value >= -128 && value <= 127) return [OPS.push_i8.code, value & 0xff];
      if (value >= -32768 && value <= 32767) return [OPS.push_i16.code, value & 0xff, (value >> 8) & 0xff];
    }
    f32[0] = value;
    const b = new Uint8Array(f32.buffer);
    return [OPS.push_f32.code, b[0], b[1], b[2], b[3]];
  }

  const utf8 = (s) => Array.from(new TextEncoder().encode(s));

  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    let c = 0xffffffff;
    for (const x of b) c = CRC_T[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Returns { image: Uint8Array, sourceMap: [[pc, blockId], ...] sorted by pc, lineMap }
  function assemble(text) {
    let name = '';
    const variables = {};
    const lists = {};
    const strings = {};
    const blob = [];
    const lines = text.split(/\r?\n/);
    let parsed = [];
    lines.forEach((raw, idx) => {
      const line = stripComment(raw).trim();
      if (!line) return;
      let toks;
      try { toks = tokenize(line); } catch (e) { throw new AsmError(`line ${idx + 1}: ${e.message}`); }
      parsed.push([idx + 1, toks]);
      if (toks[0] === '.string') {
        if (toks.length !== 3) throw new AsmError(`line ${idx + 1}: .string NAME "text"`);
        strings[toks[1]] = blob.length;
        blob.push(...utf8(toks[2]), 0);
      }
    });

    // every script ends with END (same rule as elxasm.py)
    const fixed = [];
    let inScript = false, last = null;
    for (const [n, toks] of parsed) {
      if (toks[0] === '.script') {
        if (inScript && last !== 'end') fixed.push([n, ['end']]);
        inScript = true; last = null;
      } else if (!toks[0].startsWith('.') && !(toks[0].endsWith(':') && toks.length === 1)) {
        last = toks[0].toLowerCase();
      }
      fixed.push([n, toks]);
    }
    if (inScript && last !== 'end') fixed.push([lines.length + 1, ['end']]);
    parsed = fixed;

    const labels = {};
    const scripts = [];
    const items = [];
    const srcMarks = [];
    let pc = 0;
    for (const [n, toks] of parsed) {
      const head = toks[0];
      if (head === '.name') {
        name = toks[1] || '';
        if (utf8(name).length > 16) throw new AsmError(`line ${n}: name longer than 16 bytes`);
      } else if (head === '.var') {
        for (const v of toks.slice(1)) {
          if (v in variables) throw new AsmError(`line ${n}: duplicate var ${v}`);
          variables[v] = Object.keys(variables).length;
        }
      } else if (head === '.list') {
        for (const v of toks.slice(1)) {
          if (v in lists) throw new AsmError(`line ${n}: duplicate list ${v}`);
          lists[v] = Object.keys(lists).length;
        }
      } else if (head === '.string') {
      } else if (head === '.src') {
        srcMarks.push([pc, toks[1]]);
      } else if (head === '.script') {
        const ev = (toks[1] || '').toLowerCase();
        if (!EVENTS[ev]) throw new AsmError(`line ${n}: unknown event '${toks[1]}'`);
        let param = 0;
        if (toks.length > 2) {
          const pv = enumValue(toks[2], EVENT_ENUM[ev]);
          param = pv !== null ? pv : parseInt(toks[2], 10);
          if (!(param >= 0 && param <= 255)) throw new AsmError(`line ${n}: event param out of range`);
        }
        scripts.push([EVENTS[ev].id, param, pc]);
      } else if (head.endsWith(':') && toks.length === 1) {
        const lab = head.slice(0, -1);
        if (lab in labels) throw new AsmError(`line ${n}: duplicate label ${lab}`);
        labels[lab] = pc;
      } else {
        const m = head.toLowerCase();
        let size;
        if (m === 'push') {
          if (toks.length !== 2) throw new AsmError(`line ${n}: push needs one value`);
          size = pushBytes(number(toks[1], strings)).length;
        } else if (['load', 'store', 'change', 'sys'].includes(m)) size = 2;
        else if (['jmp', 'jz', 'jnz'].includes(m)) size = 3;
        else if (m.startsWith('list_') && OPS[m]) size = 2;
        else if (OPS[m] && OPS[m].operands.length === 0) size = 1;
        else throw new AsmError(`line ${n}: unknown instruction '${head}'`);
        items.push([n, m, toks.slice(1), pc]);
        pc += size;
      }
    }
    if (!scripts.length) throw new AsmError('program needs at least one script (a "when" block)');
    if (scripts.length > S.limits.max_scripts) throw new AsmError(`too many scripts (max ${S.limits.max_scripts})`);
    if (Object.keys(lists).length > S.limits.max_lists) throw new AsmError(`too many lists (max ${S.limits.max_lists})`);
    if (Object.keys(variables).length > S.limits.max_vars) throw new AsmError(`too many variables (max ${S.limits.max_vars})`);

    const code = [];
    for (const [n, m, args, at] of items) {
      if (code.length !== at) throw new AsmError('internal layout error');
      if (m === 'push') code.push(...pushBytes(number(args[0], strings)));
      else if (m === 'load' || m === 'store' || m === 'change') {
        if (!(args[0] in variables)) throw new AsmError(`line ${n}: unknown variable '${args[0]}'`);
        const op = { load: 'load_var', store: 'store_var', change: 'change_var' }[m];
        code.push(OPS[op].code, variables[args[0]]);
      } else if (m.startsWith('list_')) {
        if (!(args[0] in lists)) throw new AsmError(`line ${n}: unknown list '${args[0]}'`);
        code.push(OPS[m].code, lists[args[0]]);
      } else if (m === 'jmp' || m === 'jz' || m === 'jnz') {
        if (!(args[0] in labels)) throw new AsmError(`line ${n}: unknown label '${args[0]}'`);
        const t = labels[args[0]];
        code.push(OPS[m].code, t & 0xff, t >> 8);
      } else if (m === 'sys') {
        const s = SYS[args[0]];
        if (!s) throw new AsmError(`line ${n}: unknown syscall '${args[0]}'`);
        code.push(OPS.sys.code, s.id);
      } else code.push(OPS[m].code);
    }

    const nameBytes = utf8(name);
    const header = [0x45, 0x4c, 0x58, 0x42, S.bytecode_version, Object.keys(lists).length, scripts.length, Object.keys(variables).length,
      code.length & 0xff, code.length >> 8, blob.length & 0xff, blob.length >> 8];
    for (let i = 0; i < 16; i++) header.push(nameBytes[i] || 0);
    for (const [ev, param, off] of scripts) header.push(ev, param, off & 0xff, off >> 8);
    const body = header.concat(code, blob);
    const c = crc32(body);
    const image = new Uint8Array(body.length + 4);
    image.set(body);
    image.set([c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, c >>> 24], body.length);
    if (image.length > S.limits.max_program_bytes) throw new AsmError(`program too large (${image.length} > ${S.limits.max_program_bytes} bytes)`);
    return { image, sourceMap: srcMarks, codeLen: code.length };
  }

  root.ElxAsm = { assemble, AsmError, crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
