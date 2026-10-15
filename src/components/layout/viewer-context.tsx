"use client";
import { createContext, useContext } from "react";

/** 目前登入者角色（僅供畫面顯示判斷；權限一律由伺服器端檢查） */
const ViewerContext = createContext<{ role: "ADMIN" | "USER" }>({ role: "USER" });

export function ViewerProvider({ role, children }: { role: "ADMIN" | "USER"; children: React.ReactNode }) {
  return <ViewerContext.Provider value={{ role }}>{children}</ViewerContext.Provider>;
}

/** 只有管理員可以標記完成或變更工作狀態 */
export function useCanComplete(): boolean {
  return useContext(ViewerContext).role === "ADMIN";
}
