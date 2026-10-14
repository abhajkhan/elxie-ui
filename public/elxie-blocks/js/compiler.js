// Blocks -> Elxie assembly -> bytecode.  Follows spec/02-bytecode.md "Compiler rules".
// compile(workspace, name) returns { ok, image, sourceMap, asm, errors:[{blockId,msg}], warnings, stats }
(function (root) {
  'use strict';
  const S = root.ELX_SPEC;
  const SYS = Object.fromEntries(S.syscalls.map((s) => [s.name, s]));
  const STACK = S.limits.stack_depth;

  class CompileError extends Error {
    constructor(block, msg) { super(msg); this.blockId = block && block.id; }
  }

  function numText(v) {
    const x = Number(v);
    if (!Number.isFinite(x)) return '0';
    return Number.isInteger(x) ? String(x) : String(Math.fround(x) === x ? x : x);
  }

  function compile(workspace, programName) {
    try { return compileInner(workspace, programName); } catch (e) {
      if (!(e instanceof CompileError)) throw e;
      return { ok: false, errors: [{ blockId: e.blockId, msg: e.message }], warnings: [], asm: '' };
    }
  }

  function compileInner(workspace, programName) {
    const lines = [];
    const warnings = [];
    const strings = [];
    let labelN = 0;
    const L = (p) => `${p}${++labelN}`;
    const emit = (s) => lines.push('    ' + s);
    const srcIds = [];
    const mark = (b) => { srcIds.push(b.id); lines.push(`.src ${srcIds.length - 1}`); };

    // variables -> v0..vN, lists -> l0..lN (Blockly variable type 'List')
    const allVars = workspace.getVariableMap().getAllVariables();
    const vars = allVars.filter((v) => v.type !== 'List');
    const listVars = [];  // only lists that blocks actually use get a slot
    const listIdx = {};
    const listName = (block) => {
      const id = block.getFieldValue('LIST');
      const v = id && workspace.getVariableMap().getVariableById(id);
      if (!v) throw new CompileError(block, 'Make a list first (Lists → Make a List).');
      if (!(id in listIdx)) {
        if (listVars.length >= S.limits.max_lists) throw new CompileError(block, `Elxie can use at most ${S.limits.max_lists} lists.`);
        listIdx[id] = 'l' + listVars.length; listVars.push(v);
      }
      return listIdx[id];
    };
    // broadcast message names -> ids 1..N (shared by "broadcast" and "when I receive")
    const msgIds = {};
    const msgId = (txt) => {
      const k = String(txt || '').trim().toLowerCase() || 'message1';
      if (!(k in msgIds)) msgIds[k] = Object.keys(msgIds).length + 1;
      if (msgIds[k] > 255) throw new CompileError(null, 'Too many different messages.');
      return msgIds[k];
    };
    // My Blocks: procedure definitions, inlined at every call
    const procs = {};
    for (const def of workspace.getBlocksByType('procedures_defnoreturn', false)) procs[def.getFieldValue('NAME')] = def;
    const inlining = [];
    if (vars.length > S.limits.max_vars) throw new CompileError(null, `Too many variables (max ${S.limits.max_vars}).`);
    const varIdx = {};
    vars.forEach((v, i) => { varIdx[v.getId()] = 'v' + i; });
    const varName = (block) => {
      const id = block.getFieldValue('VAR');
      if (!(id in varIdx)) throw new CompileError(block, 'This variable no longer exists.');
      return varIdx[id];
    };

    // -------------------------------------------------------------- expressions
    // Returns max stack depth used (pushes exactly one value).
    function expr(block, base, wantBool) {
      if (!block) { emit('push 0'); return base + 1; }
      const t = block.type;
      if (t === 'math_number') { emit('push ' + numText(block.getFieldValue('NUM'))); return base + 1; }
      if (t === 'variables_get') { emit('load ' + varName(block)); return base + 1; }
      const d = root.ElxBlocks.BY_TYPE[t];
      if (!d || (d.kind !== 'num' && d.kind !== 'bool' && d.kind !== 'colour')) throw new CompileError(block, 'This block cannot be used here.');
      if (d.literal) { emit('push ' + numText(block.getFieldValue(d.literal))); return base + 1; }
      if (d.listOp) return listOp(block, d, base);
      if (d.ctl === 'obstacle_closer') {  // distance < cm
        emit('sys distance');
        const depth = expr(block.getInputTargetBlock('CM'), base + 1);
        emit('lt');
        return Math.max(depth, base + 1);
      }
      if (d.op) {
        const names = d.args.map((a) => a.i);
        let depth = base;
        names.forEach((nm, k) => { depth = Math.max(depth, expr(block.getInputTargetBlock(nm), base + k, false)); });
        emit(d.op);
        return depth;
      }
      return syscall(block, d, base);
    }

    // list ops: operands are pushed in the VM's order (index before item)
    function listOp(block, d, base) {
      const order = { add: ['ITEM'], get: ['INDEX'], delete: ['INDEX'], set: ['INDEX', 'ITEM'], insert: ['INDEX', 'ITEM'], contains: ['ITEM'], len: [], clear: [] }[d.listOp];
      const l = listName(block);
      let depth = base;
      order.forEach((nm, k) => { depth = Math.max(depth, expr(block.getInputTargetBlock(nm), base + k)); });
      emit(`list_${d.listOp} ${l}`);
      checkDepth(block, depth);
      return Math.max(depth, d.kind === 'stmt' ? base : base + 1);
    }

    // "C D E- G5 # -": letter [#|b] [octave 3-7], '-' or '_' = rest; one beat each
    function melodyNotes(block, txt) {
      const out = [];
      for (const tok of String(txt || '').trim().split(/[\s,]+/).filter(Boolean)) {
        if (/^[-_.]+$/.test(tok)) { out.push(null); continue; }
        const m = /^([A-Ga-g])([#b]?)([3-7]?)$/.exec(tok);
        if (!m) throw new CompileError(block, `"${tok}" is not a note. Use letters like C D E F G A B, a dash for a rest.`);
        const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
        out.push(12 * ((m[3] ? Number(m[3]) : 4) + 1) + semi);
      }
      if (!out.length) throw new CompileError(block, 'Type some notes, like: C D E F G');
      if (out.length > 64) throw new CompileError(block, 'Too many notes (max 64).');
      return out;
    }

    function checkDepth(block, depth) {
      if (depth > STACK) throw new CompileError(block, 'Too many blocks inside each other here. Try using a variable.');
    }

    // pushes the block's arguments in spec order, then SYS
    function syscall(block, d, base) {
      const def = SYS[d.sys];
      let depth = base, k = 0;
      if (d.fixedArgs) for (const v of d.fixedArgs) { emit('push ' + v); depth = Math.max(depth, base + ++k); }
      for (const a of d.args) {
        if (a.dummy || a.stmts || a.list) continue;
        if (a.text !== undefined) {
          const s = 's' + strings.length;
          const txt = String(block.getFieldValue(a.f) || '');
          strings.push(`.string ${s} "${txt.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
          emit('push str.' + s);
          depth = Math.max(depth, base + ++k);
        } else if (a.f) {
          emit('push ' + numText(block.getFieldValue(a.f)));
          depth = Math.max(depth, base + ++k);
        } else {
          depth = Math.max(depth, expr(block.getInputTargetBlock(a.i), base + k, a.bool));
          k++;
        }
      }
      if (d.fixedTail) for (const v of d.fixedTail) { emit('push ' + v); depth = Math.max(depth, base + ++k); }
      if (k !== def.args.length) throw new CompileError(block, `internal: ${d.sys} expects ${def.args.length} arguments`);
      emit('sys ' + d.sys);
      checkDepth(block, depth);
      return Math.max(depth, def.returns ? base + 1 : base);
    }

    // -------------------------------------------------------------- statements
    function stmts(block, base) {
      for (let b = block; b; b = b.getNextBlock()) {
        if (!b.isEnabled()) continue;
        statement(b, base);
      }
    }

    function statement(b, base) {
      mark(b);
      const t = b.type;
      if (t === 'variables_set') { checkDepth(b, expr(b.getInputTargetBlock('VALUE'), base)); emit('store ' + varName(b)); return; }
      if (t === 'math_change') { checkDepth(b, expr(b.getInputTargetBlock('DELTA'), base)); emit('change ' + varName(b)); return; }
      if (t === 'procedures_callnoreturn') { callProc(b, base); return; }
      const d = root.ElxBlocks.BY_TYPE[t];
      if (!d) throw new CompileError(b, 'Unknown block.');
      if (d.kind !== 'stmt' && d.kind !== 'cap') throw new CompileError(b, 'This block cannot be used here.');
      if (d.listOp) { listOp(b, d, base); return; }
      if (d.sys) { syscall(b, d, base); return; }
      const cond = (nm) => checkDepth(b, expr(b.getInputTargetBlock(nm), base, true));
      switch (d.ctl) {
        case 'wait': checkDepth(b, expr(b.getInputTargetBlock('SECS'), base)); emit('wait'); return;
        case 'repeat': {
          const top = L('rep'), end = L('rend');
          checkDepth(b, expr(b.getInputTargetBlock('TIMES'), base));
          lines.push(top + ':'); emit('dup'); emit('push 0'); emit('gt'); emit('jz ' + end);
          checkDepth(b, base + 3);
          stmts(b.getInputTargetBlock('DO'), base + 1);
          mark(b); emit('push 1'); emit('sub'); emit('jmp ' + top);
          lines.push(end + ':'); emit('pop');
          return;
        }
        case 'forever': {
          const top = L('loop');
          lines.push(top + ':');
          stmts(b.getInputTargetBlock('DO'), base);
          mark(b); emit('jmp ' + top);
          return;
        }
        case 'if': {
          const end = L('endif');
          cond('COND'); emit('jz ' + end);
          stmts(b.getInputTargetBlock('DO'), base);
          lines.push(end + ':');
          return;
        }
        case 'if_else': {
          const els = L('else'), end = L('endif');
          cond('COND'); emit('jz ' + els);
          stmts(b.getInputTargetBlock('DO'), base);
          emit('jmp ' + end);
          lines.push(els + ':');
          stmts(b.getInputTargetBlock('ELSE'), base);
          lines.push(end + ':');
          return;
        }
        case 'wait_until': {
          const top = L('wait'), end = L('wend');
          lines.push(top + ':'); cond('COND'); emit('jnz ' + end); emit('jmp ' + top);
          lines.push(end + ':');
          return;
        }
        case 'repeat_until': {
          const top = L('until'), end = L('uend');
          lines.push(top + ':'); cond('COND'); emit('jnz ' + end);
          stmts(b.getInputTargetBlock('DO'), base);
          mark(b); emit('jmp ' + top);
          lines.push(end + ':');
          return;
        }
        case 'stop': emit(b.getFieldValue('WHAT') === 'all' ? 'stop_all' : 'end'); return;
        case 'broadcast': emit('push ' + msgId(b.getFieldValue('MSG'))); emit('sys broadcast'); return;
        case 'my_melody':
          for (const note of melodyNotes(b, b.getFieldValue('NOTES'))) {
            if (note === null) { emit('push 1'); emit('sys rest'); } else { emit('push ' + note); emit('push 1'); emit('sys play_note'); }
          }
          checkDepth(b, base + 2);
          return;
      }
      throw new CompileError(b, 'Unknown block.');
    }

    // My Blocks: arguments are stored in the procedure's parameter variables, then the body is inlined
    function callProc(b, base) {
      const name = b.getFieldValue('NAME');
      const def = procs[name];
      if (!def || !def.isEnabled()) throw new CompileError(b, `The block "${name}" has no definition.`);
      if (inlining.includes(name)) throw new CompileError(b, `"${name}" cannot use itself.`);
      if (inlining.length >= 8) throw new CompileError(b, 'My Blocks are nested too deep.');
      const models = def.getVarModels ? def.getVarModels() : [];
      models.forEach((v, k) => {
        if (!(v.getId() in varIdx)) throw new CompileError(b, 'Internal: missing parameter variable.');
        checkDepth(b, expr(b.getInputTargetBlock('ARG' + k), base));
        emit('store ' + varIdx[v.getId()]);
      });
      inlining.push(name);
      try { stmts(def.getInputTargetBlock('STACK'), base); } finally { inlining.pop(); }
    }

    // -------------------------------------------------------------- scripts
    const errors = [];
    const top = workspace.getTopBlocks(true).filter((b) => b.isEnabled());  // sorted top-to-bottom, left-to-right
    const hats = [];
    for (const b of top) {
      const d = root.ElxBlocks.BY_TYPE[b.type];
      if (d && d.kind === 'hat') hats.push(b);
      else if (b.type === 'procedures_defnoreturn') continue;
      else warnings.push({ blockId: b.id, msg: 'This stack has no "when" block on top, so it will not run.' });
    }
    if (!hats.length) errors.push({ blockId: null, msg: 'Add a "when ⚑ clicked" block (Events) to start your program.' });
    if (hats.length > S.limits.max_scripts) errors.push({ blockId: hats[S.limits.max_scripts].id, msg: `Elxie can run at most ${S.limits.max_scripts} "when" scripts.` });

    const body = [];
    if (!errors.length) {
      for (const h of hats) {
        const d = root.ElxBlocks.BY_TYPE[h.type];
        lines.length = 0;
        mark(h);
        try {
          const param = d.msgParam ? ' ' + msgId(h.getFieldValue(d.msgParam))
            : d.param ? ' ' + Math.max(0, Math.min(255, Math.round(Number(h.getFieldValue(d.param)) || 0))) : '';
          lines.unshift(`.script ${d.ev}${param}`);
          stmts(h.getNextBlock(), 0);
        } catch (e) {
          if (!(e instanceof CompileError)) throw e;
          errors.push({ blockId: e.blockId, msg: e.message });
        }
        body.push(...lines);
      }
    }
    const nameSafe = (programName || 'My program').replace(/"/g, "'");
    let nm = '';
    for (const ch of nameSafe) { if (new TextEncoder().encode(nm + ch).length > 16) break; nm += ch; }
    const asm = [`.name "${nm}"`, vars.length ? '.var ' + vars.map((_, i) => 'v' + i).join(' ') : '',
      listVars.length ? '.list ' + listVars.map((_, i) => 'l' + i).join(' ') : '', ...strings, ...body]
      .filter(Boolean).join('\n') + '\n';
    if (errors.length) return { ok: false, errors, warnings, asm };
    try {
      const r = root.ElxAsm.assemble(asm);
      return { ok: true, image: r.image, sourceMap: r.sourceMap.map(([pc, k]) => [pc, srcIds[Number(k)]]), asm, errors, warnings, stats: { bytes: r.image.length, scripts: hats.length, vars: vars.length, lists: listVars.length, messages: Object.keys(msgIds).length } };
    } catch (e) {
      return { ok: false, errors: [{ blockId: null, msg: e.message }], warnings, asm };
    }
  }

  // pc -> block id using the .src markers (the instruction that just ran is pc-1)
  function blockAtPc(sourceMap, pc) {
    let id = null;
    for (const [p, b] of sourceMap) { if (p <= pc) id = b; else break; }
    return id;
  }

  root.ElxCompiler = { compile, blockAtPc };
})(typeof window !== 'undefined' ? window : globalThis);
