/** Symbol2:6202:121–306: sample T, F8 then keys1–8 at source13Hz.
 * Source hitkey is20 frames for ordinary branches and100 for F8.
 * This transient latch owns only held keys/delay; callbacks own eligibility and
 * gameplay. Focus/visibility/readiness loss releases held input, as for P/Q. */
import { fleetKeyboardCommands, type FleetCommand } from '../fleet-order-rules';

/** Main row and numpad share command meaning, but remain separate held keys. */
export function fleetShortcut(code: number): FleetCommand | null {
  const index = code >= 97 && code <= 104 ? code - 97 : code - 49;
  return fleetKeyboardCommands[index] ?? null;
}

export function createTransportInput(
  transport: () => boolean,
  fleet?: (command: FleetCommand) => boolean,
  openTextCommand?: () => boolean
) {
  const held = new Set<number>();
  let remainingFrames = 0;
  return Object.freeze({
    activate: transport,
    // The boolean form is the existing T-only consumer contract (C8); numeric
    // codes let the same latch retain separate main-row/numpad held states.
    key: (code: number | boolean, down = true) => {
      const physical = typeof code === 'boolean' ? 84 : code;
      const pressed = typeof code === 'boolean' ? code : down;
      if (pressed) held.add(physical);
      if (!pressed) held.delete(physical);
    },
    release: () => {
      held.clear();
      remainingFrames = 0;
    },
    // Focus transfers release keys without erasing the source hitkey countdown.
    releaseHeld: () => held.clear(),
    advance: () => {
      if (remainingFrames <= 0) {
        if (held.has(84)) {
          remainingFrames = 20;
          transport();
        }
        // Symbol2:6202:131–136, after T and the unported M, before fleet1–8.
        // Absent capability neither opens a panel nor acquires a delay (D12).
        if (remainingFrames <= 0 && held.has(119) && openTextCommand?.()) remainingFrames = 100;
        if (remainingFrames <= 0 && fleet) {
          // Source branch order, independent of browser key event order.
          fleetKeyboardCommands.some((command, index) => {
            if (!held.has(49 + index) && !held.has(97 + index)) return false;
            if (!fleet(command)) return false;
            remainingFrames = 20;
            return true;
          });
        }
      }
      // Countdown follows all branches, including the frame setting20 or100.
      remainingFrames = Math.max(0, remainingFrames - 1);
    },
  });
}
