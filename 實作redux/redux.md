# 實作 Redux

基於函數式編程思想，集中式管理狀態、單向資料流

- 單一數據源：共用**唯一的** Store
- Store 是**只讀的**：唯一改變的方法是 dispatch action
- 使用純函數修改

![这是图片](./assets/redux-flow.png)

#### start

1.  創建 store，參數為 defaultStore、reducer、enhencer，回傳 getState、dispatch、subscribe

    1. reducer init，定義修改 store 的規則
    2. getState (getter)：取當前 store
    3. dispatch (setter)：傳入 action 修改 store
    4. subscribe，定義訂閱 store 要做的事情：
       - 傳入 callback 在 store 更新時回調。回傳“取消訂閱的 callback”。
       - 用 Map 來紀錄“傳入的 callback”。
       - 注意回調時，不應操作 store 本身。
         </br>

    ```js
    function createStore(defaultState, reducers, enhancer) {
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
        if (isDispatching)
          throw Error("isDispatching，reducers 不能執行 actions");

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
    ```

2.  middlewares，他的功能是擴充 dispatch，在 dispatch 執行前後增加功能，所以要==封裝一個新的 dispatch 取代原本的 dispatch==。

    1. 使用 middleware 的方式是 `(store) => (dispatch) => (action) => {...實際要做的內容}`，這是因為 middleware 只能使用 getState，不能使用 subscribe，所以他的 store 要單獨參數
       </br>

    ```js
    export const loggerMiddleware = (store) => (next) => (action) => {
      console.log(store.getState());
      next(action);
      console.log(store.getState());
    };
    ```

    ```js
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
        // after ----> (next) => (action) => {...}
        const middlewareChain = middlewares.map((i) =>
          // { getState: newCreateStore } 是簡化後的 store，避免 middleware 使用 subscribe
          i({ getState: newCreateStore })
        );
        // 要不斷不斷的包裝 dispatch，
        // 每個 middleware 目前長這樣 ----> (next) => (action) => {...}
        // 要把 dispatch 改成這樣 -----> (dispatchArgs) => middleware1(middleware2(middleware3(dispatchArgs)));
        // middleware3(dispatchArgs) 作為 middleware2 的 next fn 參數，一層一層呼叫
        newCreateStore.dispatch = compose(...middlewareChain)(
          newCreateStore.dispatch
        );
        return newCreateStore;
      };
    ```

3.  combineReducers：將多個不同商業邏輯的 reducers，整合成單一 reducer，藉此傳入 createStore 中使用。

    ```js
    const defaultState = {
      points: 0,
      user: {
        name: "Mike",
        age: 18,
      },
    };
    const pointsReducer = (state = preloadedState.points, action) => {
      ...
    };
    const userReducer = (state = preloadedState.user, action) => {
      ...
    };
    // 透過 combineReducers，整合出單一的 reducer
    const reducer = combineReducers({
      points: pointsReducer,
      user: userReducer
    });
    // 創建 store
    const store = createStore(reducer, defaultState);
    ```

    1.  combineReducers 接受一個 reducer 物件，回傳一個函式，參數為 state 和 action，函式內為 呼叫 reducer，回傳新的 state
    2.  檢查每個 reducer 必須是 function，初始化不得為 undefined，執行 reducer 後不得為 undefined

        ```js
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
        ```

---

##### 學習資料

- [理解 Redux 原始碼](https://www.programfarmer.com/articles/2021/redux-make-createStore-getState-dispatch-subscribe)
- [redux 中間件問題](https://juejin.cn/post/7127975245998194695?searchId=202407221255130474ABC14E6A6F09014F#heading-4)
