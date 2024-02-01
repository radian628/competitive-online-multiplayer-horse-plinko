import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Horse } from "./horse";
import { Backboard, Paddle } from "./paddle";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
// const controls = new OrbitControls(camera, renderer.domElement);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 32;
camera.position.y = 0;

{
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.x = 1;
  light.position.y = 2;
  light.position.z = 3;
  scene.add(light);
}

{
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.x = -2;
  light.position.y = 2;
  light.position.z = -4;
  scene.add(light);
}

async function runGame() {
  await RAPIER.init();
  // Run the simulation.
  // Use the RAPIER module here.
  let gravity = { x: 0.0, y: -9.81, z: 0.0 };
  let world = new RAPIER.World(gravity);

  const horses: Horse[] = [];
  const backboard = new Backboard(world, scene);
  const paddle = new Paddle(world, scene, camera, backboard);

  for (let i = 0; i < 100; i++) {
    horses.push(new Horse(world, scene));
  }

  await Promise.all(
    horses.map((h) =>
      h.init(Math.random() * 20 - 10, Math.random() * 20 - 10, 7)
    )
  );

  // Game loop. Replace by your own game loop system.
  let gameLoop = () => {
    // Ste the simulation forward.
    world.step();

    for (const h of horses) h.update();
    // backboard.update();
    paddle.update();

    setTimeout(gameLoop, 16);
  };

  let renderLoop = () => {
    renderer.render(scene, camera);

    requestAnimationFrame(renderLoop);
  };

  setTimeout(gameLoop, 0);
  renderLoop();
}

runGame();
