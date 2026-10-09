import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import clipboardFilled from '@wearables-ui-toolkit/icons/svg/clipboard__filled.svg';
import rectangleCheckmarkStackFilled from '@wearables-ui-toolkit/icons/svg/rectanglecheckmarkstack__filled.svg';
import {SubNavigationPager, type SubNavigationItem} from '@wearables-ui-toolkit/mrbd';
import {useMemo} from 'react';
import {t} from '../i18n/strings';
import {useTasks} from '../TasksProvider';
import {ListsTab} from './ListsTab';
import {NewListTab} from './NewListTab';
import {PendingTab} from './PendingTab';


/** The start screen: Pending, the lists, and New list. */
export function HomePage() {
  const {tab, setTab, lists} = useTasks();
  const loading = lists == null || lists.status === 'loading';
  const items = useMemo<SubNavigationItem[]>(
    () => [
      {label: t('tabPending'), icon: rectangleCheckmarkStackFilled, isLoading: loading},
      {label: t('tabLists'), icon: clipboardFilled, isLoading: loading},
      {label: t('tabNew'), icon: circlePlusFilled},
    ],
    [loading],
  );

  return (
    <SubNavigationPager items={items} currentPageIndex={tab} onPageChange={next => setTab(next)} ariaLabel={t('homeLabel')}>
      <PendingTab />
      <ListsTab />
      <NewListTab />
    </SubNavigationPager>
  );
}
