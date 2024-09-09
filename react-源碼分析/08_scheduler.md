# scheduler

在 README.md 當中可以看到

> This is a package for cooperative scheduling in a browser environment. It is currently used internally by React, but we plan to make it more generic.

> 在瀏覽器環境去實作協作式的調度(cooperative scheduling)

### 什麼是協作式調度?

這個概念主要是來自於作業系統，由於 CPU 資源極為寶貴，為了提高它的使用率，作業系統需要把 CPU 的使用權在同一時間段內分配給多個進程或任務去使用。多進程或任務對 CPU 的使用權的策略，稱為「調度策略」。協作式是其中一種。

#### 協作式調度

- 任務或進程**自願釋放 CPU 控制權**。這意味著任務具有一定的**合作性和自覺性**，只有在**主動讓出** CPU 的情況下，其他任務才能獲得執行機會；
- 由於任務必須自行管理 CPU 時間，協作式調度通常不夠穩定，容易出現問題，例如任務之間的競爭和餓死。

#### 搶佔式調度

- **作業系統身為審判官，具有管理任務執行的權限，可隨時中斷正在執行的任務，並將 CPU 指派給其他任務。**
- 通常會使用**優先權、時間切片**等策略來決定任務執行的順序，高優先權任務會優先執行，而時間切片用於控制任務在 CPU 上執行的時間；
- 可以更好地保證系統的回應性和穩定性，因為它不依賴任務的合作性，如果某個任務陷入無限循環或其他問題，作業系統仍然可以確保其他任務能夠獲得執行機會；

#### 轉換到瀏覽器

CPU 的角色變成主執行緒（UI 執行緒）的控制權。scheduler 套件核心要實現的就是「讓 js 執行一段時間後，**主動**把主執行緒的控制權讓給瀏覽器」。

- 如何把主動地把控制權讓出去呢？
  - setImmediate()
  - MessageChannel
  - setTimeout()
- 執行一段時間？到底執行多久呢？

##### 控制權的轉讓

react 按照使用者的瀏覽器支援度，選擇使用其中一種非同步 api 來實現，將執行任務放入宏任務中

- setImmediate()
- MessageChannel
- setTimeout()

###### 為什麼不是微任務？

微任務會緊接著在另一個微任務中執行，如果其中執行完後又呼叫微任務，event loop 的 call stack 一直被佔用。宏任務才可以實現控制權的轉讓。

###### React 為什麼選擇使用 MessageChannel 來實現類似 requestIdleCallback 的功能，主要是因為以下幾個原因：

1. <u>兼容性和一致性</u>：
   requestIdleCallback 在所有瀏覽器中的支持情況不一樣，特別是在一些舊版瀏覽器或不支持這個 API 的環境下，React 希望能在不同的環境中保持一致的行為。使用 MessageChannel 可以提供更一致的跨瀏覽器行為。

2. <u>精細控制和穩定性</u>：
   **呼叫的間隔不穩定，因特定的裝置效能和目前的瀏覽器任務而異，呼叫的頻率太低了，據說有網友檢查到只有 20 次/每秒**。MessageChannel 和 postMessage 使得 React 可以更精確地控制執行時機，並且在任務調度中提供更高的穩定性。

3. <u>更高的控制權</u>：
   使用 MessageChannel 使得 React 團隊可以完全掌控任務的調度過程。他們可以自行決定如何處理閒置時間，而不需要依賴瀏覽器的實現。這有助於 React 更好地優化性能和用戶體驗。

4. <u>測試和調試</u>：
   自己實現的調度機制可以讓 React 團隊更容易進行測試和調試，特別是在測試不同的瀏覽器和環境下的行為時。

###### 為什麼不能用 setTimeout 來代替 MessageChannel？不是都是呼叫執行宏任務嗎？

- MessageChannel 的執行時機會早於 setTimeout
- setTimeout(fn,0) 所建立的宏任務，會有至少 4ms 的執行時差
- 如果目前環境不支援 MessageChannel 時，會預設使用 setTimeout

###### performWorkUntilDeadline()

瀏覽器和 js 程式交替佔用主執行緒的控制權的這種現象就稱之為「time slicing」。

在源碼當中，會用非同步執行 performWorkUntilDeadline，裡面又會去呼叫 `workLoop`，裡面會 while 執行，直到約定時間（時間切片）到點為止 (在`shouldYieldToHost()`中)，之後就會讓給瀏覽器去執行 layout, paint, composite。

在源碼中可以看到 `shouldYieldToHost()` 裡面的時間切片是 `const frameYieldMs = 5; // 5ms`，
react 團隊根據自己的實踐所獲得的經驗，覺得了預留 11ms 給瀏覽器所取得的介面更新效果比較理想。所以，留給 js 解釋執行的時間就是 16ms - 11ms = 5ms。

> ps. 源碼是使用 performance.now()來計算時間，是因為能表示的時間精度更高，相比於 Date.now()只能精確到 1ms，performance.now()能精確到微秒級別。Date.now()會受到作業系統時鐘或使用者時間調整的影響。
