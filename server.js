import { serve } from "bun";
import homepage from "./index.html";
import { Database } from "bun:sqlite";

/**
 * Game parameters
 */
const WIDTH = 16;
const HEIGHT = 16;
const TICK_RATE = 5.0; // ticks per seconds

/**
 * helper functions
 */
const getBoard = () => [...Array(WIDTH)].map(() => [...Array(HEIGHT)].fill(0));

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const getRandomPosition = (board) => {
  let x, y;
  do {
    x = getRandomInt(WIDTH - 1);
    y = getRandomInt(HEIGHT - 1);
  } while (board[x][y] > 0);

  return [x, y];
}

function vecSum([x1, y1], [x2, y2]) {
  return [(x1 + x2) & (WIDTH - 1), (y1 + y2) & (HEIGHT - 1)];
}

const vecEquals = ([x1, y1], [x2, y2]) => x1 == x2 && y1 == y2;

const DIRS = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
]

/**
 * Game state
 */
const players = {};
let data = new Uint8Array(WIDTH * HEIGHT);

const db = new Database("db.sqlite", { create: true });
db.query('CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY, positions TEXT, direction INTEGER, move INTEGER);').run();
db.query('CREATE TABLE IF NOT EXISTS food(id INTEGER KEY CHECK (id = 1), x INTEGER NOT NULL, y INTEGER NOT NULL);').run();

db.query('INSERT OR REPLACE INTO food (id, x, y) VALUES (1, $x, $y);').run({ $x: getRandomInt(WIDTH - 1), $y: getRandomInt(HEIGHT - 1) });


/**
 * websocket events
 */

const open = (ws) => {
  ws.subscribe("players");
}

const close = (ws, code, message) => {
  console.log("deleting", ws.data.id);
  db.query('DELETE FROM players WHERE id = $id;').run({ $id: ws.data.id });
}

const message = (ws, message) => {
  const player = db.query('SELECT * from players WHERE id = $id;').get({ $id: ws.data.id });

  // constraint to range [0, 3]
  const newDirection = parseInt(message) & 3;

  // prevent going oposite direction
  // TODO: go back to move
  if (((player.direction + newDirection) & 1) == 0) return;

  db.query('UPDATE players SET direction = $direction WHERE id = $id;').run({ $direction: newDirection, $id: ws.data.id });
}

/**
 * Game loop
 */
let ticks = 0;
function tick() {
  const board = getBoard();
  data = new Uint8Array(WIDTH * HEIGHT);
  let someoneAteTheFood = false;

  const players = db.query('SELECT * from players;').all();

  let { x, y } = db.query('SELECT x, y from food WHERE id = 1;').get();

  players.forEach(({ id, positions, direction, move }) => {
    const pos = JSON.parse(positions);

    // move player
    const head = vecSum(pos.at(0), DIRS[direction]);
    pos.unshift(head);

    // add player to the board
    pos.forEach(([x, y]) => {
      // TODO: remove board
      board[x][y] = id;
      data[x + y * WIDTH] = id;
    });

    // eat the food
    if (vecEquals(head, [x, y])) {
      someoneAteTheFood = true;
    } else {
      // normally we would always remove the tail, but if we eat the food, we don't as we are one square bigger
      pos.pop();
    }

    db.query('UPDATE players SET positions = $positions WHERE id = $id;').run({ $positions: JSON.stringify(pos), $id: id });
  });

  if (someoneAteTheFood) {
    [x, y] = getRandomPosition(board);
    console.log(x,y);

    db.query('INSERT OR REPLACE INTO food (id, x, y) VALUES (1, $x, $y);').run({ $x: x, $y: y });
  }

  data[x + y * WIDTH] = 255;

  // server might not be defined here?
  server.publish("players", data);

  ticks += 1;
}

setInterval(tick, 1000 / TICK_RATE);

const server = serve({
  routes: {
    "/": homepage,
  },
  fetch(req, server) {
    const initialX = getRandomInt(WIDTH - 1);
    const initialY = getRandomInt(HEIGHT - 1);

    const positions = [
      [initialX, initialY + 0],
      [initialX, initialY + 1],
      [initialX, initialY + 2],
    ];

    const { lastInsertRowid } = db.query("INSERT INTO players (positions, direction, move) VALUES ($positions, 1, NULL);").run({ $positions: JSON.stringify(positions) });

    server.upgrade(req, { data: { id: lastInsertRowid } });
  },
  development: true,
  websocket: {
    open,
    close,
    message,
  }
})

