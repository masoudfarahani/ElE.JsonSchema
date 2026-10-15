# ElE.JsonSchema

A TypeScript JSON Schema editor with locally compiled Tailwind CSS.

## Development

```sh
npm install
npm run dev
```

## Verification and build

```sh
npm test
npm run build
```

Production files are generated in `dist/`. TypeScript is bundled by Vite; generated JavaScript is not kept alongside the source files.

## Editor

- Add and edit properties through the same modal.
- Available validation controls come from `ValidatorRegistry.GetValidatorsByElemType()`.
- Objects support nested properties; arrays support a single reusable item schema.
- Numeric and string enums use removable chips. Enter or Add commits a value.
- Choose Cloud blue, Fresh mint, or Soft rose. Theme preference is stored locally.
- Preview, copy, or export a JSON Schema 2020-12 document.
- Schema changes are held in memory. Export before refreshing or closing the page.

## Extending

Models and serialization live in `src/models/`. The editor maps registered validator classes to form controls in `src/editor.ts`. Add a control definition there when introducing a new validator class. Theme tokens and Tailwind component styles live in `src/styles.css`.

The test suite uses Node's test runner with jsdom to exercise form behavior and schema serialization; it does not replace a visual browser check.
