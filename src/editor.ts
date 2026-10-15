import { ArrayElem, BooleanElem, DateElem, Elem, ElemType, NumberElem, ObjectElem, StringElem } from './models/elem';
import * as v from './models/validators';

type Rule = { label: string; kind: 'number' | 'text' | 'select' | 'boolean' | 'list'; value: (rule: v.Validator) => unknown; create: (value: any) => v.Validator; min?: number; integer?: boolean };
const rules = new Map<Function, Rule>([
  [v.RequiredValidator, { label: 'Required property', kind: 'boolean', value: () => true, create: () => new v.RequiredValidator() }],
  [v.MinValValidator, { label: 'Minimum', kind: 'number', value: r => (r as v.MinValValidator).minVal, create: n => new v.MinValValidator(n) }],
  [v.MaxValValidator, { label: 'Maximum', kind: 'number', value: r => (r as v.MaxValValidator).maxVal, create: n => new v.MaxValValidator(n) }],
  [v.MinLengthValidator, { label: 'Minimum length', kind: 'number', min: 0, integer: true, value: r => (r as v.MinLengthValidator).minLen, create: n => new v.MinLengthValidator(n) }],
  [v.MaxLengthValidator, { label: 'Maximum length', kind: 'number', min: 0, integer: true, value: r => (r as v.MaxLengthValidator).maxLen, create: n => new v.MaxLengthValidator(n) }],
  [v.MinItemsValidator, { label: 'Minimum items', kind: 'number', min: 0, integer: true, value: r => (r as v.MinItemsValidator).minItems, create: n => new v.MinItemsValidator(n) }],
  [v.MaxItemsValidator, { label: 'Maximum items', kind: 'number', min: 0, integer: true, value: r => (r as v.MaxItemsValidator).maxItems, create: n => new v.MaxItemsValidator(n) }],
  [v.MultipleOfValidator, { label: 'Multiple of', kind: 'number', min: 0, value: r => (r as v.MultipleOfValidator).multipleOf, create: n => new v.MultipleOfValidator(n) }],
  [v.UniqueItemsValidator, { label: 'Unique items only', kind: 'boolean', value: () => true, create: () => new v.UniqueItemsValidator() }],
  [v.AdditionalPropertiesValidator, { label: 'Allow additional properties', kind: 'select', value: r => String((r as v.AdditionalPropertiesValidator).additionalProperties), create: n => new v.AdditionalPropertiesValidator(n === 'true') }],
  [v.FormatValidator, { label: 'String format', kind: 'select', value: r => (r as v.FormatValidator).format, create: n => new v.FormatValidator(n) }],
  [v.RegexValidator, { label: 'Pattern (regular expression)', kind: 'text', value: r => (r as v.RegexValidator).pattern, create: n => new v.RegexValidator(n) }],
  [v.NumberEnum, { label: 'Allowed values (enum)', kind: 'list', value: r => (r as v.NumberEnum).enums, create: n => new v.NumberEnum(n) }],
  [v.StringEnum, { label: 'Allowed values (enum)', kind: 'list', value: r => (r as v.StringEnum).enums, create: n => new v.StringEnum(n) }],
]);
const constructors = [ObjectElem, ArrayElem, NumberElem, StringElem, BooleanElem, DateElem];
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
const icons = { plus: '+', edit: 'Edit', remove: '×' };

export function mountEditor(app: HTMLElement): void {
  const root = new ObjectElem('root');
  const ids = new WeakMap<Elem, string>();
  const nodes = new Map<string, { node: Elem; parent?: Elem }>();
  let counter = 0;
  let editing: Elem | undefined;
  let parent: Elem | undefined;
  let enumValues: (string | number)[] = [];
  let available: v.Validator[] = [];
  let lastFocus: HTMLElement | null = null;
  let theme = 'blue';
  try { theme = localStorage.getItem('schema-studio-theme') || theme; } catch {}
  if (!['blue', 'mint', 'rose'].includes(theme)) theme = 'blue';
  document.documentElement.dataset.theme = theme;

  app.innerHTML = `
    <header class="border-b border-line bg-surface"><div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <a href="./" class="flex items-center gap-3 no-underline text-ink"><span class="flex size-10 items-center justify-center rounded-xl bg-tint font-mono text-xl font-semibold text-accent">{ }</span><span class="text-lg font-semibold tracking-tight">ElE.JsonSchema<span class="ml-3 hidden rounded-md bg-soft px-2 py-1 text-[10px] font-medium tracking-widest text-muted sm:inline">BUILDER</span></span></a>
      <label class="flex items-center gap-3 text-sm text-muted">Theme <select id="theme" class="field !w-auto !py-2" aria-label="Color theme"><option value="blue">Cloud blue</option><option value="mint">Fresh mint</option><option value="rose">Soft rose</option></select></label>
    </div></header>
    <main class="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <div class="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p class="mb-3 text-xs font-semibold tracking-[.2em] text-accent">DESIGN YOUR DATA</p><h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">A little structure. Endless possibilities.</h1><p class="mt-3 text-sm leading-6 text-muted">Build your JSON Schema visually, one property at a time.</p></div><button id="download" class="btn btn-primary">? Export schema</button></div>
      <div class="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section class="panel overflow-hidden"><div class="flex items-center justify-between border-b border-line px-5 py-5"><div><h2 class="font-semibold">Schema structure</h2><p class="mt-1 text-xs text-muted">Define properties and their validation rules</p></div><span id="count" class="badge"></span></div><div id="tree" class="p-4 sm:p-5"></div><div class="border-t border-line bg-soft/40 px-5 py-4 text-xs leading-5 text-muted">Objects contain properties. Arrays contain one reusable item definition.</div></section>
        <section class="panel overflow-hidden lg:sticky lg:top-6"><div class="flex items-center justify-between border-b border-line px-5 py-5"><div class="flex items-center gap-2"><span class="size-2 rounded-full bg-emerald-400"></span><h2 class="font-semibold">Live preview</h2></div><button id="copy" class="btn btn-small">Copy JSON</button></div><div class="flex items-center justify-between border-b border-line bg-soft/40 px-5 py-3 text-xs text-muted"><span class="font-mono">schema.json</span><span>JSON Schema · 2020-12</span></div><pre class="max-h-[640px] min-h-72 overflow-auto p-5 text-[13px] leading-7" tabindex="0" aria-label="Generated JSON Schema"><code id="preview"></code></pre><div class="border-t border-line px-5 py-3 text-xs text-muted">Updated as you save your changes</div></section>
      </div><p id="status" role="status" class="mt-5 min-h-6 text-sm text-accent"></p>
    </main>
    <dialog id="property-dialog" aria-labelledby="modal-title"><form id="property-form" novalidate>
      <div class="flex items-start justify-between border-b border-line px-6 py-5"><div><p id="modal-context" class="mb-1 text-xs text-muted"></p><h2 id="modal-title" class="text-xl font-semibold"></h2></div><button type="button" id="close" class="btn btn-small" aria-label="Close dialog">×</button></div>
      <div class="space-y-6 px-6 py-5"><div class="grid gap-4 sm:grid-cols-2"><div id="name-wrap"><label for="property-name" class="label">Property name <span class="text-accent">*</span></label><input id="property-name" class="field" placeholder="e.g. firstName" autocomplete="off" /></div><div><label for="property-type" class="label">Data type</label><select id="property-type" class="field">${constructors.map((_, i) => `<option value="${i}">${ElemType[i]}</option>`).join('')}</select></div></div>
      <div><h3 class="mb-1 text-sm font-semibold">Validation rules</h3><p class="mb-5 text-xs leading-5 text-muted">Optional constraints available for this data type.</p><div id="validators" class="grid gap-4 sm:grid-cols-2"></div></div><p id="form-error" role="alert" class="text-sm text-rose-600"></p></div>
      <div class="flex justify-end gap-3 border-t border-line bg-soft/40 px-6 py-4"><button type="button" id="cancel" class="btn">Cancel</button><button type="submit" id="save" class="btn btn-primary">Save property</button></div>
    </form></dialog>`;

  const $ = <T extends HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const dialog = $<HTMLDialogElement>('#property-dialog');
  const form = $<HTMLFormElement>('#property-form');
  const typeInput = $<HTMLSelectElement>('#property-type');
  const nameInput = $<HTMLInputElement>('#property-name');
  const status = (message: string) => { $('#status').textContent = message; };
  const schema = () => JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...root.ToSchema() }, null, 2);
  function renderNode(node: Elem, owner?: Elem): string {
    let id = ids.get(node);
    if (!id) { id = String(++counter); ids.set(node, id); }
    nodes.set(id, { node, parent: owner });
    const required = node.validators.some(rule => rule instanceof v.RequiredValidator);
    const canAdd = node.elemType === ElemType.object || (node.elemType === ElemType.array && !node.properties.length);
    const details = node.validators.filter(rule => !(rule instanceof v.RequiredValidator)).map(rule => rule.ToString().replace(/^"|"(?=\s*:)/g, '')).join(' · ');
    return `<div class="mb-2"><div class="group rounded-xl border border-line bg-surface p-3"><div class="flex flex-wrap items-center justify-between gap-3"><div class="flex min-w-0 items-center gap-2"><span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tint font-mono text-sm text-accent">${node.elemType === ElemType.object ? '{}' : node.elemType === ElemType.array ? '[]' : node.elemType === ElemType.number ? '#' : node.elemType === ElemType.boolean ? '?' : node.elemType === ElemType.date ? '?' : 'Aa'}</span><span class="max-w-48 truncate font-mono text-sm font-medium" title="${escape(node.elemName)}">${owner?.elemType === ElemType.array ? 'items' : escape(node.elemName)}</span><span class="badge">${ElemType[node.elemType]}</span>${required ? '<span class="text-xs text-accent">required</span>' : ''}</div><div class="flex gap-1">${canAdd ? `<button class="btn btn-small btn-primary" data-action="add" data-id="${id}" aria-label="Add ${node.elemType === ElemType.array ? 'items' : 'property'} to ${escape(node.elemName)}">${icons.plus} ${node.elemType === ElemType.array ? 'Items' : 'Property'}</button>` : ''}<button class="btn btn-small" data-action="edit" data-id="${id}" aria-label="Edit ${escape(node.elemName)}">${icons.edit}</button>${owner ? `<button class="btn btn-small !text-rose-500 !bg-rose-50 !border-rose-100" data-action="delete" data-id="${id}" aria-label="Delete ${escape(node.elemName)}">${icons.remove}</button>` : ''}</div></div>${details ? `<p class="mt-2 truncate pl-10 font-mono text-[11px] text-muted" title="${escape(details)}">${escape(details)}</p>` : ''}</div>${node.properties.length ? `<div class="tree-children mt-2">${node.properties.map(child => renderNode(child, node)).join('')}</div>` : ''}</div>`;
  }
  function render(): void {
    nodes.clear();
    $('#tree').innerHTML = renderNode(root) + (!root.properties.length ? `<div class="py-14 text-center"><div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-dashed border-line font-mono text-xl text-accent">{ + }</div><h3 class="text-sm font-semibold">Your schema starts here</h3><p class="mx-auto mt-2 max-w-64 text-xs leading-6 text-muted">Add your first property, choose its type, and make the rules your own.</p><button id="first-property" class="btn btn-primary mt-5">+ Add first property</button></div>` : '');
    $('#count').textContent = `${nodes.size - 1} properties`;
    $('#preview').innerHTML = escape(schema()).replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null|-?\d+(?:\.\d+)?)\b/g, (match, string, colon) => `<span class="${string ? colon ? 'code-key' : 'code-string' : 'code-number'}">${match}</span>`);
  }
  function close(): void { dialog.close(); lastFocus?.focus(); }
  function renderRules(existing: v.Validator[] = []): void {
    available = (v.ValidatorRegistry.GetValidatorsByElemType().get(Number(typeInput.value)) || []).filter(rule => !(rule instanceof v.RequiredValidator) || parent?.elemType === ElemType.object);
    enumValues = [];
    $('#validators').innerHTML = available.map((prototype, index) => {
      const config = rules.get(prototype.constructor)!;
      const active = existing.find(rule => rule.constructor === prototype.constructor);
      const value = active ? config.value(active) : '';
      const id = `rule-${index}`;
      let control = '';
      if (config.kind === 'boolean') return `<label class="flex items-center gap-3 rounded-xl border border-line p-3 text-sm sm:col-span-2"><input id="${id}" type="checkbox" class="size-4 accent-accent" ${active ? 'checked' : ''} />${config.label}</label>`;
      if (config.kind === 'list') {
        enumValues = active ? [...value as (string | number)[]] : [];
        control = `<div id="enum-chips" class="mb-2 flex flex-wrap gap-2"></div><div class="flex gap-2"><input id="enum-input" class="field min-w-0" type="${prototype instanceof v.NumberEnum ? 'number' : 'text'}" step="any" placeholder="Add allowed value…" aria-label="Allowed value" /><button id="enum-add" type="button" class="btn">Add</button></div><p class="mt-2 text-xs text-muted">Press Enter or Add. Remove a value with ×.</p>`;
      } else if (config.kind === 'select') {
        const options = prototype instanceof v.FormatValidator ? Object.values(v.StringFormats) : ['true', 'false'];
        control = `<select id="${id}" class="field"><option value="">Not specified</option>${options.map(option => `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`).join('')}</select>`;
      } else control = `<input id="${id}" class="field" type="${config.kind === 'number' ? 'number' : 'text'}" value="${escape(value)}" placeholder="${config.kind === 'text' ? 'e.g. ^[A-Za-z]+$' : 'No limit'}" ${config.min !== undefined ? `min="${config.min}"` : ''} step="${config.integer ? '1' : 'any'}" />`;
      return `<div class="${config.kind === 'list' || config.kind === 'text' ? 'sm:col-span-2' : ''}"><label class="label" for="${config.kind === 'list' ? 'enum-input' : id}">${config.label}</label>${control}</div>`;
    }).join('');
    renderChips();
    $('#form-error').textContent = '';
  }
  function renderChips(): void {
    const chips = app.querySelector('#enum-chips');
    if (chips) chips.innerHTML = enumValues.map((value, index) => `<span class="badge !bg-canvas !text-ink"><span class="max-w-64 truncate">${escape(value === '' ? '""' : value)}</span><button type="button" data-remove-enum="${index}" class="px-1 text-muted hover:text-accent" aria-label="Remove ${escape(value)}">×</button></span>`).join('');
  }
  function addEnum(): void {
    const input = $<HTMLInputElement>('#enum-input');
    if (!input.value && input.type === 'number') return;
    const value = input.type === 'number' ? Number(input.value) : input.value;
    if (input.validity.badInput || (typeof value === 'number' && !Number.isFinite(value))) { $('#form-error').textContent = 'Enter a valid finite number.'; return; }
    if (!enumValues.includes(value)) enumValues.push(value);
    input.value = '';
    $('#form-error').textContent = '';
    renderChips();
    input.focus();
  }
  function open(owner?: Elem, node?: Elem): void {
    lastFocus = document.activeElement as HTMLElement;
    editing = node; parent = owner;
    const isRoot = node === root;
    const isItem = owner?.elemType === ElemType.array;
    $('#modal-title').textContent = isRoot ? 'Root settings' : `${node ? 'Edit' : 'Add'} ${isItem ? 'array items' : 'property'}`;
    $('#modal-context').textContent = isRoot ? 'Schema structure' : `Inside ${owner?.elemName || 'root'}`;
    $('#save').textContent = node ? 'Save changes' : 'Add property';
    nameInput.value = node?.elemName || (isItem ? 'items' : '');
    $('#name-wrap').hidden = isRoot || isItem;
    typeInput.value = String(node?.elemType ?? ElemType.string);
    typeInput.disabled = isRoot;
    renderRules(node?.validators);
    dialog.showModal();
    (isRoot || isItem ? typeInput.disabled ? $('#save') : typeInput : nameInput).focus();
  }
  $('#tree').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.id === 'first-property') { open(root); return; }
    const record = nodes.get(button.dataset.id || '');
    if (!record) return;
    if (button.dataset.action === 'add') open(record.node);
    if (button.dataset.action === 'edit') open(record.parent, record.node);
    if (button.dataset.action === 'delete' && record.parent) { record.parent.properties = record.parent.properties.filter(child => child !== record.node); render(); status('Property removed.'); }
  });
  typeInput.addEventListener('change', () => renderRules());
  $('#validators').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button?.id === 'enum-add') addEnum();
    if (button?.dataset.removeEnum !== undefined) { enumValues.splice(Number(button.dataset.removeEnum), 1); renderChips(); }
  });
  $('#validators').addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key === 'Enter' && (event.target as HTMLElement).id === 'enum-input') { event.preventDefault(); addEnum(); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const name = nameInput.value.trim();
      if (!name) throw new Error('Enter a property name.');
      if (parent?.elemType === ElemType.object && parent.properties.some(child => child !== editing && child.elemName === name)) throw new Error('A property with this name already exists.');
      const type = Number(typeInput.value);
      if (editing?.properties.length && editing.elemType !== type) throw new Error('Remove the nested properties before changing this data type.');
      const next = new constructors[type](name);
      available.forEach((prototype, index) => {
        const config = rules.get(prototype.constructor)!;
        const input = app.querySelector<HTMLInputElement | HTMLSelectElement>(`#rule-${index}`);
        if (config.kind === 'list') { if (enumValues.length) next.AddValidator(config.create([...enumValues])); return; }
        if (config.kind === 'boolean') { if ((input as HTMLInputElement).checked) next.AddValidator(config.create(true)); return; }
        if (!input || input.value === '') {
          if (input && 'validity' in input && input.validity.badInput) throw new Error(`${config.label} must be a valid number.`);
          return;
        }
        let value: string | number = input.value;
        if (config.kind === 'number') {
          value = Number(value);
          if (!Number.isFinite(value) || (config.integer && !Number.isInteger(value)) || (config.min !== undefined && value < config.min) || (prototype instanceof v.MultipleOfValidator && value <= 0)) throw new Error(`Enter a valid ${config.label.toLowerCase()}${config.integer ? ' (whole number, zero or greater)' : ''}.`);
        }
        if (prototype instanceof v.RegexValidator) { try { new RegExp(String(value)); } catch { throw new Error('Enter a valid regular expression.'); } }
        next.AddValidator(config.create(value));
      });
      const output = next.ToSchema();
      for (const [min, max] of [['minimum', 'maximum'], ['minLength', 'maxLength'], ['minItems', 'maxItems']]) {
        if (typeof output[min] === 'number' && typeof output[max] === 'number' && output[min] > output[max]) throw new Error(`${min} cannot exceed ${max}.`);
      }
      next.properties = editing?.properties || [];
      if (editing === root) { root.validators = next.validators; }
      else if (editing && parent) parent.properties[parent.properties.indexOf(editing)] = next;
      else parent?.AddProperties(next);
      close(); render(); status('Schema updated.');
    } catch (error) { $('#form-error').textContent = error instanceof Error ? error.message : 'Unable to save property.'; }
  });
  $('#close').addEventListener('click', close);
  $('#cancel').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } });
  const themeInput = $<HTMLSelectElement>('#theme');
  themeInput.value = theme;
  themeInput.addEventListener('change', () => { document.documentElement.dataset.theme = themeInput.value; try { localStorage.setItem('schema-studio-theme', themeInput.value); } catch {} });
  $('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(schema()); status('JSON copied to clipboard.'); } catch { status('Clipboard unavailable. Use Export schema to save your JSON.'); } });
  $('#download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([schema()], { type: 'application/schema+json' })); const link = document.createElement('a'); link.href = url; link.download = 'schema.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Schema exported.'); });
  render();
}
