import assert from "node:assert/strict";
import {
  applyAction,
  createBoard,
  createDefaultSettings,
  getCurrentBatter,
  getCurrentPitcher
} from "../src/shared/scoringRules.mjs";

const settings = createDefaultSettings();

function run(board, type, payload = {}) {
  const result = applyAction(board, { type, payload }, settings);
  if (result.error) throw new Error(result.error);
  return result.board;
}

{
  let board = createBoard("test");
  board = run(board, "pitch:ball");
  board = run(board, "pitch:ball");
  board = run(board, "count:balls", { delta: 10 });
  assert.equal(board.gameState.balls, 4);
  assert.equal(getCurrentPitcher(board).pitchCount, 2);
}

{
  let board = createBoard("test");
  board = run(board, "runner:toggle", { base: "first" });
  board = run(board, "runner:toggle", { base: "third" });
  board = run(board, "plate:result", { result: "homeRun" });
  assert.equal(board.gameState.score.away, 3);
  assert.equal(board.gameState.runners.first, false);
  assert.equal(board.gameState.runners.third, false);
  assert.equal(board.gameState.overlay.message, "HOME RUN");
}

{
  let board = createBoard("test");
  board = run(board, "outs:adjust", { delta: 3 });
  board = run(board, "inning:change");
  assert.equal(board.gameState.inningHalf, "bottom");
  assert.equal(board.gameState.outs, 0);
}

{
  let board = createBoard("test");
  board = run(board, "abs:adjust", { side: "away", delta: -5 });
  assert.equal(board.gameState.abs.away, 0);
  const afterAbs = board;
  board = run(board, "history:undo");
  assert.equal(board.gameState.abs.away, 2);
  board = run(board, "history:redo");
  assert.equal(board.gameState.abs.away, afterAbs.gameState.abs.away);
}

{
  let board = createBoard("test");
  board = run(board, "score:adjust", { side: "home", delta: 1 });
  board = run(board, "score:adjust", { side: "home", delta: -10 });
  assert.equal(board.gameState.score.home, 0);
}

{
  let board = createBoard("test");
  board = run(board, "board:patchConfig", {
    teams: {
      away: { abbreviationWidth: 10 },
      home: { abbreviationWidth: 999 }
    }
  });
  assert.equal(board.teamSettings.away.abbreviationWidth, 30);
  assert.equal(board.teamSettings.home.abbreviationWidth, 120);
}

{
  let board = createBoard("test");
  board = run(board, "pitch:strike");
  board = run(board, "pitch:foul");
  board = run(board, "pitch:foul");
  assert.equal(board.gameState.strikes, 2);
  assert.equal(getCurrentPitcher(board).pitchCount, 3);
  board = run(board, "count:reset");
  assert.equal(board.gameState.balls, 0);
  assert.equal(board.gameState.strikes, 0);
}

{
  let board = createBoard("test");
  board = run(board, "runner:toggle", { base: "first" });
  board = run(board, "runner:toggle", { base: "second" });
  board = run(board, "runner:toggle", { base: "third" });
  board = run(board, "plate:result", { result: "walk" });
  assert.equal(board.gameState.score.away, 1);
  assert.equal(board.gameState.runners.first, true);
  assert.equal(board.gameState.runners.second, true);
  assert.equal(board.gameState.runners.third, true);
  assert.equal(board.playerSettings.currentBattingOrderIndex.away, 1);
}

{
  let board = createBoard("test");
  board = run(board, "plate:result", { result: "hit" });
  assert.equal(board.playerSettings.away.battingOrder[0].hits, 1);
  board = run(board, "players:patch", {
    battingOrderUpdates: {
      away: {
        0: { playerName: "New Batter" }
      }
    }
  });
  assert.equal(board.playerSettings.away.battingOrder[0].playerName, "New Batter");
  assert.equal(board.playerSettings.away.battingOrder[0].hits, 0);
  assert.equal(getCurrentBatter(board).playerName, "A.Batter2");
}

console.log("scoringRules tests passed");
