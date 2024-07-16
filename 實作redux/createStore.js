// preloadedState: 初始化狀態
function createStore(preloadedState, reducers) {
  let currentState = preloadedState,
    /** 所有放入 listener 的 id */
    listenIdCounter = 0,
    /** 用 map 來紀錄放入的 listener，都是獨一無二的 */
    currentListeners = new Map(),

  function getState() {

    return currentState;
  }

  function dispatch(actions) {
    const newState = reducers(currentState, actions);
    currentState = newState;
    currentListeners.forEach((l) => l());
  }

  function subscribe(listeners) {
    const newListenerId = listenIdCounter++;
    currentListeners.set(newListenerId, listeners);
    return () => {
      currentListeners.delete(newListenerId);
    };
  }

  return { getState, dispatch, subscribe };
}
export { createStore };
