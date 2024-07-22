// defaultState: 初始化狀態
function createStore(defaultState, reducers, enhancer) {
  if (enhancer) {
    // 修改 dispatch ，讓他包裹 middlewares
    const newCreateStore = enhancer(createStore);
    return newCreateStore(reducers, enhancer);
  }
  let currentState = defaultState,
    /** 所有放入 listener 的 id */
    listenIdCounter = 0,
    /** 用 map 來紀錄放入的 listener，都是獨一無二的 */
    currentListeners = new Map(),
    /* flag 去記是否在執行 reducer 中，要避免其他可以觸碰到 currentState 改變的時候（避免副作用
     * getState: 回傳 State 給使用者，可能意外修改
     * dispatch: 避免再度觸發同個 action 事件
     */
    isDispatching = false;

  function getState() {
    if (isDispatching)
      throw Error(
        "isDispatching，不能執行直接讀取 state，如果想要拿到 state 請用 reducer"
      );

    return currentState;
  }

  function dispatch(actions) {
    if (isDispatching) throw Error("isDispatching，reducers 不能執行 actions");

    try {
      isDispatching = true;
      const newState = reducers(currentState, actions);
      currentState = newState;
    } finally {
      isDispatching = false;
    }
    currentListeners.forEach((l) => l());
  }

  function subscribe(listeners) {
    const newListenerId = listenIdCounter++;
    currentListeners.set(newListenerId, listeners);

    return () => currentListeners.delete(newListenerId);
  }

  return { getState, dispatch, subscribe };
}
export { createStore };
