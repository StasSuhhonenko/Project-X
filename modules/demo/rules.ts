/**
 * Simple navigation authored for the demonstration module. Opposing inputs
 * cancel, speed is capped at the vessel limit, and turning has no speed tiers.
 * This module does not import compatibility rules or recovered evidence.
 */
import type { GameRules } from '../../src/simulation/contracts/game-rules';
import { freezePlayerState } from '../../src/simulation/model/player-state';

export const rules: GameRules = Object.freeze<GameRules>({
  apiVersion: 1,
  moduleId: 'demo',
  updatePlayerMovement: (player, vessel, controls) => {
    const throttle = Number(controls.accelerate) - Number(controls.decelerate);
    const steering = Number(controls.turnRight) - Number(controls.turnLeft);
    const canAccelerate = throttle <= 0 || player.energy > 0;
    const speed = player.repairing || !canAccelerate ? player.speedPerFrame
      : Math.max(-vessel.maximumSpeedPerFrame, Math.min(0, player.speedPerFrame - throttle * 0.5));
    const rotation = player.repairing ? player.rotationDegrees
      : ((player.rotationDegrees + steering * vessel.turnDegreesPerFrame) % 360 + 360) % 360;
    const heading = rotation * Math.PI / 180;
    return freezePlayerState({
      ...player,
      speedPerFrame: speed,
      rotationDegrees: rotation,
      position: { x: player.position.x - Math.sin(heading) * speed, y: player.position.y + Math.cos(heading) * speed },
    });
  },
});
