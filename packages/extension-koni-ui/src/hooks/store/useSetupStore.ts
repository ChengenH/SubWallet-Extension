import useSetupPrice from "@polkadot/extension-koni-ui/hooks/store/useSetupPrice";
import useSetupBalance from "@polkadot/extension-koni-ui/hooks/store/useSetupBalance";
import useSetupNetworkMetadata from "@polkadot/extension-koni-ui/hooks/store/useSetupNetworkMetadata";
import useSetupChainRegistry from "@polkadot/extension-koni-ui/hooks/store/useSetupChainRegistry";
import useSetupCrowdloan from "@polkadot/extension-koni-ui/hooks/store/useSetupCrowdloan";

export default function useSetupStore (): void {
  useSetupNetworkMetadata();
  useSetupChainRegistry();
  useSetupPrice();
  useSetupBalance();
  useSetupCrowdloan();
}