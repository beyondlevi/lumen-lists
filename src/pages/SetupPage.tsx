import rectangleCheckmarkStackFilled from '@wearables-ui-toolkit/icons/svg/rectanglecheckmarkstack__filled.svg';
import rotateClockwiseFilled from '@wearables-ui-toolkit/icons/svg/rotateclockwise__filled.svg';
import {Button, ButtonRail, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useState} from 'react';
import {LoadingContent} from '../components/StateContent';
import {formatNumber, t} from '../i18n/strings';
import {useTasks, type Phase} from '../TasksProvider';

const STEPS = ['setupStep1', 'setupStep2', 'setupStep3'] as const;

/** Shown instead of every route while the TickTick token is missing or refused. */
export function SetupPage({phase}: {phase: Exclude<Phase, {kind: 'ready'}>}) {
  const {retrySetup} = useTasks();
  const [checked, setChecked] = useState(false);
  const retryMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);

  if (phase.kind === 'loading') {
    return (
      <Page headerText={t('appName')} headerIsLoading enableSystemBarInset={false}>
        <LoadingContent />
      </Page>
    );
  }

  const tryAgain = async () => {
    await retrySetup();
    setChecked(true);
  };
  const problem =
    phase.reason === 'refused'
      ? [t('setupRefusedTitle'), t('setupRefusedBody')]
      : phase.reason === 'invalid'
        ? [t('setupInvalidTitle'), t('setupInvalidBody')]
        : null;

  return (
    <Page
      headerText={t('setupHeader')}
      headerIcon={rectangleCheckmarkStackFilled}
      headerMetadata={checked && phase.reason === 'missing' ? t('stillMissing') : undefined}
      enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader tabIndex={0} ariaLabel={t('setupLabel')}>
          <div className="content-inset" role={problem ? 'alert' : 'status'}>
            {problem ? (
              <div className="setup-problem">
                <TextView as="p" textStyle={TextStyle.BODY2_EMPHASIZED}>
                  {problem[0]}
                </TextView>
                <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
                  {problem[1]}
                </TextView>
              </div>
            ) : null}
            <ol className="setup-steps">
              {STEPS.map((step, index) => (
                <li key={step} className="setup-step">
                  <TextView as="span" textStyle={TextStyle.BODY2_EMPHASIZED} textColor={TextColor.SECONDARY}>
                    {formatNumber(index + 1)}
                  </TextView>
                  <TextView as="span" textStyle={TextStyle.BODY2}>
                    {t(step)}
                  </TextView>
                </li>
              ))}
            </ol>
            <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
              {t('setupNote')}
            </TextView>
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonRail>
            <Button title={t('retry')} icon={rotateClockwiseFilled} alwaysShowText material={retryMaterial} onClick={() => void tryAgain()} />
          </ButtonRail>
        </div>
      </div>
    </Page>
  );
}
