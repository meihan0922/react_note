# 鏈表

一種數據結構，每個物件上會存儲指針，指向下一個數據，因為不用按照順序儲存，所以在插入時複雜度只需要 `O(1)`，但查找需要`O(n)`。
如果有指針指向上一個數據，則是雙向鏈表。
最後一個指針指向空值。
如果最後一個鏈表數據指針指向第一個，則是循環鏈表。

```js
function Node(name) {
  this.name = name;
  this.next = null;
}
function LinkedList() {
  // 定義起始鏈表
  this.head = new Node("head");

  this.findPrevious = function (node) {
    let currentNode = this.head;
    // 一直找下一個，直到currentNode的下一個就是 node，那 currentNode 就是 node 的上一個
    while (currentNode && currentNode.next !== node) {
      currentNode = currentNode.next;
    }
    return currentNode;
  };
  this.insert = function (name, insertPlaceNode) {
    // 要插在 insertPlaceNode 之後，所以 insertPlaceNode.next 要指向新節點，新節點要指向原先的 insertPlaceNode.next
    const newNode = new Node(name);
    newNode.next = insertPlaceNode.next;
    insertPlaceNode.next = newNode;
  };
  this.remove = function (node) {
    // 要移除節點，先找到前一個節點，把他的 next 轉移給 node.next即可
    const previousNode = this.findPrevious();
    if (previousNode) {
      previousNode.next = node.next;
    }
  };
  this.reverse = function (node) {
    let prev = null;
    let current = this.head;
    while (current) {
      const nextNode = current.next;
      current.next = prev;
      prev = current;
      current = nextNode;
    }
    this.head = current;
  };
}
```

#### React 中採用鏈表

UpdateQueue：儲存即將更新的狀態，他的內容元素是 update 物件，shared 中就是循換鏈表，baseQueue 是單向鏈表。

- 為什麼要採用鏈表？
  1. 高效的插入和刪除操作
  2. 維持更新的順序，也方便批量更新，不會受到固定大小或順序限制
  3. 之廚中間狀態和替換
