import assert from "node:assert/strict";
import {
  applyAction,
  createBoard,
  createDefaultSettings,
  getCurrentBatter,
  getCurrentPitcher,
  normalizeBoardData
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
  assert.equal(board.gameState.halfInningTransition.label, "Mid 1st");

  board = run(board, "outs:adjust", { delta: 3 });
  board = run(board, "inning:change");
  assert.equal(board.gameState.inningHalf, "top");
  assert.equal(board.gameState.inningNumber, 2);
  assert.equal(board.gameState.halfInningTransition.label, "End 1st");

  board = run(board, "history:undo");
  assert.equal(board.gameState.inningHalf, "bottom");
  assert.equal(board.gameState.halfInningTransition.label, "Mid 1st");
}

{
  // game:finishは得点の多いほうを自動的に勝者にする。同点はwinner: null(どちらもグレー化しない)。
  let board = createBoard("test");
  assert.equal(board.gameState.finalResult, null);
  board = run(board, "score:adjust", { side: "away", delta: 3 });
  board = run(board, "game:finish");
  assert.deepEqual(board.gameState.finalResult, { winner: "away" });

  // 「戻る」で試合終了操作自体を取り消せる。
  board = run(board, "history:undo");
  assert.equal(board.gameState.finalResult, null);

  board = run(board, "score:adjust", { side: "home", delta: 5 });
  board = run(board, "game:finish");
  assert.deepEqual(board.gameState.finalResult, { winner: "home" });
  board = run(board, "game:reset");
  assert.equal(board.gameState.finalResult, null);

  // 同点の場合はwinner: null。
  board = run(board, "score:adjust", { side: "away", delta: 2 });
  board = run(board, "score:adjust", { side: "home", delta: 2 });
  board = run(board, "game:finish");
  assert.deepEqual(board.gameState.finalResult, { winner: null });
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

{
  let board = createBoard("test");
  board = run(board, "plate:result", { result: "strikeoutSwinging" });
  board = run(board, "plate:result", { result: "strikeoutLooking" });
  assert.equal(getCurrentPitcher(board).strikeouts, 2);
  board = run(board, "history:undo");
  assert.equal(getCurrentPitcher(board).strikeouts, 1);
  board = run(board, "game:reset");
  assert.equal(getCurrentPitcher(board).strikeouts, 0);
}

{
  let board = createBoard("test");
  assert.equal(board.playerSettings.away.pitchers.length, 1);
  assert.ok(board.playerSettings.away.pitchers[0].pitcherId);
  board = run(board, "players:patch", {
    addedPitchers: {
      away: [{ pitcherName: "A.Pitcher2" }, { pitcherName: "A.Pitcher3" }]
    }
  });
  assert.equal(board.playerSettings.away.pitchers.length, 3);

  board = run(board, "players:patch", { removedPitchers: { away: 1 } });
  assert.equal(board.playerSettings.away.pitchers.length, 2);
  assert.equal(board.playerSettings.away.pitchers[1].pitcherName, "A.Pitcher2");

  // 1人しかいない場合は削除しても最後の1人は残す。
  board = run(board, "players:patch", { removedPitchers: { away: 10 } });
  assert.equal(board.playerSettings.away.pitchers.length, 1);
}

{
  // A端末が削除対象を選んだ後にB端末が追加しても、対象IDの投手だけを削除する。
  let board = createBoard("pitcher-id-concurrency");
  board = run(board, "players:patch", {
    addedPitchers: {
      away: [
        { pitcherId: "pitcher-2", pitcherName: "A.Pitcher2" },
        { pitcherId: "pitcher-3", pitcherName: "A.Pitcher3" }
      ]
    }
  });
  const pitcherIdToRemove = board.playerSettings.away.pitchers[2].pitcherId;

  board = run(board, "players:patch", {
    addedPitchers: {
      away: [{ pitcherId: "pitcher-4", pitcherName: "A.Pitcher4" }]
    }
  });
  board = run(board, "players:patch", {
    removedPitcherIds: { away: [pitcherIdToRemove] }
  });

  assert.deepEqual(
    board.playerSettings.away.pitchers.map((pitcher) => pitcher.pitcherId),
    [board.playerSettings.away.pitchers[0].pitcherId, "pitcher-2", "pitcher-4"]
  );
  board = run(board, "players:patch", {
    pitcherUpdatesById: {
      away: { "pitcher-2": { pitchCount: 27 } }
    }
  });
  assert.equal(board.playerSettings.away.pitchers.find((pitcher) => pitcher.pitcherId === "pitcher-2").pitchCount, 27);
  assert.equal(board.playerSettings.away.pitchers.find((pitcher) => pitcher.pitcherId === "pitcher-4").pitchCount, 0);
}

{
  const board = createBoard("legacy-player-data");
  delete board.playerSettings.away.pitchers[0].pitcherId;
  board.playerSettings.matchupEnabled = true;
  board.undoHistory = [{ playerSettings: structuredClone(board.playerSettings) }];
  assert.equal(normalizeBoardData(board), true);
  assert.ok(board.playerSettings.away.pitchers[0].pitcherId);
  assert.ok(board.undoHistory[0].playerSettings.away.pitchers[0].pitcherId);
  assert.equal(Object.hasOwn(board.playerSettings, "matchupEnabled"), false);
}

{
  // クランプ後も値が同じ操作は、履歴を増やさずchanged:falseにする。
  let board = createBoard("noop-history");
  const initialHistoryLength = board.undoHistory.length;
  const scoreAtFloor = applyAction(
    board,
    { type: "score:adjust", payload: { side: "away", delta: -1 } },
    settings
  );
  assert.equal(scoreAtFloor.changed, false);
  assert.equal(scoreAtFloor.board.undoHistory.length, initialHistoryLength);

  const countResetAtZero = applyAction(board, { type: "count:reset" }, settings);
  assert.equal(countResetAtZero.changed, false);
  assert.equal(countResetAtZero.board.undoHistory.length, initialHistoryLength);

  board = run(board, "abs:adjust", { side: "away", delta: -2 });
  const historyAtAbsFloor = board.undoHistory.length;
  const absAtFloor = applyAction(
    board,
    { type: "abs:adjust", payload: { side: "away", delta: -1 } },
    settings
  );
  assert.equal(absAtFloor.changed, false);
  assert.equal(absAtFloor.board.undoHistory.length, historyAtAbsFloor);

  board = run(board, "outs:adjust", { delta: 3 });
  const historyAtOutsMax = board.undoHistory.length;
  const caughtStealingAtMax = applyAction(board, { type: "outs:caughtStealing" }, settings);
  assert.equal(caughtStealingAtMax.changed, false);
  assert.equal(caughtStealingAtMax.board.undoHistory.length, historyAtOutsMax);
}

{
  // 表示カウントが上限でも投手球数が増える投球は履歴対象にし、Undoで球数も戻す。
  let board = createBoard("pitch-stat-history");
  board = run(board, "count:balls", { delta: 10 });
  const historyAtBallMax = board.undoHistory.length;
  const manualCountAtBallMax = applyAction(
    board,
    { type: "count:balls", payload: { delta: 1 } },
    settings
  );
  assert.equal(manualCountAtBallMax.changed, false);
  assert.equal(manualCountAtBallMax.board.undoHistory.length, historyAtBallMax);

  const pitchAtBallMax = applyAction(board, { type: "pitch:ball" }, settings);
  assert.equal(pitchAtBallMax.changed, true);
  assert.equal(pitchAtBallMax.board.gameState.balls, 4);
  assert.equal(getCurrentPitcher(pitchAtBallMax.board).pitchCount, 1);
  assert.equal(pitchAtBallMax.board.undoHistory.length, historyAtBallMax + 1);

  board = run(pitchAtBallMax.board, "history:undo");
  assert.equal(board.gameState.balls, 4);
  assert.equal(getCurrentPitcher(board).pitchCount, 0);

  board = run(board, "board:patchConfig", {
    displayOptions: { showMatchup: false }
  });
  const historyWithMatchupHidden = board.undoHistory.length;
  const pitchWithoutRecordedStat = applyAction(board, { type: "pitch:ball" }, settings);
  assert.equal(pitchWithoutRecordedStat.changed, false);
  assert.equal(pitchWithoutRecordedStat.board.undoHistory.length, historyWithMatchupHidden);
}

{
  // 打席結果で変わる打者成績と打順は履歴に残り、Undoでまとめて復元する。
  let board = createBoard("batter-stat-history");
  const hitResult = applyAction(
    board,
    { type: "plate:result", payload: { result: "hit" } },
    settings
  );
  assert.equal(hitResult.changed, true);
  assert.equal(hitResult.board.playerSettings.away.battingOrder[0].hits, 1);
  assert.equal(hitResult.board.playerSettings.currentBattingOrderIndex.away, 1);

  board = run(hitResult.board, "history:undo");
  assert.equal(board.playerSettings.away.battingOrder[0].hits, 0);
  assert.equal(board.playerSettings.currentBattingOrderIndex.away, 0);
}

{
  let board = createBoard("test");
  assert.equal(board.playerSettings.away.battingOrder[0].position, undefined);
}

{
  let board = createBoard("test");
  board = run(board, "plate:result", { result: "strikeoutSwinging" });
  assert.equal(board.gameState.overlay.kind, "strikeout");
  assert.equal(board.gameState.overlay.batterName, "A.Batter1");
  assert.equal(board.gameState.overlay.pitcherStrikeouts, 1);
  const seqAfterFirst = board.gameState.plateAppearanceSeq;
  assert.equal(seqAfterFirst, 1);

  board = run(board, "plate:result", { result: "homeRun" });
  assert.equal(board.gameState.overlay.kind, "homeRun");
  assert.equal(board.gameState.overlay.batterName, "A.Batter2");
  assert.equal(board.gameState.plateAppearanceSeq, 2);

  // count:reset (カウントRS) must NOT bump the plate-appearance sequence,
  // since only plate-result-triggered count resets should snap instantly on the client.
  board = run(board, "count:reset");
  assert.equal(board.gameState.plateAppearanceSeq, 2);

  // game:reset (スコアリセット) must preserve the sequence value across the reset too.
  board = run(board, "game:reset");
  assert.equal(board.gameState.plateAppearanceSeq, 2);
}

console.log("scoringRules tests passed");
