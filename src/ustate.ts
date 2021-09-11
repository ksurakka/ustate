
export type HandlerFuncWithoutParam<TState> = (state:TState, dispatcher: Dispatcher<any>) => TState;
export function isHandlerFuncWithoutParam<TState>(handler: any): handler is HandlerFuncWithoutParam<TState> {
  return typeof handler == 'function' && handler.length==1;
}
export type HandlerFuncWithParam<TState, TParam> = (state:TState, param:TParam, dispatcher: Dispatcher<any>) => TState;
export function isHandlerFuncWithParam<TState>(handler: any): handler is HandlerFuncWithParam<TState, any> {
  return typeof handler == 'function' && handler.length>1;
}
export type HandlerFunc<TState> = HandlerFuncWithParam<TState, any> | HandlerFuncWithoutParam<TState>;

export type StateSelectorWithoutParam<TState, TSelectedState> = (state:TState) => TSelectedState;
export type StateSelectorWithParam<TState, TSelectedState, TParam> = (state:TState, param:TParam) => TSelectedState;
export type StateSelector<TState, TSelectedState> = StateSelectorWithoutParam<TState, TSelectedState> | StateSelectorWithParam<TState, TSelectedState, any>;

export type NestedSelectorWithoutParam<TState, TNestedState> = () => {
  get: (state:TState) => TNestedState;
  update: (state:TState, nestedState:TNestedState) => TState;
}

export type NestedSelectorWithParam<TState, TNestedState, TParam> = (param:TParam) => {
  get: (state:TState) => TNestedState;
  update: (state:TState, nestedState:TNestedState) => TState;
}

export type NestedHandlersWithoutParam<TState, TNestedState, THandlers extends Handlers<TNestedState>> = {
  selector: NestedSelectorWithoutParam<TState, TNestedState>,
  handlers: THandlers
}
export type NestedHandlersWithParam<TState, TNestedState, THandlers extends Handlers<TNestedState>, TParam> = {
  selector: NestedSelectorWithParam<TState, TNestedState, TParam>,
  handlers: THandlers
}
function isNestedHandlersWithoutParam<TState>(handlers:any): handlers is NestedHandlersWithoutParam<TState, any, any> {
  return (handlers as NestedHandlersWithoutParam<TState, any, any>).selector?.length==0;
}
function isNestedHandlersWithParam<TState>(handlers:any): handlers is NestedHandlersWithParam<TState, any, any, any> {
  return (handlers as NestedHandlersWithoutParam<TState, any, any>).selector?.length==1;
}


export type Handlers<TState> = {
  [key:string]: HandlerFunc<TState> | NestedHandlersWithoutParam<TState, any, any> | NestedHandlersWithParam<TState, any, any, any>;
}

export type DispatcherFuncWithParam<TParam> = (param:TParam) => void;
export type DispatcherFuncWithoutParam = () => void;

export type Dispatcher<THandlers> = {
  [key in keyof THandlers]: THandlers[key] extends HandlerFuncWithoutParam<any> ? DispatcherFuncWithoutParam : 
    THandlers[key] extends HandlerFuncWithParam<any, infer TParam> ? DispatcherFuncWithParam<TParam> :
    THandlers[key] extends NestedHandlersWithoutParam<any, any, infer TNestedHandlers> ? Dispatcher<TNestedHandlers> :
    THandlers[key] extends NestedHandlersWithParam<any, any, infer TNestedHandlers, infer TParam> ? (param:TParam) => Dispatcher<TNestedHandlers> :
    never;
};

export type ChangeListenerFunc<TState> = (state:TState, oldState:TState) => void;

export type RemoveListenerFunc = () => void;

export type StateMachine<TState, THandlers> = {
  onChange: (listener:ChangeListenerFunc<TState>) => RemoveListenerFunc;
  getState: () => TState;
  dispatcher: Dispatcher<THandlers>
}

type DispatcherQueue = {
  push: (dispatchFunc:() => void) => void;
}

function createDispatcher<TState, THandlers extends Handlers<TState>>(
  handlers:THandlers,
  getState: () => TState,
  updateState: (newState:TState, oldState:TState) => void,
  queue: DispatcherQueue
): Dispatcher<THandlers> {
  const nestedDispatcherCache:{
    [key:string]: Dispatcher<any>
  } = {};

  const dispatcher:Dispatcher<THandlers> = Object.keys(handlers).reduce((dispatcher, key) => {
    const handler = handlers[key];
    let dispatcherItem:DispatcherFuncWithoutParam | DispatcherFuncWithParam<any> | 
      Dispatcher<any> | undefined = undefined;

    if (isHandlerFuncWithoutParam<TState>(handler)) {
      dispatcherItem = () => {
        queue.push(() => {
          const state = getState();
          const newState = handler(state, dispatcher);
          updateState(newState, state);
        });
      }
    } else if (isHandlerFuncWithParam<TState>(handler)) {
      dispatcherItem = (param:any) => {
        queue.push(() => {
          const state = getState();
          const newState = handler(state, param, dispatcher);
          updateState(newState, state);
        });
      } 
    } else if (isNestedHandlersWithParam(handler)) {
      dispatcherItem = (param:any) => {
        const cacheKey = key+JSON.stringify(param);
        if (!nestedDispatcherCache[cacheKey]) {
          nestedDispatcherCache[cacheKey] = 
            createDispatcher(
              handler.handlers,
              () => {
                const selector = handler.selector(param);
                return selector.get(getState())
              },
              (newNestedState) => {
                const state = getState();
                const selector = handler.selector(param);
                const newState = selector.update(state,newNestedState);
                updateState(newState as any, state)
              },
              queue
            )
        }
        return nestedDispatcherCache[cacheKey];
      };
    } else if (isNestedHandlersWithoutParam(handler)) {
      dispatcherItem = createDispatcher(
        handler.handlers,
        () => {
          const selector = handler.selector();
          return selector.get(getState())
        },
        (newNestedState) => {
          const state = getState();
          const selector = handler.selector();
          const newState = selector.update(state,newNestedState);
          updateState(newState as any, state)
        },
        queue
      );
    }

    return {
      ...dispatcher,
      ...dispatcherItem ? {[key] : dispatcherItem} : {}
    }
  }, {} as Dispatcher<THandlers>); // TODO: tseggaa miten voi alustaa ilman "as"
  return dispatcher as Dispatcher<THandlers>;
}

export function createMachine<TState, THandlers extends Handlers<TState>>(
  initialState:TState, handlers:THandlers): StateMachine<TState, THandlers> {
    let state = {...initialState};

    let executing = false;
    let queuedFuncs:(()=>void)[] = [];
    const queue:DispatcherQueue = {      
      push: (func:() => void) => {
        queuedFuncs.push(func);
        if (!executing) {
          executing = true;          
          while(queuedFuncs.length) {
            const nextFunc = queuedFuncs.shift();
            nextFunc && nextFunc();
          }
          executing = false;
        }
      }
    }
    const dispatcher = createDispatcher(
      handlers, 
      () => state,
      (newState, oldState) => {
        state = newState;
      },
      queue
    );
    return {
      getState: () => state,
      onChange: (listener:ChangeListenerFunc<TState>) => () => undefined,
      dispatcher: dispatcher,
    };
}

// Testing 

type InnerState = {
  age: number;
}

type FooState = {
  name: string;
  inner: InnerState;
  collection: InnerState[];
}

const initialFooState:FooState = {
  name: 'John Doe',
  inner: {
    age: 40
  },
  collection: [
    {
      age: 120
    },
    {
      age: 75
    },
  ]
};

const fooHandlers = {
  add: (state:FooState, text:string):FooState => {
    console.log('add', text)
    return state;
  },
  noParam: (state:FooState):FooState => {
    console.log('noParam');
    return state;
  },
  noParamAndDispatcher: (state:FooState, dispatcher:Dispatcher<any>):FooState => {
    console.log('noParamAndDispatcher');
    return state;
  },
  param: (state:FooState, someVal:number):FooState => {
    console.log('param', someVal);
    return state;
  },
  paramAndDispatcher: (state:FooState, someVal:number, dispatcher:Dispatcher<any>):FooState => {
    console.log('paramAndDispatcher');
    return state;
  },
  myInner: {
    selector: () => ({
      get: (state:FooState) => state.inner,
      update: (state:FooState, inner:InnerState) => ({...state, inner})
    }),
    handlers: {
      increase: (state:InnerState, amount:number):InnerState => {
        return state;
      }
    }
  },
  collection: {
    selector: (index: number) => ({
      get: (state:FooState) => state.collection[index],
      update: (state:FooState, inner:InnerState) => ({...state, collection: state.collection.map((item, idx) => idx==index ? inner : item)})
    }),
    handlers: {
      decrease: (state:InnerState, amount:number):InnerState => {
        return {...state, age: state.age-amount};
      }
    }
  }
}

const m = createMachine(initialFooState, fooHandlers);
const d = m.dispatcher;
// d.paramAndDispatcher(5);
// d.param(14);
// d.noParam();
// d.noParamAndDispatcher();
// d.myInner.increase(45);
// d.collection(1).decrease(12);



// function nested<
//   TState, 
//   TNestedState, 
//   TParam = 'xxx', // this is the trick
//   // StateSelectorWithoutParam<TState, TNestedState> | 
//   // StateSelectorWithParam<TState,TNestedState, TParam>
// >(
//   //selector: ((state:TState) => any) | ((state:TState, p:TParam) => any), 
//   selector: StateSelectorWithoutParam<TState, TNestedState> | StateSelectorWithParam<TState,TNestedState, TParam>
//   // handlers: THandlers
//   ): TParam extends 'xxx' ? number : string
//   //  TStateSelector extends StateSelectorWithParam<TState, TNestedState, infer TSelectorParam> ? number :
//   // TStateSelector extends StateSelectorWithoutParam<TState, TNestedState> ? any : any
// {
//     return 10 as any;
// }
