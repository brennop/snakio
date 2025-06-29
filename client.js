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
  switch(event.key) {
    case "ArrowRight": ws.send(0); break;
    case "ArrowUp": ws.send(1); break;
    case "ArrowLeft": ws.send(2); break;
    case "ArrowDown": ws.send(3); break;
  }
});
