/** Source Symbol3:93518/85811 and Page1:25841 loadplayer(). Planet self
 * trade-ins only; fleet ownership and station commerce retain their own scope. */
import type { VesselPurchaseApproval, VesselPurchaseContext } from '@engine/simulation/contracts/vessel-purchase';
import { energyCapacity } from './energy-capacity';
import { worldToSourceStage } from './source-geometry';

export function evaluateVesselPurchase(context: VesselPurchaseContext): VesselPurchaseApproval | null {
  const { currentVessel, nextVessel, system, standing } = context;
  if (nextVessel.id > 69 || standing === null || standing < nextVessel.sizeClass * 15) return null;
  // Source preview21 removes itself outside these displayed planet bounds.
  const planet = worldToSourceStage(context.planetPosition, context.playerPosition, context.cameraZoom);
  if (planet.x < -50 || planet.x > 700 || planet.y < -50 || planet.y > 450) return null;
  const empire = system.governmentId === 16;
  const resourceId = empire ? 'deuranium' : 'latinum';
  // The ordinary adjustment occurs on both sides and cancels. Downgrades do
  // not refund. The empire source guard uses OLD price/4, independently of debit.
  const cost = Math.max(0, (nextVessel.basePrice - currentVessel.basePrice) / (empire ? 4 : 1));
  const delta = {
    x: context.planetPosition.x - context.playerPosition.x,
    y: context.planetPosition.y - context.playerPosition.y,
  };
  return Object.freeze({
    resetCloak: true,
    resourceId,
    cost,
    minimumBalance: empire ? currentVessel.basePrice / 4 : cost,
    energy: energyCapacity(nextVessel.cargoCapacity),
    // loadplayer does not clear root speed. Recompute mode from the new hull;
    // retaining motion is observable when trading while coasting past a planet.
    motion: Object.freeze({
      ...context.motion,
      flightMode:
        nextVessel.maximumSpeedPerFrame > 25 && context.motion.speedPerFrame < -25 / context.cameraZoom
          ? 'warp'
          : 'impulse',
    }),
    rotationDegrees: (Math.round((Math.atan2(delta.y, delta.x) * 180) / Math.PI) + 450) % 360,
    refill: Object.freeze({ resourceId: 'antimatter', units: 10 }),
    notice: Object.freeze({ code: 'vessel-purchased', message: 'You have just made a purchase...' }),
  });
}
