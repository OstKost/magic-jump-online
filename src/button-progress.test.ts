import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setButtonProgress } from './button-progress.ts';

interface MockClassList {
  classes: Set<string>;
  add: (...tokens: string[]) => void;
  remove: (...tokens: string[]) => void;
  contains: (token: string) => boolean;
}

interface MockElement {
  disabled?: boolean;
  textContent: string;
  attributes: Record<string, string>;
  style: {
    properties: Record<string, string>;
    setProperty: (prop: string, val: string) => void;
    removeProperty: (prop: string) => void;
  };
  classList: MockClassList;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | undefined;
  removeAttribute: (name: string) => void;
}

function createMockElement(isButton = true): MockElement {
  const classes = new Set<string>();
  const attributes: Record<string, string> = {};
  const properties: Record<string, string> = {};

  const el: MockElement = {
    disabled: false,
    textContent: '',
    attributes,
    classList: {
      classes,
      add(...tokens: string[]) {
        for (const t of tokens) classes.add(t);
      },
      remove(...tokens: string[]) {
        for (const t of tokens) classes.delete(t);
      },
      contains(token: string) {
        return classes.has(token);
      },
    },
    style: {
      properties,
      setProperty(prop: string, val: string) {
        properties[prop] = val;
      },
      removeProperty(prop: string) {
        delete properties[prop];
      },
    },
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
    getAttribute(name: string) {
      return attributes[name];
    },
    removeAttribute(name: string) {
      delete attributes[name];
    },
  };

  if (!isButton) {
    delete el.disabled;
  }

  return el;
}

test('determinate progress updates classes, styles, ARIA attributes and text', () => {
  const el = createMockElement(true);
  setButtonProgress(el as unknown as HTMLElement, {
    loading: true,
    determinate: true,
    progress: 0.42,
    loadingText: 'Загрузка персонажей… 42%',
  });

  assert.equal(el.disabled, true);
  assert.equal(el.classList.contains('btn-progress'), true);
  assert.equal(el.classList.contains('btn-progress-determinate'), true);
  assert.equal(el.classList.contains('btn-progress-indeterminate'), false);
  assert.equal(el.style.properties['--btn-progress'], '42%');
  assert.equal(el.getAttribute('role'), 'progressbar');
  assert.equal(el.getAttribute('aria-valuenow'), '42');
  assert.equal(el.getAttribute('aria-valuemin'), '0');
  assert.equal(el.getAttribute('aria-valuemax'), '100');
  assert.equal(el.getAttribute('aria-busy'), 'true');
  assert.equal(el.textContent, 'Загрузка персонажей… 42%');
});

test('determinate progress clamps out of bound values', () => {
  const el = createMockElement(true);
  setButtonProgress(el as unknown as HTMLElement, {
    loading: true,
    determinate: true,
    progress: -0.2,
  });
  assert.equal(el.style.properties['--btn-progress'], '0%');
  assert.equal(el.getAttribute('aria-valuenow'), '0');

  setButtonProgress(el as unknown as HTMLElement, {
    loading: true,
    determinate: true,
    progress: 1.5,
  });
  assert.equal(el.style.properties['--btn-progress'], '100%');
  assert.equal(el.getAttribute('aria-valuenow'), '100');
});

test('indeterminate progress updates classes and aria attributes without numeric progress', () => {
  const el = createMockElement(true);
  setButtonProgress(el as unknown as HTMLElement, {
    loading: true,
    determinate: false,
    loadingText: 'Подключение…',
  });

  assert.equal(el.disabled, true);
  assert.equal(el.classList.contains('btn-progress'), true);
  assert.equal(el.classList.contains('btn-progress-indeterminate'), true);
  assert.equal(el.classList.contains('btn-progress-determinate'), false);
  assert.equal(el.style.properties['--btn-progress'], undefined);
  assert.equal(el.getAttribute('aria-busy'), 'true');
  assert.equal(el.getAttribute('role'), undefined);
  assert.equal(el.textContent, 'Подключение…');
});

test('finishing loading clears classes, styles, ARIA attributes and enables button', () => {
  const el = createMockElement(true);
  setButtonProgress(el as unknown as HTMLElement, {
    loading: true,
    determinate: true,
    progress: 0.9,
    loadingText: 'Загрузка…',
  });

  setButtonProgress(el as unknown as HTMLElement, {
    loading: false,
    readyText: 'Выбрать для игрока 1 →',
  });

  assert.equal(el.disabled, false);
  assert.equal(el.classList.contains('btn-progress'), false);
  assert.equal(el.classList.contains('btn-progress-determinate'), false);
  assert.equal(el.classList.contains('btn-progress-indeterminate'), false);
  assert.equal(el.style.properties['--btn-progress'], undefined);
  assert.equal(el.getAttribute('role'), undefined);
  assert.equal(el.getAttribute('aria-valuenow'), undefined);
  assert.equal(el.getAttribute('aria-busy'), undefined);
  assert.equal(el.getAttribute('data-loading'), undefined);
  assert.equal(el.textContent, 'Выбрать для игрока 1 →');
});

test('handles non-button HTMLElement without throwing', () => {
  const el = createMockElement(false);
  setButtonProgress(el as unknown as HTMLElement, {
    loading: true,
    determinate: false,
    loadingText: 'Загрузка…',
  });

  assert.equal(el.classList.contains('btn-progress'), true);
  assert.equal(el.textContent, 'Загрузка…');
});
