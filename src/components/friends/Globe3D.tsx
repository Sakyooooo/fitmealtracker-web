'use client';

import { Suspense, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GlobeUser } from './FriendsGlobe';

const EARTH_URL = '/models/earth_textured.glb';
const AVATAR_URL = '/models/Avatar.glb';

// 各フレンドがランダムに行う筋トレクリップ（Avatar.glb に内蔵）
const WORKOUT_CLIPS = ['Squat', 'BenchPress', 'PullUp'] as const;
// クリップごとに表示する器材ノード（それ以外は隠す）
const CLIP_EQUIPMENT: Record<string, string[]> = {
  BenchPress: ['Bench', 'Barbell'],
  Squat: ['Barbell'],
  PullUp: ['PullUpBar'],
};
const EQUIPMENT_NODES = ['Bench', 'Barbell', 'PullUpBar'];

const ME_COLOR = '#AB47BC';
const FRIEND_COLORS = ['#4F9BE8', '#F6A6C1', '#7BC96F', '#F6C453', '#9B8CFA'];
const RADIUS = 2;
const AVATAR_SCALE = 0.42;

// フレンド配置（重ならないよう各大陸へ分散。me は [10,30] 固定）
const SPOTS: [number, number][] = [
  [-95, 40], [128, 32], [-58, -18], [28, 4], [148, -28], [72, 50], [-20, 64],
];

// 文字列 → 安定したハッシュ（ユーザーごとに常に同じ像を割り当てる）
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// 最終記録の相対時刻ラベル
function lastRecordLabel(iso?: string): string {
  if (!iso) return 'まだ記録なし';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (min < 1) return 'たった今 記録';
  if (min < 60) return `${min}分前に記録`;
  if (hr < 24) return `${hr}時間前に記録`;
  return `${day}日前に記録`;
}

function lonLatToVec3(lon: number, lat: number, r = RADIUS): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = (((lon / 360 + 0.5) % 1 + 1) % 1) * Math.PI * 2;
  return new THREE.Vector3(
    -r * Math.cos(theta) * Math.sin(phi),
    r * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
  );
}

// GLB 地球モデル（テクスチャ付き・バウンディングボックスで自動フィット）
function EarthModel() {
  const gltf = useGLTF(EARTH_URL);
  const { scene, scale, offset } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = (RADIUS * 2) / maxDim;
    return {
      scene: clone,
      scale: s,
      offset: new THREE.Vector3(-center.x * s, -center.y * s, -center.z * s),
    };
  }, [gltf]);

  return (
    <group scale={scale} position={offset}>
      <primitive object={scene} />
    </group>
  );
}

// アバターピン — 地球表面に立つアバターが筋トレクリップを再生（ユーザーごとに種目固定）
function AvatarPin({
  lon, lat, gltf, clipName, onTap,
}: {
  lon: number; lat: number;
  gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] };
  clipName: string;
  onTap?: () => void;
}) {
  // スキン付きメッシュは SkeletonUtils.clone で複製（plain clone はスケルトンを壊す）
  const scene = useMemo(() => {
    const c = cloneSkinned(gltf.scene) as THREE.Group;
    const visible = CLIP_EQUIPMENT[clipName] ?? [];
    c.traverse((o) => {
      o.frustumCulled = false; // どの角度でも消えないように
      if (EQUIPMENT_NODES.includes(o.name)) o.visible = visible.includes(o.name);
    });
    return c;
  }, [gltf, clipName]);

  // インスタンスごとに独立した AnimationMixer（各自バラバラに動く）
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene);
    const clip = gltf.animations.find((a) => a.name === clipName);
    if (clip) {
      const action = mixer.clipAction(clip);
      action.time = Math.random() * clip.duration; // 位相をずらす
      action.play();
    }
    mixerRef.current = mixer;
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(scene); };
  }, [scene, gltf, clipName]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  useFrame((_, delta) => { mixerRef.current?.update(delta); });

  const pos = useMemo(() => lonLatToVec3(lon, lat, RADIUS), [lon, lat]);
  const quat = useMemo(() => {
    const outward = pos.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      outward,
    );
  }, [pos]);

  return (
    <group
      position={pos}
      quaternion={quat}
      scale={AVATAR_SCALE}
      onClick={(e) => { e.stopPropagation(); onTap?.(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <primitive object={scene} />
    </group>
  );
}

// フレンドカード（HTML オーバーレイ）
function FriendCard({
  user, lon, lat, color, occludeRef, gltf, clipName, onSelectUser, didDragRef,
}: {
  user: GlobeUser; lon: number; lat: number; color: string;
  occludeRef: React.RefObject<THREE.Mesh | null>;
  gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] };
  clipName: string;
  onSelectUser?: (user: GlobeUser) => void;
  didDragRef: React.RefObject<boolean>;
}) {
  const normal = useMemo(() => lonLatToVec3(lon, lat, 1), [lon, lat]);
  // カードはアバター（＋器材）の頭上に浮かせる。懸垂は鉄棒が高いので余分に上げる
  const cardPos = useMemo(() => {
    const lift = clipName === 'PullUp' ? 1.35 : 1.0;
    return normal.clone().multiplyScalar(RADIUS + lift);
  }, [normal, clipName]);
  const initial = user.name.charAt(0).toUpperCase();

  const handleTap = () => {
    if (didDragRef.current) return; // ドラッグ操作中はタップ扱いしない
    onSelectUser?.(user);
  };

  return (
    <>
      <AvatarPin lon={lon} lat={lat} gltf={gltf} clipName={clipName} onTap={handleTap} />
      <Html
        position={cardPos}
        center
        occlude={[occludeRef as React.RefObject<THREE.Object3D>]}
        style={{ pointerEvents: 'none', transition: 'opacity 0.25s' }}
      >
        <div
          onClick={handleTap}
          style={{
            background: 'rgba(255,255,255,0.96)',
            borderRadius: 16, padding: '10px 14px',
            boxShadow: '0 4px 18px rgba(30,41,59,0.18)',
            display: 'flex', alignItems: 'center', gap: 10,
            minWidth: 132, maxWidth: 180,
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'auto', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff',
          }}>
            {user.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#1F2937', lineHeight: 1.2 }}>
              {user.isMe ? 'You' : user.name}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, whiteSpace: 'nowrap' }}>
              {lastRecordLabel(user.lastActivityAt)}
            </div>
          </div>
        </div>
      </Html>
    </>
  );
}

// Avatar.glb をロードし、各ユーザーへランダムな筋トレ種目を割り当てる
function AllFriends({ users, occludeRef, onSelectUser, didDragRef }: {
  users: GlobeUser[];
  occludeRef: React.RefObject<THREE.Mesh | null>;
  onSelectUser?: (user: GlobeUser) => void;
  didDragRef: React.RefObject<boolean>;
}) {
  const gltf = useGLTF(AVATAR_URL);

  let friendIdx = 0;

  return (
    <>
      {users.map((u, i) => {
        const [lon, lat] = u.isMe ? [10, 30] : SPOTS[friendIdx++ % SPOTS.length];
        const color = u.isMe ? ME_COLOR : FRIEND_COLORS[i % FRIEND_COLORS.length];
        // ユーザーIDから安定的に種目を割り当て（毎回同じ種目になる）
        const clipName = WORKOUT_CLIPS[hashId(u.id) % WORKOUT_CLIPS.length];
        return (
          <FriendCard
            key={u.id}
            user={u}
            lon={lon}
            lat={lat}
            color={color}
            occludeRef={occludeRef}
            gltf={gltf}
            clipName={clipName}
            onSelectUser={onSelectUser}
            didDragRef={didDragRef}
          />
        );
      })}
    </>
  );
}

// 「地球を掴んで回す」コントローラー（自動回転なし・慣性つき）
function GlobeController({ users, onSelectUser }: {
  users: GlobeUser[];
  onSelectUser?: (user: GlobeUser) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const occludeRef = useRef<THREE.Mesh>(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false); // タップ/ドラッグ判定
  const prevPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const { gl } = useThree();

  // 慣性のみ（手を離すと少し流れてやがて静止）。自動回転はしない。
  useFrame(() => {
    const g = groupRef.current;
    if (!g || isDragging.current) return;
    if (Math.abs(velocity.current.x) < 1e-4 && Math.abs(velocity.current.y) < 1e-4) return;
    g.rotation.y += velocity.current.x;
    g.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, g.rotation.x + velocity.current.y));
    velocity.current.x *= 0.92;
    velocity.current.y *= 0.92;
  });

  const onPointerDown = (e: PointerEvent) => {
    isDragging.current = true;
    didDrag.current = false;
    velocity.current = { x: 0, y: 0 };
    prevPointer.current = { x: e.clientX, y: e.clientY };
    gl.domElement.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging.current || !groupRef.current) return;
    const dx = e.clientX - prevPointer.current.x;
    const dy = e.clientY - prevPointer.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) didDrag.current = true; // 動いたらドラッグ扱い
    // 掴んで回す：ドラッグ方向に地球が回る
    groupRef.current.rotation.y += dx * 0.012;
    groupRef.current.rotation.x += dy * 0.012;
    groupRef.current.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, groupRef.current.rotation.x));
    velocity.current = { x: dx * 0.012, y: dy * 0.012 };
    prevPointer.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    isDragging.current = false;
    // クリック判定が走るまで一瞬 didDrag を保持してから解除
    setTimeout(() => { didDrag.current = false; }, 0);
  };

  useEffect(() => {
    const el = gl.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  return (
    <group ref={groupRef}>
      <EarthModel />

      {/* occlude 用透明球（カードの裏回り込み判定に使用） */}
      <mesh ref={occludeRef}>
        <sphereGeometry args={[RADIUS, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <AllFriends users={users} occludeRef={occludeRef}
        onSelectUser={onSelectUser} didDragRef={didDrag} />
    </group>
  );
}

function Scene({ users, onSelectUser }: {
  users: GlobeUser[];
  onSelectUser?: (user: GlobeUser) => void;
}) {
  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} />
      <pointLight position={[-6, -4, -4]} intensity={0.4} color="#b0d0ff" />
      <GlobeController users={users} onSelectUser={onSelectUser} />
    </>
  );
}

export default function Globe3D({ users, onSelectUser }: {
  users: GlobeUser[];
  onSelectUser?: (user: GlobeUser) => void;
}) {
  return (
    <div className="h-full w-full cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 7.4], fov: 40 }} dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene users={users} onSelectUser={onSelectUser} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(EARTH_URL);
useGLTF.preload(AVATAR_URL);
