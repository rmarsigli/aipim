# Skills: Context Modules

AIPIM Context Modules are a powerful way to inject static guidelines, best practices, and templates directly into an AI model's context.

Unlike a full `aipim install` wrapper, **Skills** can be injected dynamically, piecemeal, and without losing your existing customizations in files like `CLAUDE.md` or `.ai/guidelines/`.

## Built-In Skills

AIPIM natively ships with several strict baseline guidelines:
- `pest`: Best practices for PHP Pest testing.
- `tailwind`: Rules for modern Tailwind CSS v4 usage (no `@apply`, using strict variables).
- `typescript`: Architectural constraints for TypeScript (no `any`, usage of ESM, etc).

To see all available skills:
```bash
aipim list skills
```

## How It Works

To inject a skill into your current project, run:
```bash
aipim add skill <name>
```

### 1. In standard projects (CLAUDE.md / GEMINI.md)
AIPIM parses your existing markdown prompt. It isolates the `{{/SLOT:guidelines}}` marker and seamlessly integrates the chosen skill's text block.
Crucially, AIPIM automatically recalculates its security Signature Hash at the very bottom of the document, guaranteeing integrity.

### 2. In Laravel Boost mode (`.ai/guidelines/`)
If AIPIM detects the official Laravel Boost `.ai/guidelines/` directory structure, it avoids polluting the global file. 
Instead, it scopes the module perfectly by writing it into a dedicated `.blade.php` file (e.g., `skill-tailwind.blade.php`).

## Idempotency
Run the command as many times as you like. `aipim` executes duplicate-detection strings to refuse injecting the identical module twice in the same project, ensuring your context prompt budget stays low.
