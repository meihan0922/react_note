# 01_createReactElement

createElement, jsx

在 `/react-debugger/vite.config.js`，可以看到 v16, v17 版本間的差異。
官網中[介紹全新的 JSX 轉換](https://zh-hans.legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html)，有指出大多數 React 開發者需依靠 Babel 或 TypeScript 來將 JSX 程式碼轉換為 JavaScript。
使用全新的轉換，可以單獨使用 JSX 而無需引入 React。根據你的配置，JSX 的編譯輸出可能會略微改善 bundle 的大小。

```js
// before v16
import React from "react";

const element = (
  <div key="1">
    <span>Hello</span>
    <span>World</span>
  </div>
);

// after babel
import React from "react";

const element = React.createElement(
  "div",
  { key: "1" },
  React.createElement("span", null, "Hello"),
  React.createElement("span", null, "World")
  // React.createElement(type, config, child1, child2, child3...)
);
```

```js
// after v17
const element = (
  <div key="1">
    <span>Hello</span>
    <span>World</span>
  </div>
);

// after babel
// 由编译器引入（禁止自己引入！）

import { jsx as _jsx } from "react/jsx-runtime";
import { jsxs as _jsxs } from "react/jsx-runtime";

/*
 _jsxs(type, config, key);
*/
_jsxs(
  "div",
  {
    children: [
      _jsx("span", {
        children: "Hello",
      }),
      _jsx("span", {
        children: "World",
      }),
    ],
  },
  "1"
);
```

### 看源碼

vite 先設置編譯器

```js
// react-debugger/vite.config.js
// https://vitejs.dev/config/
// 使用不同的 編譯器
export default defineConfig({
  plugins: [
    react({
      // jsxRuntime: "classic", // React.createElement
      jsxRuntime: "automatic", // jsx()
    }),
  ],
});
```

### React.createElement()

> `react-debugger/src/react/packages/react/src/ReactElement.js`

```js
/**
 * 創建 react element
 * @param type 元素類型 ex: div, span, Component
 * @param config 配置屬性，可為 null，包含特殊屬性 key, ref, self, source
 * @param children 子元素 [element] || element，第三個參數後可以無限制地放入 children 作為參數
 *
 * 1. 分離 props 屬性和特殊屬性
 * 2. 將子元素掛到 props 中
 * 3. 為 props 屬性賦默認值 defaultProps
 * 4. 創建並且返回 react element
 */
export function createElement(type, config, children) {
  console.log("createElement", type, config, children);
  // 後面 for in 循環用到的 props key屬性
  // 因為會不斷賦值，寫成 let 用同一變數，省效能
  let propName;

  // Reserved names are extracted
  // 保留舖通的屬性，排除掉 key, ref, self, source
  const props = {};
  // 會提出 key, ref, self, source
  let key = null;
  let ref = null;
  let self = null;
  let source = null;

  if (config != null) {
    // 如果有合法的 ref 屬性，就存在 ref 當中
    if (hasValidRef(config)) {
      ref = config.ref;

      // 在開發環境中
      if (__DEV__) {
        // 如果 ref 被設置成 字串，提示用戶以後會被移除
        warnIfStringRefCannotBeAutoConverted(config);
      }
    }
    // 如果有合法的 key
    if (hasValidKey(config)) {
      if (__DEV__) {
        // 會強制轉型的話要跳提示
        checkKeyStringCoercion(config.key);
      }
      // 一定要是字串類型
      key = "" + config.key;
    }

    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    // Remaining properties are added to a new props object
    for (propName in config) {
      // 只遍歷自身的屬性並且排除特殊屬性 key, ref, self, source
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  // createElement 第三個參數後可以無限制地放入 children 作為參數
  const childrenLength = arguments.length - 2; // 剪掉前兩個 type, config
  if (childrenLength === 1) {
    props.children = children; // props.children 只有一個為物件，多個為陣列
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    if (__DEV__) {
      if (Object.freeze) {
        Object.freeze(childArray);
      }
    }
    props.children = childArray;
  }

  // Resolve default props
  // 為 props 屬性賦默認值 defaultProps
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  if (__DEV__) {
    // 不能在內部通過 props 取 key 或 ref 使用
    if (key || ref) {
      const displayName =
        typeof type === "function"
          ? type.displayName || type.name || "Unknown"
          : type;
      if (key) {
        // 定義 key getter，就會報錯誤
        defineKeyPropWarningGetter(props, displayName);
      }
      if (ref) {
        // 定義 ref getter，就會報錯誤
        defineRefPropWarningGetter(props, displayName);
      }
    }
  }
  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props
  );
}
```

### jsx()

> `react-debugger/src/react/packages/react/src/jsx/ReactJSXElement.js`

最大的不同就是 children 放入 config 中，不再需要 for loop 處理再放入 props

```js
/**
 * 創建 react element
 * @param type 元素類型 ex: div, span, Component
 * @param config 配置屬性，可為 null，包含特殊屬性 ref, self, source
 * @param maybeKey key
 * 1. 分離 props 屬性和特殊屬性
 * 2. 為 props 屬性賦默認值 defaultProps
 * 3. 創建並且返回 react element
 * */
export function jsxDEV(type, config, maybeKey, source, self) {
  console.log(
    "react-debugger/src/react/packages/react/src/jsx/ReactJSXElement.js",
    "jsxDEV"
  );
  if (__DEV__) {
    // 後面 for in 循環用到的 props key屬性
    // 因為會不斷賦值，寫成 let 用同一變數，省效能
    let propName;

    // Reserved names are extracted
    const props = {};

    let key = null;
    let ref = null;

    // Currently, key can be spread in as a prop. This causes a potential
    // issue if key is also explicitly declared (ie. <div {...props} key="Hi" />
    // or <div key="Hi" {...props} /> ). We want to deprecate key spread,
    // but as an intermediary step, we will use jsxDEV for everything except
    // <div {...props} key="Hi" />, because we aren't currently able to tell if
    // key is explicitly declared to be undefined or not.
    if (maybeKey !== undefined) {
      if (__DEV__) {
        // 會強制轉型的話要跳提示
        checkKeyStringCoercion(maybeKey);
      }
      key = "" + maybeKey;
    }

    // 如果有合法的 key
    if (hasValidKey(config)) {
      if (__DEV__) {
        // 會強制轉型的話要跳提示
        checkKeyStringCoercion(config.key);
      }
      key = "" + config.key;
    }

    // 如果有合法的 ref 屬性，就存在 ref 當中
    if (hasValidRef(config)) {
      ref = config.ref;
      // 如果 ref 被設置成 字串，提示用戶以後會被移除
      warnIfStringRefCannotBeAutoConverted(config, self);
    }

    // Remaining properties are added to a new props object
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName];
      }
    }

    // Resolve default props
    if (type && type.defaultProps) {
      const defaultProps = type.defaultProps;
      for (propName in defaultProps) {
        if (props[propName] === undefined) {
          props[propName] = defaultProps[propName];
        }
      }
    }

    // 不能在內部通過 props 取 key 或 ref 使用
    if (key || ref) {
      const displayName =
        typeof type === "function"
          ? type.displayName || type.name || "Unknown"
          : type;
      if (key) {
        // 定義 key getter，就會報錯誤
        defineKeyPropWarningGetter(props, displayName);
      }
      if (ref) {
        // 定義 ref getter，就會報錯誤
        defineRefPropWarningGetter(props, displayName);
      }
    }

    return ReactElement(
      type,
      key,
      ref,
      self,
      source,
      ReactCurrentOwner.current,
      props
    );
  }
}
```

### ReactElement()

> `react-debugger/src/react/packages/react/src/ReactElement.js`

```js
/**
 * 最終轉換的 react 對象
 * @param {*} type 元素類型 ex: div, span, Component
 * @param {*} props 排除掉特殊屬性 key, ref, self, source 的 props
 * @param {*} key
 * @param {string|object} ref 對元素實例的引用
 * @param {*} owner 記錄當前元素所屬的組件，是哪個組件創建的
 * @param {*} self A *temporary* helper to detect places where `this` is
 * different from the `owner` when React.createElement is called, so that we
 * can warn. We want to get rid of owner and replace string `ref`s with arrow
 * functions, and as long as `this` and owner are the same, there will be no
 * change in behavior.
 * @param {*} source An annotation object (added by a transpiler or otherwise)
 * indicating filename, line number, and/or other information.
 * @internal
 */
function ReactElement(type, key, ref, self, source, owner, props) {
  const element = {
    /* packages/shared/ReactSymbols
      export const REACT_ELEMENT_TYPE = Symbol.for('react.element');
    */
    /**
     * 組件的類型：以此為判斷依據，只有 'react.element' 才會被渲染成真正的 DOM
     */
    $$typeof: REACT_ELEMENT_TYPE, // ! Symbol

    type: type,
    key: key,
    ref: ref,
    props: props,

    // Record the component responsible for creating this element.
    _owner: owner,
  };

  if (__DEV__) {
    // 一連串的凍結屬性，禁止修改更新

    // The validation flag is currently mutative. We put it on
    // an external backing store so that we can freeze the whole object.
    // This can be replaced with a WeakMap once they are implemented in
    // commonly used development environments.
    element._store = {};

    // To make comparing ReactElements easier for testing purposes, we make
    // the validation flag non-enumerable (where possible, which should
    // include every environment we run tests in), so the test framework
    // ignores it.
    Object.defineProperty(element._store, "validated", {
      configurable: false,
      enumerable: false,
      writable: true,
      value: false,
    });
    // self and source are DEV only properties.
    Object.defineProperty(element, "_self", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: self,
    });
    // Two elements created in two different places should be considered
    // equal for testing purposes and therefore we hide it from enumeration.
    Object.defineProperty(element, "_source", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: source,
    });
    if (Object.freeze) {
      Object.freeze(element.props);
      Object.freeze(element);
    }
  }

  return element;
}
```

#### 知識點 - $$typeof 就是 React 內建的防範 XSS 攻擊功能

`$$typeof` 是一個 `Symbol`，為什麼要用 `Symbol`?
Symbol 是 es6 推出的基本類型，表示獨一無二的值，可以作為物件的屬性名，避免出現相同的 key。

React 當中可以使用`dangerouslySetInnerHTML`來注入 html，

```js
<div dangerouslySetInnerHTML={{ __html: message }}></div>
```

如果我們手動建構一個類似 ReactElement 的結構給 React，那 React 就會編譯成 ReactElement，就有發生 `XSS攻擊` 的可能。

```js
function SomeElement() {
  const message = {
    type: "div",
    props: {
      dangerouslySetInnerHTML: {
        __html: `<h1>HTML</h1>
            <a href='xxxxxx'>link</a>`,
      },
    },
    key: null,
    ref: null,
    // $$typeof: Symbol.for("react.element"),
  };
  return <>{message}</>;
}
```

但 React 為了防範安全問題，引入 `$$typeof` 屬性，來標示對象是否是有效的 react 元素！
因為 `symbol` 的唯一性，外部的使用者是沒辦法拿到源碼的 `$$typeof symbol`，只有 React 的內部邏輯知道這個 Symbol 的值，攻擊者無法簡單地模擬這個 Symbol 的值。即使攻擊者知道 Symbol 的描述，也無法創建一個具有相同 $$typeof 值的 Symbol。只有由 React 正確創建的元素才會具有正確的 Symbol 值。且 數據中 json 也沒有 Symbol 的類型。

```js
console.log(Symbol("foo") === Symbol("foo")); // false
```

> 補充 XSS: 主要是插入惡意腳本、到網頁中，當用戶加載時就會在他們的瀏覽器執行。主要類型有存儲型（把惡意腳本存在服務端，請求時加載）、反射型（在請求中插入惡意的腳本，在服務器端回應時，執行，通常會搭配表單提交或通過 url 實現）、DOM 型（直接改變客戶端 JS 代碼，使得惡意的腳本被執行）。防範方式有：所有提交都須經過驗證、在將用戶輸入顯示到網頁上之前，對數據進行編碼，防止瀏覽器將其解釋為腳本、使用現代框架 React 等等。

> 學習資料：
> [React 的源碼與原始理解讀（一）：從創建 React 元素出發](https://blog.csdn.net/weixin_46463785/article/details/129591062) > [React 原始碼起始篇](https://www.qinguanghui.com/react/react%E6%BA%90%E7%A0%81%E8%B5%B7%E5%A7%8B%E7%AF%87.html)
