import * as ustate from '../src/ustate';

type TestState = {
    val: number;
}

test('Dispatcher func without param', () => {
    let callCount = 0;
    const m = ustate.createMachine(
        {
            val: 1
        },
        {
            add: (state:TestState) => {
                callCount++;
                return {
                    ...state,
                    val: state.val+1
                }
            }
        }
    );

    expect(callCount).toBe(0);
    expect(m.getState().val).toBe(1);

    m.dispatcher.add();
    
    expect(callCount).toBe(1);
    expect(m.getState().val).toBe(2);
});
  