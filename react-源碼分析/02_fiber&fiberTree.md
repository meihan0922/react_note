# fiber

> https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactInternalTypes.js

```ts
export type Fiber = {
  // -----dom相關
  // 0-29 的數值，表示不同的類型 ex: 0-函數組件 1類組件 3當前掛載點會用到 fiber 對象
  // 源碼位置：https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactWorkTags.js
  tag: WorkTag,

  // Unique identifier of this child.
  key: null | string,

  // The value of element.type which is used to preserve the identity during
  // reconciliation of this child.
  elementType: any,

  // 組件類型 div, span, 構造函數等等
  type: any,

  // 實例對象，類組件實例對象或原生dom實例，但 函式組件沒有實例，所以是 null
  stateNode: any,


 // -----構建 fiber tree 相關
  // 指向父級
  return: Fiber | null,

  // Singly Linked List Tree Structure.
  // 指向第一個子節點
  child: Fiber | null,
  // 指向兄弟節點
  sibling: Fiber | null,
  index: number,

  /**
   * 是用於雙緩衝樹這個結構
   * 在更新的過程中，會產生兩棵樹，
   * - current fiber tree 對應到現行的dom節點
   * - workInProgress fiber tree 是未來準備要更新的節點
   * 各會有一個指針，對應到正在處理 相同位置的 fiber node，
   * current <----> wokInProgress，如果有更新，workInprogress Fiber 樹的alternate 指向Current Fiber樹的對應節點
   * 完成後會交換位置
   *  */
  alternate: Fiber | null,


  // -----狀態數據相關

  // 即將更新的屬性
  pendingProps: any,
  // 舊的屬性
  memoizedProps: any,
  // 舊的狀態
  memoizedState: any,


  // ------和副作用相關的屬性
  // A queue of state updates and callbacks.
  // 每個fiber身上可能還有的更新隊列，是一個循環鏈表
  updateQueue: mixed,
  // Dependencies (contexts, events) for this fiber, if it has any
  dependencies: Dependencies | null,
  lanes: Lanes, // 用來表示執行fiber 任務的優先順序的
  childLanes: Lanes,

  // Effect
  // 副作用的標記
  // 以二進制標記之後要進行什麼 dom 操作，之前的版本叫做 effectTag
  // 比如：插入 更新 刪除 等等
  flags: Flags,
  // 子節點對應的副作用標記，為了性能優化，所以會記子節點
  // 如果子節點標記是 沒有更新，就不用再循環了
  // 子副作用會向上冒泡
  subtreeFlags: Flags,
  deletions: Array<Fiber> | null,

  // 同步或是異步或是嚴格模式
  mode: TypeOfMode,

  // The ref last used to attach this node.
  // I'll avoid adding an owner field for prod and model that as functions.
  ref:
    | null
    | (((handle: mixed) => void) & {_stringRef: ?string, ...})
    | RefObject,

  refCleanup: null | (() => void),



    // ...省略
};

type BaseFiberRootProperties = {|
  // 任務過期時間，如果超過任務時間，react 會強制執行
  expirationTimes: LaneMap<number>,
  // ...省略
|};
```

![16 之前](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTlR4ZuDN6cMBakd0xC5TyaMMb0RGK4ikQdJhCWGu0f9UwXGnkDyjosYCwh1JZuXMdIIHc&usqp=CAU)
React 16 之前是使用 stack reconciler 棧調和器，他最大的缺點是**開始任務後，一切都是同步進行，一旦開始後就無法中斷，diff 操作跟 DOM 更新作業幾乎同時發生，必須等到所有工作完成。如果工作量大，元件樹層級過深，使主執行緒阻塞，用戶的交互得不到響應。**以深度優先需要迭代整棵樹，對於每個節點，react 需要先取得他的子元素列表。這個做法的問題是棧堆，遞歸模式下只能迭代。

![16 之後](https://note.pcwu.net/assets/images/2017-04-03-react-fiber-intro-8aab7.png)
16 之後，將節點都封裝到 fiber 樹的鏈表中，每個 fiber 都有指針指向父子兄弟節點，整個 DOM 樹渲染任務可以被分成小片段。
用一個指針指向目前呼叫的 fiber，結束後指向下一個 fiber，呼叫的堆棧不會長大，他永遠都只會指向目前在操作的節點。暫停任務也可以找到下個節點。
當需要進行渲染時，從根節點開始逐一更新每一個節點，每更新一個 fiber 之後，js 得以檢查是否有優先級更高、需要快速響應的任務（優先順序在 lanes) ，依照優先權判定要中斷 fiber 處理，時間切片任務在執行結束後主動釋放主執行緒給瀏覽器。
fiber 架構當中清楚地被分成兩個階段：

1. render: 負責在內存中渲染組件，diff 找出不同的點，給 fiber 打上不同的記號 flag 來做好標記
2. commit: 遍歷 fiber tree，根據 flag 做對應的 dom 更新操作和其他副作用的操作

所以可中斷是指 render 階段，commit 只能同步執行，基於使用者體驗，用戶需要一次性看到完整的部分。

他把渲染和 DOM 更新進行了分離，一個更新請求造成多個組件的渲染工作變成純計算的任務。之後把這些任務分散到 fiber node 上，fiber node 上存放更新所需要的所有資料，最終根據深度優先遍歷連接起來。再用 while 取代遞歸呼叫、執行 DOM 操作（副作用不份）。

有一個全域變數 `workInProgress`，指向現在執行任務的 fiber node，這也是最小不可分割的工作任務

> 留下的面試題：
> React 的任務是怎麼樣調度的？lanes
> Fiber 樹是怎麼樣產生和更新的？雙緩衝樹和 alternate
> React Element 到 Fiber 的過程發生了什麼事？會處理我們提到的 state 和 props 的部分
