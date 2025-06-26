ws = new WebSocket('ws://localhost:8080');

ws.binaryType = "arraybuffer";

const game = document.querySelector('#game');
const WIDTH = 16;
const HEIGHT = 16;

const board = [...Array(HEIGHT)].map(() => [...Array(WIDTH)].fill(0));

ws.addEventListener('message', (event) => {
  const data = new Uint8Array(event.data);

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      board[y][x] = data[x + y * WIDTH]
    }
  }

  game.innerHTML = board.map(rows => rows.join("")).join("\n");
});

document.addEventListener('keydown', (event) => {
  if (event.keyCode == 37) {
    ws.send(1);
  } else if (event.keyCode == 39) {
    ws.send(-1);
  }
});
