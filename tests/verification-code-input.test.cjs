const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { buildSync } = require('esbuild');
const { outputFiles } = buildSync({ entryPoints: ['src/app/components/VerificationCodeInput.tsx'], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react'] });
const moduleValue = { exports: {} };
const hooks = { ...React, useId: () => 'otp-test', useRef: value => ({ current: value }), useState: value => [value, () => {}] };
new Function('require', 'module', 'exports', 'window', outputFiles[0].text)(name => name === 'react' ? hooks : require(name), moduleValue, moduleValue.exports, { requestAnimationFrame: callback => callback() });
const { VerificationCodeInput, normalizeVerificationCode } = moduleValue.exports;
function walk(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => walk(child, predicate, found)); return found;
}
function input(value, onChange) { return walk(VerificationCodeInput({ value, onChange }), node => node.type === 'input')[0]; }
test('four-digit codes remain strings, preserve zero, and normalize all supported digit sets before truncation', () => {
  for (const [raw, expected] of [['0123','0123'], ['٥١٢٦','5126'], ['۰۱۲۳','0123'], [' ٠ - ۱ 2.٣ ٤٥', '0123'], ['012345','0123'], ['a !','']]) assert.equal(normalizeVerificationCode(raw), expected);
});
test('one native LTR text input renders four decorative boxes and supports OS autofill without raw maxlength', () => {
  const tree = VerificationCodeInput({ value: '0123', onChange() {}, invalid: true, describedBy: 'error' });
  const inputs = walk(tree, node => node.type === 'input'); assert.equal(inputs.length, 1);
  const field = inputs[0];
  assert.equal(field.props.type, 'text'); assert.equal(field.props.inputMode, 'numeric');
  assert.equal(field.props.autoComplete, 'one-time-code'); assert.equal(field.props.dir, 'ltr');
  assert.equal(field.props.maxLength, undefined); assert.equal(field.props['aria-invalid'], true);
  assert.equal(field.props['aria-describedby'], 'error');
  const boxes = walk(tree, node => node.props?.className === 'otp-code__boxes')[0];
  assert.equal(boxes.props['aria-hidden'], 'true'); assert.equal(boxes.props.children.length, 4);
  assert.deepEqual(boxes.props.children.map(box => box.props.children), ['0','1','2','3']);
});
test('native typing, deletion, middle correction and autofill all use the same normalized string path', () => {
  let code = '';
  const change = raw => input(code, value => { code = value; }).props.onChange({ target: { value: raw, selectionStart: raw.length } });
  for (const raw of ['0','01','012','0123']) { change(raw); assert.equal(code, raw); }
  change('012'); assert.equal(code, '012'); change('0192'); assert.equal(code, '0192');
  change('٥١٢٦'); assert.equal(code, '5126'); change('۰۱۲۳'); assert.equal(code, '0123');
});
test('full-code paste replaces the code from any selection, removes separators and keeps the initial zero', () => {
  let code = '9999', prevented = false;
  input(code, value => { code = value; }).props.onPaste({ clipboardData: { getData: () => ' ٠١-٢٣ ' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(code, '0123');
  prevented = false;
  input(code, value => { code = value; }).props.onPaste({ clipboardData: { getData: () => '٢' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false, 'partial pastes use native selection-aware editing');
});
