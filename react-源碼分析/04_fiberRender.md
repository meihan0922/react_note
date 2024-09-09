# fiber 的 render 階段：將 react element -> fiber tree

```js
import { createRoot } from "react-dom/client";
import App from "./App";
import * as React from "react";

const root = createRoot(document.getElementById("root"));

root.render(<App />);
```

> `react-debugger/src/react/packages/react-dom/src/client/ReactDOMRoot.js`

```js
ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render =
  // $FlowFixMe[missing-this-annot]
  function (children) {
    const root = this._internalRoot;
    if (root === null) {
      throw new Error("Cannot update an unmounted root.");
    }

    // ...中間驗證略過

    // 通過調用updateContainer，將組件渲染在頁面上
    updateContainer(children, root, null, null);
  };
```

接下來的代碼會遇到 updateQueue，和 lanes 系統。

## updateQueue

react 會把一系列相關的更新寄存在主要的組件的根節點 `fiber.updateQueue` 上面。
所以會經歷

1. 創建 updateQueue
2. 創建單個 update
3. 把單個 update 入隊，掛載到 updateQueue 上面
4. 管理隊列（updates)，添加到 fiber.shared 上
5. 真正開始處理 updateQueue，處理更新隊列

其中 2. ~ 5. 都在 `updateContainer()` 當中發起。

### 1. 創建 updateQueue

在初次渲染時，會調用 fiber.memoizedState 建立 `baseState`，`initializeUpdateQueue()` 初始化 fiber.updateQueue。
，在 `beginWork` 階段，`updateHostRoot` 中使用 `processUpdateQueue` 函式再來具體賦值。

> react-reconciler/src/ReactUpdateQueue.old.js

```ts
// 根據 baseState 和 shared 算出更新後的值
export type UpdateQueue<State> = {|
  baseState: State, // 當前 state，渲染開始前的 state，初始時用 memoizedState 做預設
  shared: SharedQueue<State>, // 本次渲染時要執行的任務
  effects: Array<Update<State>> | null, // 有回調函式的update，更新完畢後會觸發回調

  /**
   * 每次調度都會判斷當前任務是否有足夠的優先級執行，
   * 如果優先級不夠，則重新存儲到鏈表中，用於下次渲染時重新調度
   * 所以在新一次的調度之前會先解決這些遺留的任務，再開始新的任務
   */
  firstBaseUpdate: Update<State> | null,  // 上次渲染時的鏈表頭節點
  lastBaseUpdate: Update<State> | null,   // 上次渲染時的鏈表尾節點
};

// 建立 fiber 節點時，使用來建立 updateQueue，
export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState, // 前一次更新計算出的狀態，算出新的後取而代之
    /**
    每次調度時都會判斷當前任務是否有足夠的優先級來執行，
    如果優先級不夠則重新儲存到鏈表當中，用於下次渲染時重新調度，
    所以我們在新一次調度時，需要先解決這些遺留的任務，然後再開始我們的新任務
    */
   /**
    * 紀錄上次遺留的第一個更新，跟優先級有關，
    */
    firstBaseUpdate: null,
    /**
    * 紀錄上次遺留的最後一個更新，跟優先級有關
    */
    lastBaseUpdate: null,
    // 存放這次準備渲染的新的一系列更新，通過和baseState計算出新的狀態
    shared: {
      pending: null, // 更新操作的循環鏈表
      // 交錯更新
      interleaved: null, // 如果當前處於 render 階段，此時產生的更新都會放在這裡，結束之後會變成 pending queue
      lanes: NoLanes, // pending 鏈表中所有的 lane 合併位運算產生 lanes
    },
    effects: null, //有回調函式的更新，更新完畢後要觸發
  };
  fiber.updateQueue = queue;
}
```

### 2. 創建單個 update

update 的結構

> `packages/react-reconciler/src/ReactFiberClassUpdateQueue.js`

```ts
const update: Update<*> = {
  lane, // 優先級
  /**
   * 執行的操作
   * 包括UpdateState | ReplaceState | ForceUpdate | CaptureUpdate
   * */
  tag: UpdateState,
  /**
   * 更新掛載的數據，不同類型元件掛載的數據不同。
   * 對於ClassComponent，payload 為this.setState的第一個傳參。
   * 對於HostRoot，payload 為ReactDOM.render 的第一個傳參。
   */
  payload: null,
  // 更新的回呼函數，也就是setState 的第二個參數
  callback: null,
  next: null, // next指針，如果同時觸發多個 setState 就會形成多個 update，透過 next 連接
};
```

以下是在 `createRoot(root).render()` 階段產生 update (之後 hooks 更新走的流程不太一樣)

在 updateContainer 中，調用 createUpdate()，把 element 放進 update.payload

> `react-debugger/src/react/packages/react-reconciler/src/ReactFiberReconciler.js`

```js
const update = createUpdate(lane);
// Caution: React DevTools currently depends on this property
// being called "element".
update.payload = { element };
```

> `react-debugger/src/react/packages/react-reconciler/src/ReactFiberClassUpdateQueue.js`

```js
export function createUpdate(lane) {
  const update = {
    lane,

    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
  };
  return update;
}
```

### 3. 把單個 update 入隊，掛載到 updateQueue 上面

在 updateContainer 中，調用 `enqueueUpdate()`

> `react-debugger/src/react/packages/react-reconciler/src/ReactFiberReconciler.js`

```js
const root = enqueueUpdate(current, update, lane);
```

> `react-debugger/src/react/packages/react-reconciler/src/ReactFiberClassUpdateQueue.js`

```js
export function enqueueUpdate(fiber, update, lane) {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return null;
  }
  const sharedQueue = updateQueue.shared;

  // ... 省略

  if (isUnsafeClassRenderPhaseUpdate(fiber)) {
    // ... 省略
  } else {
    return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
  }
}
```

再往下找，會發現實際調用的是 `enqueueConcurrentClassUpdate()`，處理完 update 入隊後，會返回 fiberRoot。

> `react-debugger/src/react/packages/react-reconciler/src/ReactFiberConcurrentUpdates.js`

```js
export function enqueueConcurrentClassUpdate(fiber, queue, update, lane) {
  const concurrentQueue = queue;
  const concurrentUpdate = update;
  // 入隊
  enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane);
  // 返回 fiberRoot
  return getRootForUpdatedFiber(fiber);
}
```

會發現他沒有立刻就把 update 掛載到 fiber 的結構上，怕影響到正在進行的調度渲染。
他以陣列的結構儲存 fiber, queue, update, lane，

```js
// 暫時放入 concurrentQueues
function enqueueUpdate(fiber, queue, update, lane) {
  // Don't update the `childLanes` on the return path yet. If we already in
  // the middle of rendering, wait until after it has completed.
  concurrentQueues[concurrentQueuesIndex++] = fiber;
  concurrentQueues[concurrentQueuesIndex++] = queue;
  concurrentQueues[concurrentQueuesIndex++] = update;
  concurrentQueues[concurrentQueuesIndex++] = lane;

  concurrentlyUpdatedLanes = mergeLanes(concurrentlyUpdatedLanes, lane);

  // ??? 這裡沒有看懂，之後研究優先級 lane 再說
  // The fiber's `lane` field is used in some places to check if any work is
  // scheduled, to perform an eager bailout, so we need to update it immediately.
  // TODO: We should probably move this to the "shared" queue instead.
  fiber.lanes = mergeLanes(fiber.lanes, lane);
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }
}
```

### 4. 管理隊列，添加到 fiber 上

在 updateContainer 中，調用

1. `scheduleUpdateOnFiber()` > 在 root 標記有新的更新、生成調度任務
   1. `ensureRootIsScheduled()` > 傳入根節點註冊一個調度任務，Scheduler 負責處理，進行 fiber 的構造，可以理解為開始 workLoop 循環，生成調度任務
      1. `scheduleTaskForRootDuringMicrotask()` > 只要收到 update 就會調用這個函式，主要做兩件事，1) 確保在 root 的調節當中，2) 確保添加一個微任務
         1. `performConcurrentWorkOnRoot()` > 生成調度任務
            1. `render!!!(這裡才算是 reconciile render 階段開始)` >
               1. `prepareFreshStack()` > 會重置與渲染相關的狀態，比如更新隊列、錯誤邊界等等，確保每次渲染週期都是一個乾淨的狀態開始。並且把 update 掛載上 fiber
                  1. `finishQueueingConcurrentUpdates()` > 是把 `concurrentQueues` 的 update 掛載到 fiber 上

#### scheduleUpdateOnFiber

目的：從下到上更新整個優先級、在 root 標記有新的更新、生成調度任務、並返回更新後的整個 fiber 樹根節點
時機：初次渲染、類組件 setState/forceUpdate、韓式組件 setState 都會調用

```js
export function scheduleUpdateOnFiber(root, fiber, lane) {
  // 省略

  // 在 root 標記有新的更新，合併updateLane到root.pendingLanes
  // 如果 update 是屬於閒置 idle 的，就不處理，直到更高優先的 update 都完成才處理
  markRootUpdated(root, lane);

  if (
    (executionContext & RenderContext) !== NoLanes &&
    root === workInProgressRoot
  ) {
    // 省略
  } else {
    // 省略

    // 生成調度任務
    // 把剛剛 concurrentQueues 的內容掛到 fiber 的 queue 上面，形成單向鏈表，後續根據此更新 DOM
    // 會調用 finishQueueingConcurrentUpdates ，在 render 前後調用，並且由底向上更新 fiber.lanes
    // fiber.updateQueue.shared.pending 指向最後一個 update
    ensureRootIsScheduled(root);

    // 省略
  }
}
```

#### ensureRootIsScheduled

- 時機：每次 FiberRoot 接收到 update 時，都會被調用。
- 目的：註冊調度、生成 fiber。
- 作用：1) 確保在 root 的調節當中，2) 確保添加一個微任務"

```js
export function ensureRootIsScheduled(root) {
  console.log(
    "%censureRootIsScheduled[80]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );
  console.log("註冊調度任務，Scheduler調度，構造 fiber");
  console.log(
    "只要收到 update 就會調用這個函式，主要做兩件事，
  );
  // This function is called whenever a root receives an update. It does two
  // things 1) it ensures the root is in the root schedule, and 2) it ensures
  // there's a pending microtask to process the root schedule.
  //
  // Most of the actual scheduling logic does not happen until
  // `scheduleTaskForRootDuringMicrotask` runs.

  // Add the root to the schedule
  if (root === lastScheduledRoot || root.next !== null) {
    // Fast path. This root is already scheduled.
  } else {
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
    } else {
      lastScheduledRoot.next = root;
      lastScheduledRoot = root;
    }
  }

  // Any time a root received an update, we set this to true until the next time
  // we process the schedule. If it's false, then we can quickly exit flushSync
  // without consulting the schedule.
  mightHavePendingSyncWork = true;
  // At the end of the current event, go through each of the roots and ensure
  // there's a task scheduled for each one at the correct priority.
  if (__DEV__ && ReactCurrentActQueue.current !== null) {
    // 省略
  } else {
    if (!didScheduleMicrotask) {
      didScheduleMicrotask = true;
      scheduleImmediateTask(processRootScheduleInMicrotask);
    }
  }

  if (!enableDeferRootSchedulingToMicrotask) {
    // While this flag is disabled, we schedule the render task immediately
    // instead of waiting a microtask.
    // TODO: We need to land enableDeferRootSchedulingToMicrotask ASAP to
    // unblock additional features we have planned.

    scheduleTaskForRootDuringMicrotask(root, now());
  }
}
```

#### scheduleTaskForRootDuringMicrotask

```js
function scheduleTaskForRootDuringMicrotask(root, currentTime) {
  console.log(
    "%cscheduleTaskForRootDuringMicrotask[294]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );
  // This function is always called inside a microtask, or at the very end of a
  // rendering task right before we yield to the main thread. It should never be
  // called synchronously.
  //
  // TODO: Unless enableDeferRootSchedulingToMicrotask is off. We need to land
  // that ASAP to unblock additional features we have planned.
  //
  // This function also never performs React work synchronously; it should
  // only schedule work to be performed later, in a separate task or microtask.

  // Check if any lanes are being starved by other work. If so, mark them as
  // expired so we know to work on those next.
  console.log("把優先級低但是過期的任務標註為高優先級");
  markStarvedLanesAsExpired(root, currentTime);

  // Determine the next lanes to work on, and their priority.
  const workInProgressRoot = getWorkInProgressRoot();
  const workInProgressRootRenderLanes = getWorkInProgressRootRenderLanes();
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );

  const existingCallbackNode = root.callbackNode;
  if (
    // Check if there's nothing to work on
    nextLanes === NoLanes ||
    // If this root is currently suspended and waiting for data to resolve, don't
    // schedule a task to render it. We'll either wait for a ping, or wait to
    // receive an update.
    //
    // Suspended render phase
    (root === workInProgressRoot && isWorkLoopSuspendedOnData()) ||
    // Suspended commit phase
    root.cancelPendingCommit !== null
  ) {
    // Fast path: There's nothing to work on.
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return NoLane;
  }

  // Schedule a new callback in the host environment.
  if (includesSyncLane(nextLanes)) {
    // Synchronous work is always flushed at the end of the microtask, so we
    // don't need to schedule an additional task.
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackPriority = SyncLane;
    root.callbackNode = null;
    return SyncLane;
  } else {
    // 可中斷任務調用
    // We use the highest priority lane to represent the priority of the callback.
    const existingCallbackPriority = root.callbackPriority;
    const newCallbackPriority = getHighestPriorityLane(nextLanes);

    if (
      newCallbackPriority === existingCallbackPriority &&
      // Special case related to `act`. If the currently scheduled task is a
      // Scheduler task, rather than an `act` task, cancel it and re-schedule
      // on the `act` queue.
      !(
        __DEV__ &&
        ReactCurrentActQueue.current !== null &&
        existingCallbackNode !== fakeActCallbackNode
      )
    ) {
      // The priority hasn't changed. We can reuse the existing task.
      return newCallbackPriority;
    } else {
      // Cancel the existing callback. We'll schedule a new one below.
      cancelCallback(existingCallbackNode);
    }

    let schedulerPriorityLevel;
    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }

    const newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );

    root.callbackPriority = newCallbackPriority;
    root.callbackNode = newCallbackNode;
    return newCallbackPriority;
  }
}
```

#### performConcurrentWorkOnRoot

不管是 `renderRootConcurrent`、`renderRootSync` 都會調用 `prepareFreshStack`

```js
export function performConcurrentWorkOnRoot(root, didTimeout) {
  // 省略
  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    (disableSchedulerTimeoutInWorkLoop || !didTimeout);
  console.log(
    "%cperformConcurrentWorkOnRoot start Render---[870]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes);
  // 省略
}
```

#### prepareFreshStack

react 中會有兩棵樹 `current`、`WorkInProgress`，通過`alternate`指向彼此，但首次調用時，只初始化了`current`。所以需要通過當前的它（還只有根節點）來初始化 `workInProgress`。

會重置與渲染相關的狀態，比如更新隊列、錯誤邊界等等，確保每次渲染週期都是一個乾淨的狀態開始。
並且通過調用 `finishQueueingConcurrentUpdates` 把 update 掛載上 fiber。

> `react-debugger/src/react/packages/react-reconciler/src/ReactFiberWorkLoop.js`

```js
function prepareFreshStack(root, lanes) {
  console.log(
    "%cprepareFreshStack[1487]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    // $FlowFixMe[incompatible-call] Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle);
  }
  const cancelPendingCommit = root.cancelPendingCommit;
  if (cancelPendingCommit !== null) {
    root.cancelPendingCommit = null;
    cancelPendingCommit();
  }

  resetWorkInProgressStack();
  workInProgressRoot = root;
  // 判斷 current.alternate 是否為空，創造新節點或是複製節點屬性掛到節點上
  // 之後把 workInProgress 指針指向初始化出來的根節點
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = renderLanes = lanes;
  workInProgressSuspendedReason = NotSuspended;
  workInProgressThrownValue = null;
  workInProgressRootDidAttachPingListener = false;
  workInProgressRootExitStatus = RootInProgress;
  workInProgressRootFatalError = null;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressRootInterleavedUpdatedLanes = NoLanes;
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
  workInProgressRootPingedLanes = NoLanes;
  workInProgressRootConcurrentErrors = null;
  workInProgressRootRecoverableErrors = null;
  console.log("創造 WorkInProgress", workInProgressRoot);
  finishQueueingConcurrentUpdates();

  if (__DEV__) {
    ReactStrictModeWarnings.discardPendingWarnings();
  }

  return rootWorkInProgress;
}
```

#### finishQueueingConcurrentUpdates

時機：在 render 階段，在一開始和結束時，都會調用。
目的：是把 `concurrentQueues` 的 update 掛載到 fiber 上。

> react-debugger/src/react/packages/react-reconciler/src/ReactFiberWorkLoop.js

```js
export function finishQueueingConcurrentUpdates() {
  console.log(
    "%cfinishQueueingConcurrentUpdates[34]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );
  console.log(
    "把 concurrentQueues 的內容掛載到 fiber.queue.pending上面，形成單向鏈表"
  );
  const endIndex = concurrentQueuesIndex;
  concurrentQueuesIndex = 0;

  concurrentlyUpdatedLanes = NoLanes;

  let i = 0;
  while (i < endIndex) {
    const fiber = concurrentQueues[i];
    concurrentQueues[i++] = null;
    const queue = concurrentQueues[i];
    concurrentQueues[i++] = null;
    const update = concurrentQueues[i];
    concurrentQueues[i++] = null;
    const lane = concurrentQueues[i];
    concurrentQueues[i++] = null;

    if (queue !== null && update !== null) {
      // 指向 shared.queue
      const pending = queue.pending;
      if (pending === null) {
        // This is the first update. Create a circular list.
        // 第一個節點
        update.next = update;
      } else {
        // 把舊的 pending.next 接在新的 update.next 後面
        update.next = pending.next;
        // 再把 pending.next 接回 update，構成環形鏈表
        pending.next = update;
      }
      // 最後把 pending 指向最新的 update，最尾部的更新
      queue.pending = update;
    }

    if (lane !== NoLane) {
      console.log(
        "自底向上更新整個優先級，從 fiber 開始，直到根節點，mergeLanes update lane，掛到 childLanes 上"
      );
      markUpdateLaneFromFiberToRoot(fiber, update, lane);
    }
  }
}
```

### 5. 真正開始處理 updateQueue

接續剛剛 4-5. `render!!!(這裡才算是 reconciile render 階段開始)內部繼續調用` >

#### render -> workLoop

performUnitOfWork 和 completeUnitOfWork 合作完成了一個深度優先搜尋的邏輯，遍歷了整個 DOM 樹，產生了 Fiber 樹

- `renderRootConcurrent` -> `workLoopConcurrent`
- `workLoopSync` -> `workLoopSync`
  只差在可不可以中斷，調用 `Scheduler` 的 `shouldYield`

```js
function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    // $FlowFixMe[incompatible-call] found when upgrading Flow
    performUnitOfWork(workInProgress);
  }
}
function workLoopSync() {
  // Perform work without checking if we need to yield between fiber.
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}
```

1. `workLoop!!!` > while 循環調用每個 fiber 節點
   1. `performUnitOfWork()`
      1. `beginWork()` >
         1. `updateHostRoot()` > 處理節點上的 updateQueue
         2. `processUpdateQueue()` > workInProgress.memoizedState = newState;
      2. `completeUnitOfWork()` > 實現深度優先遍歷

#### performUnitOfWork 傳入剛初始化的 workInProgress 樹

```js
function performUnitOfWork(unitOfWork) {
  console.log(
    "%cperformUnitOfWork[2219]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );

  // The current, flushed, state of this fiber is the alternate. Ideally
  // nothing should rely on this, but relying on it here means that we don't
  // need an additional field on the work in progress.
  // unitOfWork: workInProgress 樹，他的 alternate 指向的是 current 樹
  const current = unitOfWork.alternate;
  setCurrentDebugFiberInDEV(unitOfWork);

  // 遍歷整個 element 得到下一個節點，第一次調用車是傳入 element 的根節點
  let next;
  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {
    startProfilerTimer(unitOfWork);
    // 創建 fiber 節點，更新 兩棵樹
    next = beginWork(current, unitOfWork, renderLanes);
    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  } else {
    next = beginWork(current, unitOfWork, renderLanes);
  }

  resetCurrentDebugFiberInDEV();
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  // 如果沒有下一個節點了，遍歷結束了，就結束整個流程，否則將 workInProgress 樹更新為剛剛建立的那個節點
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    // 沒有子節點的話，就 completeUnitOfWork
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }

  ReactCurrentOwner.current = null;
}
```

#### processUpdateQueue

- 時機：會在 `updateHostRoot`、`updateClassComponent` 被調用到。
- 主要的流程：
  1. 檢查是否有 pending update(掛載中的)
     1. 如果有轉移到 baseQueue(上次遺留下來的 update)
     2. 因為是循環鏈表，所以要斷開才能方入單向循環鏈表中
  2. 遍歷 queue，根據 updates 計算出最後的結果，workInProgress.memoizedState = newState;

```js
newState = getStateFromUpdate(
  workInProgress,
  queue,
  update,
  newState,
  props,
  instance
);
```

```js
export function processUpdateQueue(
  workInProgress,
  props,
  instance,
  renderLanes
) {
  console.log(
    "%cprocessUpdateQueue[436]",
    "color: #FFFFFF; font-size: 14px; background: #333333;"
  );
  console.log("處理pending update，把他們轉移到 baseQueue");
  console.log(
    "pending update是單向循環鏈表，firstBaseUpdate, lastBaseUpdate 不是"
  );
  // This is always non-null on a ClassComponent or HostRoot
  const queue = workInProgress.updateQueue;

  hasForceUpdate = false;

  if (__DEV__) {
    currentlyProcessingQueue = queue.shared;
  }

  // 獲取上次還沒渲染（但已經處理完的）的隊列
  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;

  // Check if there are pending updates. If so, transfer them to the base queue.
  // ! 獲取當前的隊列，pending 是循環鏈表
  let pendingQueue = queue.shared.pending;
  // 有 update
  if (pendingQueue !== null) {
    queue.shared.pending = null;

    // The pending queue is circular. Disconnect the pointer between first
    // and last so that it's non-circular.
    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;
    // ! 先將循環鏈表斷開，將 `firstBaseUpdate` 和 `lastBaseUpdate` 構成的隊列拼接到 queue 前，最後構成一個大的單向鏈表 updateQueue
    lastPendingUpdate.next = null;
    // Append pending updates to base queue
    // 如果尾隊列是空，表示整個隊列都是空的，把新的當前隊列塞入
    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate;
    } else {
      // 把新的隊列放入尾節點的後面，拼接起來
      lastBaseUpdate.next = firstPendingUpdate;
    }
    // 指向到最末端
    lastBaseUpdate = lastPendingUpdate;

    // If there's a current queue, and it's different from the base queue, then
    // we need to transfer the updates to that queue, too. Because the base
    // queue is a singly-linked list with no cycles, we can append to both
    // lists and take advantage of structural sharing.
    // TODO: Pass `current` as argument
    const current = workInProgress.alternate;
    // 如果兩棵樹對應的節點已經存在的話
    if (current !== null) {
      // This is always non-null on a ClassComponent or HostRoot
      const currentQueue = current.updateQueue;
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
      // 如果當前的樹的更新鏈表最後的節點比對 新的樹的尾節點 不一樣，則將新的鏈表拼接到當前的樹中
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
  }

  // These values may change as we process the queue.
  // 遍歷 queue
  if (firstBaseUpdate !== null) {
    // Iterate through the list of updates to compute the result.
    let newState = queue.baseState;
    // TODO: Don't need to accumulate this. Instead, we can remove renderLanes
    // from the original lanes.
    let newLanes = NoLanes;

    let newBaseState = null;
    let newFirstBaseUpdate = null;
    let newLastBaseUpdate = null;

    let update = firstBaseUpdate;
    // 鏈表的循環處理，將 workInProgress 節點中的 queue 同步到 current 節點
    do {
      // An extra OffscreenLane bit is added to updates that were made to
      // a hidden tree, so that we can distinguish them from updates that were
      // already there when the tree was hidden.
      const updateLane = removeLanes(update.lane, OffscreenLane);
      const isHiddenUpdate = updateLane !== update.lane;

      // Check if this update was made while the tree was hidden. If so, then
      // it's not a "base" update and we should disregard the extra base lanes
      // that were added to renderLanes when we entered the Offscreen tree.
      const shouldSkipUpdate = isHiddenUpdate
        ? !isSubsetOfLanes(getWorkInProgressRootRenderLanes(), updateLane)
        : !isSubsetOfLanes(renderLanes, updateLane);

      if (shouldSkipUpdate) {
        // 判斷當前的 update lane 滿足更新優先級條件嗎？否，則把 update 存起來
        // Priority is insufficient. Skip this update. If this is the first
        // skipped update, the previous update/state is the new base
        // update/state.
        const clone = {
          lane: updateLane,

          tag: update.tag,
          payload: update.payload,
          callback: update.callback,

          next: null,
        };
        if (newLastBaseUpdate === null) {
          newFirstBaseUpdate = newLastBaseUpdate = clone;
          // 有 update 延遲了，把 state 保存起來
          newBaseState = newState;
        } else {
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }
        // Update the remaining priority in the queue.
        // 更新 lane， 他下次遍歷到時才能執行
        newLanes = mergeLanes(newLanes, updateLane);
      } else {
        // This update does have sufficient priority.

        if (newLastBaseUpdate !== null) {
          // 如果前面有 update 被延遲了，後面所有任務都必須進入到被延遲的隊列中
          const clone = {
            // This update is going to be committed so we never want uncommit
            // it. Using NoLane works because 0 is a subset of all bitmasks, so
            // this will never be skipped by the check above.
            lane: NoLane,

            tag: update.tag,
            payload: update.payload,

            // When this update is rebased, we should not fire its
            // callback again.
            callback: null,

            next: null,
          };
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }

        console.log("遍歷 queue，根據update計算出最後結果newState");
        // Process this update.
        newState = getStateFromUpdate(
          workInProgress,
          queue,
          update,
          newState,
          props,
          instance
        );
        const callback = update.callback;
        if (callback !== null) {
          // 標記當前 fiber 有 callback
          workInProgress.flags |= Callback;
          if (isHiddenUpdate) {
            workInProgress.flags |= Visibility;
          }
          // 有 callback 先儲存，後執行
          const callbacks = queue.callbacks;
          if (callbacks === null) {
            queue.callbacks = [callback];
          } else {
            callbacks.push(callback);
          }
        }
      }
      // $FlowFixMe[incompatible-type] we bail out when we get a null
      // 指向下個
      update = update.next;
      // 到達尾節點
      if (update === null) {
        pendingQueue = queue.shared.pending;
        // 又有新的 update
        if (pendingQueue === null) {
          break;
        } else {
          // 當前的 queue 處理完後，queue.shared.pending可能會有新的更新，如果有就把新的放進來繼續處理
          // An update was scheduled from inside a reducer. Add the new
          // pending updates to the end of the list and keep processing.
          const lastPendingUpdate = pendingQueue;
          // Intentionally unsound. Pending updates form a circular list, but we
          // unravel them when transferring them to the base queue.
          const firstPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = null;
          update = firstPendingUpdate;
          queue.lastBaseUpdate = lastPendingUpdate;
          queue.shared.pending = null;
        }
      }
    } while (true);

    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = newBaseState;
    // 保存延遲的 update
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;

    if (firstBaseUpdate === null) {
      // 當多個 transitions 在同個 queue 中，只允許最近一個完成，不應顯示中間的狀態，當queue為空，將 lanes = NoLanes
      // `queue.lanes` is used for entangling transitions. We can set it back to
      // zero once the queue is empty.
      queue.shared.lanes = NoLanes;
    }

    // Set the remaining expiration time to be whatever is remaining in the queue.
    // This should be fine because the only two other things that contribute to
    // expiration time are props and context. We're already in the middle of the
    // begin phase by the time we start processing the queue, so we've already
    // dealt with the props. Context in components that specify
    // shouldComponentUpdate is tricky; but we'll have to account for
    // that regardless.
    // 把跳過的 update 記錄下來
    markSkippedUpdateLanes(newLanes);
    workInProgress.lanes = newLanes;
    console.log("把newState掛到workInProgress.memoizedState");
    // 掛載 element 到 memoizedState 上
    workInProgress.memoizedState = newState;
  }

  if (__DEV__) {
    currentlyProcessingQueue = null;
  }
}
```

#### completeUnitOfWork

深度優先遍歷

```js
function completeUnitOfWork(unitOfWork) {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  let completedWork = unitOfWork;
  do {
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    const current = completedWork.alternate;
    const returnFiber = completedWork.return; // 父節點
    // 省略
    let next;
    // 省略
    if (next !== null) {
      // Completing this fiber spawned new work. Work on that next.
      workInProgress = next;
      return;
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      // 返回兄弟節點
      // If there is more work to do in this returnFiber, do that next.
      workInProgress = siblingFiber;
      return;
    }
    // Otherwise, return to the parent
    // $FlowFixMe[incompatible-type] we bail out when we get a null
    // 返回父節點
    completedWork = returnFiber;
    // Update the next thing we're working on in case something throws.
    workInProgress = completedWork;
  } while (completedWork !== null);

  // We've reached the root.
  // 遍歷結束，標記遍歷完成
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}
```
