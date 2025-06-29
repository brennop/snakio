ws = new WebSocket('ws://localhost:8080');

ws.binaryType = "arraybuffer";

const canvas = document.querySelector('canvas');
const WIDTH = 16;
const HEIGHT = 16;
const scale = canvas.width / WIDTH;
const ctx = canvas.getContext("2d");

const colors = [
  "#0000ff",
  "#00ff00",
  "#ff0000",
]

const board = [...Array(HEIGHT)].map(() => [...Array(WIDTH)].fill(0));
let data = new Uint8Array();

ws.addEventListener('message', (event) => {
  data = new Uint8Array(event.data);
});

document.addEventListener('keydown', (event) => {
  switch(event.key) {
    case "ArrowRight": ws.send(0); break;
    case "ArrowUp": ws.send(1); break;
    case "ArrowLeft": ws.send(2); break;
    case "ArrowDown": ws.send(3); break;
  }
});

let start;
function step(timestamp) {
  if (start === undefined) start = timestamp;
  const elapsed = timestamp - start;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const value = data[x + y * WIDTH];

      if (value > 0) {
        ctx.fillStyle = colors[value % colors.length];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  requestAnimationFrame(step);
}

requestAnimationFrame(step);

