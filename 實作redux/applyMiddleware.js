function compose(...funcs) {
  // 看 FP - compose 的篇章：https://github.com/meihan0922/fp_note/blob/main/02_compose.md
  // let result = (dispatchArgs) => funcs[2](funcs[1](funcs[0](dispatchArgs)));
  return (args) => funcs.reduceRight((acc, cur) => cur(acc), args);
}

export const applyMiddleware =
  (middlewares) => (createStore) => (defaultState, reducers) => {
    const newCreateStore = createStore(defaultState, reducers);
    // middlewares :
    // before ----> (store) => (next) => (action) => {...}
    // after ---->  (next) => (action) => {...}
    const middlewareChain = middlewares.map((i) =>
      // { getState: newCreateStore } 是簡化後的 store，避免 middleware 使用 subscribe
      i({ getState: newCreateStore })
    );
    // 要不斷不斷的包裝 dispatch，
    // 每個 middleware 目前長這樣 ---->  (next) => (action) => {...}
    // 要把 dispatch 改成這樣 -----> (dispatchArgs) => middleware1(middleware2(middleware3(dispatchArgs)));
    // middleware3(dispatchArgs) 作為 middleware2 的 next fn 參數，一層一層呼叫
    newCreateStore.dispatch = compose(...middlewareChain)(
      newCreateStore.dispatch
    );
    return newCreateStore;
  };
