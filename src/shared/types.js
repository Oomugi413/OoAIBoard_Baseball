// @ts-check

/** @typedef {"away" | "home"} Side */
/** @typedef {"top" | "bottom"} InningHalf */

/**
 * @typedef {object} Pitcher
 * @property {string} pitcherId
 * @property {string} pitcherName
 * @property {number} pitchCount
 * @property {number} strikeouts
 * @property {number} order
 */

/**
 * @typedef {object} Batter
 * @property {number} battingOrderNumber
 * @property {string} playerName
 * @property {boolean} isPinchHitter
 * @property {number} homeRuns
 * @property {number} hits
 * @property {number} strikeoutsSwinging
 * @property {number} strikeoutsLooking
 * @property {number} outs
 * @property {number} others
 */

/**
 * @typedef {object} SidePlayers
 * @property {Batter[]} battingOrder
 * @property {Pitcher[]} pitchers
 */

/**
 * @typedef {object} DisplayOptions
 * @property {boolean} showAbs
 * @property {boolean} showMatchup
 */

export {};
