/** Symbol2:6202:121–125: sample T at13Hz with hitkey20. This transient
 * keyboard latch owns no gameplay facts; button and key call the same intent.
 * Focus/visibility/readiness loss releases held input, as for HUD P/Q. */
export function createTransportInput(transport: () => boolean) {
  let held = false;
  let remainingFrames = 0;
  return Object.freeze({
    activate: transport,
    key: (down: boolean) => {
      held = down;
    },
    release: () => {
      held = false;
      remainingFrames = 0;
    },
    advance: () => {
      remainingFrames = Math.max(0, remainingFrames - 1);
      if (!held || remainingFrames > 0) return;
      remainingFrames = 20;
      transport();
    },
  });
}
