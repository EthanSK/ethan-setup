// Check real Three.js geometry without a GPU; canvas drawing and wallpaper decoding are covered by the browser checks.
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'setup-models-'));
const threeUrl = pathToFileURL(join(root, 'docs/lib/three.module.min.js')).href;
const THREE = await import(threeUrl);
const gradient = {addColorStop() {}};
const context = new Proxy({}, {get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : () => {}});
globalThis.matchMedia = () => ({matches: false});
globalThis.document = {createElement: () => ({getContext: () => context})};
globalThis.Path2D = class {};
THREE.ImageLoader.prototype.loadAsync = async () => ({naturalWidth: 1280, naturalHeight: 720});
try {
  const rounded = (await readFile(join(root, 'docs/lib/RoundedBoxGeometry.js'), 'utf8')).replace(/from 'three'/g, `from '${threeUrl}'`);
  await writeFile(join(temporary, 'rounded.mjs'), rounded);
  const source = (await readFile(join(root, 'docs/product-models.mjs'), 'utf8'))
    .replace('from "three"', `from '${threeUrl}'`)
    .replace('from "./lib/RoundedBoxGeometry.js"', 'from "./rounded.mjs"');
  await writeFile(join(temporary, 'models.mjs'), source + '\nexport {builders, boundingRadius};\n');
  const {builders, boundingRadius} = await import(pathToFileURL(join(temporary, 'models.mjs')).href);
  let count = 0;
  for (const [id, build] of Object.entries(builders)) {
    const {group, movements = []} = await build();
    for (const movement of movements) movement.apply(0);
    group.updateMatrixWorld(true);
    const resting = new Map();
    group.traverse(object => {
      resting.set(object, object.matrix.clone());
      const positions = object.geometry?.attributes.position;
      if (positions) assert(positions.array.every(Number.isFinite), `${id}: invalid vertex`);
    });
    const bounds = new THREE.Box3().setFromObject(group);
    for (const movement of movements) {
      for (let i = 0; i <= 16; i++) { movement.apply(i / 16); bounds.union(new THREE.Box3().setFromObject(group)); }
      movement.apply(0);
      group.updateMatrixWorld(true);
      for (const [object, matrix] of resting) assert(object.matrix.elements.every((n, i) => Math.abs(n - matrix.elements[i]) < 1e-8), `${id}/${movement.name}: reset changes another adjustment`);
    }
    group.position.sub(bounds.getCenter(new THREE.Vector3()));
    let fitted = boundingRadius(group);
    for (const movement of movements) {
      for (let i = 0; i <= 16; i++) { movement.apply(i / 16); fitted = Math.max(fitted, boundingRadius(group, true)); }
      movement.apply(0);
    }
    assert(Number.isFinite(fitted) && fitted > 0, `${id}: invalid camera radius`);
    for (const movement of movements) {
      let changed = false;
      for (let i = 0; i <= 80; i++) {
        movement.apply(i / 80);
        assert(boundingRadius(group, true) <= fitted * 1.06, `${id}/${movement.name}: leaves fitted camera sphere`);
        group.traverse(object => {
          assert(object.matrixWorld.elements.every(Number.isFinite), `${id}/${movement.name}: invalid transform`);
          if (object !== group && object.matrix.elements.some((n, k) => Math.abs(n - resting.get(object).elements[k]) > 1e-6)) changed = true;
        });
      }
      assert(changed, `${id}/${movement.name}: no moving part`);
      movement.apply(0);
      count++;
    }
    console.log(`${id}: geometry and ${movements.length} movements passed`);
  }
  console.log(`${Object.keys(builders).length} products, ${count} movement sweeps: finite coordinates, independent reset and camera containment passed`);
} finally {
  await rm(temporary, {recursive: true, force: true});
}
