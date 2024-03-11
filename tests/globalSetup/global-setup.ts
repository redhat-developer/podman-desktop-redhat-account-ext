import { removeFolderIfExists } from 'podman-desktop-tester';

let setupCalled = false;
let teardownCalled = false;

export async function setup() {
  if (!setupCalled) {
    // remove all previous testing output files
    // Junit reporter output file is created before we can clean up output folders
    // It is not possible to remove junit output file because it is opened by the process already, at least on windows
    if (!process.env.CI) {
      await removeFolderIfExists('tests/output');
    } else {
      console.log(
        `On CI, skipping before All tests/output cleanup, see https://github.com/containers/podman-desktop/issues/5460`,
      );
    }
    setupCalled = true;
  }
}

export async function teardown() {
  if (!teardownCalled) {
    // here comes teardown logic
    teardownCalled = true;
  }
}