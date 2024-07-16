import { createStore } from "./createStore.js";

const reducer = (state, action) => {
  switch (action.type) {
    case "PLUS_POINTS":
      return {
        points: state.points + action.payload,
      };
    case "MINUS_POINTS":
      return {
        points: state.points - action.payload,
      };
    default:
      return state;
  }
};

const preloadedState = {
  points: 0,
};

document.getElementById("point").textContent = preloadedState.points;

const store = createStore(preloadedState, reducer);

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
const unsbscribe1 = store.subscribe(() => console.log("unsbscribe1"));
const unsbscribe2 = store.subscribe(() => {
  unsbscribe1();
  console.log("unsbscribe2");
  const unsbscribe3 = store.subscribe(() => console.log("unsbscribe3"));
});
