import { createContext, useContext } from "react";

export const ExpandedContext = createContext(false);
export const useIsExpanded = () => useContext(ExpandedContext);
