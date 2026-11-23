import { createContext, useContext } from 'react';

/**
 * On wide windows the title pills and the (compact) dice dock share one slim
 * strip along the top, and the board stretches to fill everything below it.
 * On tall / narrow windows the dock sits under the board.
 */
export const wideFor = (width: number, height: number) => width - height > 420;
export const STRIP = 62;

export const WideContext = createContext(false);
export const useWide = () => useContext(WideContext);
