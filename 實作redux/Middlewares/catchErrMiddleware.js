export const catchErrMiddleware = (store) => (next) => (action) => {
  try {
    next(action);
    console.log("catch");
  } catch (err) {
    console.log(err);
  }
};
