import {describe, expect, it} from 'vitest';
import {SubtitleTextColor} from '@wearables-ui-toolkit/mrbd';
import {loading, retrying, settled, type Resource} from '../../src/state/resource';
import {secondLine} from '../../src/components/taskStyle';
import {TickTickError} from '../../src/ticktick/types';

describe('loading while retrying', () => {
  const empty: Resource<string[]> | null = null;
  const shown: Resource<string[]> = {status: 'ready', data: ['a'], error: null};

  it('keeps loading after a network failure that will be tried again', () => {
    const error = new TickTickError('network');
    retrying.add(error);
    expect(settled(empty, error)).toEqual({status: 'loading', data: null, error: null});
    expect(settled(shown, error, true)).toEqual({status: 'ready', data: ['a'], error: null});
  });

  it('shows the error once there are no more tries', () => {
    const error = new TickTickError('network');
    expect(settled(empty, error)).toEqual({status: 'error', data: null, error});
    expect(settled(shown, error, true)).toEqual({status: 'ready', data: ['a'], error});
    expect(settled(empty, new TickTickError('server', 500)).status).toBe('error');
  });

  it('keeps the data while loading silently', () => {
    expect(loading(shown, true).status).toBe('ready');
    expect(loading(empty, true).status).toBe('loading');
  });
});

describe('the due line on a row', () => {
  it('is in the primary text color, with an icon for overdue and today', () => {
    const overdue = secondLine('Yesterday', 'Work', 'overdue');
    const today = secondLine('15:00', 'Work', 'today');
    const later = secondLine('Fri, Oct 16', '', 'normal');
    expect([overdue.subtitle, overdue.subtitleTextColor]).toEqual(['Yesterday · Work', SubtitleTextColor.PRIMARY]);
    expect(overdue.secondaryIcon).toBeTruthy();
    expect(today.secondaryIcon).toBeTruthy();
    expect(today.secondaryIcon).not.toEqual(overdue.secondaryIcon);
    expect([later.subtitle, later.subtitleTextColor, later.secondaryIcon]).toEqual(['Fri, Oct 16', SubtitleTextColor.PRIMARY, undefined]);
    expect(secondLine('', 'Work', 'normal')).toEqual({subtitle: 'Work'});
  });
});
