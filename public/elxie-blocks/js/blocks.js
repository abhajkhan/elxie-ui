// Elxie block set. Each entry drives BOTH the Blockly definition and the
// compiler (js/compiler.js), so a block can never appear without code behind it.
(function (root) {
  'use strict';
  const E = root.ELX_SPEC.enums;

  // ---------------------------------------------------------------- dropdowns
  const label = (k) => k.replace(/_/g, ' ');
  const dd = (enumName, keys) => (keys || Object.keys(E[enumName])).map((k) => [label(k), String(E[enumName][k])]);
  const COLOURS = [
    ['red', 0xff0000], ['orange', 0xff7a00], ['yellow', 0xffd000], ['lime', 0x80ff00], ['green', 0x00c000], ['teal', 0x00c0a0],
    ['cyan', 0x00d0ff], ['blue', 0x0040ff], ['indigo', 0x4b00ff], ['purple', 0x8000ff], ['pink', 0xff2080], ['magenta', 0xff00ff],
    ['white', 0xffffff], ['warm white', 0xffb060], ['off', 0x000000],
  ];
  const swatch = (hex) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="10" fill="#${hex}" stroke="#ffffff" stroke-width="2"/></svg>`);
  const COLOUR_OPTIONS = COLOURS.map(([n, v]) => [{ src: swatch(v.toString(16).padStart(6, '0')), width: 22, height: 22, alt: n }, String(v)]);
  const NOTES = (() => {
    const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], semis = [0, 2, 4, 5, 7, 9, 11], out = [];
    for (let oct = 4; oct <= 6; oct++) for (let i = 0; i < 7; i++) {
      if (oct === 6 && i > 0) break;
      out.push([names[i] + oct, String(12 * (oct + 1) + semis[i])]);
    }
    return out;
  })();
  const CORNER = [['front left', '1'], ['front right', '2'], ['back left', '3'], ['back right', '4']];
  const DD = {
    drive: dd('drive'), turn: dd('turn'), look: dd('look'), face: dd('face'), effect: dd('effect'), sound: dd('sound'),
    emotion: dd('emotion'), zone: [['any', '0'], ['left', '1'], ['center', '2'], ['right', '3']],
    corner: [['any', '0'], ...CORNER], corner4: CORNER, tilt: dd('tilt'), axisTilt: [['pitch', '1'], ['roll', '2']],
    axisJoy: [['x', '1'], ['y', '2']], button: [['A', '1'], ['B', '2'], ['stick', '3']], note: NOTES,
    stop: [['all', 'all'], ['this script', 'this']], until: dd('until'), stopmode: dd('stopmode'), icon: dd('icon'),
    anim: dd('anim'), melody: [['Happy Birthday', '1'], ['Twinkle Twinkle', '2'], ['Victory', '3'], ['Siren', '4']],
    lineall: dd('lineall'), compass: dd('compass'), dance: [['1 (wiggle)', '1'], ['2 (spin party)', '2'], ['3 (shuffle)', '3']],
    fill: [['filled', '1'], ['outline', '0']], direction: [['north', '0'], ['east', '90'], ['south', '180'], ['west', '270']],
    colour: COLOUR_OPTIONS,
  };

  // ---------------------------------------------------------------- block table
  // kind: hat | stmt | num | bool | cap (statement with nothing below) | colour (reporter)
  // args: {f, dd} dropdown · {f, num} number field · {f, text} text field · {i, def} number input
  //       {i, bool} boolean input · {i, colour} colour input · {dummy} · {stmts}
  const B = [];
  const add = (cat, type, kind, msg, args = [], extra = {}) => B.push({ cat, type, kind, msg, args, ...extra });
  const n = (i, def) => ({ i, def });
  const b = (i) => ({ i, bool: true });
  const c = (i, def) => ({ i, colour: true, def });
  const f = (fName, ddName) => ({ f: fName, dd: ddName });

  // Events
  add('events', 'elx_when_start', 'hat', 'when ⚑ clicked', [], { ev: 'start' });
  add('events', 'elx_when_touched', 'hat', 'when Elxie is touched', [], { ev: 'touched' });
  add('events', 'elx_when_long_press', 'hat', 'when Elxie is long-pressed', [], { ev: 'long_press' });
  add('events', 'elx_when_double_tap', 'hat', 'when Elxie is double-tapped', [], { ev: 'double_tap' });
  add('events', 'elx_when_obstacle', 'hat', 'when obstacle closer than %1 cm', [{ f: 'CM', num: 15, min: 1, max: 255 }], { ev: 'obstacle', param: 'CM' });
  add('events', 'elx_when_object_near', 'hat', 'when object near %1', [f('CORNER', 'corner')], { ev: 'object_near', param: 'CORNER' });
  add('events', 'elx_when_line', 'hat', 'when line under %1', [f('ZONE', 'zone')], { ev: 'line', param: 'ZONE' });
  add('events', 'elx_when_edge', 'hat', 'when edge at %1', [f('CORNER', 'corner')], { ev: 'edge', param: 'CORNER' });
  add('events', 'elx_when_tilted', 'hat', 'when tilted %1', [f('TILT', 'tilt')], { ev: 'tilted', param: 'TILT' });
  add('events', 'elx_when_shaken', 'hat', 'when shaken', [], { ev: 'shaken' });
  add('events', 'elx_when_picked_up', 'hat', 'when picked up', [], { ev: 'picked_up' });
  add('events', 'elx_when_put_down', 'hat', 'when put down', [], { ev: 'put_down' });
  add('events', 'elx_when_magnet', 'hat', 'when magnet is near', [], { ev: 'magnet' });
  add('events', 'elx_when_button', 'hat', 'when remote button %1 pressed', [f('BUTTON', 'button')], { ev: 'remote_button', param: 'BUTTON' });
  add('events', 'elx_when_battery_low', 'hat', 'when battery is low', [], { ev: 'battery_low' });
  add('events', 'elx_when_receive', 'hat', 'when I receive %1', [{ f: 'MSG', text: 'message1' }], { ev: 'message', msgParam: 'MSG' });
  add('events', 'elx_broadcast', 'stmt', 'broadcast %1', [{ f: 'MSG', text: 'message1' }], { ctl: 'broadcast' });

  // Motion
  add('motion', 'elx_drive_timed', 'stmt', 'move %1 at %2 % for %3 sec', [f('DIR', 'drive'), n('SPEED', 50), n('SECS', 1)], { sys: 'drive_timed' });
  add('motion', 'elx_drive', 'stmt', 'move %1 at %2 %', [f('DIR', 'drive'), n('SPEED', 50)], { sys: 'drive' });
  add('motion', 'elx_turn', 'stmt', 'turn %1 %2 degrees', [f('DIR', 'turn'), n('DEG', 90)], { sys: 'turn_degrees' });
  add('motion', 'elx_spin', 'stmt', 'spin %1 for %2 sec', [f('DIR', 'turn'), n('SECS', 1)], { sys: 'spin' });
  add('motion', 'elx_arc', 'stmt', 'drive in an arc to the %1 at %2 % for %3 sec', [f('DIR', 'turn'), n('SPEED', 50), n('SECS', 2)], { sys: 'drive_arc' });
  add('motion', 'elx_move_until', 'stmt', 'move %1 at %2 % until %3', [f('DIR', 'drive'), n('SPEED', 40), f('UNTIL', 'until')], { sys: 'move_until' });
  add('motion', 'elx_follow_line', 'stmt', 'follow the line at %1 % for %2 sec', [n('SPEED', 40), n('SECS', 5)], { sys: 'follow_line' });
  add('motion', 'elx_follow_junction', 'stmt', 'follow the line at %1 % until a crossroad', [n('SPEED', 40)], { sys: 'follow_line', fixedTail: [0] });
  add('motion', 'elx_stop_motors', 'stmt', 'stop moving', [], { sys: 'stop_motors' });
  add('motion', 'elx_stop_mode', 'stmt', 'when stopping: %1', [f('MODE', 'stopmode')], { sys: 'set_stop_mode' });
  add('motion', 'elx_turn_to_direction', 'stmt', 'turn to face %1', [f('DIR', 'direction')], { sys: 'turn_to_heading' });
  add('motion', 'elx_turn_to_heading', 'stmt', 'turn to face heading %1 °', [n('DEG', 0)], { sys: 'turn_to_heading' });
  add('motion', 'elx_set_motors', 'stmt', 'set wheels left %1 % right %2 %', [n('L', 50), n('R', 50)], { sys: 'set_motors' });

  // Face
  add('face', 'elx_face_show', 'stmt', 'show face %1', [f('FACE', 'face')], { sys: 'face_show' });
  add('face', 'elx_face_look', 'stmt', 'look %1', [f('DIR', 'look')], { sys: 'face_look' });
  add('face', 'elx_face_blink', 'stmt', 'blink', [], { sys: 'face_blink' });
  add('face', 'elx_face_wink', 'stmt', 'wink', [], { sys: 'face_wink' });
  add('face', 'elx_show_icon', 'stmt', 'show icon %1', [f('ICON', 'icon')], { sys: 'show_icon' });
  add('face', 'elx_face_anim', 'stmt', 'play face animation %1', [f('ANIM', 'anim')], { sys: 'face_anim' });
  add('face', 'elx_show_text', 'stmt', 'show text %1', [{ f: 'TEXT', text: 'Hi!' }], { sys: 'show_text' });
  add('face', 'elx_show_number', 'stmt', 'show number %1', [n('N', 7)], { sys: 'show_number' });
  add('face', 'elx_face_clear', 'stmt', 'clear screen', [], { sys: 'face_clear' });
  add('face', 'elx_draw_pixel', 'stmt', 'draw dot at x %1 y %2', [n('X', 64), n('Y', 32)], { sys: 'draw_pixel' });
  add('face', 'elx_draw_line', 'stmt', 'draw line from x %1 y %2 to x %3 y %4', [n('X1', 0), n('Y1', 0), n('X2', 127), n('Y2', 63)], { sys: 'draw_line' });
  add('face', 'elx_draw_rect', 'stmt', 'draw %5 rectangle at x %1 y %2 width %3 height %4', [n('X', 34), n('Y', 12), n('W', 60), n('H', 40), f('FILL', 'fill')], { sys: 'draw_rect' });
  add('face', 'elx_draw_circle', 'stmt', 'draw %4 circle at x %1 y %2 size %3', [n('X', 64), n('Y', 32), n('R', 20), f('FILL', 'fill')], { sys: 'draw_circle' });

  // Lights
  add('lights', 'elx_lights_all', 'stmt', 'set all lights to %1', [c('COLOR', 0xff0000)], { sys: 'lights_all' });
  add('lights', 'elx_light_set', 'stmt', 'set light %1 to %2', [n('N', 1), c('COLOR', 0x0040ff)], { sys: 'light_set' });
  add('lights', 'elx_light_effect', 'stmt', 'light effect %1 colour %2', [f('EFFECT', 'effect'), c('COLOR', 0x00d0ff)], { sys: 'light_effect' });
  add('lights', 'elx_light_bar', 'stmt', 'show %1 out of %2 as a light bar in %3', [n('VALUE', 5), n('MAX', 10), c('COLOR', 0x00c000)], { sys: 'light_bar' });
  add('lights', 'elx_lights_brightness', 'stmt', 'set brightness to %1 %', [n('P', 50)], { sys: 'lights_brightness' });
  add('lights', 'elx_lights_off', 'stmt', 'lights off', [], { sys: 'lights_off' });
  add('lights', 'elx_colour', 'colour', '%1', [f('COLOUR', 'colour')], { literal: 'COLOUR', hidden: true });
  add('lights', 'elx_rgb', 'colour', 'colour red %1 green %2 blue %3', [n('R', 255), n('G', 120), n('B', 0)], { sys: 'rgb' });
  add('lights', 'elx_random_color', 'colour', 'random colour', [], { sys: 'random_color' });

  // Sound
  add('sound', 'elx_play_sound', 'stmt', 'play sound %1', [f('SOUND', 'sound')], { sys: 'play_sound' });
  add('sound', 'elx_play_note', 'stmt', 'play note %1 for %2 beats', [f('NOTE', 'note'), n('BEATS', 1)], { sys: 'play_note' });
  add('sound', 'elx_play_tone', 'stmt', 'play tone %1 Hz for %2 sec', [n('HZ', 440), n('SECS', 0.5)], { sys: 'play_tone' });
  add('sound', 'elx_play_melody', 'stmt', 'play melody %1', [f('MELODY', 'melody')], { sys: 'play_melody' });
  add('sound', 'elx_play_my_melody', 'stmt', 'play my melody %1', [{ f: 'NOTES', text: 'C D E F G - G G' }], { ctl: 'my_melody' });
  add('sound', 'elx_rest', 'stmt', 'rest for %1 beats', [n('BEATS', 1)], { sys: 'rest' });
  add('sound', 'elx_set_tempo', 'stmt', 'set tempo to %1', [n('BPM', 120)], { sys: 'set_tempo' });
  add('sound', 'elx_stop_sound', 'stmt', 'stop sound', [], { sys: 'stop_sound' });

  // Sensors
  add('sensors', 'elx_distance', 'num', 'distance (cm)', [], { sys: 'distance' });
  add('sensors', 'elx_obstacle_closer', 'bool', 'obstacle closer than %1 cm?', [n('CM', 15)], { ctl: 'obstacle_closer' });
  add('sensors', 'elx_object_near', 'bool', 'object near %1 ?', [f('CORNER', 'corner')], { sys: 'object_near' });
  add('sensors', 'elx_line_detected', 'bool', 'line under %1 ?', [f('ZONE', 'zone')], { sys: 'line_detected' });
  add('sensors', 'elx_line_all', 'bool', 'all line sensors on %1 ?', [f('WHAT', 'lineall')], { sys: 'line_all' });
  add('sensors', 'elx_line_value', 'num', 'line sensor %1', [n('N', 1)], { sys: 'line_value' });
  add('sensors', 'elx_line_position', 'num', 'line position', [], { sys: 'line_position' });
  add('sensors', 'elx_edge_detected', 'bool', 'edge at %1 ?', [f('CORNER', 'corner')], { sys: 'edge_detected' });
  add('sensors', 'elx_floor_depth', 'num', 'corner sensor %1', [f('CORNER', 'corner4')], { sys: 'floor_depth' });
  add('sensors', 'elx_tilt', 'num', 'tilt %1', [f('AXIS', 'axisTilt')], { sys: 'tilt' });
  add('sensors', 'elx_shaken', 'bool', 'shaken?', [], { sys: 'is_shaken' });
  add('sensors', 'elx_picked_up', 'bool', 'picked up?', [], { sys: 'picked_up' });
  add('sensors', 'elx_upside_down', 'bool', 'upside down?', [], { sys: 'upside_down' });
  add('sensors', 'elx_turned_angle', 'num', 'turned angle', [], { sys: 'turned_angle' });
  add('sensors', 'elx_reset_angle', 'stmt', 'reset turned angle', [], { sys: 'reset_angle' });
  add('sensors', 'elx_heading', 'num', 'compass heading', [], { sys: 'heading' });
  add('sensors', 'elx_facing', 'bool', 'facing %1 ?', [f('DIR', 'compass')], { sys: 'facing' });
  add('sensors', 'elx_magnet_near', 'bool', 'magnet near?', [], { sys: 'magnet_near' });
  add('sensors', 'elx_magnet_strength', 'num', 'magnet strength', [], { sys: 'magnet_strength' });
  add('sensors', 'elx_touched', 'bool', 'touched?', [], { sys: 'is_touched', fixedArgs: [0] });
  add('sensors', 'elx_touch_count', 'num', 'touch count', [], { sys: 'touch_count' });
  add('sensors', 'elx_battery', 'num', 'battery level (%)', [], { sys: 'battery_level' });
  add('sensors', 'elx_timer', 'num', 'timer', [], { sys: 'timer' });
  add('sensors', 'elx_reset_timer', 'stmt', 'reset timer', [], { sys: 'reset_timer' });
  add('sensors', 'elx_calibrate_line', 'stmt', 'calibrate line sensors for %1 sec', [n('SECS', 5)], { sys: 'calibrate_line' });

  // Remote
  add('remote', 'elx_joystick', 'num', 'joystick %1', [f('AXIS', 'axisJoy')], { sys: 'joystick' });
  add('remote', 'elx_remote_button', 'bool', 'remote button %1 pressed?', [f('BUTTON', 'button')], { sys: 'remote_button' });
  add('remote', 'elx_joystick_drive', 'stmt', 'drive with joystick for %1 sec', [n('SECS', 30)], { sys: 'joystick_drive' });
  add('remote', 'elx_joystick_drive_forever', 'stmt', 'drive with joystick forever', [], { sys: 'joystick_drive', fixedArgs: [0] });
  add('remote', 'elx_remote_buzz', 'stmt', 'buzz remote for %1 ms', [n('MS', 200)], { sys: 'remote_buzz' });

  // Pet
  add('pet', 'elx_react', 'stmt', 'react %1', [f('EMOTION', 'emotion')], { sys: 'react' });
  add('pet', 'elx_dance', 'stmt', 'do dance %1', [f('N', 'dance')], { sys: 'dance' });
  add('pet', 'elx_say_hello', 'stmt', 'say hello', [], { sys: 'say_hello' });
  add('pet', 'elx_act_sleepy', 'stmt', 'act sleepy', [], { sys: 'act_sleepy' });
  add('pet', 'elx_set_mood', 'stmt', 'set mood to %1', [f('EMOTION', 'emotion')], { sys: 'set_mood' });
  add('pet', 'elx_mood', 'num', 'mood', [], { sys: 'mood' });

  // Control
  add('control', 'elx_wait', 'stmt', 'wait %1 seconds', [n('SECS', 1)], { ctl: 'wait' });
  add('control', 'elx_repeat', 'stmt', 'repeat %1 %2 %3', [n('TIMES', 10), { dummy: true }, { stmts: 'DO' }], { ctl: 'repeat' });
  add('control', 'elx_forever', 'cap', 'forever %1 %2', [{ dummy: true }, { stmts: 'DO' }], { ctl: 'forever' });
  add('control', 'elx_if', 'stmt', 'if %1 then %2 %3', [b('COND'), { dummy: true }, { stmts: 'DO' }], { ctl: 'if' });
  add('control', 'elx_if_else', 'stmt', 'if %1 then %2 %3 else %4 %5', [b('COND'), { dummy: true }, { stmts: 'DO' }, { dummy: true }, { stmts: 'ELSE' }], { ctl: 'if_else' });
  add('control', 'elx_wait_until', 'stmt', 'wait until %1', [b('COND')], { ctl: 'wait_until' });
  add('control', 'elx_repeat_until', 'stmt', 'repeat until %1 %2 %3', [b('COND'), { dummy: true }, { stmts: 'DO' }], { ctl: 'repeat_until' });
  add('control', 'elx_stop', 'cap', 'stop %1', [f('WHAT', 'stop')], { ctl: 'stop' });

  // Operators
  const bin = (type, sym, op) => add('operators', type, 'num', `%1 ${sym} %2`, [n('A', 0), n('B', 0)], { op });
  bin('elx_add', '+', 'add'); bin('elx_sub', '−', 'sub'); bin('elx_mul', '×', 'mul'); bin('elx_div', '÷', 'div');
  add('operators', 'elx_random', 'num', 'pick random %1 to %2', [n('A', 1), n('B', 10)], { op: 'random' });
  const cmp = (type, sym, op) => add('operators', type, 'bool', `%1 ${sym} %2`, [n('A', 0), n('B', 50)], { op });
  cmp('elx_gt', '>', 'gt'); cmp('elx_lt', '<', 'lt'); cmp('elx_eq', '=', 'eq');
  add('operators', 'elx_and', 'bool', '%1 and %2', [b('A'), b('B')], { op: 'and' });
  add('operators', 'elx_or', 'bool', '%1 or %2', [b('A'), b('B')], { op: 'or' });
  add('operators', 'elx_not', 'bool', 'not %1', [b('A')], { op: 'not' });
  add('operators', 'elx_mod', 'num', '%1 mod %2', [n('A', 10), n('B', 3)], { op: 'mod' });
  add('operators', 'elx_round', 'num', 'round %1', [n('A', 2.5)], { op: 'round' });
  add('operators', 'elx_abs', 'num', 'abs %1', [n('A', -5)], { op: 'abs' });

  // Lists (list variables have Blockly variable type 'List')
  const L = { f: 'LIST', list: true };
  add('lists', 'elx_list_add', 'stmt', 'add %1 to %2', [n('ITEM', 10), L], { listOp: 'add' });
  add('lists', 'elx_list_delete', 'stmt', 'delete item %1 of %2', [n('INDEX', 1), L], { listOp: 'delete' });
  add('lists', 'elx_list_clear', 'stmt', 'delete all of %1', [L], { listOp: 'clear' });
  add('lists', 'elx_list_insert', 'stmt', 'insert %1 at %2 of %3', [n('ITEM', 10), n('INDEX', 1), L], { listOp: 'insert' });
  add('lists', 'elx_list_replace', 'stmt', 'replace item %1 of %2 with %3', [n('INDEX', 1), L, n('ITEM', 10)], { listOp: 'set' });
  add('lists', 'elx_list_item', 'num', 'item %1 of %2', [n('INDEX', 1), L], { listOp: 'get' });
  add('lists', 'elx_list_length', 'num', 'length of %1', [L], { listOp: 'len' });
  add('lists', 'elx_list_contains', 'bool', '%1 contains %2 ?', [L, n('ITEM', 10)], { listOp: 'contains' });

  // ---------------------------------------------------------------- categories (Scratch-like colours)
  const CATS = [
    { id: 'events', name: 'Events', color: '#FFBF00' },
    { id: 'motion', name: 'Motion', color: '#4C97FF' },
    { id: 'face', name: 'Face', color: '#9966FF' },
    { id: 'lights', name: 'Lights', color: '#E6559C' },
    { id: 'sound', name: 'Sound', color: '#CF63CF' },
    { id: 'sensors', name: 'Sensors', color: '#5CB1D6' },
    { id: 'remote', name: 'Remote', color: '#0FBD8C' },
    { id: 'pet', name: 'Pet', color: '#FF8C1A' },
    { id: 'control', name: 'Control', color: '#FFAB19' },
    { id: 'operators', name: 'Operators', color: '#59C059' },
    { id: 'variables', name: 'Variables', color: '#FF8C1A' },
    { id: 'lists', name: 'Lists', color: '#FF661A' },
    { id: 'myblocks', name: 'My Blocks', color: '#FF6680' },
  ];

  // ---------------------------------------------------------------- Blockly definitions
  function toBlocklyJson(d) {
    const args0 = [];
    for (const a of d.args) {
      if (a.dummy) args0.push({ type: 'input_dummy' });
      else if (a.stmts) args0.push({ type: 'input_statement', name: a.stmts });
      else if (a.list) args0.push({ type: 'field_variable', name: a.f, variable: null, variableTypes: ['List'], defaultType: 'List' });
      else if (a.dd) args0.push({ type: 'field_dropdown', name: a.f, options: DD[a.dd] });
      else if (a.text !== undefined) args0.push({ type: 'field_input', name: a.f, text: a.text });
      else if (a.num !== undefined) args0.push({ type: 'field_number', name: a.f, value: a.num, min: a.min, max: a.max, precision: 1 });
      else if (a.bool) args0.push({ type: 'input_value', name: a.i, check: 'Boolean' });
      else if (a.colour) args0.push({ type: 'input_value', name: a.i, check: ['Colour', 'Number'] });
      else args0.push({ type: 'input_value', name: a.i, check: ['Number', 'Colour'] });
    }
    const j = { type: d.type, message0: d.msg, args0, style: d.cat + '_blocks', inputsInline: true, tooltip: d.msg.replace(/%\d/g, '…') };
    if (d.kind === 'hat') j.nextStatement = null;
    if (d.kind === 'stmt') { j.previousStatement = null; j.nextStatement = null; }
    if (d.kind === 'cap') j.previousStatement = null;
    if (d.kind === 'num') j.output = 'Number';
    if (d.kind === 'bool') j.output = 'Boolean';
    if (d.kind === 'colour') j.output = 'Colour';
    if (d.args.some((a) => a.stmts)) j.inputsInline = false;
    return j;
  }

  function theme(Blockly) {
    const blockStyles = {}, categoryStyles = {};
    for (const cat of CATS) {
      blockStyles[cat.id + '_blocks'] = { colourPrimary: cat.color };
      categoryStyles[cat.id + '_category'] = { colour: cat.color };
    }
    blockStyles.events_blocks.hat = 'cap';
    blockStyles.variable_blocks = { colourPrimary: '#FF8C1A' };
    blockStyles.variable_dynamic_blocks = { colourPrimary: '#FF8C1A' };
    blockStyles.math_blocks = { colourPrimary: '#59C059' };
    blockStyles.procedure_blocks = { colourPrimary: '#FF6680' };
    return Blockly.Theme.defineTheme('elxie', {
      base: Blockly.Themes.Classic, blockStyles, categoryStyles,
      componentStyles: { workspaceBackgroundColour: '#F9F9FB', toolboxBackgroundColour: '#FFFFFF', flyoutBackgroundColour: '#F2F3F7', flyoutOpacity: 1, scrollbarColour: '#CED3DE' },
      fontStyle: { family: 'Nunito, "Helvetica Neue", Helvetica, Arial, sans-serif', weight: '700', size: 12 },
      startHats: true,
    });
  }

  function shadowFor(a) {
    if (a.colour) return { shadow: { type: 'elx_colour', fields: { COLOUR: String(a.def) } } };
    return { shadow: { type: 'math_number', fields: { NUM: a.def } } };
  }

  function blockEntry(d) {
    const inputs = {};
    for (const a of d.args) if (a.i && !a.bool) inputs[a.i] = shadowFor(a);
    return { kind: 'block', type: d.type, inputs };
  }

  function toolbox() {
    const contents = [];
    for (const cat of CATS) {
      const style = cat.id + '_category';
      if (cat.id === 'variables') { contents.push({ kind: 'category', name: cat.name, categorystyle: style, custom: 'VARIABLE' }); continue; }
      if (cat.id === 'lists') { contents.push({ kind: 'category', name: cat.name, categorystyle: style, custom: 'ELX_LISTS' }); continue; }
      if (cat.id === 'myblocks') { contents.push({ kind: 'category', name: cat.name, categorystyle: style, custom: 'ELX_MYBLOCKS' }); continue; }
      const items = B.filter((d) => d.cat === cat.id && !d.hidden).map(blockEntry);
      contents.push({ kind: 'category', name: cat.name, categorystyle: style, contents: items });
    }
    return { kind: 'categoryToolbox', contents };
  }

  // Dynamic categories: Lists and My Blocks
  function listsFlyout(ws) {
    const out = [{ kind: 'button', text: 'Make a List', callbackKey: 'ELX_MAKE_LIST' }];
    const lists = ws.getVariableMap().getVariablesOfType('List');
    if (!lists.length) return out;
    const first = lists[0];
    for (const d of B.filter((x) => x.cat === 'lists')) {
      const e = blockEntry(d);
      e.fields = { LIST: { id: first.getId(), name: first.name, type: 'List' } };
      out.push(e);
    }
    return out;
  }
  function myBlocksFlyout(ws) {
    const out = [{ kind: 'block', type: 'procedures_defnoreturn' }];
    for (const def of ws.getBlocksByType('procedures_defnoreturn', false)) {
      const name = def.getFieldValue('NAME');
      const params = def.getVars ? def.getVars() : [];
      out.push({ kind: 'block', type: 'procedures_callnoreturn', extraState: { name, params } });
    }
    return out;
  }

  let registered = null;
  function register(Blockly) {  // idempotent
    if (!registered) {
      Blockly.common.defineBlocksWithJsonArray(B.map(toBlocklyJson));
      registered = theme(Blockly);
    }
    return registered;
  }
  function attachWorkspace(Blockly, ws) {
    ws.registerToolboxCategoryCallback('ELX_LISTS', listsFlyout);
    ws.registerToolboxCategoryCallback('ELX_MYBLOCKS', myBlocksFlyout);
    ws.registerButtonCallback('ELX_MAKE_LIST', (btn) => Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace(), null, 'List'));
  }

  root.ElxBlocks = { BLOCKS: B, BY_TYPE: Object.fromEntries(B.map((d) => [d.type, d])), CATS, DD, register, toolbox, attachWorkspace };
})(typeof window !== 'undefined' ? window : globalThis);
