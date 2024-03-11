import type { RunnerTestContext } from 'podman-desktop-tester';
import { afterEach } from 'vitest';
import { takeScreenshotHook } from 'podman-desktop-tester';

afterEach(async (context: RunnerTestContext) => {
  context.onTestFailed(async () => await takeScreenshotHook(context.pdRunner, context.task.name));
});