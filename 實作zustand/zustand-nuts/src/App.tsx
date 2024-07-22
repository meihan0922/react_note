import { memo } from "react";
import useBearStore from "./store/useBearStore";

function App() {
  const { bears, count, increase, decrease, reset, increaseCount } =
    useBearStore();

  return (
    <>
      <div>
        <h3>BearsPage</h3>

        <button onClick={() => increase()}>increase {bears}</button>
        <button onClick={() => decrease()}>decrease {bears}</button>
        <button onClick={reset}>reset</button>
        <button onClick={() => increaseCount()}>count: {count}</button>
      </div>
      <Child />
    </>
  );
}

const Child = memo(() => {
  const bears = useBearStore(
    (state) => state.bears,
    (a, b) => a === b
  );

  console.log("child");

  return (
    <div>
      <h3>Child</h3>
      <p>{bears}</p>
    </div>
  );
});
export default App;
