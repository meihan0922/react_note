const localSetTimeout = typeof setTimeout === "function" ? setTimeout : null;
const localClearTimeout =
  typeof clearTimeout === "function" ? clearTimeout : null;
const localSetImmediate =
  typeof setImmediate !== "undefined" ? setImmediate : null;

let startTime; // 记录开始时间
let sum = 0;
const currentIndex = 0; // 当前遍历的索引
const totalCount = 20000000;

const getCurrentTime = () => Date.now();

// 调度应该被中断吗
function shouldYieldToHost() {
  // 當前時間 - 開始時間 = 從開始到現在經過幾秒，
  const timeElapsed = getCurrentTime() - startTime;
  // 從開始到現在 不到 5ms, 繼續執行調度
  if (timeElapsed < 5) {
    return false;
  }
  return true;
}

const performWorkUntilDeadline = () => {
  startTime = getCurrentTime();
  const hasTimeRemaining = true; // 有剩余时间

  let hasMoreWork = true;
  try {
    // 这里执行的函数就是 flushWork，flushWork 如果返回一个 true 那么表示还有任务
    // 这里的 是 workLoop 循环里 return 的， 如果 return true, 那么表示还有剩余的任务，只是时间用完了，被中断了
    hasMoreWork = flushWork();
  } finally {
    if (hasMoreWork) {
      schedulePerformWorkUntilDeadline();
    } else {
    }
  }
};

let schedulePerformWorkUntilDeadline;
// 還有工作的話，要排入下次調用的時間
// react 中调度的优先级  setImmediate > MessageChannel > setTimeout
if (typeof localSetImmediate === "function") {
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== "undefined") {
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null);
  };
} else {
  schedulePerformWorkUntilDeadline = () => {
    localSetTimeout(performWorkUntilDeadline, 0);
  };
}

const flushWork = () => {
  return workLoop();
};

// 返回是否要繼續執行
// true: 繼續執行
// false: 結束執行
const workLoop = () => {
  while (true) {
    try {
      work();
    } catch (error) {
    } finally {
      if (currentIndex < totalCount) {
        return true;
      } else {
        return false;
      }
    }
  }
};

// 執行任務，如果執行時間小於五秒則繼續調度，
const work = () => {
  for (
    let currentIndex = 0;
    currentIndex < totalCount && !shouldYieldToHost();
    currentIndex++
  ) {
    sum += currentIndex;
  }
};

performWorkUntilDeadline();
