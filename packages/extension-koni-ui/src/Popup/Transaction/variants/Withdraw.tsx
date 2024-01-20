// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainInfo } from '@subwallet/chain-list/types';
import { ExtrinsicType } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson } from '@subwallet/extension-base/background/types';
import { _STAKING_CHAIN_GROUP } from '@subwallet/extension-base/services/earning-service/constants';
import { getAstarWithdrawable } from '@subwallet/extension-base/services/earning-service/handlers/native-staking/astar';
import { RequestYieldWithdrawal, UnstakingInfo, UnstakingStatus, YieldPoolType, YieldPositionInfo } from '@subwallet/extension-base/types';
import { isSameAddress } from '@subwallet/extension-base/utils';
import { AccountSelector, HiddenInput, MetaInfo } from '@subwallet/extension-koni-ui/components';
import { useGetChainAssetInfo, useHandleSubmitTransaction, useInitValidateTransaction, usePreCheckAction, useRestoreTransaction, useSelector, useTransactionContext, useWatchTransaction } from '@subwallet/extension-koni-ui/hooks';
import { useYieldPositionDetail } from '@subwallet/extension-koni-ui/hooks/earning';
import { yieldSubmitStakingWithdrawal } from '@subwallet/extension-koni-ui/messaging';
import { accountFilterFunc } from '@subwallet/extension-koni-ui/Popup/Transaction/helper';
import { FormCallbacks, FormFieldData, ThemeProps, WithdrawParams } from '@subwallet/extension-koni-ui/types';
import { convertFieldToObject, isAccountAll, simpleCheckForm } from '@subwallet/extension-koni-ui/utils';
import { Button, Form, Icon } from '@subwallet/react-ui';
import CN from 'classnames';
import { ArrowCircleRight, XCircle } from 'phosphor-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { EarnOutlet, FreeBalance, TransactionContent, TransactionFooter } from '../parts';

type Props = ThemeProps;

const hideFields: Array<keyof WithdrawParams> = ['chain', 'asset', 'slug'];
const validateFields: Array<keyof WithdrawParams> = ['from'];

const filterAccount = (
  chainInfoMap: Record<string, _ChainInfo>,
  allPositionInfos: YieldPositionInfo[],
  poolType: YieldPoolType,
  poolChain?: string
): ((account: AccountJson) => boolean) => {
  return (account: AccountJson): boolean => {
    const nomination = allPositionInfos.find((data) => isSameAddress(data.address, account.address));

    return (
      (nomination
        ? nomination.unstakings.filter((data) => data.status === UnstakingStatus.CLAIMABLE).length > 0
        : false) && accountFilterFunc(chainInfoMap, poolType, poolChain)(account)
    );
  };
};

const Component = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { defaultData, onDone, persistData } = useTransactionContext<WithdrawParams>();
  const { slug } = defaultData;

  const [form] = Form.useForm<WithdrawParams>();
  const formDefault = useMemo((): WithdrawParams => ({ ...defaultData }), [defaultData]);

  const { isAllAccount } = useSelector((state) => state.accountState);
  const { chainInfoMap } = useSelector((state) => state.chainStore);
  const { poolInfoMap } = useSelector((state) => state.earning);

  const [isDisable, setIsDisable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isBalanceReady, setIsBalanceReady] = useState(true);

  const chainValue = useWatchTransaction('chain', form, defaultData);
  const fromValue = useWatchTransaction('from', form, defaultData);

  const { list: allPositionInfos } = useYieldPositionDetail(slug);
  const { list: yieldPositions } = useYieldPositionDetail(slug, fromValue);
  const yieldPosition = yieldPositions[0];
  const type = yieldPosition.type;

  const poolInfo = useMemo(() => poolInfoMap[slug], [poolInfoMap, slug]);
  const stakingChain = useMemo(() => poolInfo?.chain || '', [poolInfo?.chain]);

  const inputAsset = useGetChainAssetInfo(poolInfo.metadata.inputAsset);
  const decimals = inputAsset?.decimals || 0;
  const symbol = inputAsset?.symbol || '';

  const unstakingInfo = useMemo((): UnstakingInfo | undefined => {
    if (fromValue && !isAccountAll(fromValue) && !!yieldPosition) {
      if (_STAKING_CHAIN_GROUP.astar.includes(yieldPosition.chain)) {
        return getAstarWithdrawable(yieldPosition);
      }

      return yieldPosition.unstakings.filter((data) => data.status === UnstakingStatus.CLAIMABLE)[0];
    }

    return undefined;
  }, [fromValue, yieldPosition]);

  const goHome = useCallback(() => {
    navigate('/home/earning');
  }, [navigate]);

  const onFieldsChange: FormCallbacks<WithdrawParams>['onFieldsChange'] = useCallback((changedFields: FormFieldData[], allFields: FormFieldData[]) => {
    // TODO: field change
    const { empty, error } = simpleCheckForm(allFields, ['--asset']);

    const values = convertFieldToObject<WithdrawParams>(allFields);

    setIsDisable(empty || error);
    persistData(values);
  }, [persistData]);

  const { onError, onSuccess } = useHandleSubmitTransaction(onDone);

  const onSubmit: FormCallbacks<WithdrawParams>['onFinish'] = useCallback((values: WithdrawParams) => {
    setLoading(true);

    if (!unstakingInfo) {
      setLoading(false);

      return;
    }

    const params: RequestYieldWithdrawal = {
      address: values.from,
      slug: values.slug,
      unstakingInfo: unstakingInfo
    };

    setTimeout(() => {
      yieldSubmitStakingWithdrawal(params)
        .then(onSuccess)
        .catch(onError)
        .finally(() => {
          setLoading(false);
        });
    }, 300);
  }, [onError, onSuccess, unstakingInfo]);

  const onPreCheck = usePreCheckAction(fromValue);

  const accountSelectorFilter = useCallback((account: AccountJson): boolean => {
    return filterAccount(chainInfoMap, allPositionInfos, poolInfo.type)(account);
  }, [allPositionInfos, chainInfoMap, poolInfo.type]);

  useRestoreTransaction(form);
  useInitValidateTransaction(validateFields, form, defaultData);

  useEffect(() => {
    form.setFieldValue('chain', stakingChain);
  }, [form, stakingChain]);

  return (
    <>
      <TransactionContent>
        <Form
          className={'form-container form-space-sm'}
          form={form}
          initialValues={formDefault}
          onFieldsChange={onFieldsChange}
          onFinish={onSubmit}
        >

          <HiddenInput fields={hideFields} />
          <Form.Item
            name={'from'}
          >
            <AccountSelector
              disabled={!isAllAccount}
              filter={accountSelectorFilter}
            />
          </Form.Item>
          <FreeBalance
            address={fromValue}
            chain={chainValue}
            className={'free-balance'}
            label={t('Available balance:')}
            onBalanceReady={setIsBalanceReady}
          />
          <Form.Item>
            <MetaInfo
              className='withdraw-meta-info'
              hasBackgroundWrapper={true}
            >
              <MetaInfo.Chain
                chain={chainValue}
                label={t('Network')}
              />
              {
                unstakingInfo && (
                  <MetaInfo.Number
                    decimals={decimals}
                    label={t('Amount')}
                    suffix={symbol}
                    value={unstakingInfo.claimable}
                  />
                )
              }
            </MetaInfo>
          </Form.Item>
        </Form>
      </TransactionContent>
      <TransactionFooter>
        <Button
          disabled={loading}
          icon={(
            <Icon
              phosphorIcon={XCircle}
              weight='fill'
            />
          )}
          onClick={goHome}
          schema={'secondary'}
        >
          {t('Cancel')}
        </Button>

        <Button
          disabled={isDisable || !isBalanceReady}
          icon={(
            <Icon
              phosphorIcon={ArrowCircleRight}
              weight='fill'
            />
          )}
          loading={loading}
          onClick={onPreCheck(form.submit, type === YieldPoolType.NOMINATION_POOL ? ExtrinsicType.STAKING_POOL_WITHDRAW : ExtrinsicType.STAKING_WITHDRAW)}
        >
          {t('Continue')}
        </Button>
      </TransactionFooter>
    </>
  );
};

const Wrapper: React.FC<Props> = (props: Props) => {
  const { className } = props;

  return (
    <EarnOutlet
      className={CN(className)}
      path={'/transaction/withdraw'}
      stores={['earning']}
    >
      <Component />
    </EarnOutlet>
  );
};

const Withdraw = styled(Wrapper)<Props>(({ theme: { token } }: Props) => {
  return {
    '.free-balance': {
      marginBottom: token.marginXS
    },

    '.meta-info': {
      marginTop: token.paddingSM
    }
  };
});

export default Withdraw;
