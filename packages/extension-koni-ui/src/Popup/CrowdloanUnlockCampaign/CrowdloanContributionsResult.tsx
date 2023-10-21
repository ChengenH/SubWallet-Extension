// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainInfo } from '@subwallet/chain-list/types';
import { CrowdloanParaState } from '@subwallet/extension-base/background/KoniTypes';
import { CrowdloanContributionItem } from '@subwallet/extension-base/services/subscan-service/types';
import { reformatAddress } from '@subwallet/extension-base/utils';
import { AddressInput, TokenBalance } from '@subwallet/extension-koni-ui/components';
import { FilterTabItemType, FilterTabs } from '@subwallet/extension-koni-ui/components/FilterTabs';
import { ScreenContext } from '@subwallet/extension-koni-ui/contexts/ScreenContext';
import { WebUIContext } from '@subwallet/extension-koni-ui/contexts/WebUIContext';
import { getBalanceValue, getConvertedBalanceValue } from '@subwallet/extension-koni-ui/hooks/screen/home/useAccountBalance';
import { getCrowdloanContributions } from '@subwallet/extension-koni-ui/messaging';
import NoteBox from '@subwallet/extension-koni-ui/Popup/CrowdloanUnlockCampaign/components/NoteBox';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { PriceStore } from '@subwallet/extension-koni-ui/stores/types';
import { CrowdloanContributionsResultParam, CrowdloanFundInfo, CrowdloanFundStatus, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { customFormatDate, openInNewTab } from '@subwallet/extension-koni-ui/utils';
import { ActivityIndicator, Button, ButtonProps, Form, Icon, Logo, SwSubHeader, Table, Tag } from '@subwallet/react-ui';
import { Rule } from '@subwallet/react-ui/es/form';
import BigN from 'bignumber.js';
import CN from 'classnames';
import fetch from 'cross-fetch';
import { ArrowCounterClockwise, FadersHorizontal, PlusCircle, RocketLaunch, Vault, Wallet } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import styled from 'styled-components';

import { isAddress } from '@polkadot/util-crypto';

import EmptyList from '../../components/EmptyList/EmptyList';

type Props = ThemeProps;

type TableItem = {
  id: string;
  chainSlug: string;
  chainName: string;
  relayChainSlug: string;
  relayChainName: string;
  contribution: {
    symbol: string;
    value: BigN;
    convertedValue: BigN;
  };
  paraState?: CrowdloanParaState,
  unlockTime: string;
  sortOrder: number
};

type CrowdloanContributionsMap = {
  polkadot: CrowdloanContributionItem[],
  kusama: CrowdloanContributionItem[]
}

interface FormParams {
  address: string;
}

const fetchContributionsMap = async (address: string): Promise<CrowdloanContributionsMap> => {
  const polkadotResponse = await getCrowdloanContributions('polkadot', address);
  const kusamaResponse = await getCrowdloanContributions('kusama', address);

  return {
    polkadot: polkadotResponse.list || [],
    kusama: kusamaResponse.list || []
  };
};

function getTagColor (paraState?: CrowdloanParaState) {
  if (!paraState) {
    return 'default';
  }

  if (paraState.valueOf() === CrowdloanParaState.COMPLETED.valueOf()) {
    return 'success';
  }

  if (paraState === CrowdloanParaState.FAILED.valueOf()) {
    return 'error';
  }

  if (paraState === CrowdloanParaState.ONGOING.valueOf()) {
    return 'warning';
  }

  return 'default';
}

enum FilterValue {
  ALL = 'all',
  POLKADOT_PARACHAIN = 'Polkadot parachain',
  KUSAMA_PARACHAIN = 'Kusama parachain',
  WON = 'won',
  FAIL = 'failed',
  IN_AUCTION = 'in auction'
}

const ACALA_FUND_ID = '2000-0';

const paraStateMap: Record<CrowdloanFundStatus, CrowdloanParaState> = {
  [CrowdloanFundStatus.IN_AUCTION]: CrowdloanParaState.ONGOING,
  [CrowdloanFundStatus.WON]: CrowdloanParaState.COMPLETED,
  [CrowdloanFundStatus.FAILED]: CrowdloanParaState.FAILED,
  [CrowdloanFundStatus.WITHDRAW]: CrowdloanParaState.FAILED
};

const getTableItems = (
  relayChainSlug: 'polkadot' | 'kusama',
  contributionsMap: CrowdloanContributionsMap,
  crowdloanFundInfoMap: Record<string, CrowdloanFundInfo>,
  chainInfoMap: Record<string, _ChainInfo>,
  priceMap: PriceStore['priceMap']
) => {
  const result: TableItem[] = [];

  const relayChainName = relayChainSlug === 'polkadot' ? 'Polkadot' : 'Kusama';
  const decimals = relayChainSlug === 'polkadot' ? 10 : 12;
  const priceId = relayChainSlug === 'polkadot' ? 'polkadot' : 'kusama';
  const symbol = relayChainSlug === 'polkadot' ? 'DOT' : 'KSM';
  const price = priceMap[priceId] || 0;
  const dateNow = Date.now();

  contributionsMap[relayChainSlug].forEach((c) => {
    if (!crowdloanFundInfoMap[c.fund_id]) {
      return;
    }

    const fundInfo = crowdloanFundInfoMap[c.fund_id];

    if (!fundInfo.status || [CrowdloanFundStatus.FAILED, CrowdloanFundStatus.WITHDRAW].includes(fundInfo.status)) {
      return;
    }

    if (!fundInfo.endTime || new Date(fundInfo.endTime).getTime() < dateNow) {
      return;
    }

    const contributedValue = getBalanceValue(c.contributed || '0', decimals);
    const convertedContributedValue = getConvertedBalanceValue(contributedValue, price);

    const unlockTimeNumber = new Date(fundInfo.endTime).getTime();
    const unlockTime = customFormatDate(unlockTimeNumber, '#YYYY#-#MM#-#DD#');
    const chainInfo: _ChainInfo | undefined = fundInfo.chain ? chainInfoMap[fundInfo.chain] : undefined;

    result.push({
      id: `${c.fund_id}-${relayChainSlug}`,
      chainSlug: chainInfo?.slug || `unknown-${c.fund_id}`,
      chainName: chainInfo?.name || `Unknown (${c.fund_id})`,
      relayChainSlug: relayChainSlug,
      relayChainName,
      contribution: {
        symbol,
        value: contributedValue,
        convertedValue: convertedContributedValue
      },
      paraState: paraStateMap[fundInfo.status],
      unlockTime: customFormatDate(unlockTime, '#YYYY#-#MM#-#DD#'),
      sortOrder: unlockTimeNumber
    });
  });

  return result;
};

const getAcalaTableItem = (
  value: string | undefined,
  fundInfo: CrowdloanFundInfo | undefined,
  chainInfo: _ChainInfo | undefined,
  priceMap: PriceStore['priceMap']
): TableItem | undefined => {
  if (!value || !fundInfo || !chainInfo) {
    return;
  }

  if (!fundInfo.endTime || new Date(fundInfo.endTime).getTime() < Date.now()) {
    return;
  }

  const price = priceMap.polkadot || 0;

  const contributedValue = getBalanceValue(value || '0', 10);
  const convertedContributedValue = getConvertedBalanceValue(contributedValue, price);

  const unlockTimeNumber = new Date(fundInfo.endTime).getTime();
  const unlockTime = customFormatDate(unlockTimeNumber, '#YYYY#-#MM#-#DD#');

  return {
    id: `${ACALA_FUND_ID}-polkadot`,
    chainSlug: chainInfo.slug,
    chainName: chainInfo.name,
    relayChainSlug: 'polkadot',
    relayChainName: 'Polkadot',
    contribution: {
      symbol: 'DOT',
      value: contributedValue,
      convertedValue: convertedContributedValue
    },
    paraState: paraStateMap[fundInfo.status as CrowdloanFundStatus],
    unlockTime: customFormatDate(unlockTime, '#YYYY#-#MM#-#DD#'),
    sortOrder: unlockTimeNumber
  };
};

enum RelayChainFilter {
  ALL='all',
  POLKADOT='polkadot',
  KUSAMA='kusama'
}

const Component: React.FC<Props> = ({ className = '' }: Props) => {
  const locationState = useLocation().state as CrowdloanContributionsResultParam;
  const [propAddress] = useState<string | undefined>(locationState?.address);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const priceMap = useSelector((state: RootState) => state.price.priceMap);
  const [selectedFilterTab, setSelectedFilterTab] = useState<string>(FilterValue.ALL);
  const { isNoAccount } = useSelector((state: RootState) => state.accountState);
  const { setOnBack, setWebBaseClassName } = useContext(WebUIContext);
  const [currentSelectRelayChainFilter, setCurrentSelectRelayChainFilter] = useState<RelayChainFilter>(RelayChainFilter.ALL);
  const [acalaValue, setAcalaValue] = useState<string | undefined>(undefined);
  const { isWebUI } = useContext(ScreenContext);
  const { setTitle } = useContext(WebUIContext);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/crowdloan-unlock-campaign/contributions-result') {
      setTitle(t('Your crowdloan contributions'));
    }
  }, [location.pathname, setTitle, t]);

  const [contributionsMap, setContributionsMap] = useState<CrowdloanContributionsMap>({
    polkadot: [],
    kusama: []
  });

  const { chainInfoMap = {},
    crowdloanFundInfoMap = {} }: {
    crowdloanFundInfoMap: Record<string, CrowdloanFundInfo>,
    chainInfoMap: Record<string, _ChainInfo>,
  } = useOutletContext();

  const [form] = Form.useForm<FormParams>();
  const addressValue = Form.useWatch('address', form);
  const [loading, setLoading] = useState<boolean>(false);

  const formDefault = useMemo((): FormParams => {
    return {
      address: propAddress || ''
    };
  }, [propAddress]);

  const goEarningDemo = useCallback(() => {
    openInNewTab(`${window.location.origin}/earning-demo`)();
    // todo: ...
  }, []);

  const onBack = useCallback(() => {
    navigate('/crowdloan-unlock-campaign/check-contributions');
  }, [navigate]);

  const getParaStateLabel = useCallback((paraState?: CrowdloanParaState) => {
    if (!paraState) {
      return '';
    }

    if (paraState.valueOf() === CrowdloanParaState.COMPLETED.valueOf()) {
      return t('Won');
    }

    if (paraState === CrowdloanParaState.FAILED.valueOf()) {
      return t('Fail');
    }

    if (paraState === CrowdloanParaState.ONGOING.valueOf()) {
      return t('In Auction');
    }

    return '';
  }, [t]);

  const tableItems = useMemo<TableItem[]>(() => {
    if (!contributionsMap.polkadot.length && !contributionsMap.kusama.length && !acalaValue) {
      return [];
    }

    const results: TableItem[] = [];

    if (acalaValue) {
      const acalaValueInfo = getAcalaTableItem(acalaValue, crowdloanFundInfoMap[ACALA_FUND_ID], chainInfoMap.acala, priceMap);

      !!acalaValueInfo && results.push(acalaValueInfo);
    }

    results.push(
      ...getTableItems('polkadot', contributionsMap, crowdloanFundInfoMap, chainInfoMap, priceMap),
      ...getTableItems('kusama', contributionsMap, crowdloanFundInfoMap, chainInfoMap, priceMap)
    );

    return results.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [acalaValue, chainInfoMap, contributionsMap, crowdloanFundInfoMap, priceMap]);

  const filteredTableItems = useMemo(() => {
    const filterTabFunction = (item: TableItem) => {
      if (selectedFilterTab === FilterValue.ALL) {
        return true;
      }

      if (selectedFilterTab === FilterValue.WON) {
        return item.paraState === CrowdloanParaState.COMPLETED;
      }

      if (selectedFilterTab === FilterValue.IN_AUCTION) {
        return item.paraState === CrowdloanParaState.ONGOING;
      }

      return false;
    };

    const filterRelaytChainFunction = (item: TableItem) => {
      if (currentSelectRelayChainFilter === RelayChainFilter.ALL) {
        return true;
      }

      if (currentSelectRelayChainFilter === RelayChainFilter.POLKADOT) {
        return item.relayChainSlug === RelayChainFilter.POLKADOT;
      }

      if (currentSelectRelayChainFilter === RelayChainFilter.KUSAMA) {
        return item.relayChainSlug === RelayChainFilter.KUSAMA;
      }

      return false;
    };

    const filterFunction = (item: TableItem) => {
      return filterTabFunction(item) && filterRelaytChainFunction(item);
    };

    return tableItems.filter(filterFunction);
  }, [currentSelectRelayChainFilter, selectedFilterTab, tableItems]);

  const columns = useMemo(() => {
    const getUnlockTexts = (paraState?: CrowdloanParaState): [string, string] => {
      if (!paraState || paraState === CrowdloanParaState.COMPLETED) {
        return [t('Locked'), t('Until')];
      }

      if (paraState === CrowdloanParaState.ONGOING) {
        return [t('Crowdloan'), t('Ends on')];
      }

      return [t('Refunded'), t('On')];
    };

    const cols = [
      {
        title: t('Project name'),
        dataIndex: 'name',
        key: 'name',
        render: (_: any, row: TableItem) => {
          const [text1, text2] = getUnlockTexts(row.paraState);

          return <div className='project-container'>
            <Logo
              isShowSubLogo={true}
              network={row.chainSlug}
              shape={'squircle'}
              size={40}
              subLogoShape={'circle'}
              subNetwork={row.relayChainSlug}
            />
            <div className='project-information'>
              <div className={'project-information-part-1'}>
                <div className={'project-name'}>{row.chainName}</div>
                {!isWebUI && (<Tag color={getTagColor(row.paraState)}>{getParaStateLabel(row.paraState)}</Tag>)}
              </div>

              {isWebUI && (<div className={'project-parachain'}>{`${row.relayChainName} ${t('parachain')}`}</div>)}
              {!isWebUI && (<div className={'fund-unlock-detail-line-2-for-mobile'}>{`${text1} ${text2.toLowerCase()} ${row.unlockTime}`}</div>)}

            </div>
          </div>;
        }
      },
      {
        title: t('Status'),
        dataIndex: 'status',
        key: 'status',
        render: (_: any, item: TableItem) => {
          return <Tag color={getTagColor(item.paraState)}>{getParaStateLabel(item.paraState)}</Tag>;
        }
      },
      {
        title: t('Details'),
        dataIndex: 'details',
        key: 'details',
        render: (_: any, row: TableItem) => {
          const [text1, text2] = getUnlockTexts(row.paraState);

          return <div className={'fund-unlock-detail'}>
            <div className={'fund-unlock-detail-line-1'}>{text1}</div>
            <div className={'fund-unlock-detail-line-2'}>{`${text2} ${row.unlockTime}`}</div>
          </div>;
        }
      },
      {
        title: t('Contribution'),
        dataIndex: 'contribution',
        key: 'contribution',
        render: (_: any, row: TableItem) => {
          return (
            <TokenBalance
              autoHideBalance={false}
              convertedValue={row.contribution.convertedValue}
              symbol={row.contribution.symbol}
              value={row.contribution.value}
            />
          );
        }
      }
    ];

    if (!isWebUI) {
      // Remove col 3
      cols.splice(1, 2);
    }

    return cols;
  }, [getParaStateLabel, isWebUI, t]);

  const filterTabItems = useMemo<FilterTabItemType[]>(() => {
    return [
      {
        label: t('All'),
        value: FilterValue.ALL
      },
      {
        label: t('In Auction'),
        value: FilterValue.IN_AUCTION
      },
      {
        label: t('Won'),
        value: FilterValue.WON
      }
    ];
  }, [t]);

  const onSelectFilterTab = useCallback((value: string) => {
    setSelectedFilterTab(value);
  }, []);

  useEffect(() => {
    setWebBaseClassName(`${className}-web-base-container`);

    return () => {
      setWebBaseClassName('');
    };
  }, [className, setWebBaseClassName]);

  const fetchTableData = useCallback((address: string) => {
    setLoading(true);

    const polkadotAddress = reformatAddress(address, 10, false);

    Promise.all([
      fetchContributionsMap(address),
      (async () => {
        const res = await fetch(`https://api.polkawallet.io/acala-distribution-v2/crowdloan?account=${polkadotAddress}`);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await res.json();
      })()
    ]).then(([contributionsMap, acalaValueInfo]) => {
      setContributionsMap(contributionsMap);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
      setAcalaValue(acalaValueInfo?.data?.acala?.[0]?.totalDOTLocked);
    }).catch((e) => {
      console.log('fetch Contributions Error', e);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (propAddress) {
      fetchTableData(propAddress);
    }
  }, [fetchTableData, propAddress]);

  const onClickCheckAgain = useCallback(() => {
    fetchTableData(addressValue);
  }, [addressValue, fetchTableData]);

  const validateAddress = useCallback((rule: Rule, address: string): Promise<void> => {
    if (!address) {
      return Promise.reject(t('Address is required.'));
    }

    if (!isAddress(address)) {
      return Promise.reject(t('Invalid address. Check again or create a new account to get started.'));
    }

    fetchTableData(address);

    return Promise.resolve();
  }, [fetchTableData, t]);

  const isCheckAgainDisabled = loading || !addressValue || !isAddress(addressValue);

  const onClickCreateNewWallet = useCallback(() => {
    if (isNoAccount) {
      openInNewTab(`${window.location.origin}/welcome`)();
    } else {
      openInNewTab(`${window.location.origin}/home/tokens`)();
    }
  }, [isNoAccount]);

  useEffect(() => {
    setOnBack(onBack);

    return () => {
      setOnBack(undefined);
    };
  }, [onBack, setOnBack]);

  const onSelectRelayChainFilter = useCallback((relayChainFilter: RelayChainFilter) => {
    return () => {
      setCurrentSelectRelayChainFilter((prev) => {
        if (prev === relayChainFilter) {
          return RelayChainFilter.ALL;
        }

        return relayChainFilter;
      });
    };
  }, []);

  const tagAreaNode = (
    <div className={'__tag-area'}>
      <div
        className={CN('__tag-item', {
          '-active': currentSelectRelayChainFilter === RelayChainFilter.POLKADOT
        })}
        onClick={onSelectRelayChainFilter(RelayChainFilter.POLKADOT)}
      >
        <Logo
          className={'__tag-item-logo'}
          network={'polkadot'}
          size={16}
        />
        <div className={'__tag-item-label'}>
          DOT
        </div>
      </div>
      <div
        className={CN('__tag-item', {
          '-active': currentSelectRelayChainFilter === RelayChainFilter.KUSAMA
        })}
        onClick={onSelectRelayChainFilter(RelayChainFilter.KUSAMA)}
      >
        <Logo
          className={'__tag-item-logo'}
          network={'kusama'}
          size={16}
        />
        <div className={'__tag-item-label'}>
          KSM
        </div>
      </div>
    </div>
  );

  // @ts-ignore
  const headerIcons = useMemo<ButtonProps[]>(() => {
    return [
      {
        icon: (
          <Icon
            customSize={'24px'}
            phosphorIcon={FadersHorizontal}
            type='phosphor'
          />
        ),
        onClick: () => {
          //
        }
      }
    ];
  }, []);

  return (
    <div
      className={className}
    >
      {isWebUI && tagAreaNode}
      <div className='__tool-area'>
        {
          !isWebUI && (
            <SwSubHeader
              background={'transparent'}
              className={'__header-area'}
              onBack={onBack}
              paddingVertical
              // rightButtons={headerIcons}
              showBackButton
              title={t('Your contributions')}
            />
          )
        }

        {
          isWebUI && (
            <FilterTabs
              className={'__filter-tabs-container'}
              items={filterTabItems}
              onSelect={onSelectFilterTab}
              selectedItem={selectedFilterTab}
            />
          )
        }

        <div className={'__form-area'}>
          <Form
            className={'__form-container'}
            form={form}
            initialValues={formDefault}
          >
            <Form.Item
              className={'__form-item'}
              name={'address'}
              rules={[
                {
                  validator: validateAddress
                }
              ]}
              statusHelpAsTooltip
              validateTrigger='onChange'
            >
              <AddressInput
                placeholder={t('Enter your Polkadot wallet address')}
                prefix={(
                  <Icon
                    className={'address-input-icon'}
                    phosphorIcon={Wallet}
                    size='md'
                  />
                )}
                showLabel={false}
                showPlainAddressOnly
                showScanner
              />
            </Form.Item>
          </Form>
        </div>

        {!isWebUI && tagAreaNode}
      </div>

      <div className={'__table-area'}>
        {loading && (
          <div className={'__loading-area'}>
            <ActivityIndicator
              loading={true}
              size={32}
            />
          </div>
        )}
        {!!filteredTableItems.length && !loading && (
          <Table
            className={'__table'}
            columns={columns}
            dataSource={filteredTableItems}
            pagination={false}
            rowKey={'id'}
          />
        )}
        {!filteredTableItems.length && !loading && (
          <div className={'__empty-list-wrapper'}>
            <EmptyList
              className={'__empty-list'}
              emptyMessage={
                <>
                  <span className={'__has-suffix-space'}>
                    {t('Check again, create a new account or visit our')}
                  </span>
                  <a
                    className={'__link'}
                    href='https://docs.subwallet.app/main/web-dashboard-user-guide/earning/faqs'
                    rel='noreferrer'
                    target={'_blank'}
                  >
                    {t('FAQs')}
                  </a>
                </>
              }
              emptyTitle={t('We can\'t find any crowdloan contributions from this address.')}
              phosphorIcon={RocketLaunch}
            />

            <div className='__buttons-block'>
              <Button
                block
                className='__check-again-button'
                disabled={isCheckAgainDisabled}
                icon={
                  <Icon
                    customSize={'28px'}
                    phosphorIcon={ArrowCounterClockwise}
                    weight='fill'
                  />
                }
                onClick={onClickCheckAgain}
                schema='secondary'
              >
                {t('Check again')}
              </Button>

              <Button
                block
                className='__create-a-wallet-button'
                icon={
                  <Icon
                    customSize={'28px'}
                    phosphorIcon={PlusCircle}
                    weight='fill'
                  />
                }
                onClick={onClickCreateNewWallet}
                schema='primary'
              >
                {t('Create a new account')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={'__footer-area'}>
        <NoteBox
          className={'__note-box'}
          content={t('There\'re multiple ways you can play with your unlocked DOT, such as native staking, liquid staking, or lending. Check out SubWallet Dashboard for curated options with competitive APY to earn yield on your DOT.')}
          title={t('Crowdloan unlock, then what?')}
        />

        <Button
          className={'__footer-button'}
          contentAlign={'left'}
          icon={
            <Icon
              className='__footer-button-icon'
              phosphorIcon={Vault}
              size='md'
              weight='fill'
            />
          }
          onClick={goEarningDemo}
        >
          <div className={'__footer-button-content'}>
            <div className={'__footer-button-title'}>{t('Rewards: 18% - 24%')}</div>
            <div className={'__footer-button-subtitle'}>{t('Earn with SubWallet Dashboard')}</div>
          </div>
        </Button>
      </div>
    </div>
  );
};

const CrowdloanContributionsResult = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    maxWidth: 1216,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: token.padding,
    paddingRight: token.padding,
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',

    '&-web-base-container': {
      '.web-layout-header-simple': {
        paddingBottom: token.sizeLG
      }
    },

    '.__header-area': {
      alignSelf: 'stretch',
      marginLeft: -token.margin,
      marginRight: -token.margin,
      backgroundColor: token.colorBgDefault
    },

    '.__tag-area': {
      display: 'flex',
      justifyContent: 'center',
      gap: token.sizeXS,
      marginBottom: 28
    },

    '.__tag-item': {
      display: 'flex',
      gap: token.sizeXXS,
      position: 'relative',
      alignItems: 'center',
      paddingLeft: token.paddingSM,
      paddingRight: token.paddingSM,
      height: 30,
      borderRadius: 50,
      cursor: 'pointer',

      '&:before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        border: '2px solid',
        borderColor: token.colorBorderBg,
        borderRadius: 50,
        opacity: 1
      },

      '&.-active': {
        backgroundColor: token.colorBgSecondary,

        '&:before': {
          opacity: 0
        }
      }
    },

    '.__tag-item-label': {
      fontSize: token.fontSize,
      lineHeight: token.lineHeight,
      color: token.colorTextLight4
    },

    '.ant-sw-screen-layout-body': {
      display: 'flex',
      flexDirection: 'column'
    },

    '.project-container': {
      display: 'flex',
      gap: token.sizeXS,

      '.project-information': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingRight: token.paddingXS
      },

      '.project-information-part-1': {
        display: 'flex'
      },

      '.project-name': {
        fontSize: token.fontSizeLG,
        lineHeight: token.lineHeightLG,
        fontWeight: token.headingFontWeight,
        color: token.colorTextLight1,
        paddingRight: token.sizeXS,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },

      '.project-parachain': {
        fontSize: token.fontSizeSM,
        lineHeight: token.lineHeightSM,
        color: token.colorTextLight4
      }
    },

    '.fund-unlock-detail-line-1': {
      fontSize: token.fontSizeLG,
      lineHeight: token.lineHeightLG,
      color: token.colorTextLight1
    },

    '.fund-unlock-detail-line-2': {
      fontSize: token.fontSizeSM,
      lineHeight: token.lineHeightSM,
      color: token.colorSuccess
    },

    '.fund-unlock-detail-line-2-for-mobile': {
      fontSize: token.fontSizeSM,
      lineHeight: token.lineHeightSM,
      color: token.colorTextLight4,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: 156
    },

    '.address-input-icon': {
      zIndex: 10
    },

    '.__tool-area': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: token.size,
      flexWrap: 'wrap'
    },

    '.__form-area': {
      flex: 1,

      '.web-ui-enable &': {
        maxWidth: 358
      }
    },

    '.__form-item': {
      marginBottom: 0
    },

    '.__table-area': {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      paddingTop: token.padding,
      paddingBottom: token.paddingLG
    },

    '.__loading-area': { display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center' },

    '.__empty-list-wrapper': {
      paddingTop: 70,
      paddingBottom: 100
    },

    '.__empty-list': {
      '.__has-suffix-space': {
        '&:after': {
          content: '" "'
        }
      },

      '.__link': {
        textDecoration: 'underline',
        color: token.colorPrimary
      }
    },

    '.__buttons-block': {
      display: 'flex',
      gap: token.size,
      maxWidth: 584,
      marginLeft: 'auto',
      marginRight: 'auto',
      flexWrap: 'wrap'
    },

    '.__check-again-button, .__create-a-wallet-button': {
      flex: 1
    },

    '.__footer-area': {
      borderTop: `2px solid ${token.colorBgDivider}`,
      display: 'flex',
      gap: token.size,
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: token.sizeLG,
      paddingBottom: 42,
      position: 'sticky',
      bottom: 0,
      background: token.colorBgDefault,
      opacity: 1,
      zIndex: 10
    },

    '.__note-box': {
      maxWidth: 684,
      flex: '1 0 300px'
    },

    '.__footer-button': {
      height: 72,
      flex: 1,
      paddingRight: token.paddingSM,
      paddingLeft: token.paddingSM,
      gap: token.size,
      maxWidth: 384
    },

    '.__footer-button-icon': {
      width: 40,
      height: 40,
      justifyContent: 'center'
    },

    '.__footer-button-content': {
      textAlign: 'left'
    },

    '.__footer-button-title': {
      fontSize: token.fontSizeLG,
      lineHeight: token.lineHeightLG,
      color: token.colorTextLight1,
      marginBottom: token.marginXXS
    },

    '.__footer-button-subtitle': {
      fontSize: token.fontSize,
      lineHeight: token.lineHeight,
      color: token.colorTextLight3
    },

    '@media (max-width: 991px)': {
      '.__footer-area': {
        position: 'static',
        paddingTop: token.padding
      },

      '.__table-area': {
        paddingTop: 0,
        paddingBottom: token.sizeXS
      },

      '.__tool-area': {
        position: 'sticky',
        display: 'block',
        top: 0,
        background: token.colorBgDefault,
        zIndex: 10
      },

      '.__form-area': {
        marginTop: token.marginXS,
        marginBottom: token.margin
      },

      '.__tag-area': {
        minWidth: '100%',
        paddingBottom: token.padding,
        marginBottom: 0,
        justifyContent: 'flex-start'
      }
    },

    '@media (max-width: 767px)': {
      '.__footer-button': {
        minWidth: '100%'
      },

      '.__buttons-block': {
        '.ant-btn': {
          minWidth: '100%'
        }
      }
    }
  };
});

export default CrowdloanContributionsResult;
