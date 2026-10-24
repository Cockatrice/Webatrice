import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders, makeStoreState, makeUser } from '../../../../__test-utils__';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import CreateGameDialog from './CreateGameDialog';
import { CREATE_GAME_DEFAULTS_KEY } from './createGameDefaults';

function renderDialog(opts: { isJudge?: boolean; isRegistered?: boolean; gametypeMap?: Record<number, string> } = {}) {
  const userLevel =
    (opts.isRegistered ? ServerInfo_User_UserLevelFlag.IsRegistered : 0) |
    (opts.isJudge ? ServerInfo_User_UserLevelFlag.IsJudge : 0);
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <CreateGameDialog
      isOpen
      roomName="Magic"
      gametypeMap={opts.gametypeMap ?? {}}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
    {
      preloadedState: makeStoreState({
        server: {
          user: makeUser({ userLevel }),
        } as any,
      }),
    },
  );
  return { onSubmit, onCancel };
}

const create = () => fireEvent.click(screen.getByRole('button', { name: 'CreateGameDialog.action.create' }));
const advancedButton = () => screen.getByRole('button', { name: /CreateGameDialog.advanced.title/ });
const toggleAdvanced = () => fireEvent.click(advancedButton());
const toggle = (key: string) => fireEvent.click(screen.getByRole('switch', { name: `CreateGameDialog.label.${key}` }));
const preset = (id: string) => screen.getByRole('radio', { name: `CreateGameDialog.preset.${id}.name` });

describe('CreateGameDialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('submits desktop-default values for an unedited form, with the 1v1 preset selected', () => {
    const { onSubmit } = renderDialog({ isRegistered: true });
    expect(preset('oneVsOne')).toBeChecked();
    create();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      description: '',
      password: '',
      maxPlayers: 2,
      onlyBuddies: false,
      onlyRegistered: true,
      spectatorsAllowed: true,
      spectatorsNeedPassword: false,
      spectatorsCanTalk: false,
      spectatorsSeeEverything: false,
      joinAsSpectator: false,
      startingLifeTotal: 20,
      shareDecklistsOnLoad: false,
      joinAsJudge: false,
      gameTypeIds: [],
    });
  });

  it('Commander pod sets four seats, 40 life and the room\'s Commander type', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, gametypeMap: { 0: 'Standard', 3: 'Commander' } });
    fireEvent.click(preset('commanderPod'));
    expect(preset('commanderPod')).toBeChecked();
    create();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ maxPlayers: 4, startingLifeTotal: 40, gameTypeIds: [3] });
  });

  it('Commander pod leaves the format as Any when the room has no Commander type', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, gametypeMap: { 0: 'Standard' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.format'), { target: { value: '0' } });
    fireEvent.click(preset('commanderPod'));
    create();
    expect(onSubmit.mock.calls[0][0].gameTypeIds).toEqual([]);
  });

  it('Duel Commander sets two seats, 30 life and the room\'s Other type', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, gametypeMap: { 0: 'Standard', 7: 'Other' } });
    fireEvent.click(preset('duelCommander'));
    expect(preset('duelCommander')).toBeChecked();
    create();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      maxPlayers: 2,
      startingLifeTotal: 30,
      onlyRegistered: true,
      spectatorsAllowed: true,
      spectatorsCanTalk: false,
      gameTypeIds: [7],
    });
  });

  it('Duel Commander leaves the format as Any when the room has no Other type', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, gametypeMap: { 0: 'Standard' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.format'), { target: { value: '0' } });
    fireEvent.click(preset('duelCommander'));
    create();
    expect(onSubmit.mock.calls[0][0].gameTypeIds).toEqual([]);
  });

  it('shows no description under the preset cards', () => {
    renderDialog({ isRegistered: true });
    for (const id of ['commanderPod', 'oneVsOne', 'friendsOnly', 'duelCommander']) {
      expect(preset(id)).not.toHaveAccessibleDescription();
    }
  });

  it('Friends only is unavailable to unregistered users, and says why', () => {
    renderDialog({ isRegistered: false });
    expect(preset('friendsOnly')).toBeDisabled();
    expect(preset('friendsOnly')).toHaveAccessibleDescription('CreateGameDialog.preset.needsAccount');
  });

  it('marks the picked preset as customised once a field no longer matches it', () => {
    renderDialog({ isRegistered: true });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.maxPlayers'), { target: { value: '3' } });
    expect(preset('oneVsOne')).toBeChecked();
    expect(preset('oneVsOne')).toHaveAccessibleDescription(expect.stringContaining('CreateGameDialog.preset.customised'));
  });

  it('clicking a customised preset restores its fields and format', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, gametypeMap: { 3: 'Commander', 4: 'Modern' } });
    fireEvent.click(preset('commanderPod'));
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.format'), { target: { value: '4' } });
    expect(preset('commanderPod')).toHaveAccessibleDescription(expect.stringContaining('CreateGameDialog.preset.customised'));
    fireEvent.click(preset('commanderPod'));
    expect(preset('commanderPod')).not.toHaveAccessibleDescription(expect.stringContaining('CreateGameDialog.preset.customised'));
    create();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ maxPlayers: 4, startingLifeTotal: 40, gameTypeIds: [3] });
  });

  it('blocks an out-of-range seat count even with Advanced collapsed, then reveals and focuses it', () => {
    const { onSubmit } = renderDialog({ isRegistered: true });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.maxPlayers'), { target: { value: '0' } });
    toggleAdvanced();
    expect(screen.queryByLabelText('CreateGameDialog.label.maxPlayers')).not.toBeInTheDocument();
    create();
    expect(onSubmit).not.toHaveBeenCalled();
    const seats = screen.getByLabelText('CreateGameDialog.label.maxPlayers');
    expect(seats).toHaveFocus();
    expect(seats).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('CreateGameDialog.error.range');
    expect(window.localStorage.getItem(CREATE_GAME_DEFAULTS_KEY)).toBeNull();
  });

  it('opens with Advanced expanded and collapses it on demand', () => {
    renderDialog({ isRegistered: true });
    expect(advancedButton()).toHaveAttribute('aria-expanded', 'true');
    expect(advancedButton()).toHaveAccessibleName(expect.not.stringContaining('CreateGameDialog.advanced.hint'));
    expect(screen.getByRole('switch', { name: 'CreateGameDialog.label.spectatorsAllowed' })).toBeInTheDocument();
    toggleAdvanced();
    expect(advancedButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('switch', { name: 'CreateGameDialog.label.spectatorsAllowed' })).not.toBeInTheDocument();
  });

  it('hides "Join as judge" for non-judges', () => {
    renderDialog({ isJudge: false });
    expect(screen.queryByRole('switch', { name: 'CreateGameDialog.label.joinAsJudge' })).not.toBeInTheDocument();
  });

  it('disables spectator sub-options when watching is off', () => {
    renderDialog();
    toggle('spectatorsAllowed');
    expect(screen.getByRole('switch', { name: 'CreateGameDialog.label.spectatorsNeedPassword' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'CreateGameDialog.label.spectatorsCanTalk' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'CreateGameDialog.label.spectatorsSeeEverything' })).toBeDisabled();
  });

  it('forwards description, password, seats, life and format edits', () => {
    const { onSubmit } = renderDialog({ gametypeMap: { 0: 'Constructed', 1: 'Limited' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.description'), { target: { value: 'Friday night' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.password'), { target: { value: 'secret' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.format'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.maxPlayers'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.startingLifeTotal'), { target: { value: '30' } });
    create();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      description: 'Friday night',
      password: 'secret',
      maxPlayers: 4,
      startingLifeTotal: 30,
      gameTypeIds: [1],
    });
  });

  it('toggles every Advanced switch and forwards them on Create', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, isJudge: true });
    ['onlyBuddies', 'onlyRegistered', 'shareDecklistsOnLoad', 'joinAsSpectator', 'joinAsJudge',
      'spectatorsCanTalk', 'spectatorsSeeEverything', 'spectatorsNeedPassword'].forEach(toggle);
    create();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      onlyBuddies: true,
      onlyRegistered: false,
      shareDecklistsOnLoad: true,
      joinAsSpectator: true,
      joinAsJudge: true,
      spectatorsCanTalk: true,
      spectatorsSeeEverything: true,
      spectatorsNeedPassword: true,
    });
  });

  it('remembers the settings for next time, without the password', () => {
    const { onSubmit } = renderDialog({ isRegistered: true, gametypeMap: { 3: 'Commander' } });
    fireEvent.click(preset('commanderPod'));
    fireEvent.change(screen.getByLabelText('CreateGameDialog.label.password'), { target: { value: 'secret' } });
    create();
    expect(onSubmit).toHaveBeenCalled();
    const stored = JSON.parse(window.localStorage.getItem(CREATE_GAME_DEFAULTS_KEY) ?? '{}');
    expect(stored).toMatchObject({ remember: true, gameTypeName: 'Commander', presetId: 'commanderPod', fields: { maxPlayers: 4 } });
    expect(JSON.stringify(stored)).not.toContain('secret');
  });

  it('opens on the remembered preset', () => {
    window.localStorage.setItem(CREATE_GAME_DEFAULTS_KEY, JSON.stringify({
      remember: true,
      gameTypeName: 'Commander',
      fields: {
        description: 'Pod night',
        maxPlayers: 4,
        startingLifeTotal: 40,
        onlyBuddies: false,
        onlyRegistered: true,
        spectatorsAllowed: true,
        spectatorsNeedPassword: false,
        spectatorsCanTalk: false,
        spectatorsSeeEverything: false,
        joinAsSpectator: false,
        shareDecklistsOnLoad: false,
      },
    }));
    renderDialog({ isRegistered: true, gametypeMap: { 3: 'Commander' } });
    expect(preset('commanderPod')).toBeChecked();
    expect(screen.getByLabelText('CreateGameDialog.label.description')).toHaveValue('Pod night');
    expect(screen.getByLabelText('CreateGameDialog.label.format')).toHaveValue('3');
  });

  it('forgets the settings when "Remember as my default" is off', () => {
    renderDialog({ isRegistered: true });
    fireEvent.click(screen.getByRole('checkbox', { name: 'CreateGameDialog.label.remember' }));
    create();
    expect(JSON.parse(window.localStorage.getItem(CREATE_GAME_DEFAULTS_KEY) ?? '{}')).toEqual({ remember: false });
  });

  it('Cancel calls onCancel', () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
