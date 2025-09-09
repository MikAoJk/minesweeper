/* Minesweeper JavaScript
 * Features:
 * - Random mine placement (safe first click)
 * - Flood fill for zero-value cells
 * - Flags (right-click or press F)
 * - Timer & mine counter
 * - Difficulty selection & custom sizes
 * - Keyboard navigation & accessibility
 */

(() => {
  const difficulties = {
    beginner:  { cols: 9,  rows: 9,  mines: 10 },
    intermediate: { cols: 16, rows: 16, mines: 40 },
    expert: { cols: 30, rows: 16, mines: 99 }
  };

  const boardEl = document.getElementById('board');
  const wrapperEl = document.getElementById('boardWrapper');
  const minesRemainingEl = document.getElementById('minesRemaining');
  const timerEl = document.getElementById('timer');
  const resetBtn = document.getElementById('resetBtn');
  const messageEl = document.getElementById('message');

  let board = []; // 2D array of cell objects
  let cols = 9;
  let rows = 9;
  let mineCount = 10;
  let flagsPlaced = 0;
  let firstClick = true;
  let gameOver = false;
  let revealedCount = 0;
  let timerInterval = null;
  let timeElapsed = 0;

  function formatNumber(n) {
    return String(n).padStart(3, '0').slice(-3);
  }

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = 'message ' + (type || '');
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      timeElapsed++;
      timerEl.textContent = formatNumber(timeElapsed);
    }, 1000);
  }

  function resetTimer() {
    stopTimer();
    timeElapsed = 0;
    timerEl.textContent = '000';
  }

  function updateMinesRemaining() {
    const remaining = mineCount - flagsPlaced;
    minesRemainingEl.textContent = formatNumber(Math.max(0, remaining));
  }

  function createEmptyBoard() {
    board = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          row: r,
            col: c,
            mine: false,
            adjacent: 0,
            revealed: false,
            flagged: false,
            el: null
        });
      }
      board.push(row);
    }
  }

  // Place mines except the safe cell (and its neighbors if desired)
  function placeMines(safeRow, safeCol) {
    let placed = 0;
    const safeZone = new Set();
    // Guarantee immediate first cell is safe; optionally treat adjacency as safe also
    safeZone.add(`${safeRow},${safeCol}`);
    // (Optional) uncomment to also avoid neighbors
    // getNeighbors(safeRow, safeCol).forEach(n => safeZone.add(`${n.row},${n.col}`));

    while (placed < mineCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (board[r][c].mine) continue;
      if (safeZone.has(`${r},${c}`)) continue;
      board[r][c].mine = true;
      placed++;
    }

    // After placing mines calculate adjacent counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].mine) {
          board[r][c].adjacent = countAdjacentMines(r, c);
        }
      }
    }
  }

  function countAdjacentMines(r, c) {
    return getNeighbors(r, c).reduce((acc, cell) => acc + (cell.mine ? 1 : 0), 0);
  }

  function getNeighbors(r, c) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          neighbors.push(board[nr][nc]);
        }
      }
    }
    return neighbors;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    boardEl.setAttribute('aria-rowcount', rows);
    boardEl.setAttribute('aria-colcount', cols);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellObj = board[r][c];
        const cellDiv = document.createElement('button');
        cellDiv.className = 'cell covered';
        cellDiv.type = 'button';
        cellDiv.setAttribute('data-row', r);
        cellDiv.setAttribute('data-col', c);
        cellDiv.setAttribute('role', 'gridcell');
        cellDiv.setAttribute('aria-label', `Covered cell at row ${r + 1} column ${c + 1}`);
        cellDiv.tabIndex = 0;

        const span = document.createElement('span');
        span.className = 'content';
        cellDiv.appendChild(span);

        cellDiv.addEventListener('click', onCellClick);
        cellDiv.addEventListener('contextmenu', onCellRightClick);
        cellDiv.addEventListener('keydown', onCellKeyDown);
        // Mobile long press for flag
        enableLongPress(cellDiv);

        cellObj.el = cellDiv;
        boardEl.appendChild(cellDiv);
      }
    }
  }

  function onCellClick(e) {
    const cell = getCellFromEvent(e);
    if (!cell || gameOver) return;
    if (cell.flagged) return;
    revealCell(cell);
  }

  function onCellRightClick(e) {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (!cell || gameOver) return;
    if (cell.revealed) return;
    toggleFlag(cell);
  }

  function onCellKeyDown(e) {
    const cell = getCellFromEvent(e);
    if (!cell || gameOver) return;

    if (['Enter', ' ', 'Spacebar'].includes(e.key)) {
      e.preventDefault();
      if (!cell.flagged) revealCell(cell);
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (!cell.revealed) toggleFlag(cell);
    }

    // Optional: arrow navigation
    const { row, col } = cell;
    let target;
    switch (e.key) {
      case 'ArrowUp': target = board[row - 1]?.[col]; break;
      case 'ArrowDown': target = board[row + 1]?.[col]; break;
      case 'ArrowLeft': target = board[row]?.[col - 1]; break;
      case 'ArrowRight': target = board[row]?.[col + 1]; break;
    }
    if (target) {
      e.preventDefault();
      target.el.focus();
    }
  }

  function getCellFromEvent(e) {
    const target = e.currentTarget || e.target;
    const r = parseInt(target.getAttribute('data-row'), 10);
    const c = parseInt(target.getAttribute('data-col'), 10);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return board[r][c];
  }

  function toggleFlag(cell) {
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    if (cell.flagged) {
      flagsPlaced++;
      cell.el.classList.add('flagged');
      cell.el.querySelector('.content').textContent = '🚩';
      cell.el.setAttribute('aria-label', `Flag at row ${cell.row + 1} column ${cell.col + 1}`);
    } else {
      flagsPlaced--;
      cell.el.classList.remove('flagged');
      cell.el.querySelector('.content').textContent = '';
      cell.el.setAttribute('aria-label', `Covered cell at row ${cell.row + 1} column ${cell.col + 1}`);
    }
    updateMinesRemaining();
  }

  function revealCell(cell) {
    if (cell.revealed || cell.flagged) return;

    if (firstClick) {
      placeMines(cell.row, cell.col);
      firstClick = false;
      startTimer();
    }

    cell.revealed = true;
    revealedCount++;
    cell.el.classList.remove('covered');
    cell.el.classList.add('revealed');
    cell.el.removeAttribute('aria-label');

    if (cell.mine) {
      cell.el.classList.add('mine');
      cell.el.querySelector('.content').textContent = '💣';
      endGame(false);
      return;
    }

    cell.el.dataset.value = cell.adjacent;
    if (cell.adjacent === 0) {
      cell.el.classList.add('zero');
      // Flood fill
      floodReveal(cell);
    } else {
      cell.el.querySelector('.content').textContent = cell.adjacent;
    }

    if (checkWin()) {
      endGame(true);
    }
  }

  function floodReveal(startCell) {
    const queue = [startCell];
    const visited = new Set();

    while (queue.length) {
      const cell = queue.shift();
      const key = `${cell.row},${cell.col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      getNeighbors(cell.row, cell.col).forEach(n => {
        if (!n.revealed && !n.flagged && !n.mine) {
          n.revealed = true;
          revealedCount++;
          n.el.classList.remove('covered');
          n.el.classList.add('revealed');
          n.el.dataset.value = n.adjacent;
          if (n.adjacent > 0) {
            n.el.querySelector('.content').textContent = n.adjacent;
          } else {
            n.el.classList.add('zero');
            queue.push(n);
          }
        }
      });
    }
  }

  function checkWin() {
    const totalSafe = rows * cols - mineCount;
    return revealedCount >= totalSafe && !gameOver;
  }

  function endGame(win) {
    gameOver = true;
    stopTimer();
    if (win) {
      setMessage('You win! 🎉', 'win');
      resetBtn.textContent = '😎';
      revealAllMines(true);
    } else {
      setMessage('Boom! You hit a mine. 💥', 'lose');
      resetBtn.textContent = '💀';
      revealAllMines(false);
    }
  }

  function revealAllMines(won) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.mine && !cell.revealed) {
          cell.revealed = true;
          cell.el.classList.remove('covered');
          cell.el.classList.add('revealed','mine');
          const content = cell.el.querySelector('.content');
          content.textContent = won ? '🎉' : '💣';
        } else if (!cell.mine && cell.flagged && !won) {
          // Mark incorrect flags
            cell.el.classList.add('incorrect-flag');
            cell.el.querySelector('.content').textContent = '❌';
        }
      }
    }
  }

  function resetGame() {
    stopTimer();
    resetTimer();
    setMessage('');
    resetBtn.textContent = '🙂';
    gameOver = false;
    revealedCount = 0;
    flagsPlaced = 0;
    firstClick = true;

    // Always use beginner difficulty since settings form is removed
    ({ cols, rows, mines: mineCount } = difficulties.beginner);

    minesRemainingEl.textContent = formatNumber(mineCount);
    createEmptyBoard();
    renderBoard();
    wrapperEl.style.setProperty('--cols', cols);
  }

  function clamp(val, min, max) {
    if (Number.isNaN(val)) return min;
    return Math.max(min, Math.min(max, val));
  }

  // Long press detection for mobile flagging
  function enableLongPress(el) {
    let pressTimer = null;
    let moved = false;

    const start = (e) => {
      if (e.button === 2) return;
      moved = false;
      pressTimer = setTimeout(() => {
        if (!moved) {
          const cell = getCellFromEvent({ currentTarget: el });
          if (cell && !cell.revealed && !gameOver) {
            toggleFlag(cell);
          }
        }
      }, 550);
    };

    const cancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', () => { moved = true; });
    el.addEventListener('touchcancel', cancel);
  }

  // Event bindings
  resetBtn.addEventListener('click', () => {
    resetGame();
  });

  // Initialize default
  resetGame();

  // Expose for debugging (optional)
  window.__Minesweeper__ = {
    get board() { return board; },
    revealCell,
    toggleFlag,
    reset: resetGame
  };
})();
