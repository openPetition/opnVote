import { create } from 'zustand'

export const useStepStore = create((set) => ({
  step: 2,
  stepForward: () => set((state) => ({ step: state.step + 1 })),
  stepReset: () => set({ step: 2 }),
}))

export const useSecretFileStore = create((set) => ({
  file: null,
}))