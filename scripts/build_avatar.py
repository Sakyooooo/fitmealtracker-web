"""
Rig a low-poly humanoid into a game-ready fitness avatar.
Phase 1: mirror-apply, orient/scale to ~1.8 m (Y-up on export), build a 19-bone
humanoid skeleton, skin (auto weights with manual fallback), white material,
export a STATIC GLB to validate the rig before animation.

Run:
  blender --background "<blend>" --python build_avatar.py
"""

import bpy, bmesh, math, os
from mathutils import Vector

OUT = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\fitness_avatar_complete.glb"
TARGET_H = 1.8

os.makedirs(os.path.dirname(OUT), exist_ok=True)

def log(*a): print("[BUILD]", *a)

# ── 0. scene / units ──────────────────────────────────────────────────────────
scene = bpy.context.scene
scene.render.fps = 30
vl = bpy.context.view_layer

def only_active(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    vl.objects.active = o

# ── 1. mesh: apply mirror ─────────────────────────────────────────────────────
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
mesh.name = "AvatarBody"
only_active(mesh)
for m in list(mesh.modifiers):
    try:
        bpy.ops.object.modifier_apply(modifier=m.name)
        log("applied modifier", m.name)
    except Exception as e:
        log("modifier apply failed", m.name, e)

# ── 2. orient & scale: model is Z-up, standing along +Z. Normalize height ─────
def world_verts(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]

vs = world_verts(mesh)
zmin = min(v.z for v in vs); zmax = max(v.z for v in vs)
H0 = zmax - zmin
s = TARGET_H / H0
mesh.scale = (s, s, s)
only_active(mesh)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

vs = world_verts(mesh)
zmin = min(v.z for v in vs)
mesh.location.z -= zmin
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

# center X on 0 (mirror should already), center Y
vs = world_verts(mesh)
cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
mesh.location.x -= cx; mesh.location.y -= cy
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

vs = world_verts(mesh)
H = max(v.z for v in vs)
log(f"normalized height={H:.3f}  verts={len(vs)}")

# ── 3. measure joint offsets from the mesh ────────────────────────────────────
def band(z0, z1):
    return [v for v in vs if z0 <= v.z <= z1]

def outer_x(z0, z1, default):
    b = band(z0, z1)
    if not b: return default
    return max(abs(v.x) for v in b)

def side_centroid_x(z0, z1, sign, default):
    b = [v for v in band(z0, z1) if (v.x > 0 if sign > 0 else v.x < 0)]
    if not b: return default
    return sum(v.x for v in b) / len(b)

def front_y(z0, z1, default):
    b = band(z0, z1)
    if not b: return default
    return min(v.y for v in b)  # -Y is forward

shoulder_x = outer_x(0.74 * H, 0.82 * H, 0.18)
hand_x     = outer_x(0.45 * H, 0.55 * H, 0.30)
elbow_x    = outer_x(0.58 * H, 0.66 * H, 0.26)
hip_x      = abs(side_centroid_x(0.46 * H, 0.50 * H, 1, 0.10))
knee_x     = abs(side_centroid_x(0.24 * H, 0.30 * H, 1, 0.12))
foot_x     = abs(side_centroid_x(0.00, 0.07 * H, 1, 0.12))
foot_fwd   = front_y(0.0, 0.10 * H, -0.10)
log(f"measured shoulder_x={shoulder_x:.3f} elbow_x={elbow_x:.3f} hand_x={hand_x:.3f} "
    f"hip_x={hip_x:.3f} knee_x={knee_x:.3f} foot_x={foot_x:.3f} foot_fwd={foot_fwd:.3f}")

# guard against arm/leg measurements collapsing
shoulder_x = max(shoulder_x, 0.12)
elbow_x    = max(elbow_x, shoulder_x)
hand_x     = max(hand_x, elbow_x)
hip_x      = min(max(hip_x, 0.07), 0.16)
knee_x     = min(max(knee_x, 0.07), 0.16)
foot_x     = min(max(foot_x, 0.07), 0.16)

# ── 4. build armature ─────────────────────────────────────────────────────────
# positions as fractions of H (z), x left(+)/right(-), y depth (-Y forward)
def P(x, z, y=0.0): return Vector((x, y, z * H))

# bone: name -> (head, tail, parent)
BONES = [
    ("Hips",          P(0, 0.500), P(0, 0.545), None),
    ("Spine",         P(0, 0.545), P(0, 0.620), "Hips"),
    ("Chest",         P(0, 0.620), P(0, 0.730), "Spine"),
    ("Neck",          P(0, 0.730), P(0, 0.790), "Chest"),
    ("Head",          P(0, 0.790), P(0, 0.930), "Neck"),

    ("LeftShoulder",  P(0.04, 0.715), P( shoulder_x, 0.715), "Chest"),
    ("LeftUpperArm",  P( shoulder_x, 0.715), P( elbow_x, 0.585), "LeftShoulder"),
    ("LeftLowerArm",  P( elbow_x, 0.585), P( hand_x, 0.470), "LeftUpperArm"),
    ("LeftHand",      P( hand_x, 0.470), P( hand_x + 0.02, 0.405), "LeftLowerArm"),

    ("RightShoulder", P(-0.04, 0.715), P(-shoulder_x, 0.715), "Chest"),
    ("RightUpperArm", P(-shoulder_x, 0.715), P(-elbow_x, 0.585), "RightShoulder"),
    ("RightLowerArm", P(-elbow_x, 0.585), P(-hand_x, 0.470), "RightUpperArm"),
    ("RightHand",     P(-hand_x, 0.470), P(-hand_x - 0.02, 0.405), "RightLowerArm"),

    ("LeftUpperLeg",  P( hip_x, 0.500), P( knee_x, 0.270), "Hips"),
    ("LeftLowerLeg",  P( knee_x, 0.270), P( foot_x, 0.055), "LeftUpperLeg"),
    ("LeftFoot",      P( foot_x, 0.055), P( foot_x, 0.010, foot_fwd), "LeftLowerLeg"),

    ("RightUpperLeg", P(-hip_x, 0.500), P(-knee_x, 0.270), "Hips"),
    ("RightLowerLeg", P(-knee_x, 0.270), P(-foot_x, 0.055), "RightUpperLeg"),
    ("RightFoot",     P(-foot_x, 0.055), P(-foot_x, 0.010, foot_fwd), "RightLowerLeg"),
]

arm_data = bpy.data.armatures.new("AvatarArmature")
arm_obj = bpy.data.objects.new("Armature", arm_data)
scene.collection.objects.link(arm_obj)
only_active(arm_obj)
bpy.ops.object.mode_set(mode='EDIT')
ebs = arm_data.edit_bones
created = {}
for name, head, tail, parent in BONES:
    b = ebs.new(name)
    b.head = head
    b.tail = tail
    b.use_connect = False
    if parent:
        b.parent = created[parent]
    created[name] = b
bpy.ops.object.mode_set(mode='OBJECT')
log(f"armature bones={len(arm_data.bones)}")

# ── 5. skinning: try automatic weights, fall back to distance weighting ───────
def manual_weights():
    """Distance-weighted to nearest bone segments (robust fallback)."""
    # precompute bone segments in world space
    segs = []
    for name in created:
        bone = arm_data.bones[name]
        segs.append((name, bone.head_local.copy(), bone.tail_local.copy()))
    # ensure groups
    for name, _, _ in segs:
        if name not in mesh.vertex_groups:
            mesh.vertex_groups.new(name=name)

    def dist_to_seg(p, a, b):
        ab = b - a; t = 0.0
        denom = ab.dot(ab)
        if denom > 1e-9:
            t = max(0.0, min(1.0, (p - a).dot(ab) / denom))
        proj = a + ab * t
        return (p - proj).length

    for v in mesh.data.vertices:
        p = mesh.matrix_world @ v.co
        d = [(dist_to_seg(p, a, b), name) for name, a, b in segs]
        d.sort(key=lambda x: x[0])
        nearest = d[:3]
        # inverse-distance weights
        ws = []
        for dist, name in nearest:
            ws.append((name, 1.0 / (dist * dist + 1e-4)))
        tot = sum(w for _, w in ws)
        for name, w in ws:
            mesh.vertex_groups[name].add([v.index], w / tot, 'REPLACE')
    log("manual distance weights applied")

# add armature modifier + parent
mesh.parent = arm_obj
auto_ok = False
try:
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    arm_obj.select_set(True)
    vl.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    auto_ok = any(len(v.groups) > 0 for v in mesh.data.vertices)
    log("automatic weights:", "ok" if auto_ok else "produced no weights")
except Exception as e:
    log("automatic weights failed:", e)

if not auto_ok:
    # ensure armature modifier exists
    if not any(m.type == 'ARMATURE' for m in mesh.modifiers):
        md = mesh.modifiers.new("Armature", 'ARMATURE')
        md.object = arm_obj
    mesh.parent = arm_obj
    manual_weights()

# ── 6. material: single white (app tints per user) ───────────────────────────
for m in list(mesh.data.materials):
    mesh.data.materials.clear()
mat = bpy.data.materials.new("AvatarBody")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.92, 0.92, 0.94, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Metallic"].default_value = 0.0
mesh.data.materials.append(mat)

# flat low-poly look
only_active(mesh)
for p in mesh.data.polygons:
    p.use_smooth = False

# ── 7. ANIMATIONS ─────────────────────────────────────────────────────────────
FPS = 30
scene.render.fps = FPS

if not arm_obj.animation_data:
    arm_obj.animation_data_create()

def deg3(v): return (math.radians(v[0]), math.radians(v[1]), math.radians(v[2]))

def build_anim(name, dur, poses):
    """poses: list of (t in [0,1], dict bone->(rx,ry,rz)deg + optional '_hips_loc'(x,y,z))."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm_obj.animation_data.action = act
    # reset pose to rest
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
    nf = max(2, round(dur * FPS))
    for t, pose in poses:
        fr = 1 + round(t * (nf - 1))
        for bn, val in pose.items():
            if bn == '_hips_loc':
                hb = arm_obj.pose.bones['Hips']
                hb.location = val
                hb.keyframe_insert('location', frame=fr)
                continue
            pb = arm_obj.pose.bones.get(bn)
            if not pb: continue
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = deg3(val)
            pb.keyframe_insert('rotation_euler', frame=fr)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    log(f"  anim '{name}' frames=1..{nf}")
    return act

def locomotion(dur, leg, arm, knee, bob, lean, elbow):
    poses = []; N = 8
    for i in range(N + 1):
        t = i / N; ph = 2 * math.pi * t
        lL = leg * math.sin(ph); lR = -lL
        kL = knee * (0.5 - 0.5 * math.cos(ph)); kR = knee * (0.5 - 0.5 * math.cos(ph + math.pi))
        aL = arm * math.sin(ph + math.pi); aR = -aL
        bobz = bob * abs(math.sin(2 * ph))
        poses.append((t, {
            'LeftUpperLeg': (lL, 0, 0), 'RightUpperLeg': (lR, 0, 0),
            'LeftLowerLeg': (kL, 0, 0), 'RightLowerLeg': (kR, 0, 0),
            'LeftUpperArm': (aL, 0, 0), 'RightUpperArm': (aR, 0, 0),
            'LeftLowerArm': (-elbow, 0, 0), 'RightLowerArm': (-elbow, 0, 0),
            'Spine': (lean, 0, 0), 'Chest': (lean * 0.4, 0, 0),
            'Neck': (lean * 0.3, 0, 0),
            '_hips_loc': (0, -bobz, 0),
        }))
    return poses

def run_cycle(dur, thigh_fwd, thigh_back, knee_drive, knee_min, arm, elbow,
              lean, bob, knee_phase=0.9, arm_z=4, adduct=3):
    """Athletic run: high knee drive, push-off extension, airborne pop, bent arms.
    adduct = inward lean of the legs (Left +Z / Right -Z) to track feet under the
    body and avoid a wide bow-legged (ガニ股) look."""
    poses = []; N = 12
    cen = (thigh_fwd + thigh_back) / 2.0; amp = (thigh_fwd - thigh_back) / 2.0
    for i in range(N + 1):
        t = i / N; ph = 2 * math.pi * t
        uL = cen + amp * math.sin(ph)
        uR = cen + amp * math.sin(ph + math.pi)
        kL = knee_min + knee_drive * (0.5 - 0.5 * math.cos(ph + knee_phase))
        kR = knee_min + knee_drive * (0.5 - 0.5 * math.cos(ph + math.pi + knee_phase))
        aL = arm * math.sin(ph + math.pi); aR = -aL
        y = bob * abs(math.sin(ph))               # pop up at flight (mid-swing)
        poses.append((t, {
            'LeftUpperLeg': (uL, 0, adduct), 'RightUpperLeg': (uR, 0, -adduct),
            'LeftLowerLeg': (kL, 0, 0), 'RightLowerLeg': (kR, 0, 0),
            'LeftUpperArm': (aL, 0, arm_z), 'RightUpperArm': (aR, 0, -arm_z),
            'LeftLowerArm': (-elbow, 0, 0), 'RightLowerArm': (-elbow, 0, 0),
            'Spine': (lean, 0, 0), 'Chest': (lean * 0.5, 0, 0), 'Neck': (lean * 0.3, 0, 0),
            '_hips_loc': (0, y, 0),
        }))
    return poses

# helper: arms raised overhead (Left Z negative, Right Z positive)
def arms_up(a): return {'LeftUpperArm': (0, 0, -a), 'RightUpperArm': (0, 0, a)}

ANIMS = {}

# 1 Idle — subtle breathing + weight shift
ANIMS['Idle'] = (2.0, [
    (0.0, {'Chest': (0, 0, 0), 'Spine': (0, 0, 0), 'Head': (0, 0, 0),
           'LeftUpperArm': (2, 0, 1), 'RightUpperArm': (2, 0, -1), '_hips_loc': (0, 0, 0)}),
    (0.5, {'Chest': (-3, 0, 0), 'Spine': (-1.5, 0, 0), 'Head': (2, 0, 1),
           'LeftUpperArm': (4, 0, 2), 'RightUpperArm': (4, 0, -2), '_hips_loc': (0.01, -0.015, 0)}),
    (1.0, {'Chest': (0, 0, 0), 'Spine': (0, 0, 0), 'Head': (0, 0, 0),
           'LeftUpperArm': (2, 0, 1), 'RightUpperArm': (2, 0, -1), '_hips_loc': (0, 0, 0)}),
])

# 2 Walking
ANIMS['Walking'] = (1.5, locomotion(1.5, leg=24, arm=22, knee=30, bob=0.02, lean=4, elbow=16))
# 3 Run
ANIMS['Run'] = (0.8, run_cycle(0.8, thigh_fwd=70, thigh_back=-46, knee_drive=84,
                               knee_min=22, arm=50, elbow=90, lean=16, bob=0.085,
                               adduct=11))

# 4 Squat
_sq_down = {'LeftUpperLeg': (-48, 0, 7), 'RightUpperLeg': (-48, 0, -7),
            'LeftLowerLeg': (92, 0, 0), 'RightLowerLeg': (92, 0, 0),
            'Spine': (14, 0, 0), 'Chest': (6, 0, 0),
            'LeftUpperArm': (74, 0, 0), 'RightUpperArm': (74, 0, 0),
            'LeftLowerArm': (-12, 0, 0), 'RightLowerArm': (-12, 0, 0),
            '_hips_loc': (0, -0.36, 0.02)}
_sq_stand = {'LeftUpperLeg': (0, 0, 0), 'RightUpperLeg': (0, 0, 0),
             'LeftLowerLeg': (0, 0, 0), 'RightLowerLeg': (0, 0, 0),
             'Spine': (0, 0, 0), 'Chest': (0, 0, 0),
             'LeftUpperArm': (4, 0, 0), 'RightUpperArm': (4, 0, 0),
             'LeftLowerArm': (0, 0, 0), 'RightLowerArm': (0, 0, 0),
             '_hips_loc': (0, 0, 0)}
ANIMS['Squat'] = (3.0, [(0.0, _sq_stand), (0.42, _sq_down), (0.6, _sq_down), (1.0, _sq_stand)])

# 5 PushUp — body horizontal face-down, on hands; elbows bend
_pu_base = {'Hips': (-82, 0, 0),
            'LeftUpperLeg': (78, 0, 8), 'RightUpperLeg': (78, 0, -8),
            'LeftUpperArm': (10, 0, -52), 'RightUpperArm': (10, 0, 52),
            'Spine': (6, 0, 0), 'Chest': (8, 0, 0), 'Neck': (-18, 0, 0),
            '_hips_loc': (0, -0.78, 0.86)}
def _pu(elb):
    p = dict(_pu_base); p['LeftLowerArm'] = (-elb, 0, 0); p['RightLowerArm'] = (-elb, 0, 0)
    p['_hips_loc'] = (0, -0.78 - (0.10 if elb > 40 else 0.0), 0.86); return p
ANIMS['PushUp'] = (3.0, [(0.0, _pu(8)), (0.5, _pu(85)), (1.0, _pu(8))])

# 6 JumpingJack
_jj_in = {**arms_up(0), 'LeftUpperLeg': (0, 0, 0), 'RightUpperLeg': (0, 0, 0),
          'LeftUpperArm': (0, 0, 4), 'RightUpperArm': (0, 0, -4)}
_jj_out = {'LeftUpperArm': (0, 0, -150), 'RightUpperArm': (0, 0, 150),
           'LeftLowerArm': (-10, 0, 0), 'RightLowerArm': (-10, 0, 0),
           'LeftUpperLeg': (0, 0, 24), 'RightUpperLeg': (0, 0, -24),
           '_hips_loc': (0, -0.04, 0)}
ANIMS['JumpingJack'] = (2.5, [(0.0, _jj_in), (0.5, _jj_out), (1.0, _jj_in)])

# 7 Plank — face-down forearm plank, hands clasped in front, subtle breathing
_plank = {'Hips': (90, 0, 0),
          'Spine': (-3, 0, 0), 'Chest': (1, 0, 0), 'Neck': (-26, 0, 0), 'Head': (-8, 0, 0),
          'LeftUpperLeg': (-3, 0, 4), 'RightUpperLeg': (-3, 0, -4),
          'LeftLowerLeg': (2, 0, 0), 'RightLowerLeg': (2, 0, 0),
          'LeftFoot': (-44, 0, 0), 'RightFoot': (-44, 0, 0),
          'LeftUpperArm': (34, 0, 66), 'RightUpperArm': (34, 0, -66),
          'LeftLowerArm': (-86, 0, 0), 'RightLowerArm': (-86, 0, 0),
          '_hips_loc': (0, -0.72, 0.24)}
def _plank_b(d):
    p = dict(_plank); p['Chest'] = (1 + d, 0, 0); p['_hips_loc'] = (0, -0.72 - d * 0.003, 0.24); return p
ANIMS['Plank'] = (2.0, [(0.0, _plank_b(0)), (0.5, _plank_b(2.5)), (1.0, _plank_b(0))])

# 8 BicycleCrunch — lying on back, legs cycle, elbow to opposite knee
def _bike(t):
    ph = 2 * math.pi * t
    lL = -40 + 30 * math.sin(ph); lR = -40 + 30 * math.sin(ph + math.pi)
    kL = 60 + 30 * math.sin(ph + math.pi / 2); kR = 60 + 30 * math.sin(ph + 3 * math.pi / 2)
    # crunch: alternate elbows
    return {'Hips': (92, 0, 0),
            'LeftUpperLeg': (lL, 0, 6), 'RightUpperLeg': (lR, 0, -6),
            'LeftLowerLeg': (kL, 0, 0), 'RightLowerLeg': (kR, 0, 0),
            'LeftUpperArm': (-150, 0, -10), 'RightUpperArm': (-150, 0, 10),
            'LeftLowerArm': (-70, 0, 0), 'RightLowerArm': (-70, 0, 0),
            'Chest': (18, 0, 8 * math.sin(ph)), 'Neck': (20, 0, 0),
            '_hips_loc': (0, -0.95, 0.4)}
ANIMS['BicycleCrunch'] = (3.0, [(i / 8, _bike(i / 8)) for i in range(9)])

# 9 Stretch — arms up, side bends
ANIMS['Stretch'] = (4.0, [
    (0.0, {'LeftUpperArm': (3, 0, 2), 'RightUpperArm': (3, 0, -2), 'Spine': (0, 0, 0)}),
    (0.25, {'LeftUpperArm': (0, 0, -160), 'RightUpperArm': (0, 0, 160),
            'LeftLowerArm': (-8, 0, 0), 'RightLowerArm': (-8, 0, 0), 'Spine': (0, 0, 0), 'Chest': (0, 0, 0)}),
    (0.45, {'LeftUpperArm': (0, 0, -160), 'RightUpperArm': (0, 0, 160), 'Spine': (0, 18, 0), 'Chest': (0, 10, 0)}),
    (0.65, {'LeftUpperArm': (0, 0, -160), 'RightUpperArm': (0, 0, 160), 'Spine': (0, -18, 0), 'Chest': (0, -10, 0)}),
    (0.82, {'LeftUpperArm': (0, 0, -160), 'RightUpperArm': (0, 0, 160), 'Spine': (0, 0, 0), 'Chest': (0, 0, 0)}),
    (1.0, {'LeftUpperArm': (3, 0, 2), 'RightUpperArm': (3, 0, -2), 'Spine': (0, 0, 0)}),
])

# 10 BenchPress — lying on back, push up / lower
def _bench(elb):
    return {'Hips': (92, 0, 0),
            'LeftUpperLeg': (-2, 0, 6), 'RightUpperLeg': (-2, 0, -6),
            'LeftLowerLeg': (70, 0, 0), 'RightLowerLeg': (70, 0, 0),
            'LeftUpperArm': (-95, 0, -12), 'RightUpperArm': (-95, 0, 12),
            'LeftLowerArm': (-elb, 0, 0), 'RightLowerArm': (-elb, 0, 0),
            '_hips_loc': (0, -0.95, 0.30)}
ANIMS['BenchPress'] = (3.0, [(0.0, _bench(8)), (0.5, _bench(80)), (1.0, _bench(8))])

# 11 Deadlift — hinge at hips, lift, return
_dl_down = {'Spine': (62, 0, 0), 'Chest': (16, 0, 0), 'Neck': (-30, 0, 0),
            'LeftUpperLeg': (-26, 0, 5), 'RightUpperLeg': (-26, 0, -5),
            'LeftLowerLeg': (28, 0, 0), 'RightLowerLeg': (28, 0, 0),
            'LeftUpperArm': (6, 0, 2), 'RightUpperArm': (6, 0, -2),
            '_hips_loc': (0, -0.12, 0.10)}
_dl_up = {'Spine': (0, 0, 0), 'Chest': (0, 0, 0), 'Neck': (0, 0, 0),
          'LeftUpperLeg': (0, 0, 0), 'RightUpperLeg': (0, 0, 0),
          'LeftLowerLeg': (0, 0, 0), 'RightLowerLeg': (0, 0, 0),
          'LeftUpperArm': (4, 0, 2), 'RightUpperArm': (4, 0, -2), '_hips_loc': (0, 0, 0)}
ANIMS['Deadlift'] = (3.0, [(0.0, _dl_up), (0.4, _dl_down), (0.6, _dl_down), (1.0, _dl_up)])

# 12 PullUp — arms overhead grip, pull body up, lower
def _pull(up):
    elb = 12 + up * 80
    return {'LeftUpperArm': (0, 0, -158), 'RightUpperArm': (0, 0, 158),
            'LeftLowerArm': (-elb, 0, 0), 'RightLowerArm': (-elb, 0, 0),
            'LeftUpperLeg': (8, 0, 5), 'RightUpperLeg': (8, 0, -5),
            'LeftLowerLeg': (30, 0, 0), 'RightLowerLeg': (30, 0, 0),
            'Chest': (-4 - up * 6, 0, 0),
            '_hips_loc': (0, up * 0.18, 0)}
ANIMS['PullUp'] = (3.0, [(0.0, _pull(0.0)), (0.5, _pull(1.0)), (1.0, _pull(0.0))])

# 13 Cycling — seated, legs pedal in circle, hands on bars
def _cyc(t):
    ph = 2 * math.pi * t
    # pedal: thigh oscillates, knee follows offset → circular pedaling
    uL = -55 + 18 * math.sin(ph); uR = -55 + 18 * math.sin(ph + math.pi)
    kL = 55 + 35 * (0.5 - 0.5 * math.cos(ph)); kR = 55 + 35 * (0.5 - 0.5 * math.cos(ph + math.pi))
    return {'Hips': (8, 0, 0),
            'LeftUpperLeg': (uL, 0, 6), 'RightUpperLeg': (uR, 0, -6),
            'LeftLowerLeg': (kL, 0, 0), 'RightLowerLeg': (kR, 0, 0),
            'Spine': (22, 0, 0), 'Chest': (8, 0, 0), 'Neck': (-12, 0, 0),
            'LeftUpperArm': (62, 0, -6), 'RightUpperArm': (62, 0, 6),
            'LeftLowerArm': (-18, 0, 0), 'RightLowerArm': (-18, 0, 0),
            '_hips_loc': (0, -0.30, 0.16)}
ANIMS['Cycling'] = (2.0, [(i / 8, _cyc(i / 8)) for i in range(9)])

# 14 Sleeping — lying on side, gentle breathing
_sleep = {'Hips': (0, 0, 86),
          'LeftUpperLeg': (-22, 0, 0), 'RightUpperLeg': (-30, 0, 0),
          'LeftLowerLeg': (40, 0, 0), 'RightLowerLeg': (55, 0, 0),
          'LeftUpperArm': (28, 0, 6), 'RightUpperArm': (40, 0, 6),
          'LeftLowerArm': (-50, 0, 0), 'RightLowerArm': (-60, 0, 0),
          'Spine': (10, 0, 0), 'Chest': (6, 0, 0), 'Neck': (10, 0, 0),
          '_hips_loc': (0, -0.86, 0)}
def _sleep_b(d):
    p = dict(_sleep); p['Chest'] = (6 + d, 0, 0); return p
ANIMS['Sleeping'] = (4.0, [(0.0, _sleep_b(0)), (0.5, _sleep_b(4)), (1.0, _sleep_b(0))])

# 15 Studying — seated at desk, looking down, occasional head move
_study = {'LeftUpperLeg': (-86, 0, 8), 'RightUpperLeg': (-86, 0, -8),
          'LeftLowerLeg': (86, 0, 0), 'RightLowerLeg': (86, 0, 0),
          'Spine': (20, 0, 0), 'Chest': (10, 0, 0), 'Neck': (24, 0, 0), 'Head': (10, 0, 0),
          'LeftUpperArm': (62, 0, -8), 'RightUpperArm': (62, 0, 8),
          'LeftLowerArm': (-58, 0, 0), 'RightLowerArm': (-58, 0, 0),
          '_hips_loc': (0, -0.42, 0.12)}
def _study_v(hx, hz):
    p = dict(_study); p['Head'] = (10 + hx, 0, hz); return p
ANIMS['Studying'] = (4.0, [(0.0, _study_v(0, 0)), (0.35, _study_v(4, 6)),
                           (0.65, _study_v(-2, -6)), (1.0, _study_v(0, 0))])

# 16 Celebration — jump + arms up, energetic
_cel_low = {**arms_up(150), 'LeftLowerArm': (-12, 0, 0), 'RightLowerArm': (-12, 0, 0),
            'LeftUpperLeg': (0, 0, 8), 'RightUpperLeg': (0, 0, -8),
            'LeftLowerLeg': (24, 0, 0), 'RightLowerLeg': (24, 0, 0),
            'Spine': (-6, 0, 0), '_hips_loc': (0, -0.08, 0)}
_cel_high = {**arms_up(165), 'LeftLowerArm': (-4, 0, 0), 'RightLowerArm': (-4, 0, 0),
             'LeftUpperLeg': (-10, 0, 12), 'RightUpperLeg': (-10, 0, -12),
             'LeftLowerLeg': (40, 0, 0), 'RightLowerLeg': (40, 0, 0),
             'Spine': (-10, 0, 0), 'Head': (-6, 0, 0), '_hips_loc': (0, 0.22, 0)}
ANIMS['Celebration'] = (3.0, [
    (0.0, _cel_low), (0.28, _cel_high), (0.5, _cel_low), (0.78, _cel_high), (1.0, _cel_low),
])

ORDER = ['Idle', 'Walking', 'Run', 'Squat', 'PushUp', 'JumpingJack', 'Plank',
         'BicycleCrunch', 'Stretch', 'BenchPress', 'Deadlift', 'PullUp',
         'Cycling', 'Sleeping', 'Studying', 'Celebration']
for nm in ORDER:
    dur, poses = ANIMS[nm]
    build_anim(nm, dur, poses)
log(f"built {len(ORDER)} animations")

# reset to rest before export
for pb in arm_obj.pose.bones:
    pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
arm_obj.animation_data.action = None

# ── 8. export animated GLB ───────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=False,
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_nla_strips=False,
    export_skins=True,
    export_materials='EXPORT',
    export_normals=True,
)
sz = os.path.getsize(OUT)
log(f"WROTE {OUT}  ({sz/1024:.1f} KB)")
log("BUILD DONE")
