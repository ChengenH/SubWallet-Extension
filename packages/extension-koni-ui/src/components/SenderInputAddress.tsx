// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';

import { ChainRegistry } from '@polkadot/extension-base/background/KoniTypes';
import NETWORKS from '@polkadot/extension-koni-base/api/endpoints';
import { useTranslation } from '@polkadot/extension-koni-ui/components/translate';
import { SenderInputAddressType, TokenItemType } from '@polkadot/extension-koni-ui/components/types';
import { ThemeProps } from '@polkadot/extension-koni-ui/types';
import { toShort } from '@polkadot/extension-koni-ui/util';
import reformatAddress from '@polkadot/extension-koni-ui/util/reformatAddress';

import InputAddress from './InputAddress';
import TokenDropdown from './TokenDropdown';

interface Props {
  className: string;
  onChange: (value: SenderInputAddressType) => void;
  initValue: SenderInputAddressType,
  chainRegistryMap: Record<string, ChainRegistry>
}

function getOptions (chainRegistryMap: Record<string, ChainRegistry>): TokenItemType[] {
  const options: TokenItemType[] = [];

  Object.keys(chainRegistryMap).forEach((networkKey) => {
    Object.keys(chainRegistryMap[networkKey].tokenMap).forEach((token) => {
      const tokenInfo = chainRegistryMap[networkKey].tokenMap[token];

      options.push({
        networkKey: networkKey,
        token: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        isMainToken: tokenInfo.isMainToken,
        specialOption: tokenInfo?.specialOption
      });
    });
  });

  return options;
}

function SenderInputAddress ({ chainRegistryMap, className = '', initValue, onChange }: Props): React.ReactElement {
  const { t } = useTranslation();
  const [{ address, networkKey, token }, setValue] = useState<SenderInputAddressType>(initValue);

  const networkPrefix = NETWORKS[networkKey].ss58Format;

  const formattedAddress = useMemo<string>(() => {
    return reformatAddress(address, networkPrefix);
  }, [address, networkPrefix]);

  const options: TokenItemType[] = getOptions(chainRegistryMap);

  const onChangeInputAddress = useCallback((address: string | null) => {
    if (address) {
      setValue((prev) => {
        const newVal = {
          ...prev,
          address
        };

        onChange(newVal);

        return newVal;
      });
    } else {
      // handle null case
    }
  }, [onChange]);

  const onChangeTokenValue = useCallback((tokenValueStr: string) => {
    const tokenVal = tokenValueStr.split('|');

    setValue((prev) => {
      const newVal = {
        ...prev,
        token: tokenVal[0],
        networkKey: tokenVal[1]
      };

      onChange(newVal);

      return newVal;
    });
  }, [onChange]);

  return (
    <div className={className}>
      <InputAddress
        className={'sender-input-address'}
        defaultValue={initValue.address}
        help={t<string>('The account you will send funds from.')}
        isSetDefaultValue={true}
        label={t<string>('Send from account')}
        onChange={onChangeInputAddress}
        type='account'
        withEllipsis
      />

      <div className='sender-input-address__balance'>

      </div>

      <div className='sender-input-address__address'>
        {toShort(formattedAddress, 4, 4)}
      </div>

      <TokenDropdown
        className='sender-input-address__token-dropdown'
        onChangeTokenValue={onChangeTokenValue}
        options={options}
        value={`${token}|${networkKey}`}
      />
    </div>
  );
}

export default styled(SenderInputAddress)(({ theme }: ThemeProps) => `
  border: 2px solid ${theme.boxBorderColor};
  height: 72px;
  border-radius: 8px;
  position: relative;
  margin-bottom: 10px;

  .sender-input-address__address {
    position: absolute;
    font-size: 15px;
    line-height: 26px;
    color: ${theme.textColor2};
    right: 80px;
    top: 32px;
    pointer-events: none;
  }

  .sender-input-address__balance {
    position: absolute;
    font-size: 15px;
    line-height: 26px;
    color: ${theme.textColor2};
    right: 80px;
    top: 8px;
    pointer-events: none;
  }

  .sender-input-address__token-dropdown {
    position: absolute;
    top: 0;
    right: 0;
    width: 72px;
    height: 72px;
  }
`);
