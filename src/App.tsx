import {App} from '@wearables-ui-toolkit/mrbd';
import {ReactRouterNavigationProvider, ReactRouterPageTransition} from '@wearables-ui-toolkit/mrbd/react-router';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {CompletedPage} from './pages/CompletedPage';
import {DeletePage} from './pages/DeletePage';
import {EditPage} from './pages/EditPage';
import {HomePage} from './pages/HomePage';
import {ListPage} from './pages/ListPage';
import {PickerPage} from './pages/PickerPage';
import {ReviewPage} from './pages/ReviewPage';
import {SetupPage} from './pages/SetupPage';
import {TaskPage} from './pages/TaskPage';
import {WritePage} from './pages/WritePage';
import {restoreReturnRow} from './state/returnFocus';
import {useTasks} from './TasksProvider';

// Back (Escape) is handled by ReactRouterNavigationProvider: each route goes
// back to the one that opened it; on the start screen, with no history left,
// it is not consumed, so Lumen closes the app.
export default function TickTickApp() {
  const {phase} = useTasks();
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
                  <Route path="/add" element={<WritePage />} />
                  <Route path="/review" element={<ReviewPage />} />
                  <Route path="/review/list" element={<PickerPage kind="review-list" />} />
                  <Route path="/list/:listId" element={<ListPage />} />
                  <Route path="/list/:listId/completed" element={<CompletedPage />} />
                  <Route path="/list/:listId/add" element={<WritePage />} />
                  <Route path="/list/:listId/review" element={<ReviewPage />} />
                  <Route path="/list/:listId/review/list" element={<PickerPage kind="review-list" />} />
                  <Route path="/task/:listId/:taskId" element={<TaskPage />} />
                  <Route path="/task/:listId/:taskId/edit" element={<EditPage />} />
                  <Route path="/task/:listId/:taskId/edit/list" element={<PickerPage kind="edit-list" />} />
                  <Route path="/task/:listId/:taskId/edit/priority" element={<PickerPage kind="edit-priority" />} />
                  <Route path="/task/:listId/:taskId/delete" element={<DeletePage />} />
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
