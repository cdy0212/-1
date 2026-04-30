const socket = io();

let scene, camera, renderer;
let playerId = null;
let players = {};
let enemies = [];
let bullets = [];
let myHealth = 100;
let score = 0;

const moveSpeed = 0.3;
const keys = { w: false, a: false, s: false, d: false };
let pitch = 0, yaw = 0;

const playerMeshes = new Map();
const enemyMeshes = new Map();
const bulletMeshes = [];

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 10, 100);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xff4655, 0.5, 50);
  pointLight.position.set(0, 10, 0);
  scene.add(pointLight);

  createFloor();
  createWalls();

  setupControls();
  animate();
}

function createFloor() {
  const floorGeometry = new THREE.PlaneGeometry(100, 100, 20, 20);
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2a2a4a,
    roughness: 0.8,
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(100, 50, 0x444466, 0x333355);
  scene.add(gridHelper);
}

function createWalls() {
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a5a });
  const wallHeight = 5;
  const wallThickness = 1;
  const arenaSize = 50;

  const walls = [
    { x: 0, z: -arenaSize, w: arenaSize * 2, d: wallThickness },
    { x: 0, z: arenaSize, w: arenaSize * 2, d: wallThickness },
    { x: -arenaSize, z: 0, w: wallThickness, d: arenaSize * 2 },
    { x: arenaSize, z: 0, w: wallThickness, d: arenaSize * 2 }
  ];

  walls.forEach(wall => {
    const geometry = new THREE.BoxGeometry(wall.w, wallHeight, wall.d);
    const mesh = new THREE.Mesh(geometry, wallMaterial);
    mesh.position.set(wall.x, wallHeight / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 20;
    const obstacleGeometry = new THREE.BoxGeometry(3, 2, 3);
    const obstacle = new THREE.Mesh(obstacleGeometry, wallMaterial);
    obstacle.position.set(
      Math.cos(angle) * radius,
      1,
      Math.sin(angle) * radius
    );
    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    scene.add(obstacle);
  }
}

function createPlayerMesh(id, color) {
  const group = new THREE.Group();

  const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: color });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffccaa });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.7;
  group.add(head);

  const gunGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.4);
  const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const gun = new THREE.Mesh(gunGeometry, gunMaterial);
  gun.position.set(0.2, 1.1, 0.3);
  group.add(gun);

  scene.add(group);
  playerMeshes.set(id, group);
}

function createEnemyMesh(enemy) {
   const group = new THREE.Group();

   // 更立體的身體 - 增大尺寸並使用更詳細的幾何體
   const bodyGeometry = new THREE.CapsuleGeometry(0.6, 1.5, 8, 16);
   const bodyMaterial = new THREE.MeshStandardMaterial({ 
     color: 0xff4655,
     emissive: 0x330011,
     roughness: 0.5,
     metalness: 0.3
   });
   const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
   body.position.y = 0.9;
   body.castShadow = true;
   body.receiveShadow = true;
   group.add(body);

   // 更立體的頭部
   const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
   const headMaterial = new THREE.MeshStandardMaterial({ 
     color: 0x222222,
     emissive: 0xff0000,
     emissiveIntensity: 0.5
   });
   const head = new THREE.Mesh(headGeometry, headMaterial);
   head.position.y = 2.1;
   group.add(head);

   // 更明顯的眼睛
   const eyeGeometry = new THREE.SphereGeometry(0.12, 12, 12);
   const eyeMaterial = new THREE.MeshStandardMaterial({ 
     color: 0xff0000,
     emissive: 0xff0000,
     emissiveIntensity: 1.5
   });
   const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
   leftEye.position.set(-0.2, 2.2, 0.3);
   group.add(leftEye);
   const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
   rightEye.position.set(0.2, 2.2, 0.3);
   group.add(rightEye);

   // 添加一些裝甲細節來增加立體感
   const shoulderGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.6);
   const shoulderMaterial = new THREE.MeshStandardMaterial({ 
     color: 0xff6666,
     emissive: 0x440022,
     roughness: 0.4
   });
   const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
   leftShoulder.position.set(-0.5, 1.5, 0);
   leftShoulder.castShadow = true;
   group.add(leftShoulder);
   const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
   rightShoulder.position.set(0.5, 1.5, 0);
   rightShoulder.castShadow = true;
   group.add(rightShoulder);

   group.position.set(enemy.x, 0, enemy.z);
   scene.add(group);
   enemyMeshes.set(enemy.id, group);
 }

function setupControls() {
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
  });

  document.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    }
  });

  renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.pointerLockElement) {
      shoot();
    }
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    socket.emit('startGame');
  });
}

function shoot() {
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(camera.quaternion);

  socket.emit('shoot', {
    x: camera.position.x,
    z: camera.position.z,
    rotation: yaw
  });

  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const bulletMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1
  });
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  bullet.position.copy(camera.position);
  bullet.userData = { 
    velocity: direction.multiplyScalar(1),
    life: 100
  };
  scene.add(bullet);
  bulletMeshes.push(bullet);

  checkHit(bullet);
}

function checkHit(bullet) {
   const bulletPos = bullet.position;

   enemies.forEach(enemy => {
     const enemyMesh = enemyMeshes.get(enemy.id);
     if (enemyMesh) {
       const dist = bulletPos.distanceTo(enemyMesh.position);
       if (dist < 2.5) { // 增大擊中判定範圍，使其一槍命中更容易
         socket.emit('hitEnemy', { enemyId: enemy.id });
         bullet.userData.life = 0;
       }
     }
   });
 }

function updateBullets() {
  for (let i = bulletMeshes.length - 1; i >= 0; i--) {
    const bullet = bulletMeshes[i];
    bullet.position.add(bullet.userData.velocity);
    bullet.userData.life--;

    if (bullet.userData.life <= 0 || 
        Math.abs(bullet.position.x) > 50 || 
        Math.abs(bullet.position.z) > 50) {
      scene.remove(bullet);
      bulletMeshes.splice(i, 1);
    }
  }
}

function updateMovement() {
  if (!playerId || !players[playerId]) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

  let moved = false;
  const newPos = camera.position.clone();

  if (keys.w) { newPos.add(forward.multiplyScalar(moveSpeed)); moved = true; }
  if (keys.s) { newPos.add(forward.multiplyScalar(-moveSpeed)); moved = true; }
  if (keys.a) { newPos.add(right.multiplyScalar(-moveSpeed)); moved = true; }
  if (keys.d) { newPos.add(right.multiplyScalar(moveSpeed)); moved = true; }

  newPos.x = Math.max(-49, Math.min(49, newPos.x));
  newPos.z = Math.max(-49, Math.min(49, newPos.z));

  if (moved) {
    camera.position.copy(newPos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    socket.emit('move', {
      x: camera.position.x,
      z: camera.position.z,
      rotation: yaw
    });
  }
}

function updatePlayers() {
  Object.entries(players).forEach(([id, player]) => {
    if (id === playerId) return;

    let mesh = playerMeshes.get(id);
    if (!mesh) {
      createPlayerMesh(id, Math.random() * 0xffffff);
      mesh = playerMeshes.get(id);
    }

    mesh.position.x = player.x;
    mesh.position.z = player.z;
    mesh.rotation.y = player.rotation;
  });

  playerMeshes.forEach((mesh, id) => {
    if (!players[id]) {
      scene.remove(mesh);
      playerMeshes.delete(id);
    }
  });
}

function updateEnemies() {
  enemies.forEach(enemy => {
    let mesh = enemyMeshes.get(enemy.id);
    if (!mesh) {
      createEnemyMesh(enemy);
      mesh = enemyMeshes.get(enemy.id);
    }

    mesh.position.x = enemy.x;
    mesh.position.z = enemy.z;

    const playerPos = camera.position;
    mesh.lookAt(playerPos.x, 1, playerPos.z);
  });

  enemyMeshes.forEach((mesh, id) => {
    if (!enemies.find(e => e.id === id)) {
      scene.remove(mesh);
      enemyMeshes.delete(id);
    }
  });
}

function updateUI() {
   document.getElementById('health-fill').style.width = `${myHealth}%`;
   document.getElementById('player-count').textContent = `玩家: ${Object.keys(players).length}/5`;
   document.getElementById('enemy-count').textContent = `敵人: ${enemies.length}`;
   document.getElementById('score').textContent = `分數: ${score}`;
 }

function animate() {
  requestAnimationFrame(animate);

  updateMovement();
  updateBullets();
  updatePlayers();
  updateEnemies();
  updateUI();

  renderer.render(scene, camera);
}

socket.on('init', (data) => {
  playerId = data.id;
  players = data.players;
  enemies = data.enemies;
  init();

  if (data.players[playerId]) {
    camera.position.set(data.players[playerId].x, 1.7, data.players[playerId].z);
  }
});

socket.on('playerJoined', (player) => {
  players[player.id] = player;
});

socket.on('playerLeft', (id) => {
  delete players[id];
  const mesh = playerMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    playerMeshes.delete(id);
  }
});

socket.on('gameState', (data) => {
  players = data.players;
  enemies = data.enemies;
});

socket.on('enemySpawned', (enemy) => {
   // 限制最多同時存在5個敵人
   if (enemies.length < 5) {
     enemies.push(enemy);
   }
 });

socket.on('enemyDied', (enemyId) => {
   enemies = enemies.filter(e => e.id !== enemyId);
   const mesh = enemyMeshes.get(enemyId);
   if (mesh) {
     scene.remove(mesh);
     enemyMeshes.delete(enemyId);
   }
   // 增加分數：每擊殺一個敵人加 50 分
   score += 50;
 });

socket.on('playerHealthUpdate', (data) => {
  if (data.playerId === playerId) {
    myHealth = data.health;
  }
});

socket.on('gameStarted', () => {
   document.getElementById('start-screen').style.display = 'none';
   camera.position.set(0, 1.7, 0);
   myHealth = 100;
   score = 0; // 重置分數
   enemies = [];
   playerMeshes.forEach((mesh) => scene.remove(mesh));
   playerMeshes.clear();
   enemyMeshes.forEach((mesh) => scene.remove(mesh));
   enemyMeshes.clear();
 });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
