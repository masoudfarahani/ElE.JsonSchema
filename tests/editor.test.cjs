const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { mountEditor } = require('../.test-build/editor.js');
const e = require('../.test-build/models/elem.js');
const v = require('../.test-build/models/validators.js');

function setup() {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost' });
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  mountEditor(document.querySelector('#app'));
  const query = selector => document.querySelector(selector);
  const click = selector => query(selector).click();
  const fill = (selector, value) => { query(selector).value = value; };
  const type = value => { fill('#property-type', value); query('#property-type').dispatchEvent(new dom.window.Event('change')); };
  const save = () => query('#property-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  const schema = () => JSON.parse(query('#preview').textContent);
  return { dom, query, click, fill, type, save, schema };
}

test('schema safely serializes names, enum strings, regex, required fields and array items', () => {
  const root = new e.ObjectElem('root');
  const text = new e.StringElem('quoted"\\name');
  text.AddValidator(new v.StringEnum(['a"b', 'c\\d', '\n', '<script>']));
  text.AddValidator(new v.RegexValidator('^\\w+"$'));
  text.AddValidator(new v.RequiredValidator());
  root.AddProperties(text);
  const array = new e.ArrayElem('rows');
  array.AddProperties(new e.DateElem('item'));
  root.AddProperties(array);
  const schema = JSON.parse(root.ToString());
  assert.deepEqual(schema.required, ['quoted"\\name']);
  assert.equal(schema.properties[text.elemName].pattern, '^\\w+"$');
  assert.deepEqual(schema.properties[text.elemName].enum, ['a"b', 'c\\d', '\n', '<script>']);
  assert.deepEqual(schema.properties.rows.items, { type: 'string', format: 'date' });
  assert.throws(() => new e.NumberElem('age').AddValidator(new v.RegexValidator('x')));
});

test('number modal follows registry, validates bounds and round-trips editable enum chips', () => {
  const ui = setup();
  ui.click('#first-property'); ui.fill('#property-name', 'age'); ui.type('2');
  assert.equal(document.querySelectorAll('#validators input').length, 5);
  assert.ok(!ui.query('#validators').textContent.includes('regular expression'));
  ui.query('#rule-0').checked = true;
  ui.fill('#rule-1', '20'); ui.fill('#rule-2', '10'); ui.save();
  assert.match(ui.query('#form-error').textContent, /cannot exceed/);
  ui.fill('#rule-2', '100');
  ui.fill('#enum-input', '20'); ui.click('#enum-add');
  ui.fill('#enum-input', '30'); ui.click('#enum-add');
  ui.fill('#enum-input', '30'); ui.click('#enum-add');
  assert.equal(document.querySelectorAll('[data-remove-enum]').length, 2);
  ui.save();
  assert.deepEqual(ui.schema().properties.age.enum, [20, 30]);
  assert.deepEqual(ui.schema().required, ['age']);
  ui.click('[aria-label="Edit age"]');
  assert.equal(ui.query('#rule-1').value, '20');
  ui.click('[data-remove-enum="0"]'); ui.fill('#property-name', 'years'); ui.save();
  assert.deepEqual(ui.schema().properties.years.enum, [30]);
  assert.equal(ui.schema().properties.age, undefined);
  assert.deepEqual(ui.schema().required, ['years']);
});

test('type changes drop incompatible rules, cancel leaves schema untouched, and duplicate names fail', () => {
  const ui = setup();
  ui.click('#first-property'); ui.fill('#property-name', 'title');
  const pattern = Array.from(document.querySelectorAll('#validators label')).find(label => label.textContent.includes('Pattern'));
  ui.fill(`#${pattern.htmlFor}`, '^\\w+$'); ui.save();
  ui.click('[aria-label="Edit title"]'); ui.type('2'); ui.save();
  assert.deepEqual(ui.schema().properties.title, { type: 'number' });
  ui.click('[aria-label="Edit title"]'); ui.fill('#property-name', 'changed'); ui.click('#cancel');
  assert.ok(ui.schema().properties.title);
  ui.click('[aria-label="Add property to root"]'); ui.fill('#property-name', 'title'); ui.save();
  assert.match(ui.query('#form-error').textContent, /already exists/);
});

test('nested arrays use one item definition and omit required on items', () => {
  const ui = setup();
  ui.click('#first-property'); ui.fill('#property-name', 'rows'); ui.type('1'); ui.save();
  ui.click('[aria-label="Add items to rows"]'); ui.type('0');
  assert.ok(!ui.query('#validators').textContent.includes('Required property'));
  ui.save();
  assert.equal(ui.schema().properties.rows.items.type, 'object');
  assert.equal(ui.query('[aria-label="Add items to rows"]'), null);
  ui.click('[aria-label="Add property to items"]'); ui.fill('#property-name', 'active'); ui.type('4');
  ui.query('#rule-0').checked = true; ui.save();
  assert.deepEqual(ui.schema().properties.rows.items.required, ['active']);
  ui.click('[aria-label="Edit rows"]'); ui.type('3'); ui.save();
  assert.match(ui.query('#form-error').textContent, /nested properties/);
  ui.click('#cancel'); ui.click('[aria-label="Delete active"]');
  assert.equal(ui.schema().properties.rows.items.required, undefined);
});

test('theme is changeable and retained when the editor remounts', () => {
  const ui = setup();
  ui.fill('#theme', 'mint'); ui.query('#theme').dispatchEvent(new ui.dom.window.Event('change'));
  assert.equal(document.documentElement.dataset.theme, 'mint');
  mountEditor(document.querySelector('#app'));
  assert.equal(ui.query('#theme').value, 'mint');
});

test('text enum and names are escaped in the UI and preserved in JSON', () => {
  const ui = setup();
  ui.click('#first-property'); ui.fill('#property-name', '<img src=x onerror=alert(1)>');
  ui.fill('#enum-input', 'a"b\\c'); ui.click('#enum-add');
  ui.fill('#enum-input', '<script>alert(1)</script>'); ui.click('#enum-add');
  ui.save();
  assert.equal(document.querySelectorAll('#tree img, #preview script, #enum-chips script').length, 0);
  assert.deepEqual(ui.schema().properties['<img src=x onerror=alert(1)>'].enum, ['a"b\\c', '<script>alert(1)</script>']);
});

test('invalid regex and fractional string lengths are rejected', () => {
  const ui = setup();
  ui.click('#first-property'); ui.fill('#property-name', 'code');
  const labels = Array.from(document.querySelectorAll('#validators label'));
  const pattern = labels.find(label => label.textContent.includes('Pattern'));
  const minLength = labels.find(label => label.textContent.includes('Minimum length'));
  ui.fill(`#${pattern.htmlFor}`, '['); ui.save();
  assert.match(ui.query('#form-error').textContent, /regular expression/);
  ui.fill(`#${pattern.htmlFor}`, '^\\d+$'); ui.fill(`#${minLength.htmlFor}`, '1.5'); ui.save();
  assert.match(ui.query('#form-error').textContent, /whole number/);
  ui.fill(`#${minLength.htmlFor}`, '0'); ui.save();
  assert.equal(ui.schema().properties.code.minLength, 0);
  assert.equal(ui.schema().properties.code.pattern, '^\\d+$');
});
