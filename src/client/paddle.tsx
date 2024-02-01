import RAPIER, { CharacterCollision } from "@dimforge/rapier3d-compat";
import * as THREE from "three";

function createBoxRigidBody(x1, y1, z1, x2, y2, z2, world: RAPIER.World) {
  // mesh.position.set(x1, y1, z1);
  const rigidBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      (z1 + z2) / 2
    )
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      Math.abs(x2 - x1) / 2,
      Math.abs(y2 - y1) / 2,
      Math.abs(z2 - z1) / 2
    ),
    rigidBody
  );

  return {
    rigidBody,
    collider,
  };
}

function createBoxMeshAndRigidBody(
  x1,
  y1,
  z1,
  x2,
  y2,
  z2,
  world: RAPIER.World,
  scene: THREE.Scene,
  color: number,
  fixed: boolean
) {
  // create display cube
  const geometry = new THREE.BoxGeometry(
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
    Math.abs(z2 - z1)
  );
  const material = new THREE.MeshPhongMaterial({ color: color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  scene.add(mesh);

  return {
    ...createBoxRigidBody(x1, y1, z1, x2, y2, z2, world),
    mesh,
  };
}

export class Paddle {
  collider: RAPIER.Collider;
  rb: RAPIER.RigidBody;
  display: THREE.Mesh;
  scene: THREE.Scene;
  world: RAPIER.World;
  rc: THREE.Raycaster;
  pointer: THREE.Vector2;
  backboard: Backboard;
  camera: THREE.Camera;
  cc: RAPIER.KinematicCharacterController;

  onMouseMove(e: MouseEvent) {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    // console.log(this.pointer.x, this.pointer.y);
  }

  constructor(
    world: RAPIER.World,
    scene: THREE.Scene,
    camera: THREE.Camera,
    backboard: Backboard
  ) {
    this.scene = scene;
    this.world = world;
    this.camera = camera;

    this.pointer = new THREE.Vector2();
    this.rc = new THREE.Raycaster();

    window.addEventListener("pointermove", (e) => this.onMouseMove(e));

    this.backboard = backboard;

    // const stuff = createBoxMeshAndRigidBody(
    //   0,
    //   0,
    //   5,
    //   4,
    //   0.5,
    //   15,
    //   this.world,
    //   0xffffff,
    //   false
    // );
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(2, 1, 4.8),
      this.rb
    );
    this.rb.setTranslation(new RAPIER.Vector3(0, 0, 5), true);
    this.rb.enableCcd(true);
    this.collider.setDensity(0);
    this.cc = world.createCharacterController(0.3);
    this.cc.setApplyImpulsesToDynamicBodies(true);

    const geometry = new THREE.BoxGeometry(4, 2, 9.6);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    this.display = mesh;

    scene.add(this.display);
  }

  update() {
    this.rc.setFromCamera(this.pointer, this.camera);
    const intersects = this.rc.intersectObject(this.backboard.display);

    const firstIntersect = intersects[0];
    const pos = this.rb.translation();

    if (firstIntersect) {
      let force: [number, number, number] = [
        firstIntersect.point.x - pos.x,
        firstIntersect.point.y - pos.y,
        5 - pos.z,
      ];

      const dist = Math.hypot(...force);
      const forceMag = Math.min(10 * dist, 40);

      force = force.map((f) => (forceMag * f) / dist) as [
        number,
        number,
        number
      ];

      this.rb.setLinvel(new RAPIER.Vector3(...force), true);
    }

    this.display.position.set(pos.x, pos.y, pos.z);

    // for (let i = 0; i < this.cc.numComputedCollisions(); i++) {
    //   let collision = this.cc.computedCollision(i);

    //   collision?.collider
    // }
  }
}

export class Backboard {
  scene: THREE.Scene;
  world: RAPIER.World;
  collider: RAPIER.Collider;
  rb: RAPIER.RigidBody;
  display: THREE.Mesh;

  constructor(world: RAPIER.World, scene: THREE.Scene) {
    this.scene = scene;
    this.world = world;
    const stuff = createBoxMeshAndRigidBody(
      -15,
      -15,
      -1,
      15,
      15,
      0,
      this.world,
      this.scene,
      0xcccccc,
      true
    );

    // front panel
    createBoxRigidBody(-15, -15, 10, 15, 15, 15, this.world);

    // left side panel
    createBoxMeshAndRigidBody(
      -20,
      -20,
      -5,
      -15,
      20,
      15,
      this.world,
      this.scene,
      0xcccccc,
      true
    );
    // right side panel
    createBoxMeshAndRigidBody(
      15,
      -20,
      -5,
      20,
      20,
      15,
      this.world,
      this.scene,
      0xcccccc,
      true
    );
    // top side panel
    createBoxMeshAndRigidBody(
      -20,
      15,
      -5,
      20,
      20,
      15,
      this.world,
      this.scene,
      0xcccccc,
      true
    );

    this.collider = stuff.collider;
    this.rb = stuff.rigidBody;
    this.display = stuff.mesh;
    scene.add(this.display);
  }
}
