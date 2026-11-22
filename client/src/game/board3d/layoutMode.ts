/**
 * On wide windows the dice dock sits in the bottom-left corner and the board
 * takes the full height. On tall / narrow windows the dock sits under the board.
 */
export const sideDockFor = (width: number, height: number) => width - height > 420;
