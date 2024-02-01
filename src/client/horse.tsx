import RAPIER, { CoefficientCombineRule } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

async function asyncLoadGLTF(filename: string): Promise<THREE.Scene> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(filename, (e) => {
      resolve(e.scene);
    });
  });
}

export class Horse {
  horse: THREE.Scene;
  bones: {
    rb: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    bone: THREE.Bone;
    display: THREE.Mesh;
    name: string;
    prevname: string;
  }[] = [];
  boneMap: Map<string, (typeof this.bones)[0]> = new Map();
  scene: THREE.Scene;
  world: RAPIER.World;

  constructor(world: RAPIER.World, scene: THREE.Scene) {
    this.scene = scene;
    this.world = world;
  }

  async init(x, y, z) {
    // load assets
    const horse = await asyncLoadGLTF("horse.glb");
    const horsebones = await (await fetch("horsebones.json")).json();

    // load "tails" of horse bones
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
          x: hb.tail.x,
          y: hb.tail.z,
          z: -hb.tail.y,
        },
      ])
    );

    // add horse to scene
    this.scene.add(horse);

    // horse mesh
    const sm = horse.children[0] as THREE.SkinnedMesh;

    const organizeBones = (obj: THREE.Bone) => {
      const [name, prevname] = obj.name.split("_");

      const tail = hbtails.get(name)!;

      // determine how big the horse bone collider can be
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
      const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(tail.x, tail.y, tail.z);
      // this.scene.add(cube);

      // create horse bone rigidbody + collider
      let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(tail.x + x, tail.y + y, tail.z + z)
        .setCcdEnabled(true);
      let rigidBody = this.world.createRigidBody(rigidBodyDesc);
      let colliderDesc = RAPIER.ColliderDesc.ball(targetSize);
      let collider = this.world.createCollider(colliderDesc, rigidBody);
      collider.setRestitution(0.9);
      collider.setRestitutionCombineRule(CoefficientCombineRule.Max);

      // add bone to list
      this.bones.push({
        rb: rigidBody,
        collider,
        bone: obj,
        display: cube,
        name,
        prevname,
      });
    };

    // organize all the bones
    for (const bone of sm.skeleton.bones) organizeBones(bone);
    for (const b of this.bones) this.boneMap.set(b.name, b);

    // create joints between the bones
    for (const b of this.bones) {
      const prev = this.boneMap.get(b.prevname);
      console.log(b.name, b.prevname);
      if (!prev) {
        console.log("failed to find: ", b.prevname);
        continue;
      }

      const prevpos = prev.rb.translation();
      const pos = b.rb.translation();

      const joint = this.world.createImpulseJoint(
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

  update() {
    for (const { rb, bone, display, prevname } of this.bones) {
      const pos = rb.translation();
      const rot = rb.rotation();
      const prev = this.boneMap.get(prevname);

      // edge case: root bone
      if (!prev) {
        bone.position.set(pos.x, pos.y, pos.z);
        display.position.set(pos.x, pos.y, pos.z);
        continue;
      }

      // update position
      bone.position.set(
        prev.rb.translation().x,
        prev.rb.translation().y,
        prev.rb.translation().z
      );

      // update rotation: should look at bone tail
      bone.lookAt(new THREE.Vector3(pos.x, pos.y, pos.z));
      bone.rotateX((Math.PI * 1) / 2);
      bone.rotateOnAxis(new THREE.Vector3(0, 1, 0), (Math.PI / 2) * 2);
      //display.quaternion.copy(bone.quaternion);
    }
  }
}
