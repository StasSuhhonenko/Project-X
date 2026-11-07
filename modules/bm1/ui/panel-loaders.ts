/** Literal imports keep hidden code/data out of initial gameplay. Resource
 * projection belongs beside each presentation, rather than in a global list.
 *
 * Each loader is a page-lifetime handle: `load()` deduplicates the import and
 * `current()` returns the module synchronously once it has resolved, so a panel
 * prepared ahead of time mounts in the same render as its first activation.
 * A failed import is forgotten, so the next `load()` is a fresh attempt. */
import type { PanelModule } from './deferred-panel';

export interface PanelLoader<T> {
  readonly load: () => Promise<T>;
  readonly current: () => T | null;
}

export function createPanelLoader<T>(importer: () => Promise<T>): PanelLoader<T> {
  let pending: Promise<T> | null = null;
  let loaded: T | null = null;
  return Object.freeze({
    load: () => {
      if (pending) return pending;
      pending = importer().then(
        module => {
          loaded = module;
          return module;
        },
        error => {
          pending = null;
          throw error;
        }
      );
      return pending;
    },
    current: () => loaded,
  });
}

const panel = <P>(importer: () => Promise<PanelModule<P>>) => createPanelLoader(importer);

export const contactPanel = panel(() =>
  import('./contact/contact-presentation').then(module => ({
    Component: module.ContactPresentation,
    assets: module.contactPresentationAssets,
  }))
);
export const merchantPanel = panel(() =>
  import('./commerce/merchant-panel').then(module => ({
    Component: module.MerchantPanel,
    assets: module.merchantPanelAssets,
  }))
);
export const navigationPanels = panel(() =>
  import('./travel/navigation-panels').then(module => ({
    Component: module.NavigationPanels,
    assets: module.navigationAssets,
  }))
);
export const repairPanel = panel(() =>
  import('./repair/repair-presentation').then(module => ({
    Component: module.RepairPresentation,
    assets: module.repairPresentationAssets,
  }))
);
export const communicationPanel = panel(() =>
  import('./communication/communication-presentation').then(module => ({
    Component: module.CommunicationPresentation,
    assets: module.communicationPresentationAssets,
  }))
);
export const shipyardPanel = panel(() =>
  import('./shipyard/shipyard-preview').then(module => ({
    Component: module.ShipyardPreview,
    assets: module.shipyardPresentationAssets,
  }))
);
export const equipmentSalePanel = panel(() =>
  import('./equipment/equipment-sale').then(module => ({
    Component: module.EquipmentSale,
    assets: module.equipmentSaleAssets,
  }))
);

/** Every panel a system can expose without further preparation. */
export const localPanels: readonly PanelLoader<unknown>[] = [
  contactPanel,
  merchantPanel,
  navigationPanels,
  repairPanel,
  communicationPanel,
  shipyardPanel,
  equipmentSalePanel,
];

/** The local asset projection, kept lazy beside the panels it reuses. */
export const localPreparation = createPanelLoader(() => import('./local-preparation'));
