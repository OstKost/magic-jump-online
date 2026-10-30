import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExitConfirmationController, type ExitConfirmationCallbacks } from './confirm-exit.ts';

function createMockController() {
  const log: string[] = [];
  const callbacks: ExitConfirmationCallbacks = {
    onPauseGame: () => { log.push('pause'); },
    onResumeGame: () => { log.push('resume'); },
    onExitConfirmed: () => { log.push('exit'); },
    onVisibilityChange: (visible) => { log.push(`visible:${visible}`); },
  };
  const controller = new ExitConfirmationController(callbacks);
  return { controller, log };
}

test('requesting exit during active gameplay pauses game and opens modal', () => {
  const { controller, log } = createMockController();
  assert.equal(controller.isOpen, false);

  controller.requestExit(true, false);

  assert.equal(controller.isOpen, true);
  assert.equal(controller.wasPausedBeforeOpen, false);
  assert.deepEqual(log, ['pause', 'visible:true']);
});

test('cancelling exit during active gameplay resumes game and hides modal', () => {
  const { controller, log } = createMockController();
  controller.requestExit(true, false);
  log.length = 0;

  controller.cancel();

  assert.equal(controller.isOpen, false);
  assert.deepEqual(log, ['visible:false', 'resume']);
});

test('cancelling exit when already paused leaves game paused', () => {
  const { controller, log } = createMockController();
  controller.requestExit(true, true);
  assert.equal(controller.wasPausedBeforeOpen, true);
  log.length = 0;

  controller.cancel();

  assert.equal(controller.isOpen, false);
  assert.deepEqual(log, ['visible:false']); // no resume called
});

test('confirming exit calls onExitConfirmed and hides modal', () => {
  const { controller, log } = createMockController();
  controller.requestExit(true, false);
  log.length = 0;

  controller.confirm();

  assert.equal(controller.isOpen, false);
  assert.deepEqual(log, ['visible:false', 'exit']);
});

test('requesting exit when already open toggles it closed and resumes', () => {
  const { controller, log } = createMockController();
  controller.requestExit(true, false);
  log.length = 0;

  controller.requestExit(true, false);

  assert.equal(controller.isOpen, false);
  assert.deepEqual(log, ['visible:false', 'resume']);
});

test('reset hides modal without resuming paused game', () => {
  const { controller, log } = createMockController();
  controller.requestExit(true, false);
  log.length = 0;

  controller.reset();

  assert.equal(controller.isOpen, false);
  assert.deepEqual(log, ['visible:false']);
});

test('requesting exit when not playing opens modal without calling pauseGame', () => {
  const { controller, log } = createMockController();
  controller.requestExit(false, false);

  assert.equal(controller.isOpen, true);
  assert.deepEqual(log, ['visible:true']);
});
