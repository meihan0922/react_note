function combineReducers(obj) {
  // 檢查
  Object.values(obj).forEach((reducer) => {
    // 每個 reducer 都是 function
    if (typeof reducer !== "function")
      throw new Error(`"${key}" : reducer 必須是 function`);

    // 假設初始的 action Type = INIT
    const initialState = reducer(undefined, { type: "INIT" });
    if (initialState === undefined) {
      throw new Error(`"${key}"初始化失敗：reducer 不得回傳 undefined`);
    }
  });

  return function (state, action) {
    return Object.entries(obj).reduce((acc, [key, reducer]) => {
      const originSingleState = state[key];

      // 執行 reducer
      const newStateWithKey = reducer(originSingleState, action);
      if (newStateWithKey === undefined) {
        throw new Error(`"${key}" action 錯誤：reducer 回傳 undefined`);
      }
      acc[key] = newStateWithKey;
      return acc;
    }, {});
  };
}
