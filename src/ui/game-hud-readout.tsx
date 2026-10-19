/** Generic display controls consume only immutable content and a focused view. */
import type { PropsWithChildren } from 'react';
import type { GameModuleDefinition } from '../content/schemas/game-module';
import type { GameHudView } from './game-hud-view';

function HudValue({ label, children }: PropsWithChildren<{ readonly label: string }>) {
  return <div><span>{label}</span><strong>{children}</strong></div>;
}

/** Pure view; command validation remains in the named host action. */
export function GameHudReadout({ definition, view, onReturnToMenu }: {
  readonly definition: GameModuleDefinition;
  readonly view: GameHudView;
  readonly onReturnToMenu: () => void;
}) {
  const primaryWeapon = view.weaponDefinitionId === null ? null
    : definition.content.weaponDefinitions.find(weapon => weapon.id === view.weaponDefinitionId);

  return (
    <aside className="game-hud">
      <HudValue label="Hull">{view.hull}</HudValue>
      <HudValue label="Shields">{view.shields}</HudValue>
      <HudValue label="Energy">{view.energy.toFixed(1)}</HudValue>
      {view.weaponDefinitionId !== null && <>
        <HudValue label="Primary">{primaryWeapon?.name ?? 'Unknown weapon'}</HudValue>
        <HudValue label="Cooldown">{view.cooldownRemainingFrames}</HudValue>
        <HudValue label="Shots fired">{view.shotSequence}</HudValue>
      </>}
      {definition.resources.map(resource => (
        <HudValue key={resource.id} label={resource.label}>{view.resources[resource.id]}</HudValue>
      ))}
      <HudValue label="Speed/frame">{Math.abs(view.speedPerFrame)}</HudValue>
      <HudValue label="Flight">{view.flightMode === 'warp' ? 'Warp' : 'Impulse'}</HudValue>
      <HudValue label="Repair">{view.repairing ? 'Active' : 'Idle'}</HudValue>
      <HudValue label="Position">{view.positionX.toFixed(0)}, {view.positionY.toFixed(0)}</HudValue>
      {definition.viewport.zoom && <HudValue label="Zoom">{view.zoom}× out</HudValue>}
      {view.noticeMessage && <p className="game-hud-notice" role="alert">{view.noticeMessage}</p>}
      <button type="button" onClick={onReturnToMenu}>Return to menu</button>
    </aside>
  );
}

