
export type HandlerFuncWithParam<TState, TParam> = (state:TState, param:TParam, dispatcher: Dispatcher<any>) => TState;
export type HandlerFuncWithoutParam<TState> = (state:TState, dispatcher: Dispatcher<any>) => TState;
export type HandlerFunc<TState> = HandlerFuncWithParam<TState, any> | HandlerFuncWithoutParam<TState>;

export type StateSelectorWithParam<TState, TSelectedState, TParam> = (state:TState, param:TParam) => TSelectedState;
export type StateSelectorWithoutParam<TState, TSelectedState> = (state:TState) => TSelectedState;
export type StateSelector<TState, TSelectedState> = StateSelectorWithoutParam<TState, TSelectedState> | StateSelectorWithParam<TState, TSelectedState, any>;

export type NestedSelectorWithoutParam<TState, TNestedState> = () => {
  get: (state:TState) => TNestedState;
  update: (state:TState, nestedState:TNestedState) => TState;
}

export type NestedSelectorWithParam<TState, TNestedState, TParam> = (param:TParam) => {
  get: (state:TState) => TNestedState;
  update: (state:TState, nestedState:TNestedState) => TState;
}

export type NestedHandlers<TState, TNestedState, THandlers extends Handlers<TNestedState>> = {
  selector: NestedSelectorWithoutParam<TState, TNestedState>,
  handlers: THandlers
}

export type NestedHandlersParametrized<TState, TNestedState, THandlers extends Handlers<TNestedState>, TParam> = {
  selector: NestedSelectorWithParam<TState, TNestedState, TParam>,
  handlers: THandlers
}

export type Handlers<TState> = {
  [key:string]: HandlerFunc<TState> | NestedHandlers<TState, any, any> | NestedHandlersParametrized<TState, any, any, any>;
}

export type DispatcherFuncWithParam<TParam> = (param:TParam) => void;
export type DispatcherFuncWithoutParam = () => void;

export type Dispatcher<THandlers> = {
  [key in keyof THandlers]: THandlers[key] extends HandlerFuncWithoutParam<any> ? DispatcherFuncWithoutParam : 
    THandlers[key] extends HandlerFuncWithParam<any, infer TParam> ? DispatcherFuncWithParam<TParam> :
    THandlers[key] extends NestedHandlers<any, any, infer TNestedHandlers> ? Dispatcher<TNestedHandlers> :
    THandlers[key] extends NestedHandlersParametrized<any, any, infer TNestedHandlers, infer TParam> ? (param:TParam) => Dispatcher<TNestedHandlers> :
    never;
}

export type ChangeListenerFunc<TState> = (state:TState, oldState:TState) => void;

export type RemoveListenerFunc = () => void;

export type StateMachine<TState, THandlers> = {
  onChange: (listener:ChangeListenerFunc<TState>) => RemoveListenerFunc;
  getState: () => TState;
  dispatcher: Dispatcher<THandlers>
}

export function createMachine<TState, THandlers extends Handlers<TState>>(
  initialState:TState, handlers:THandlers): StateMachine<TState, THandlers> {
    return {} as StateMachine<TState, THandlers>;
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
d.paramAndDispatcher(5);
d.param(14);
d.noParam();
d.noParamAndDispatcher();
d.myInner.increase(45);
d.collection(1).decrease(12);



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
