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

test('Dispatcher func with param', () => {
    let callCount = 0;
    const m = ustate.createMachine(
        {
            val: 1
        },
        {
            add: (state:TestState, amount:number) => {
                callCount++;
                return {
                    ...state,
                    val: state.val+amount
                }
            }
        }
    );

    expect(callCount).toBe(0);
    expect(m.getState().val).toBe(1);

    m.dispatcher.add(5);
    
    expect(callCount).toBe(1);
    expect(m.getState().val).toBe(6);
});

test('Nested dispatcher without param', () => {
    type SubState = {
        some: string;   
    }
    type RootState = {
        val: number;
        sub: SubState
    }
    
    let callCount = 0;
    const m = ustate.createMachine(
        {
            val: 1,
            sub: {
                some: 'foo'
            }
        },
        {
            sub: {
                selector: () => ({
                    get: (state:RootState) => state.sub,
                    update: (state:RootState, newSub:SubState) => ({...state, sub:newSub})
                }),
                handlers: {
                    reverse: (state:SubState) => {
                        callCount++;
                        return {
                            ...state,
                            some: state.some.split('').sort(()=>-1).join('')
                        }
                    }
                }
            }
        }
    );

    expect(callCount).toBe(0);
    expect(m.getState().sub.some).toBe('foo');

    m.dispatcher.sub.reverse();

    expect(callCount).toBe(1);
    expect(m.getState().sub.some).toBe('oof');
});

test('Nested dispatcher with param', () => {
    type SubState = {
        some: string;   
    }
    type RootState = {
        val: number;
        subCollection: SubState[]
    }
    
    let callCount = 0;
    const m = ustate.createMachine(
        {
            val: 1,
            subCollection: [{
                some: 'first'
            }, {
                some: 'second'
            }]
        },
        {
            sub: {
                selector: (index:number) => ({
                    get: (state:RootState) => state.subCollection[index],
                    update: (state:RootState, newSub:SubState) => ({...state, subCollection: state.subCollection.map((sub, idx) => idx==index ? newSub : sub)})
                }),
                handlers: {
                    reverse: (state:SubState) => {
                        callCount++;
                        return {
                            ...state,
                            some: state.some.split('').sort(()=>-1).join('')
                        }
                    }
                }
            }
        }
    );

    expect(callCount).toBe(0);
    expect(m.getState().subCollection[1].some).toBe('second');

    m.dispatcher.sub(1).reverse();

    expect(callCount).toBe(1);
    expect(m.getState().subCollection[1].some).toBe('dnoces');
});
