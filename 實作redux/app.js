import { applyMiddleware } from "./applyMiddleware.js";
import { createStore } from "./createStore.js";
import { catchErrMiddleware, loggerMiddleware } from "./Middlewares";

const pointsReducer = (state = preloadedState.points, action) => {
  switch (action.type) {
    case "PLUS_POINTS":
      return state.points + action.payload;
    case "MINUS_POINTS":
      return state.points - action.payload;
    default:
      return state;
  }
};

// userReducer 規範 user 的更新
const userReducer = (state = preloadedState.user, action) => {
  switch (action.type) {
    case "UPDATE_NAME":
      return {
        ...state,
        name: action.name,
      };
    case "UPDATE_AGE":
      return {
        ...state,
        age: action.age,
      };
    default:
      return state;
  }
};

const defaultState = {
  points: 0,
  user: {
    name: "mmmm",
    age: 18,
  },
};
document.getElementById("point").textContent = defaultState.points;

const reducer = combineReducers({
  points: pointsReducer,
  user: userReducer,
});
const enhancer = applyMiddleware([loggerMiddleware, catchErrMiddleware]);
const store = createStore(defaultState, reducer, enhancer);

document.getElementById("plus").addEventListener("click", () => {
  store.dispatch({
    type: "PLUS_POINTS",
    payload: 100,
  });
});

document.getElementById("minus").addEventListener("click", () => {
  store.dispatch({
    type: "MINUS_POINTS",
    payload: 100,
  });
});

store.subscribe(() => {
  const points = store.getState().points;
  document.getElementById("point").textContent = points;
});

// 測試 isDispatching
// const unsbscribe1 = store.subscribe(() => console.log("unsbscribe1"));
// const unsbscribe2 = store.subscribe(() => {
//   unsbscribe1();
//   console.log("unsbscribe2");
//   const unsbscribe3 = store.subscribe(() => console.log("unsbscribe3"));
// });
