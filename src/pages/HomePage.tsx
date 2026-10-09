import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import rectangleCheckmarkStackFilled from '@wearables-ui-toolkit/icons/svg/rectanglecheckmarkstack__filled.svg';
import {SubNavigationPager, type SubNavigationItem} from '@wearables-ui-toolkit/mrbd';
import {useMemo} from 'react';
import {t} from '../i18n/strings';
import {useLists} from '../ListsProvider';
import {ListsTab} from './ListsTab';
import {NewListTab} from './NewListTab';

export const NEW_LIST_TAB = 1;

/** The start screen: the TickTick lists, and New list beside them. */
export function HomePage() {
  const {tab, setTab, lists} = useLists();
  const loading = lists == null || lists.status === 'loading';
  const items = useMemo<SubNavigationItem[]>(
    () => [
      {label: t('tabLists'), icon: rectangleCheckmarkStackFilled, isLoading: loading},
      {label: t('tabNew'), icon: circlePlusFilled},
    ],
    [loading],
  );

  return (
    <SubNavigationPager items={items} currentPageIndex={tab} onPageChange={next => setTab(next)} ariaLabel={t('homeLabel')}>
      <ListsTab />
      <NewListTab />
    </SubNavigationPager>
  );
}
