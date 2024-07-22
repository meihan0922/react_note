// 之所以要 (store) => (next) => 是因為 dispatch 必須要不斷被封裝，但store只會共用
export const loggerMiddleware = (store) => (next) => (action) => {
  console.log(store.getState());
  next(action);
  console.log(store.getState());
};
