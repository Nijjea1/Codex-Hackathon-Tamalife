import { create } from "zustand";
import { ExtractedReceiptDto } from "../types/api";
import { Subscription } from "../types/subscription";

type ReceiptDraftState = {
  parseId: string | null;
  extracted: ExtractedReceiptDto | null;
  subscription: Subscription | null;
  setDraft: (parseId: string, extracted: ExtractedReceiptDto) => void;
  setExtracted: (extracted: ExtractedReceiptDto) => void;
  setSubscription: (subscription: Subscription) => void;
  clear: () => void;
};

export const useReceiptDraftStore = create<ReceiptDraftState>((set) => ({
  parseId: null,
  extracted: null,
  subscription: null,
  setDraft: (parseId, extracted) => set({ parseId, extracted, subscription: null }),
  setExtracted: (extracted) => set({ extracted }),
  setSubscription: (subscription) => set({ subscription }),
  clear: () => set({ parseId: null, extracted: null, subscription: null }),
}));
