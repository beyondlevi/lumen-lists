import {Button, ButtonRail, InputTextView, MaterialLibrary, ScrollView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {t} from '../i18n/strings';
import {useLists} from '../ListsProvider';
import {listPath} from '../paths';

/** New list: a real text field for the name (Enter opens Lumen's composer), then Create. */
export function NewListTab() {
  const navigate = useNavigate();
  const {createList, setTab, rememberList} = useLists();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const createMaterial = useMemo(() => MaterialLibrary.themedPrimaryGreen(), []);
  const trimmed = name.trim();

  const create = async () => {
    if (trimmed === '' || busy) return;
    setBusy(true);
    const id = await createList(trimmed);
    setBusy(false);
    if (id != null) {
      setName('');
      setTab(0);
      rememberList(id);
      navigate(listPath(id));
    }
  };

  return (
    <div className="action-page-shell">
      <ScrollView insetForHeader ariaLabel={t('newListLabel')}>
        <div className="content-inset">
          <InputTextView
            text={name}
            hint={t('newListHint')}
            onTextChange={setName}
            showLoader={busy}
            loadingLabel={t('loadingLabel')}
            inputProps={{'aria-label': t('newListFieldLabel'), maxLength: 64}}
          />
        </div>
      </ScrollView>
      <div className="action-dock">
        <ButtonRail>
          <Button
            title={t('create')}
            alwaysShowText
            material={createMaterial}
            disabled={trimmed === '' || busy}
            initialFocusEligible={false}
            onClick={() => void create()}
          />
        </ButtonRail>
      </div>
    </div>
  );
}
