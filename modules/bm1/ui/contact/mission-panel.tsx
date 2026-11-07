/** Original type17 held panel. The parent owns attachment; this component owns
 * only display feedback. Cargo, offers and negotiation are authoritative props. */
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { GameModuleDefinition } from '@engine/content/schemas/game-module';
import type { ContractOfferRef } from '@engine/simulation/model/mission-state';
import { HudFieldSchema } from '../hud/hud-content';
import { HudGlyphField } from '../hud/hud-glyphs';
import raw from '../mission-panel-data.json';
import { SourceControl } from '../source-control';
import { contactAsset } from './contact-content';
import {
  acceptanceText,
  contractTexts,
  negotiationLoss,
  negotiationSuccess,
  type DisplayedContract,
} from './mission-text';

const finite = z.number().finite();
export const missionPanelContent = z
  .object({
    panel: z.literal('contact-mission.svg'),
    icon: z.literal('contact-selector-104.svg'),
    field: HudFieldSchema,
    hitBounds: z.object({ left: finite, top: finite, right: finite, bottom: finite }).strict().readonly(),
    controls: z
      .array(
        z
          .object({
            offset: z.number().int(),
            layer: z.number().int(),
            left: finite,
            top: finite,
            right: finite,
            bottom: finite,
          })
          .strict()
          .readonly()
      )
      .readonly(),
  })
  .strict()
  .readonly()
  .parse(raw);
export const missionPanelAssets = () => [
  contactAsset(missionPanelContent.panel),
  contactAsset(missionPanelContent.icon),
];
export function MissionPanel({
  contract,
  definition,
  scale,
  onClose,
  onAccept,
  onNegotiate,
}: {
  readonly contract: DisplayedContract | null;
  readonly definition: GameModuleDefinition;
  readonly scale: number;
  readonly onClose: () => void;
  readonly onAccept: (ref: ContractOfferRef) => boolean;
  readonly onNegotiate: (ref: ContractOfferRef) => boolean;
}) {
  const [feedback, setFeedback] = useState('');
  const negotiating = useRef(false);
  const panel = useRef<SVGSVGElement>(null);
  useEffect(() => {
    panel.current?.querySelector<SVGGElement>('[role="button"]')?.focus();
  }, []);
  useEffect(() => {
    if (!negotiating.current) return;
    negotiating.current = false;
    setFeedback(contract ? '' : negotiationLoss);
  }, [contract]);
  const texts = contractTexts(contract, definition, 1, false);
  const message =
    feedback ||
    (contract
      ? `${contract.offer.negotiated ? negotiationSuccess + '\n\n' : ''}${texts.name}\n\n${texts.description}`
      : texts.description);
  return (
    <svg
      ref={panel}
      className="bm1-hud-stage bm1-contact-stage"
      viewBox="0 0 600 450"
      width={600}
      height={450}
      aria-label="Cargo mission"
      data-contact-kind="station"
    >
      <g transform={`translate(303 110) scale(${scale / 100}) translate(-303 -110)`}>
        {missionPanelContent.controls
          .filter(c => c.layer === 1)
          .map(c => (
            <rect
              key={c.offset}
              x={c.left}
              y={c.top}
              width={c.right - c.left}
              height={c.bottom - c.top}
              fill="transparent"
              className="bm1-contact-blocker"
            />
          ))}
        <image href={contactAsset(missionPanelContent.panel)} width={600} height={450} />
        <HudGlyphField field={missionPanelContent.field} text={message} />
        {missionPanelContent.controls
          .filter(c => c.layer !== 1)
          .map(c => {
            const close = c.offset === 78853,
              negotiate = c.offset === 10126;
            return (
              <SourceControl
                key={c.offset}
                control={{
                  scriptOffset: c.offset + 88,
                  name: '',
                  depth: c.layer,
                  artwork: null,
                  paths: [`M${c.left},${c.top} H${c.right} V${c.bottom} H${c.left} Z`],
                }}
                label={close ? 'Close cargo mission' : negotiate ? 'Negotiate' : 'Accept'}
                disabled={!close && (!contract || (negotiate && contract.offer.negotiated))}
                onActivate={() => {
                  if (close) {
                    onClose();
                    return;
                  }
                  if (!contract) return;
                  if (negotiate) {
                    negotiating.current = onNegotiate(contract.ref);
                    return;
                  }
                  const text = acceptanceText(contract);
                  if (!contract.acceptance || 'refusal' in contract.acceptance) {
                    setFeedback(text);
                    return;
                  }
                  if (onAccept(contract.ref)) setFeedback(text);
                }}
              />
            );
          })}
      </g>
    </svg>
  );
}
