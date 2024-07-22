import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface IBearState {
  bears: number;
  count: number;
  increase: (num?: number) => void;
  decrease: (num?: number) => void;
  reset: () => void;
  increaseCount: () => void;
}

const useBearStore = create(
  immer<IBearState>((set) => ({
    bears: 0,
    count: 100,
    increase: (num = 1) => set((state) => ({ bears: state.bears + num })),
    decrease: (num = 1) =>
      set((state) => {
        state.bears -= num;
      }),
    reset: () => set({ bears: 0 }),
    increaseCount: () => set((state) => ({ count: state.count + 1 })),
  }))
);

export default useBearStore;
