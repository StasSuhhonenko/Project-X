/** Generic entry fallback for modules that have not authored a presentation. */
import type { EntryPresentationProps } from './entry-presentation';
import { MainMenu } from './main-menu';

/** Preserve the generic menu and browser tools through the same entry contract. */
export function EntryPresentation({ definition, onStart, saveTools }: EntryPresentationProps) {
  return (
    <>
      <MainMenu definition={definition} onStart={onStart} />
      {saveTools}
    </>
  );
}
