/** Symbol-12-155.as:14–18. Both C6 and C8 use this single four-draw
 * owner; C8 replays captured C6 seeds rather than consuming them twice. */
export function drawStationContract(draw: (extent: number) => number) {
  const tons = draw(100) + 20;
  const goodsIndex = draw(42);
  const destinationSystemId = draw(50) + 1;
  const basePayPerTon = (draw(200) + 20) * 0.2;
  return { tons, goodsIndex, destinationSystemId, basePayPerTon };
}
