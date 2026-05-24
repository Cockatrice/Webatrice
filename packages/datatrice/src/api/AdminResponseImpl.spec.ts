import { createStore } from '../store/createStore';
import { Actions as ServerActions } from '../store/server/server.actions';
import { AdminResponseImpl } from './AdminResponseImpl';

function setup() {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  return { impl: new AdminResponseImpl(store), dispatch };
}

describe('AdminResponseImpl', () => {
  it('adjustMod dispatches the adjustMod action', () => {
    const { impl, dispatch } = setup();
    impl.adjustMod('alice', true, false);
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.adjustMod({ userName: 'alice', shouldBeMod: true, shouldBeJudge: false }),
    );
  });

  it('reloadConfig dispatches the reloadConfig action', () => {
    const { impl, dispatch } = setup();
    impl.reloadConfig();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.reloadConfig());
  });

  it('shutdownServer dispatches the shutdownServer action', () => {
    const { impl, dispatch } = setup();
    impl.shutdownServer();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.shutdownServer());
  });

  it('updateServerMessage dispatches the updateServerMessage action', () => {
    const { impl, dispatch } = setup();
    impl.updateServerMessage();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateServerMessage());
  });
});
