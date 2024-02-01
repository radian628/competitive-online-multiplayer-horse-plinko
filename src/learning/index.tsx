import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
{
  const geometry = new THREE.BoxGeometry(10.0, 0.1, 10.0);
  const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
}

let physobj: THREE.Mesh;
{
  const geometry = new THREE.BoxGeometry(3, 3, 3);
  const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  const cube = new THREE.Mesh(geometry, material);
  physobj = cube;
  scene.add(cube);
}

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

async function asyncLoadGLTF(filename: string): Promise<THREE.Scene> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(filename, (e) => {
      resolve(e.scene);
    });
  });
}

camera.position.z = 25;

const controls = new OrbitControls(camera, renderer.domElement);

let time = Date.now();

// OR using the await syntax:
async function run_simulation() {
  await RAPIER.init();
  // Run the simulation.
  // Use the RAPIER module here.
  let gravity = { x: 0.0, y: -9.81, z: 0.0 };
  let world = new RAPIER.World(gravity);

  const bones: {
    rb: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    bone: THREE.Bone;
    display: THREE.Mesh;
    name: string;
    prevname: string;
  }[] = [];
  const boneMap = new Map<string, (typeof bones)[0]>();

  {
    const horse = await asyncLoadGLTF("horse.glb");
    const horsebones = await (await fetch("horsebones.json")).json();
    const hbtails = new Map<
      string,
      {
        x: number;
        y: number;
        z: number;
      }
    >(
      horsebones.map((hb) => [
        hb.name.split("_")[0],
        {
          x: hb.x,
          y: hb.z,
          z: -hb.y,
        },
      ])
    );

    console.log("tails", hbtails);

    scene.add(horse);

    console.log(horse);

    const sm = horse.children[0] as THREE.SkinnedMesh;

    function addJoints(obj: THREE.Bone) {
      const [name, prevname] = obj.name.split("_");

      const tail = hbtails.get(name)!;

      const targetSize =
        Math.min(
          ...sm.skeleton.bones
            .filter((b) => b !== obj)
            .map((b) => {
              const tail2 = hbtails.get(b.name.split("_")[0])!;
              const rawdist = Math.hypot(
                tail2.x - tail.x,
                tail2.y - tail.y,
                tail2.z - tail.z
              );

              if (rawdist < 0.00001) {
                console.log("weirdly short distance", b.name, obj.name);
              }

              return rawdist > 0.00001 ? rawdist : Infinity;
            })
        ) / 2.1;

      // create display cube
      const geometry = new THREE.BoxGeometry(
        targetSize * 0.5,
        targetSize * 0.5,
        targetSize * 0.5
      );
      //const geometry = new THREE.SphereGeometry(targetSize);
      const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(tail.x, tail.y, tail.z);
      scene.add(cube);

      // Create a dynamic rigid-body.
      let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(tail.x, tail.y + 40, tail.z)
        .setCcdEnabled(true);
      // .setAngvel(new RAPIER.Vector3(41, 31, 21));
      let rigidBody = world.createRigidBody(rigidBodyDesc);

      // Create a cuboid collider attached to the dynamic rigidBody.
      let colliderDesc = RAPIER.ColliderDesc.ball(targetSize);
      let collider = world.createCollider(colliderDesc, rigidBody);

      bones.push({
        rb: rigidBody,
        collider,
        bone: obj,
        display: cube,
        name,
        prevname,
      });
    }

    for (const bone of sm.skeleton.bones) addJoints(bone);

    for (const b of bones) boneMap.set(b.name, b);

    for (const b of bones) {
      const prev = boneMap.get(b.prevname);
      console.log(b.name, b.prevname);
      if (!prev) {
        console.log("failed to find: ", b.prevname);
        continue;
      }

      const prevpos = prev.rb.translation();
      const pos = b.rb.translation();

      const joint = world.createImpulseJoint(
        RAPIER.JointData.spherical(
          {
            x: prevpos.x - pos.x,
            y: prevpos.y - pos.y,
            z: prevpos.z - pos.z,
          },
          { x: 0, y: 0, z: 0 }
        ),
        b.rb,
        prev.rb,
        true
      );
    }
  }

  // Create the ground
  let groundColliderDesc = RAPIER.ColliderDesc.cuboid(5.0, 0.05, 5.0);
  world.createCollider(groundColliderDesc);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0.0, 4.5, 0.0)
    .setAngvel(new RAPIER.Vector3(11, 12, 12))
    .setLinvel(0, 1, 0);
  let rigidBody = world.createRigidBody(rigidBodyDesc);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(1.5, 1.5, 1.5);
  let collider = world.createCollider(colliderDesc, rigidBody);

  for (let i = 0; i < 300; i++) {
    const posx = Math.random() * 30 - 15;
    const posy = Math.random() * 30;
    const posz = Math.random() * 30 - 15;

    // Create a dynamic rigid-body.
    let rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      posx,
      posy,
      posz
    );
    let rigidBody = world.createRigidBody(rigidBodyDesc);

    // Create a cuboid collider attached to the dynamic rigidBody.
    let colliderDesc = RAPIER.ColliderDesc.ball(1.0);
    let collider = world.createCollider(colliderDesc, rigidBody);

    const geometry = new THREE.SphereGeometry(1.0);
    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(posx, posy, posz);
    scene.add(cube);
  }

  // Game loop. Replace by your own game loop system.
  let gameLoop = () => {
    // Ste the simulation forward.
    world.step();

    // Get and print the rigid-body's position.
    let position = rigidBody.translation();
    physobj.position.x = position.x;
    physobj.position.y = position.y;
    physobj.position.z = position.z;
    const rigidbodyRotation = rigidBody.rotation();
    physobj.quaternion.set(
      rigidbodyRotation.x,
      rigidbodyRotation.y,
      rigidbodyRotation.z,
      rigidbodyRotation.w
    );

    for (const { rb, bone, display, prevname } of bones) {
      const pos = rb.translation();
      const rot = rb.rotation();
      const prev = boneMap.get(prevname);

      if (!prev) {
        bone.position.set(pos.x, pos.y, pos.z);
        display.position.set(pos.x, pos.y, pos.z);
        continue;
      }

      bone.position.set(
        prev.rb.translation().x,
        prev.rb.translation().y,
        prev.rb.translation().z
      );
      display.position.set(
        prev.rb.translation().x,
        prev.rb.translation().y,
        prev.rb.translation().z
      );

      //bone.up = new THREE.Vector3(0, 0, 1);
      bone.lookAt(new THREE.Vector3(pos.x, pos.y, pos.z));
      bone.rotateX((Math.PI * 1) / 2);
      bone.rotateOnAxis(new THREE.Vector3(0, 1, 0), (Math.PI / 2) * 2);
      display.quaternion.copy(bone.quaternion);
    }

    setTimeout(gameLoop, 16);
  };

  let renderLoop = () => {
    renderer.render(scene, camera);

    let now = Date.now();

    // console.log(1000 / (now - time));

    time = now;

    requestAnimationFrame(renderLoop);
  };

  setTimeout(gameLoop, 0);
  renderLoop();
}

run_simulation();
