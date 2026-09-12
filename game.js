import * as T from
  'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';


/* =========================================================
   CONSTANTS
   ========================================================= */

const COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#facc15',
  '#f97316',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#f8fafc'
];

const RACE_LAPS = 3;
const RACE_COUNTDOWN = 3000;

const CHECKPOINT_COUNT = 16;
const CHECKPOINT_RADIUS = 4.5;
const CHECKPOINT_WINDOW = 5;

const MAX_PLAYERS = 9;

const SNAPSHOT_INTERVAL = 50;
const INPUT_INTERVAL = 45;


/* =========================================================
   DOM
   ========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   NETWORK STATE
   ========================================================= */

let peer = null;
let conn = null;

let host = false;

let id = '';
let room = '';
let name = '';

let state = 'lobby';

let startAt = 0;
let finishAt = 0;

let lastSnapshot = 0;
let lastInput = 0;

const connections = new Set();


/* =========================================================
   PLAYER STATE
   ========================================================= */

const P = new Map();
const V = new Map();

const input = {
  gas: 0,
  brake: 0,
  left: 0,
  right: 0
};


/* =========================================================
   THREE.JS
   ========================================================= */

const scene =
  new T.Scene();

scene.background =
  new T.Color('#91c8ef');

scene.fog =
  new T.Fog(
    '#91c8ef',
    100,
    300
  );


const camera =
  new T.PerspectiveCamera(
    60,
    innerWidth / innerHeight,
    0.1,
    500
  );


const renderer =
  new T.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance'
  });

renderer.setPixelRatio(
  Math.min(
    devicePixelRatio,
    1.5
  )
);

renderer.setSize(
  innerWidth,
  innerHeight
);

renderer.shadowMap.enabled = true;

document.body.prepend(
  renderer.domElement
);


/* =========================================================
   LIGHTING
   ========================================================= */

scene.add(
  new T.HemisphereLight(
    '#dff5ff',
    '#493628',
    1.8
  )
);

const sun =
  new T.DirectionalLight(
    '#fff1c7',
    2
  );

sun.position.set(
  40,
  90,
  20
);

sun.castShadow = true;

scene.add(sun);


/* =========================================================
   GROUND
   ========================================================= */

const ground =
  new T.Mesh(
    new T.PlaneGeometry(
      500,
      500
    ),
    new T.MeshLambertMaterial({
      color: '#567540'
    })
  );

ground.rotation.x =
  -Math.PI / 2;

ground.position.y =
  -1;

ground.receiveShadow = true;

scene.add(ground);


/* =========================================================
   TRACK
   ========================================================= */

const TRACK_POINTS = [
  [-62, 0],
  [-45, -28],
  [-8, -38],
  [28, -32],
  [62, -12],
  [72, 18],
  [45, 40],
  [8, 48],
  [-28, 40],
  [-62, 24],
  [-78, 0]
];

const curve =
  new T.CatmullRomCurve3(
    TRACK_POINTS.map(
      p =>
        new T.Vector3(
          p[0],
          0,
          p[1]
        )
    ),
    true
  );

const N = 180;

const Q = [];

for (
  let i = 0;
  i < N;
  i++
) {
  Q.push(
    curve.getPointAt(
      i / N
    )
  );
}


/* =========================================================
   TRACK MESH
   ========================================================= */

const trackMaterial =
  new T.MeshLambertMaterial({
    color: '#8b5833'
  });

for (
  let i = 0;
  i < N;
  i++
) {
  const a = Q[i];

  const b =
    Q[
      (i + 1) % N
    ];

  const mid =
    a.clone()
      .add(b)
      .multiplyScalar(0.5);

  const road =
    new T.Mesh(
      new T.BoxGeometry(
        9,
        0.65,
        a.distanceTo(b) + 0.25
      ),
      trackMaterial
    );

  road.position.set(
    mid.x,
    0,
    mid.z
  );

  road.rotation.y =
    Math.atan2(
      b.x - a.x,
      b.z - a.z
    );

  road.receiveShadow = true;

  scene.add(road);
}


/* =========================================================
   ENVIRONMENT
   ========================================================= */

function addBox(
  x,
  y,
  z,
  width,
  height,
  depth,
  color
) {
  const mesh =
    new T.Mesh(
      new T.BoxGeometry(
        width,
        height,
        depth
      ),
      new T.MeshLambertMaterial({
        color
      })
    );

  mesh.position.set(
    x,
    y,
    z
  );

  mesh.castShadow = true;

  scene.add(mesh);

  return mesh;
}


for (
  let i = 0;
  i < 30;
  i++
) {
  const p =
    curve.getPointAt(
      Math.random()
    );

  const angle =
    Math.atan2(
      p.z,
      p.x
    );

  const radius =
    13 +
    Math.random() * 10;

  const side =
    Math.random() < 0.5
      ? -1
      : 1;

  const x =
    p.x +
    Math.cos(
      angle + Math.PI / 2
    ) *
    radius *
    side;

  const z =
    p.z +
    Math.sin(
      angle + Math.PI / 2
    ) *
    radius *
    side;

  addBox(
    x,
    2,
    z,
    1.2,
    4,
    1.2,
    '#573923'
  );

  const tree =
    new T.Mesh(
      new T.IcosahedronGeometry(
        3.5,
        1
      ),
      new T.MeshLambertMaterial({
        color: '#2f6b36'
      })
    );

  tree.position.set(
    x,
    6,
    z
  );

  tree.castShadow = true;

  scene.add(tree);
}


/* =========================================================
   START / FINISH GATE
   ========================================================= */

addBox(
  -4,
  3,
  0,
  0.7,
  6,
  0.7,
  '#eee'
);

addBox(
  4,
  3,
  0,
  0.7,
  6,
  0.7,
  '#eee'
);

addBox(
  0,
  6,
  0,
  8.7,
  0.7,
  0.7,
  '#f0a500'
);


/* =========================================================
   CHECKPOINTS
   ========================================================= */

const CHECKPOINTS =
  Array.from(
    {
      length: CHECKPOINT_COUNT
    },
    (_, i) =>
      Math.round(
        i *
        N /
        CHECKPOINT_COUNT
      )
  );


function circularDistance(a, b) {
  const d =
    Math.abs(
      a - b
    );

  return Math.min(
    d,
    N - d
  );
}


/* =========================================================
   BIKE
   ========================================================= */

function createBike(color) {
  const group =
    new T.Group();

  const bodyMaterial =
    new T.MeshLambertMaterial({
      color
    });

  const darkMaterial =
    new T.MeshLambertMaterial({
      color: '#17191c'
    });


  function add(
    geometry,
    position,
    material = bodyMaterial
  ) {
    const mesh =
      new T.Mesh(
        geometry,
        material
      );

    mesh.position.set(
      ...position
    );

    mesh.castShadow = true;

    group.add(mesh);

    return mesh;
  }


  add(
    new T.BoxGeometry(
      1.2,
      0.45,
      2.4
    ),
    [0, 1.15, 0]
  );


  add(
    new T.BoxGeometry(
      1,
      0.25,
      1.1
    ),
    [0, 1.55, 0.2],
    darkMaterial
  );


  for (
    const z of [-1.05, 1.05]
  ) {
    const wheel =
      add(
        new T.CylinderGeometry(
          0.52,
          0.52,
          0.22,
          12
        ),
        [0, 0.55, z],
        darkMaterial
      );

    wheel.rotation.z =
      Math.PI / 2;
  }


  add(
    new T.BoxGeometry(
      0.18,
      0.2,
      1.4
    ),
    [0, 1.05, -0.85],
    darkMaterial
  );


  add(
    new T.BoxGeometry(
      1.35,
      0.12,
      0.12
    ),
    [0, 1.75, -0.8],
    darkMaterial
  );


  add(
    new T.SphereGeometry(
      0.4,
      10,
      8
    ),
    [0, 2.25, 0.15],
    darkMaterial
  );


  return group;
}


/* =========================================================
   TRACK SEARCH
   ========================================================= */

function nearestTrack(x, z) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (
    let i = 0;
    i < N;
    i++
  ) {
    const dx =
      Q[i].x - x;

    const dz =
      Q[i].z - z;

    const distance =
      dx * dx +
      dz * dz;

    if (
      distance <
      bestDistance
    ) {
      bestDistance =
        distance;

      bestIndex =
        i;
    }
  }

  return [
    bestIndex,
    Math.sqrt(
      bestDistance
    )
  ];
}


/* =========================================================
   PLAYER BASE
   ========================================================= */

function base(index = 0) {
  const a =
    Q[
      index % N
    ];

  const b =
    Q[
      (index + 1) % N
    ];

  return {
    x: a.x,
    z: a.z,

    rot:
      Math.atan2(
        b.x - a.x,
        b.z - a.z
      ),

    vx: 0,
    vz: 0,

    cp: 0,
    lap: 0,
    prog: index,

    finished: 0,
    ft: 0,

    resp: 0,

    input: {
      gas: 0,
      brake: 0,
      left: 0,
      right: 0
    }
  };
}


/* =========================================================
   ADD PLAYER
   ========================================================= */

function addPlayer(
  playerId,
  playerName,
  color,
  index = 0
) {
  if (
    P.has(playerId)
  ) {
    return;
  }

  const player = {
    id: playerId,

    name:
      playerName ||
      'Rider',

    color:
      color ||
      COLORS[
        P.size %
        COLORS.length
      ],

    ...base(index)
  };

  P.set(
    playerId,
    player
  );

  const visual =
    createBike(
      player.color
    );

  scene.add(
    visual
  );

  V.set(
    playerId,
    visual
  );
}


/* =========================================================
   RESET PLAYER
   ========================================================= */

function resetPlayer(
  player,
  index
) {
  const playerName =
    player.name;

  const color =
    player.color;

  Object.assign(
    player,
    base(index),
    {
      name: playerName,
      color: color
    }
  );
}


/* =========================================================
   RANKING
   ========================================================= */

function ranking() {
  return [
    ...P.values()
  ].sort(
    (a, b) =>
      b.finished -
        a.finished ||

      b.lap -
        a.lap ||

      b.prog -
        a.prog ||

      a.ft -
        b.ft
  );
}


/* =========================================================
   CHECKPOINT
   ========================================================= */

function checkCheckpoint(player) {
  const [
    nearest,
    distance
  ] =
    nearestTrack(
      player.x,
      player.z
    );

  player.prog =
    nearest;

  const next =
    (
      player.cp + 1
    ) %
    CHECKPOINT_COUNT;

  const targetIndex =
    CHECKPOINTS[next];

  const target =
    Q[targetIndex];

  const targetDistance =
    Math.hypot(
      target.x -
        player.x,
      target.z -
        player.z
    );

  if (
    distance > 30 ||
    targetDistance >
      CHECKPOINT_RADIUS
  ) {
    return;
  }

  if (
    circularDistance(
      nearest,
      targetIndex
    ) >
    CHECKPOINT_WINDOW
  ) {
    return;
  }

  const nextTrackIndex =
    (
      nearest + 1
    ) % N;

  const a =
    Q[nearest];

  const b =
    Q[nextTrackIndex];

  let tx =
    b.x - a.x;

  let tz =
    b.z - a.z;

  const length =
    Math.hypot(
      tx,
      tz
    );

  if (
    length <= 0
  ) {
    return;
  }

  tx /= length;
  tz /= length;

  const speed =
    Math.hypot(
      player.vx,
      player.vz
    );

  const forwardVelocity =
    player.vx * tx +
    player.vz * tz;

  if (
    speed < 1.5
  ) {
    return;
  }

  if (
    forwardVelocity <= 0.5
  ) {
    return;
  }

  player.cp =
    next;

  if (
    next === 0
  ) {
    player.lap++;

    if (
      player.lap >=
        RACE_LAPS &&
      !player.finished
    ) {
      player.finished = 1;

      player.ft =
        performance.now() -
        startAt;

      if (
        !finishAt
      ) {
        finishAt =
          performance.now();
      }
    }
  }
}


/* =========================================================
   RESPAWN
   ========================================================= */

function respawnPlayer(player) {
  if (
    !player ||
    player.finished ||
    player.resp > 0
  ) {
    return;
  }

  const checkpoint =
    player.cp %
    CHECKPOINT_COUNT;

  const index =
    CHECKPOINTS[
      checkpoint
    ];

  const a =
    Q[index];

  const b =
    Q[
      (index + 1) % N
    ];

  player.x = a.x;
  player.z = a.z;

  player.rot =
    Math.atan2(
      b.x - a.x,
      b.z - a.z
    );

  player.vx = 0;
  player.vz = 0;

  player.resp = 0.7;
}


/* =========================================================
   PHYSICS
   ========================================================= */

function simulate(
  player,
  dt
) {
  if (
    !player ||
    player.finished
  ) {
    return;
  }

  if (
    player.resp > 0
  ) {
    player.resp -= dt;

    if (
      player.resp < 0
    ) {
      player.resp = 0;
    }

    return;
  }

  const forward = {
    x:
      Math.sin(
        player.rot
      ),

    z:
      Math.cos(
        player.rot
      )
  };

  let speed =
    Math.hypot(
      player.vx,
      player.vz
    );

  const steering =
    (
      player.input?.right
        ? 1
        : 0
    ) -
    (
      player.input?.left
        ? 1
        : 0
    );

  if (
    player.input?.gas
  ) {
    player.vx +=
      forward.x *
      30 *
      dt;

    player.vz +=
      forward.z *
      30 *
      dt;
  }

  if (
    player.input?.brake
  ) {
    player.vx -=
      forward.x *
      22 *
      dt;

    player.vz -=
      forward.z *
      22 *
      dt;
  }

  player.vx *=
    Math.pow(
      0.985,
      dt * 60
    );

  player.vz *=
    Math.pow(
      0.985,
      dt * 60
    );

  speed =
    Math.hypot(
      player.vx,
      player.vz
    );

  if (
    speed > 25
  ) {
    player.vx *=
      25 / speed;

    player.vz *=
      25 / speed;

    speed = 25;
  }

  player.rot +=
    steering *
    (
      0.8 +
      Math.min(
        speed / 25,
        1
      ) *
      1.8
    ) *
    dt;

  const newForward = {
    x:
      Math.sin(
        player.rot
      ),

    z:
      Math.cos(
        player.rot
      )
  };

  player.vx +=
    (
      newForward.x *
        speed -
      player.vx
    ) *
    dt *
    3;

  player.vz +=
    (
      newForward.z *
        speed -
      player.vz
    ) *
    dt *
    3;

  player.x +=
    player.vx *
    dt;

  player.z +=
    player.vz *
    dt;

  const nearest =
    nearestTrack(
      player.x,
      player.z
    );

  if (
    nearest[1] > 30
  ) {
    respawnPlayer(
      player
    );

    return;
  }

  checkCheckpoint(
    player
  );
}


/* =========================================================
   SERIALIZATION
   ========================================================= */

function serialize() {
  return [
    ...P.values()
  ].map(
    player => ({
      x: player.x,
      z: player.z,

      rot: player.rot,

      vx: player.vx,
      vz: player.vz,

      cp: player.cp,
      lap: player.lap,
      prog: player.prog,

      finished:
        player.finished,

      ft: player.ft,
      resp: player.resp,

      id: player.id,
      name: player.name,
      color: player.color
    })
  );
}


/* =========================================================
   APPLY NETWORK STATE
   ========================================================= */

function apply(players) {
  if (
    !Array.isArray(players)
  ) {
    return;
  }

  const incoming =
    new Set(
      players.map(
        player =>
          player.id
      )
    );

  for (
    const [
      playerId,
      visual
    ] of V
  ) {
    if (
      !incoming.has(
        playerId
      )
    ) {
      visual?.removeFromParent();

      V.delete(
        playerId
      );

      P.delete(
        playerId
      );
    }
  }

  for (
    const snapshot
      of players
  ) {
    if (
      !P.has(
        snapshot.id
      )
    ) {
      addPlayer(
        snapshot.id,
        snapshot.name,
        snapshot.color,
        0
      );
    }

    const player =
      P.get(
        snapshot.id
      );

    Object.assign(
      player,
      snapshot
    );

    if (
      !player.input
    ) {
      player.input = {
        gas: 0,
        brake: 0,
        left: 0,
        right: 0
      };
    }
  }
}


/* =========================================================
   NETWORK SEND
   ========================================================= */

function broadcast(message) {
  for (
    const connection
      of connections
  ) {
    if (
      connection &&
      connection.open
    ) {
      try {
        connection.send(
          message
        );
      } catch (error) {
        console.error(
          'Send error:',
          error
        );
      }
    }
  }
}


/* =========================================================
   PEER ID
   ========================================================= */

function peerIdForRoom(roomCode) {
  return String(
    roomCode
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ''
    );
}


/* =========================================================
   HOST CREATE ROOM
   ========================================================= */

function hostStart() {
  if (
    typeof Peer ===
    'undefined'
  ) {
    msg(
      'PeerJS failed to load. Check your internet connection.'
    );

    console.error(
      'PeerJS is undefined.'
    );

    return;
  }

  host = true;

  room =
    'DR9-' +
    Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase();

  const peerId =
    peerIdForRoom(
      room
    );

  console.log(
    'Creating room:',
    room
  );

  console.log(
    'Peer ID:',
    peerId
  );

  msg(
    'CREATING ROOM...'
  );

  try {
    peer =
      new Peer(
        peerId
      );
  } catch (error) {
    console.error(
      'Peer creation failed:',
      error
    );

    host = false;

    msg(
      'ERROR: ' +
      (
        error?.message ||
        error
      )
    );

    return;
  }


  peer.on(
    'open',
    openedId => {
      console.log(
        'Peer opened:',
        openedId
      );

      id =
        openedId;

      addPlayer(
        id,
        name,
        COLORS[0],
        0
      );

      state =
        'lobby';

      lobby();

      msg(
        'ROOM CREATED'
      );
    }
  );


  peer.on(
    'connection',
    connection => {
      console.log(
        'Incoming player:',
        connection.peer
      );

      connections.add(
        connection
      );


      connection.on(
        'open',
        () => {
          console.log(
            'Connection opened:',
            connection.peer
          );

          if (
            state !==
            'lobby'
          ) {
            connection.send({
              type: 'error',
              msg:
                'RACE ALREADY STARTED'
            });

            connection.close();

            return;
          }

          connection.send({
            type: 'hello',
            room,
            players:
              serialize(),
            state
          });
        }
      );


      connection.on(
        'data',
        message => {
          hostMessage(
            connection,
            message
          );
        }
      );


      connection.on(
        'close',
        () => {
          console.log(
            'Player disconnected:',
            connection.peer
          );

          connections.delete(
            connection
          );

          const playerId =
            connection.peer;

          V.get(
            playerId
          )?.removeFromParent();

          V.delete(
            playerId
          );

          P.delete(
            playerId
          );

          broadcast({
            type:
              state ===
              'lobby'
                ? 'lobby'
                : 'snap',

            state,

            players:
              serialize()
          });

          if (
            state ===
            'lobby'
          ) {
            lobby();
          }
        }
      );


      connection.on(
        'error',
        error => {
          console.error(
            'Connection error:',
            error
          );

          connections.delete(
            connection
          );
        }
      );
    }
  );


  peer.on(
    'error',
    error => {
      console.error(
        'PeerJS error:',
        error
      );

      if (
        error.type ===
        'unavailable-id'
      ) {
        msg(
          'ROOM CODE COLLISION — CLICK CREATE AGAIN.'
        );
      } else {
        msg(
          'NETWORK ERROR: ' +
          (
            error.type ||
            error.message ||
            'unknown'
          )
        );
      }
    }
  );


  peer.on(
    'disconnected',
    () => {
      console.warn(
        'Peer disconnected'
      );

      msg(
        'NETWORK DISCONNECTED'
      );
    }
  );
}


/* =========================================================
   HOST MESSAGE
   ========================================================= */

function hostMessage(
  connection,
  message
) {
  if (
    !message ||
    typeof message !==
      'object'
  ) {
    return;
  }


  /* -------------------------------------------------------
     JOIN
     ------------------------------------------------------- */

  if (
    message.type ===
    'join'
  ) {
    if (
      state !==
      'lobby'
    ) {
      connection.send({
        type: 'error',
        msg:
          'RACE ALREADY STARTED'
      });

      return;
    }

    if (
      P.size >=
      MAX_PLAYERS
    ) {
      connection.send({
        type: 'error',
        msg:
          'ROOM FULL — MAXIMUM 9 PLAYERS'
      });

      return;
    }

    const playerName =
      String(
        message.name ||
        'Rider'
      )
        .trim()
        .slice(0, 16) ||
      'Rider';

    addPlayer(
      connection.peer,
      playerName,
      COLORS[
        P.size %
        COLORS.length
      ],
      P.size
    );

    broadcast({
      type: 'lobby',
      players:
        serialize(),
      state
    });

    lobby();

    return;
  }


  /* -------------------------------------------------------
     INPUT
     ------------------------------------------------------- */

  if (
    message.type ===
      'input' &&
    P.has(
      connection.peer
    )
  ) {
    const player =
      P.get(
        connection.peer
      );

    const incoming =
      message.input ||
      {};

    player.input = {
      gas:
        incoming.gas
          ? 1
          : 0,

      brake:
        incoming.brake
          ? 1
          : 0,

      left:
        incoming.left
          ? 1
          : 0,

      right:
        incoming.right
          ? 1
          : 0
    };

    return;
  }


  /* -------------------------------------------------------
     RESPAWN
     ------------------------------------------------------- */

  if (
    message.type ===
      'respawn' &&
    P.has(
      connection.peer
    )
  ) {
    respawnPlayer(
      P.get(
        connection.peer
      )
    );

    return;
  }
}


/* =========================================================
   CLIENT JOIN
   ========================================================= */

function clientJoin(code) {
  if (
    typeof Peer ===
    'undefined'
  ) {
    msg(
      'PeerJS failed to load.'
    );

    return;
  }

  host = false;

  room =
    String(code)
      .trim()
      .toUpperCase();

  console.log(
    'Joining room:',
    room
  );

  msg(
    'CONNECTING TO ROOM...'
  );

  try {
    peer =
      new Peer();
  } catch (error) {
    console.error(
      error
    );

    msg(
      'ERROR: ' +
      (
        error?.message ||
        error
      )
    );

    return;
  }


  peer.on(
    'open',
    clientPeerId => {
      id =
        clientPeerId;

      const peerId =
        peerIdForRoom(
          room
        );

      console.log(
        'Connecting to host:',
        peerId
      );

      conn =
        peer.connect(
          peerId,
          {
            reliable: true
          }
        );


      conn.on(
        'open',
        () => {
          console.log(
            'Connected to host'
          );

          conn.send({
            type: 'join',
            name
          });

          msg(
            'JOINED ROOM'
          );
        }
      );


      conn.on(
        'data',
        message => {
          clientMessage(
            message
          );
        }
      );


      conn.on(
        'close',
        () => {
          handleHostDisconnect();
        }
      );


      conn.on(
        'error',
        error => {
          console.error(
            'Client connection error:',
            error
          );

          msg(
            'CONNECTION ERROR: ' +
            (
              error.type ||
              error.message
            )
          );
        }
      );
    }
  );


  peer.on(
    'error',
    error => {
      console.error(
        'PeerJS client error:',
        error
      );

      msg(
        'UNABLE TO JOIN ROOM: ' +
        (
          error.type ||
          error.message ||
          'unknown'
        )
      );
    }
  );
}


/* =========================================================
   HOST DISCONNECT
   ========================================================= */

function handleHostDisconnect() {
  conn = null;

  state =
    'lobby';

  $('lobby')
    ?.classList
    .add('hidden');

  $('hud')
    ?.classList
    .add('hidden');

  $('finish')
    ?.classList
    .add('hidden');

  $('count')
    ?.classList
    .add('hidden');

  $('menu')
    ?.classList
    .remove('hidden');

  msg(
    'HOST DISCONNECTED — RETURN TO MENU'
  );
}


/* =========================================================
   MESSAGE
   ========================================================= */

function msg(text) {
  const element =
    $('msg');

  if (element) {
    element.textContent =
      String(text);
  }

  console.log(
    '[GAME]',
    text
  );
}


/* =========================================================
   LOBBY
   ========================================================= */

function lobby() {
  $('menu')
    ?.classList
    .add('hidden');

  $('lobby')
    ?.classList
    .remove('hidden');

  $('hud')
    ?.classList
    .add('hidden');

  $('finish')
    ?.classList
    .add('hidden');

  $('count')
    ?.classList
    .add('hidden');

  if (
    $('room')
  ) {
    $('room').textContent =
      room;
  }


  const shareUrl =
    location.href.split('?')[0] +
    '?room=' +
    encodeURIComponent(room);


  if (
    $('share')
  ) {
    $('share').textContent =
      shareUrl;
  }


  let html = '';

  for (
    const player
      of P.values()
  ) {
    html += `
      <div class="p">
        <span
          class="dot"
          style="background:${player.color}"
        ></span>
        ${escapeHtml(player.name)}
        ${
          player.id === id
            ? ' <small>(YOU)</small>'
            : ''
        }
      </div>
    `;
  }


  if (
    $('plist')
  ) {
    $('plist').innerHTML =
      html;
  }


  if (
    $('start')
  ) {
    $('start').textContent =
      host
        ? 'START RACE'
        : 'WAITING FOR HOST...';

    $('start').disabled =
      !host;
  }
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


/* =========================================================
   CLIENT MESSAGE
   ========================================================= */

function clientMessage(message) {
  if (
    !message ||
    typeof message !==
      'object'
  ) {
    return;
  }


  /* -------------------------------------------------------
     INITIAL ROOM STATE
     ------------------------------------------------------- */

  if (
    message.type ===
    'hello'
  ) {
    room =
      message.room ||
      room;

    apply(
      message.players
    );

    state =
      message.state ||
      'lobby';

    lobby();

    msg(
      'ROOM JOINED'
    );

    return;
  }


  /* -------------------------------------------------------
     LOBBY UPDATE
     ------------------------------------------------------- */

  if (
    message.type ===
    'lobby'
  ) {
    state =
      'lobby';

    apply(
      message.players
    );

    lobby();

    return;
  }


  /* -------------------------------------------------------
     START
     ------------------------------------------------------- */

  if (
    message.type ===
    'start'
  ) {
    apply(
      message.players
    );

    const countdown =
      Number.isFinite(
        message.countdown
      )
        ? message.countdown
        : RACE_COUNTDOWN;

    startAt =
      performance.now() +
      countdown;

    state =
      'countdown';

    game();

    return;
  }


  /* -------------------------------------------------------
     SNAPSHOT
     ------------------------------------------------------- */

  if (
    message.type ===
    'snap'
  ) {
    apply(
      message.players
    );

    state =
      message.state;

    if (
      state ===
      'results'
    ) {
      results();
    }

    return;
  }


  /* -------------------------------------------------------
     ERROR
     ------------------------------------------------------- */

  if (
    message.type ===
    'error'
  ) {
    msg(
      message.msg ||
      'NETWORK ERROR'
    );
  }
}


/* =========================================================
   GAME UI
   ========================================================= */

function game() {
  $('menu')
    ?.classList
    .add('hidden');

  $('lobby')
    ?.classList
    .add('hidden');

  $('hud')
    ?.classList
    .remove('hidden');

  $('finish')
    ?.classList
    .add('hidden');
}


/* =========================================================
   RESULTS
   ========================================================= */

function results() {
  let html = '';

  ranking().forEach(
    (player, index) => {
      html += `
        <div class="line">
          <span>
            ${index + 1}.
            ${escapeHtml(player.name)}
          </span>

          <span>
            ${
              player.finished
                ? (
                    player.ft / 1000
                  ).toFixed(1) + 's'
                : 'DNF'
            }
          </span>
        </div>
      `;
    }
  );

  $('results').innerHTML =
    html;

  $('finish')
    .classList
    .remove('hidden');
}


/* =========================================================
   START RACE
   ========================================================= */

function startRace() {
  if (
    !host
  ) {
    return;
  }

  if (
    P.size < 1
  ) {
    return;
  }

  state =
    'countdown';

  startAt =
    performance.now() +
    RACE_COUNTDOWN;

  finishAt = 0;

  lastSnapshot = 0;

  for (
    const [
      ,
      player
    ] of P
  ) {
    const index =
      [...P.keys()]
        .indexOf(
          player.id
        );

    resetPlayer(
      player,
      index
    );
  }

  broadcast({
    type: 'start',

    countdown:
      RACE_COUNTDOWN,

    players:
      serialize()
  });

  game();
}


/* =========================================================
   REMATCH
   ========================================================= */

function resetRace() {
  if (
    !host
  ) {
    return;
  }

  state =
    'lobby';

  finishAt = 0;

  for (
    const [
      ,
      player
    ] of P
  ) {
    const index =
      [...P.keys()]
        .indexOf(
          player.id
        );

    resetPlayer(
      player,
      index
    );
  }

  broadcast({
    type: 'lobby',

    players:
      serialize(),

    state
  });

  lobby();
}


/* =========================================================
   BUTTONS
   ========================================================= */

$('create').onclick =
  () => {
    console.log(
      'CREATE ROOM clicked'
    );

    name =
      $('name')
        .value
        .trim() ||
      'Rider';

    msg(
      'CREATING ROOM...'
    );

    try {
      hostStart();
    } catch (error) {
      console.error(
        'CREATE ROOM ERROR:',
        error
      );

      msg(
        'ERROR: ' +
        (
          error?.message ||
          error
        )
      );
    }
  };


$('join').onclick =
  () => {
    $('joinrow')
      .classList
      .toggle(
        'hidden'
      );
  };


$('go').onclick =
  () => {
    name =
      $('name')
        .value
        .trim() ||
      'Rider';

    const code =
      $('code')
        .value
        .trim();

    if (
      !code
    ) {
      msg(
        'ENTER A ROOM CODE'
      );

      return;
    }

    msg(
      'CONNECTING TO ROOM...'
    );

    try {
      clientJoin(
        code
      );
    } catch (error) {
      console.error(
        'JOIN ERROR:',
        error
      );

      msg(
        'ERROR: ' +
        (
          error?.message ||
          error
        )
      );
    }
  };


$('start').onclick =
  () => {
    startRace();
  };


$('copy').onclick =
  async () => {
    const url =
      location.href.split('?')[0] +
      '?room=' +
      encodeURIComponent(room);

    try {
      await navigator.clipboard.writeText(
        url
      );

      msg(
        'ROOM LINK COPIED!'
      );
    } catch (error) {
      console.error(
        error
      );

      msg(
        'COPY FAILED — ROOM CODE: ' +
        room
      );
    }
  };


$('leave').onclick =
  () => {
    location.reload();
  };


$('rematch').onclick =
  () => {
    resetRace();
  };


$('back').onclick =
  () => {
    if (
      host
    ) {
      resetRace();
    } else {
      location.reload();
    }
  };


/* =========================================================
   KEYBOARD CONTROLS
   ========================================================= */

function handleKeys(
  event,
  pressed
) {
  const key =
    event.key.toLowerCase();

  const mapping = {
    w: 'gas',
    arrowup: 'gas',

    s: 'brake',
    arrowdown: 'brake',

    a: 'left',
    arrowleft: 'left',

    d: 'right',
    arrowright: 'right'
  };

  if (
    key === 'r' &&
    pressed
  ) {
    requestRespawn();

    return;
  }

  const action =
    mapping[key];

  if (
    action
  ) {
    input[action] =
      pressed ? 1 : 0;

    if (
      host &&
      P.has(id)
    ) {
      P.get(id).input = {
        ...input
      };
    }
  }
}


onkeydown =
  event => {
    handleKeys(
      event,
      true
    );
  };


onkeyup =
  event => {
    handleKeys(
      event,
      false
    );
  };


/* =========================================================
   RESPAWN REQUEST
   ========================================================= */

function requestRespawn() {
  if (
    !P.has(id)
  ) {
    return;
  }

  if (
    host
  ) {
    respawnPlayer(
      P.get(id)
    );
  } else {
    conn?.send({
      type: 'respawn'
    });
  }
}


/* =========================================================
   TOUCH CONTROLS
   ========================================================= */

document
  .querySelectorAll(
    '.touch button'
  )
  .forEach(
    button => {
      const key =
        button.dataset.k;

      button.onpointerdown =
        event => {
          event.preventDefault();

          if (
            key === 'r'
          ) {
            requestRespawn();

            return;
          }

          input[key] = 1;

          if (
            host &&
            P.has(id)
          ) {
            P.get(id).input = {
              ...input
            };
          }
        };


      button.onpointerup =
      button.onpointercancel =
      button.onpointerleave =
        event => {
          event.preventDefault();

          if (
            key !== 'r'
          ) {
            input[key] = 0;

            if (
              host &&
              P.has(id)
            ) {
              P.get(id).input = {
                ...input
              };
            }
          }
        };
    }
  );


/* =========================================================
   HUD
   ========================================================= */

function lapLabel(player) {
  if (
    player.finished
  ) {
    return 'FINISHED';
  }

  return (
    'LAP ' +
    Math.min(
      RACE_LAPS,
      player.lap + 1
    ) +
    ' / ' +
    RACE_LAPS
  );
}


function boardLapLabel(player) {
  if (
    player.finished
  ) {
    return 'FINISHED';
  }

  return (
    Math.min(
      RACE_LAPS,
      player.lap + 1
    ) +
    ' / ' +
    RACE_LAPS
  );
}


function updateHud() {
  const player =
    P.get(id);

  if (
    !player
  ) {
    return;
  }

  const rankingList =
    ranking();

  const position =
    rankingList.findIndex(
      p =>
        p.id === id
    );

  $('posv').textContent =
    (
      position + 1
    ) +
    ' / ' +
    P.size;

  $('lapv').textContent =
    lapLabel(player);

  $('tv').textContent =
    Math.max(
      0,
      (
        performance.now() -
        startAt
      ) / 1000
    ).toFixed(1);

  $('board').innerHTML =
    rankingList
      .map(
        (p, index) => `
          <div
            class="line ${
              p.id === id
                ? 'me'
                : ''
            }"
          >
            <span>
              ${index + 1}.
              ${escapeHtml(p.name)}
            </span>

            <span>
              ${boardLapLabel(p)}
            </span>
          </div>
        `
      )
      .join('');
}


/* =========================================================
   GAME LOOP
   ========================================================= */

let previousTime =
  performance.now();


function loop(time) {
  requestAnimationFrame(
    loop
  );

  const dt =
    Math.min(
      0.04,
      (
        time -
        previousTime
      ) / 1000
    );

  previousTime =
    time;


  /* -------------------------------------------------------
     COUNTDOWN
     ------------------------------------------------------- */

  if (
    state ===
    'countdown'
  ) {
    const remaining =
      startAt -
      time;

    $('count')
      .classList
      .remove('hidden');

    $('count').textContent =
      remaining > 2000
        ? '3'
        : remaining > 1000
          ? '2'
          : remaining > 0
            ? '1'
            : 'GO!';

    if (
      remaining < -500
    ) {
      state =
        'race';

      $('count')
        .classList
        .add('hidden');
    }
  }


  /* -------------------------------------------------------
     HOST SIMULATION
     ------------------------------------------------------- */

  if (
    state ===
      'race' &&
    host
  ) {
    for (
      const player
        of P.values()
    ) {
      if (
        !player.finished
      ) {
        simulate(
          player,
          dt
        );
      }
    }


    if (
      time -
      lastSnapshot >=
      SNAPSHOT_INTERVAL
    ) {
      broadcast({
        type: 'snap',

        state,

        players:
          serialize()
      });

      lastSnapshot =
        time;
    }


    if (
      finishAt &&
      time -
        finishAt >
        7000
    ) {
      state =
        'results';

      broadcast({
        type: 'snap',

        state,

        players:
          serialize()
      });

      results();
    }
  }


  /* -------------------------------------------------------
     CLIENT INPUT
     ------------------------------------------------------- */

  if (
    state ===
      'race' &&
    !host &&
    time -
      lastInput >=
      INPUT_INTERVAL
  ) {
    if (
      conn?.open
    ) {
      conn.send({
        type: 'input',

        input: {
          ...input
        }
      });
    }

    lastInput =
      time;
  }


  /* -------------------------------------------------------
     HUD
     ------------------------------------------------------- */

  if (
    state ===
      'race' ||
    state ===
      'countdown'
  ) {
    updateHud();
  }


  /* -------------------------------------------------------
     PLAYER VISUALS
     ------------------------------------------------------- */

  for (
    const player
      of P.values()
  ) {
    const visual =
      V.get(
        player.id
      );

    if (
      !visual
    ) {
      continue;
    }

    visual.position.set(
      player.x,
      player.resp > 0
        ? -0.8
        : 0,
      player.z
    );

    visual.rotation.y =
      player.rot;
  }


  /* -------------------------------------------------------
     CAMERA
     ------------------------------------------------------- */

  const local =
    P.get(id);

  if (
    local
  ) {
    const target =
      new T.Vector3(
        local.x -
          8 *
          Math.sin(
            local.rot
          ),

        5,

        local.z -
          8 *
          Math.cos(
            local.rot
          )
      );

    camera.position.lerp(
      target,
      0.1
    );

    camera.lookAt(
      local.x,
      1.2,
      local.z
    );
  }


  /* -------------------------------------------------------
     RENDER
     ------------------------------------------------------- */

  renderer.render(
    scene,
    camera
  );
}


requestAnimationFrame(
  loop
);


/* =========================================================
   RESIZE
   ========================================================= */

addEventListener(
  'resize',
  () => {
    camera.aspect =
      innerWidth /
      innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      innerWidth,
      innerHeight
    );
  }
);


/* =========================================================
   SHAREABLE ROOM URL
   ========================================================= */

const roomFromUrl =
  new URLSearchParams(
    location.search
  ).get('room');

if (
  roomFromUrl
) {
  $('code').value =
    roomFromUrl;

  $('joinrow')
    .classList
    .remove('hidden');

  msg(
    'ROOM LINK DETECTED — ENTER YOUR NAME AND CLICK JOIN'
  );
}


/* =========================================================
   INITIAL DEBUG
   ========================================================= */

console.log(
  'DIRT RUSH 9 loaded successfully.'
);

console.log(
  'CREATE button:',
  $('create')
);

console.log(
  'PeerJS:',
  typeof Peer
);