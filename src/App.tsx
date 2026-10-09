import {App} from '@wearables-ui-toolkit/mrbd';
import {ReactRouterNavigationProvider, ReactRouterPageTransition} from '@wearables-ui-toolkit/mrbd/react-router';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {useLists} from './ListsProvider';
import {CartPage} from './pages/CartPage';
import {DeletePage} from './pages/DeletePage';
import {HomePage} from './pages/HomePage';
import {ItemPage} from './pages/ItemPage';
import {ListPage} from './pages/ListPage';
import {ReviewPage} from './pages/ReviewPage';
import {SetupPage} from './pages/SetupPage';
import {WritePage} from './pages/WritePage';
import {restoreReturnRow} from './state/returnFocus';

// Back (Escape) is handled by ReactRouterNavigationProvider: each route goes
// back to the one that opened it; on the start screen, with no history left,
// it is not consumed, so Lumen closes the app.
export default function ListsApp() {
  const {phase} = useLists();
  return (
    <BrowserRouter>
      <ReactRouterNavigationProvider>
        <App>
          {phase.kind !== 'ready' ? (
            <SetupPage phase={phase} />
          ) : (
            <ReactRouterPageTransition onTransitionEnd={restoreReturnRow}>
              {({location}) => (
                <Routes location={location}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/list/:listId" element={<ListPage />} />
                  <Route path="/list/:listId/add" element={<WritePage mode="add" />} />
                  <Route path="/list/:listId/review" element={<ReviewPage />} />
                  <Route path="/list/:listId/cart" element={<CartPage />} />
                  <Route path="/list/:listId/item/:itemId" element={<ItemPage />} />
                  <Route path="/list/:listId/item/:itemId/edit" element={<WritePage mode="edit" />} />
                  <Route path="/list/:listId/item/:itemId/delete" element={<DeletePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </ReactRouterPageTransition>
          )}
        </App>
      </ReactRouterNavigationProvider>
    </BrowserRouter>
  );
}
