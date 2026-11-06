/** Literal imports keep hidden code/data out of initial gameplay. Resource
 * projection belongs beside each presentation, rather than in a global list. */
export const loadContactPanel = () => import('./contact/contact-presentation').then(module => ({
  Component: module.ContactPresentation, assets: module.contactPresentationAssets,
}));
export const loadMerchantPanel=()=>import('./commerce/merchant-panel').then(module=>({Component:module.MerchantPanel,assets:module.merchantPanelAssets}));
export const loadNavigationPanels = () => import('./travel/navigation-panels').then(module => ({
  Component: module.NavigationPanels, assets: module.navigationAssets,
}));
export const loadRepairPanel = () => import('./repair/repair-presentation').then(module => ({
  Component: module.RepairPresentation, assets: module.repairPresentationAssets,
}));
export const loadCommunicationPanel = () => import('./communication/communication-presentation').then(module => ({
  Component: module.CommunicationPresentation, assets: module.communicationPresentationAssets,
}));
export const loadShipyardPanel = () => import('./shipyard/shipyard-preview').then(module => ({
  Component: module.ShipyardPreview, assets: module.shipyardPresentationAssets,
}));
export const loadEquipmentSalePanel = () => import('./equipment/equipment-sale').then(module => ({
  Component: module.EquipmentSale, assets: module.equipmentSaleAssets,
}));
