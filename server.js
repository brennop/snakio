import { WebSocketServer } from "ws";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

/**
 * Http Server stuff
 */
const PORT = 8080;

const MIME_TYPES = {
  default: "application/octet-stream",
  html: "text/html; charset=UTF-8",
  js: "text/javascript",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};

const STATIC_PATH = path.join(process.cwd(), "./");

const toBool = [() => true, () => false];

const prepareFile = async (url) => {
  const paths = [STATIC_PATH, url];
  if (url.endsWith("/")) paths.push("index.html");
  const filePath = path.join(...paths);
  const pathTraversal = !filePath.startsWith(STATIC_PATH);
  const exists = await fs.promises.access(filePath).then(...toBool);
  const found = !pathTraversal && exists;
  const streamPath = found ? filePath : `${STATIC_PATH}/404.html`;
  const ext = path.extname(streamPath).substring(1).toLowerCase();
  const stream = fs.createReadStream(streamPath);
  return { found, ext, stream };
};

const server = http.createServer(async (req, res) => {
  const file = await prepareFile(req.url);
  const statusCode = file.found ? 200 : 404;
  const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
  res.writeHead(statusCode, { "Content-Type": mimeType });
  file.stream.pipe(res);
});

const wss = new WebSocketServer({ server });

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
  } while(board[x][y] > 0 );

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
let food = getRandomPosition(getBoard());
let index = 1;

/**
 * websocket events
 */
wss.on("connection", (ws) => {
  ws.index = index;
  console.log("connected", ws.index);

  // TODO: use getRandomPosition
  const initialX = getRandomInt(WIDTH - 1);
  const initialY = getRandomInt(HEIGHT - 1);

  players[ws.index] = {
    positions: [
      [initialX, initialY + 0],
      [initialX, initialY + 1],
      [initialX, initialY + 2],
    ],
    direction: 1,
  };

  index += 1;

  ws.on("close", () => {
    console.log("deleting", ws.index);
    delete players[ws.index];
  });

  ws.on("message", (data) => {
    // constraint to range [0, 3]
    const newDirection = parseInt(data) & 3;

    // prevent going oposite direction
    if (((players[ws.index].direction + newDirection) & 1) == 0) return;

    players[ws.index].direction = newDirection;
  });
});

/**
 * Game loop
 */
let ticks = 0;
function tick() {
  const board = getBoard();
  const data = new Uint8Array(WIDTH * HEIGHT);
  let someoneAteTheFood = false;

  Object.entries(players).forEach(([index, player]) => {
    // move player
    const head = vecSum(player.positions.at(0), DIRS[player.direction]);
    player.positions.unshift(head);

    // add player to the board
    player.positions.forEach(([x, y]) => {
      board[x][y] = index;
      data[x + y * WIDTH] = parseInt(index);
    });

    // eat the food
    if (vecEquals(head, food)) {
      someoneAteTheFood = true;
    } else {
      // normally we would always remove the tail, but if we eat the food, we don't as we are one square bigger
      player.positions.pop();
    }

    players[index] = player
  });

  if (someoneAteTheFood) {
    food = getRandomPosition(board);
  }

  const [x, y] = food;
  data[x + y * WIDTH] = 255;

  wss.clients.forEach((client) => {
    client.send(data, { binary: true });
  });

  ticks += 1;
}

setInterval(tick, 1000 / TICK_RATE);
server.listen(PORT);
