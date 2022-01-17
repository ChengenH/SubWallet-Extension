// Copyright 2019-2022 @polkadot/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';

import networks from '@polkadot/extension-koni-base/api/endpoints';
import { PriceJson } from '@polkadot/extension-koni-base/stores/types';

const alternativeNameMap: Record<string, string> = {
  acala: 'acala-token',
  bifrost: 'bifrost-native-coin',
  calamari: 'calamari-network',
  kilt: 'kilt-protocol',
  parallel: 'par-stablecoin'
};

interface GeckoItem {
  id: string,
  name: string,
  current_price: number
}

export const getTokenPrice = async (chains: Array<string> = Object.keys(networks), currency = 'usd'): Promise<PriceJson> => {
  try {
    const inverseMap: Record<string, string> = {};
    const finalChains = chains.map((chain) => {
      const alterKey = alternativeNameMap[chain];

      if (alterKey) {
        inverseMap[alterKey] = chain;

        return alterKey;
      } else {
        return chain;
      }
    });
    const chainsStr = finalChains.join(',');
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${chainsStr}`);

    if (res.status !== 200) {
      console.warn('Failed to get token price');
    }

    const responseData = res.data as Array<GeckoItem>;
    const priceMap: Record<string, number> = {};

    responseData.forEach((val) => {
      if (inverseMap[val.id]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        priceMap[inverseMap[val.id]] = val.current_price;
      } else {
        priceMap[val.id] = val.current_price;
      }
    });

    return {
      currency: currency,
      priceMap: priceMap
    } as PriceJson;
  } catch (err) {
    console.error('Failed to get token price', err);
    throw err;
  }
};
