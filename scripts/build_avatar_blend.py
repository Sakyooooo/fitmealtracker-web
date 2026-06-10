"""
Step1+2 Avatar Modeling & Rig — build /blender/Avatar.blend from the turnaround sheet.

Source of truth: docs/reference/fitness-avatar-turnaround-v1.png
  180cm, T-pose, gender-neutral athletic, faceless, V-taper,
  cyan accent bands (wrists / ankles / waistband), low poly <= 6000 tris.

Mesh: ring-loft surfaces (superellipse cross-sections), smooth shading
(reference priority over the flat-shading text spec), vertex colors
(#ECECEC body / #00C2FF accent), matcap viewport.

Rig (docs/avatar-rig-spec.md.txt): armature "AvatarRig", fixed 22-bone
skeleton, legs IK (non-deform IK_Foot/IK_Knee controls), arms FK,
max 4 influences, normalized weights. No animation, no export.

Run:
  & "C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe" --background --python scripts\\build_avatar_blend.py
"""
import bpy, bmesh, math, os
from mathutils import Vector

ROOT = r"C:\Users\sakyo\FitMealTracker (Web)"
BLEND_OUT = os.path.join(ROOT, "blender", "Avatar.blend")
RENDER_OUT = os.path.join(ROOT, "scripts", "_render", "avatar")
os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
os.makedirs(RENDER_OUT, exist_ok=True)

BODY = (0.925, 0.925, 0.925, 1.0)    # #ECECEC
ACCENT = (0.0, 0.76, 1.0, 1.0)       # #00C2FF
CM = 0.01

def log(*a): print("[AVATAR]", *a)

# ── 0. clean scene (startup file may hide objects; remove via data API) ───────
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for d in list(blk):
        if d.users == 0:
            blk.remove(d)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

# ── helpers ───────────────────────────────────────────────────────────────────
def sgnpow(v, e):
    return math.copysign(abs(v) ** e, v)

def gauss(x, mu, sig):
    return math.exp(-((x - mu) / sig) ** 2)

def ring_z(z, rx, ry, n, yoff=0.0, exp=2.0, bulge=None):
    """Horizontal cross-section at height z. angle 0 = front (-Y)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = bulge(a) if bulge else 1.0
        px = sgnpow(math.sin(a), 2.0 / exp) * rx * k
        py = -sgnpow(math.cos(a), 2.0 / exp) * ry * k + yoff
        pts.append((px * CM, py * CM, z * CM))
    return pts

def ring_x(x, ry, rz, n, z0, zoff=0.0, exp=2.0):
    """Vertical cross-section for arms (loft along X). angle 0 = front."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        py = -sgnpow(math.cos(a), 2.0 / exp) * ry
        pz = z0 + sgnpow(math.sin(a), 2.0 / exp) * rz + zoff
        pts.append((x * CM, py * CM, pz * CM))
    return pts

def ring_y(y, w, zlo, zhi, n, xc=0.0, exp=2.6):
    """Vertical cross-section for feet (loft along Y)."""
    zc, rz = (zlo + zhi) / 2, (zhi - zlo) / 2
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        px = xc + sgnpow(math.sin(a), 2.0 / exp) * w
        pz = zc + sgnpow(math.cos(a), 2.0 / exp) * rz
        pts.append((px * CM, y * CM, pz * CM))
    return pts

def make_loft(name, rings, color, cap_start=True, cap_end=True):
    bm = bmesh.new()
    rows = []
    for pts in rings:
        rows.append([bm.verts.new(p) for p in pts])
    n = len(rows[0])
    for r0, r1 in zip(rows, rows[1:]):
        for i in range(n):
            bm.faces.new((r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]))
    if cap_start:
        bm.faces.new(list(reversed(rows[0])))
    if cap_end:
        bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    col = me.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')
    for i in range(len(col.data)):
        col.data[i].color = color
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    # part tag (survives join; used for shell-aware weight fixes, removed later)
    g = ob.vertex_groups.new(name="PART_" + name)
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return ob

parts = []

# ── 1. torso + neck + head (one continuous loft, faceless) ───────────────────
def pec(a):
    """Chest bulge lobes left/right of front center, slight sternum dip."""
    return (1.0 + 0.085 * (gauss(a, 0.55, 0.42) + gauss(a, 2 * math.pi - 0.55, 0.42))
            - 0.025 * gauss(a, 0.0, 0.22) - 0.025 * gauss(a, 2 * math.pi, 0.22))

def scap(a):
    """Shoulder-blade hint on the upper back."""
    return 1.0 + 0.035 * (gauss(a, math.pi - 0.6, 0.45) + gauss(a, math.pi + 0.6, 0.45))

N_T = 24
TORSO = [
    # (z, rx, ry, yoff, exp, bulge)
    (96,  16.6, 11.8, +0.6, 2.25, None),            # hip top
    (101, 15.6, 11.0, +0.2, 2.15, None),            # waistband upper
    (107, 14.2, 10.2,  0.0, 2.10, None),            # waist (narrowest)
    (114, 14.9, 10.5, -0.2, 2.10, None),            # navel
    (122, 16.4, 11.0, -0.4, 2.15, None),            # lower ribs
    (129, 18.2, 12.0, -0.8, 2.20, pec),             # under pec
    (135, 19.8, 13.2, -1.3, 2.30, pec),             # pec mass
    (141, 17.6, 12.9, -0.8, 2.30, scap),            # upper chest (armpit line)
    (146, 17.4, 12.0, -0.3, 2.25, None),            # shoulder line
    (148.5, 16.0, 11.2, -0.1, 2.20, None),          # trap slope (meets delt cap)
    (150.5, 14.4,  9.9, +0.2, 2.10, None),          # trap -> neck slope
    (152.5, 10.4,  8.5, +0.3, 2.05, None),          # trap -> neck blend
    (154,  7.0,  7.6, +0.4, 2.00, None),            # neck base
    (158,  6.4,  7.2, +0.5, 2.00, None),            # neck top
    (161,  6.8,  8.4, +0.6, 2.00, None),            # jaw
    (165,  7.5,  9.6, +0.5, 2.05, None),            # cheeks
    (170,  7.8, 10.0, +0.7, 2.05, None),            # brow
    (175,  7.3,  9.4, +1.6, 2.00, None),            # cranium (round back of head)
    (179.5, 4.7,  6.0, +1.7, 2.00, None),           # top
]
parts.append(make_loft("Torso", [ring_z(*r[:3], N_T, yoff=r[3], exp=r[4], bulge=r[5]) for r in TORSO], BODY))

# ── 2. briefs (closed pelvis shell, hides torso bottom & leg roots) ──────────
def glute(a):
    return 1.0 + 0.09 * (gauss(a, math.pi - 0.55, 0.45) + gauss(a, math.pi + 0.55, 0.45))

N_B = 24
BRIEFS = [
    (101, 16.4, 11.6, +0.5, 2.25, None),
    (97,  16.9, 11.9, +0.7, 2.30, glute),
    (92,  16.5, 11.7, +0.9, 2.30, glute),
    (87,  14.6, 10.4, +0.7, 2.25, None),
    (83,  11.8,  8.0, +0.4, 2.10, None),
]
parts.append(make_loft("Briefs", [ring_z(*r[:3], N_B, yoff=r[3], exp=r[4], bulge=r[5]) for r in BRIEFS], BODY))

# waistband (accent, slightly proud of briefs)
WB = [
    (97.5, 16.55, 11.45, +0.45, 2.2, None),
    (98.0, 17.25, 12.15, +0.65, 2.3, None),
    (101.0, 16.45, 11.55, +0.35, 2.2, None),
]
parts.append(make_loft("Waistband", [ring_z(*r[:3], N_B, yoff=r[3], exp=r[4]) for r in WB], ACCENT))

# ── 3. arms (T-pose along +/-X) + mitten hands ────────────────────────────────
N_A = 16
ARM = [
    # (x, ry, rz, zoff, exp)
    (15.0, 7.2, 5.6, +0.2, 2.1),    # root (buried in torso, low flat cap)
    (22.0, 7.4, 6.4, +0.2, 2.15),   # deltoid (top ~153.6, gentle dome)
    (27.5, 6.6, 6.2, 0.0, 2.1),     # delt taper
    (33.0, 6.3, 7.1, +0.2, 2.1),    # biceps / triceps
    (39.0, 5.6, 6.2, 0.0, 2.05),
    (45.0, 5.1, 5.5, 0.0, 2.05),    # elbow
    (52.0, 5.4, 5.8, 0.0, 2.05),    # forearm peak
    (60.0, 4.5, 4.9, 0.0, 2.0),
    (67.0, 3.7, 4.1, 0.0, 2.0),     # wrist
    (71.0, 3.6, 4.0, 0.0, 2.0),
    # hand (flat mitten, palm down)
    (74.0, 4.4, 2.9, -0.1, 2.3),
    (80.0, 4.8, 2.6, -0.3, 2.4),    # knuckles
    (86.0, 4.2, 2.1, -0.5, 2.3),    # fingers
    (89.5, 3.0, 1.5, -0.7, 2.1),    # tip
]
Z_SHO = 147.0
for sgn, side in ((1, 'L'), (-1, 'R')):
    rings = [ring_x(sgn * r[0], r[1], r[2], N_A, Z_SHO, zoff=r[3], exp=r[4]) for r in ARM]
    parts.append(make_loft(f"Arm{side}", rings, BODY))
    # thumb (points forward, palm-down T-pose), base buried in the palm
    th = [ring_y(y, w, zlo, zhi, 10, xc=sgn * 75.5, exp=2.0) for y, w, zlo, zhi in
          ((-3.8, 1.8, 145.2, 148.8), (-6.8, 1.5, 145.4, 148.2), (-9.2, 1.1, 145.7, 147.6))]
    parts.append(make_loft(f"Thumb{side}", th, BODY))
    # wristband (accent)
    wb = [ring_x(sgn * x, ry, rz, N_A, Z_SHO, zoff=0.0, exp=2.1)
          for x, ry, rz in ((61.5, 4.35, 4.75), (63.5, 4.55, 4.95), (66.5, 4.25, 4.65))]
    parts.append(make_loft(f"Wristband{side}", wb, ACCENT))

# ── 4. legs + feet ────────────────────────────────────────────────────────────
N_L = 18
LEG = [
    # (z, rx, ry, yoff, exp)
    (92, 8.4, 9.8, +0.4, 2.15),     # root (buried in briefs)
    (85, 8.9, 10.2, -0.4, 2.15),    # quad mass
    (76, 8.2, 9.3, -0.5, 2.1),
    (66, 6.9, 7.9, -0.2, 2.05),
    (57, 5.9, 6.7, -0.1, 2.05),
    (53, 5.7, 6.4, -0.2, 2.05),     # knee
    (47, 5.9, 6.9, +0.6, 2.1),      # calf top
    (38, 6.0, 7.2, +1.0, 2.1),      # calf peak
    (28, 4.8, 5.7, +0.6, 2.05),
    (18, 4.0, 4.6, +0.2, 2.0),
    (11, 3.7, 4.3, +0.1, 2.0),      # ankle
    (7,  3.6, 4.1, +0.1, 2.0),
]
X_HIP = 9.6
N_F = 16
FOOT = [
    # (y, w, zlo, zhi)
    (+8.0, 4.0, 1.2, 7.0),          # heel back
    (+3.0, 4.8, 0.4, 8.0),
    (-4.0, 5.0, 0.2, 6.6),          # arch
    (-12.0, 5.6, 0.1, 4.8),         # ball
    (-17.5, 5.0, 0.1, 3.2),         # toes
    (-20.0, 3.6, 0.4, 2.0),         # tip
]
for sgn, side in ((1, 'L'), (-1, 'R')):
    rings = [ring_z(r[0], r[1], r[2], N_L, yoff=r[3], exp=r[4]) for r in LEG]
    rings = [[(sgn * X_HIP * CM + p[0], p[1], p[2]) for p in ring] for ring in rings]
    parts.append(make_loft(f"Leg{side}", rings, BODY))
    foot = [ring_y(r[0], r[1], r[2], r[3], N_F, xc=sgn * (X_HIP + 0.4)) for r in FOOT]
    parts.append(make_loft(f"Foot{side}", foot, BODY))
    ab = [ring_z(z, rx, ry, N_L, yoff=0.1, exp=2.05) for z, rx, ry in
          ((8.0, 4.1, 4.65), (10.0, 4.3, 4.85), (13.0, 4.05, 4.6))]
    ab = [[(sgn * X_HIP * CM + p[0], p[1], p[2]) for p in ring] for ring in ab]
    parts.append(make_loft(f"AnkleBand{side}", ab, ACCENT))

# ── 5. join into a single Avatar object, flat shading, matcap material ───────
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
avatar = bpy.context.view_layer.objects.active
avatar.name = "Avatar"
avatar.data.name = "Avatar"

# smooth shading — the turnaround renders smooth; image priority > text spec
for p in avatar.data.polygons:
    p.use_smooth = True

mat = bpy.data.materials.new("AvatarMatcap")
mat.use_nodes = True
nt = mat.node_tree
# node names may be localized (Japanese UI) — find by type, sockets by identifier
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
attr = nt.nodes.new("ShaderNodeVertexColor")
attr.layer_name = "Col"
def sock(node, ident):
    return next(s for s in node.inputs if s.identifier == ident)
nt.links.new(attr.outputs[0], sock(bsdf, "Base Color"))
sock(bsdf, "Roughness").default_value = 0.9
avatar.data.materials.append(mat)

# collection
coll = bpy.data.collections.new("Avatar")
scene.collection.children.link(coll)
for c in list(avatar.users_collection):
    c.objects.unlink(avatar)
coll.objects.link(avatar)

# triangle count
avatar.data.calc_loop_triangles()
tris = len(avatar.data.loop_triangles)
log(f"TRIANGLES: {tris} (budget 6000)")

# measurements
vs = [avatar.matrix_world @ v.co for v in avatar.data.vertices]
log(f"height: {max(v.z for v in vs):.3f} m")
log(f"shoulder width (delt top z>1.53): {2 * max(abs(v.x) for v in vs if v.z > 1.53 and abs(v.x) > 0.1):.3f} m")
log(f"chest width: {2 * max(abs(v.x) for v in vs if 1.39 < v.z < 1.43 and abs(v.x) < 0.25):.3f} m")
log(f"waist width: {2 * max(abs(v.x) for v in vs if 1.05 < v.z < 1.09):.3f} m")
log(f"wingspan: {2 * max(abs(v.x) for v in vs):.3f} m")

# ── 6. Step2: AvatarRig (fixed skeleton per docs/avatar-rig-spec.md.txt) ─────
FWD = Vector((0, -1, 0))
UPV = Vector((0, 0, 1))
XH = X_HIP  # 9.6

# (name, head(cm), tail(cm), parent, roll_target, deform)
BONES = [
    ("Root",       (0, 0, 0),        (0, 0, 12),        None,        FWD, False),
    ("Pelvis",     (0, 0, 98),       (0, 0, 110),       "Root",      FWD, True),
    ("Spine01",    (0, 0, 110),      (0, 0, 124),       "Pelvis",    FWD, True),
    ("Spine02",    (0, 0, 124),      (0, 0, 138),       "Spine01",   FWD, True),
    ("Chest",      (0, 0, 138),      (0, 0, 152),       "Spine02",   FWD, True),
    ("Neck",       (0, 0, 152),      (0, 0, 158),       "Chest",     FWD, True),
    ("Head",       (0, 0, 158),      (0, 0, 178),       "Neck",      FWD, True),
]
for sgn, S in ((1, 'L'), (-1, 'R')):
    BONES += [
        (f"Clavicle_{S}", (sgn * 3, 0, 148),    (sgn * 15.5, 0, 147.3), "Chest",         FWD, True),
        (f"UpperArm_{S}", (sgn * 16, 0, 147),   (sgn * 45, 0, 147),     f"Clavicle_{S}", FWD, True),
        (f"LowerArm_{S}", (sgn * 45, 0, 147),   (sgn * 67, 0, 147),     f"UpperArm_{S}", FWD, True),
        (f"Hand_{S}",     (sgn * 67, 0, 147),   (sgn * 88, 0, 146.2),   f"LowerArm_{S}", FWD, True),
        (f"Thigh_{S}",    (sgn * XH, 0, 95),    (sgn * (XH + 0.3), -0.5, 53),  "Pelvis",     FWD, True),
        (f"Calf_{S}",     (sgn * (XH + 0.3), -0.5, 53), (sgn * (XH + 0.4), 0.1, 11), f"Thigh_{S}", FWD, True),
        (f"Foot_{S}",     (sgn * (XH + 0.4), 0.1, 11),  (sgn * (XH + 0.6), -12, 2.6), f"Calf_{S}", UPV, True),
        (f"Toe_{S}",      (sgn * (XH + 0.6), -12, 2.6), (sgn * (XH + 0.7), -19.5, 1.4), f"Foot_{S}", UPV, True),
        # non-deform leg IK controls
        (f"IK_Foot_{S}",  (sgn * (XH + 0.4), 0.1, 11),  (sgn * (XH + 0.4), -9, 11), "Root", UPV, False),
        (f"IK_Knee_{S}",  (sgn * (XH + 0.3), -35, 53),  (sgn * (XH + 0.3), -41, 53), "Root", UPV, False),
    ]

rig_data = bpy.data.armatures.new("AvatarRig")
rig = bpy.data.objects.new("AvatarRig", rig_data)
coll.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
ebs = rig_data.edit_bones
created = {}
for name, head, tail, parent, rollv, deform in BONES:
    b = ebs.new(name)
    b.head = Vector(head) * CM
    b.tail = Vector(tail) * CM
    b.use_connect = False
    b.align_roll(rollv)
    b.use_deform = deform
    if parent:
        b.parent = created[parent]
    created[name] = b
bpy.ops.object.mode_set(mode='OBJECT')
log(f"rig bones={len(rig_data.bones)} (deform={sum(1 for b in rig_data.bones if b.use_deform)})")

# legs IK (chain: Calf->Thigh, target/pole are non-deform controls)
for S in ('L', 'R'):
    pb = rig.pose.bones[f"Calf_{S}"]
    con = pb.constraints.new('IK')
    con.target = rig
    con.subtarget = f"IK_Foot_{S}"
    con.pole_target = rig
    con.pole_subtarget = f"IK_Knee_{S}"
    con.chain_count = 2
    con.pole_angle = math.radians(90)

# skinning: auto weights, then max 4 influences + normalize (spec)
bpy.ops.object.select_all(action='DESELECT')
avatar.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
ok = any(len(v.groups) > 0 for v in avatar.data.vertices)
log("auto weights:", "ok" if ok else "FAILED")

# fallback for any vertex the heat solver missed: nearest deform-bone segment
def seg_dist(p, a, b):
    ab = b - a
    t = 0.0
    if ab.dot(ab) > 1e-9:
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.dot(ab)))
    return (p - (a + ab * t)).length

segs = [(b.name, b.head_local.copy(), b.tail_local.copy())
        for b in rig_data.bones if b.use_deform]
part_idx = {g.index for g in avatar.vertex_groups if g.name.startswith("PART_")}
unweighted = [v for v in avatar.data.vertices
              if not any(gw.group not in part_idx for gw in v.groups)]
if unweighted:
    for v in unweighted:
        p = avatar.matrix_world @ v.co
        name = min(segs, key=lambda s: seg_dist(p, s[1], s[2]))[0]
        if name not in avatar.vertex_groups:
            avatar.vertex_groups.new(name=name)
        avatar.vertex_groups[name].add([v.index], 1.0, 'REPLACE')
log(f"heat-missed vertices fixed: {len(unweighted)}")
# shell-aware shoulder weights: the deltoid (arm shell) and the torso's
# shoulder corner overlap in space — heat weighting smears them together and
# the shoulders spike into "epaulettes" once the arms lower.
def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

vg = avatar.vertex_groups
part_of = {}
for g in vg:
    if g.name.startswith("PART_"):
        part_of[g.index] = g.name[5:]
vert_part = {}
for v in avatar.data.vertices:
    for gw in v.groups:
        if gw.group in part_of:
            vert_part[v.index] = part_of[gw.group]
            break

ARM_BONES = {f"{p}_{s}" for p in ("UpperArm", "LowerArm", "Hand") for s in "LR"}
bone_idx = {g.name: g.index for g in vg}
for v in avatar.data.vertices:
    part = vert_part.get(v.index, "")
    p = avatar.matrix_world @ v.co
    ax = abs(p.x)
    S = 'L' if p.x > 0 else 'R'
    if part in ("Torso", "Briefs", "Waistband"):
        # torso shell: strip smeared arm weights, then give only the outer
        # shoulder corner a gentle (<=32%) upper-arm pull so the silhouette
        # rounds off when the arms lower, without spiking
        arm_w = [(gw.group, gw.weight) for gw in v.groups if vg[gw.group].name in ARM_BONES]
        corner = 0.20 * smoothstep((ax - 0.14) / 0.05) if p.z > 1.40 else 0.0
        if arm_w or corner > 0.001:
            for gi, _ in arm_w:
                vg[gi].remove([v.index])
            rest = [(gw.group, gw.weight) for gw in v.groups]
            tot = sum(w for _, w in rest)
            if tot < 1e-6:
                tgt = f"Clavicle_{S}" if (p.z > 1.40 and ax > 0.10) else "Chest"
                vg[bone_idx[tgt]].add([v.index], 1.0 - corner, 'REPLACE')
            else:
                for gi, w in rest:
                    vg[gi].add([v.index], (w / tot) * (1.0 - corner), 'REPLACE')
            if corner > 0.001:
                vg[bone_idx[f"UpperArm_{S}"]].add([v.index], corner, 'ADD')
        # cap clavicle dominance on the torso so chest breathing reads
        cw = sum(gw.weight for gw in v.groups
                 if vg[gw.group].name in (f"Clavicle_{S}",))
        if cw > 0.45:
            vg[bone_idx[f"Clavicle_{S}"]].add([v.index], 0.45, 'REPLACE')
            vg[bone_idx["Chest"]].add([v.index], cw - 0.45, 'ADD')
    elif part.startswith("Arm") and ax < 0.30:
        # shoulder cap: verts above the joint pivot sweep an outward arc if
        # they rotate fully with the arm — fade their arm weight by height
        # (top of the cap stays as the static shoulder, armpit side follows)
        h = smoothstep((p.z - 1.475) / 0.075)
        w_arm = 1.0 - 0.65 * h
        for gw in list(v.groups):
            if gw.group not in part_of:
                vg[gw.group].remove([v.index])
        vg[bone_idx[f"UpperArm_{S}"]].add([v.index], w_arm, 'REPLACE')
        if w_arm < 0.999:
            vg[bone_idx[f"Clavicle_{S}"]].add([v.index], 1.0 - w_arm, 'REPLACE')

# drop part tags before influence limiting / normalization
for g in [g for g in vg if g.name.startswith("PART_")]:
    vg.remove(g)

bpy.ops.object.select_all(action='DESELECT')
avatar.select_set(True)
bpy.context.view_layer.objects.active = avatar
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
maxinf = max(len(v.groups) for v in avatar.data.vertices)
log(f"max influences per vertex: {maxinf}")

if os.environ.get("AVATAR_DEBUG_WEIGHTS"):
    # paint dominant bone into vertex color and render the arms-down pose
    colmap = {"UpperArm_L": (1, 0, 0, 1), "UpperArm_R": (1, 0, 0, 1),
              "Clavicle_L": (0, 1, 0, 1), "Clavicle_R": (0, 1, 0, 1),
              "Chest": (0, 0.4, 1, 1), "Neck": (1, 1, 0, 1),
              "LowerArm_L": (1, 0, 1, 1), "LowerArm_R": (1, 0, 1, 1)}
    names = {g.index: g.name for g in avatar.vertex_groups}
    colattr = avatar.data.color_attributes["Col"]
    vcol = {}
    for v in avatar.data.vertices:
        best = None
        for gw in v.groups:
            if best is None or gw.weight > best.weight:
                best = gw
        vcol[v.index] = colmap.get(names[best.group] if best else "", (1, 1, 1, 1))
    for loop in avatar.data.loops:
        colattr.data[loop.index].color = vcol[loop.vertex_index]
    for nm, z in (("UpperArm_L", -78), ("UpperArm_R", 78)):
        pb = rig.pose.bones[nm]
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, math.radians(z))
    bpy.context.view_layer.update()
    # dump the verts that form the shoulder "wings" after the arms drop
    dg = bpy.context.evaluated_depsgraph_get()
    ev = avatar.evaluated_get(dg).to_mesh()
    gnames = {g.index: g.name for g in avatar.vertex_groups}
    hits = []
    for v_ev, v_src in zip(ev.vertices, avatar.data.vertices):
        p = avatar.matrix_world @ v_ev.co
        if p.x > 0.205 and p.z > 1.48:
            ws = {gnames[gw.group]: round(gw.weight, 2) for gw in v_src.groups}
            rest = avatar.matrix_world @ v_src.co
            hits.append((round(p.x, 3), round(p.z, 3),
                         (round(rest.x, 2), round(rest.y, 2), round(rest.z, 2)), ws))
    log(f"WING ZONE VERTS: {len(hits)}")
    for h in sorted(hits, key=lambda h: -h[0])[:14]:
        log("  ", h)
    avatar.evaluated_get(dg).to_mesh_clear()
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 480; scene.render.resolution_y = 720
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'VERTEX'
    if scene.world is None:
        scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = False
    import mathutils as _mu
    cd = bpy.data.cameras.new("dbg"); cd.type = 'ORTHO'; cd.ortho_scale = 1.1
    cam = bpy.data.objects.new("dbg", cd)
    scene.collection.objects.link(cam)
    cam.location = (0, -6, 1.40)
    cam.rotation_euler = (_mu.Vector((0, 0, 1.40)) - _mu.Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(RENDER_OUT, "debug_weights_front.png")
    bpy.ops.render.render(write_still=True)
    log("DEBUG WEIGHTS RENDER DONE")
    raise SystemExit(0)

# ── 7. Step3: Idle (docs/avatar-animation-spec.md.txt — 180f @30fps, loop) ───
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 180
if not rig.animation_data:
    rig.animation_data_create()
idle = bpy.data.actions.new("Idle")
idle.use_fake_user = True
rig.animation_data.action = idle

def key(frame, bone, rot=None, loc=None):
    pb = rig.pose.bones[bone]
    if rot is not None:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = tuple(math.radians(a) for a in rot)
        pb.keyframe_insert('rotation_euler', frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert('location', frame=frame)

AD = 72  # arms relaxed at sides (T-pose -> down, slight athletic A-pose)

def idle_pose(f, breath, shift, flare, shrug, exhale=0.0):
    """breath: 0..1 inhale, shift: 0..1 weight to left leg."""
    key(f, 'UpperArm_L', (0, 0, -(AD - flare)))
    key(f, 'UpperArm_R', (0, 0, +(AD - flare)))
    key(f, 'LowerArm_L', (10, 0, 0)); key(f, 'LowerArm_R', (10, 0, 0))
    key(f, 'Hand_L', (4, 0, 0)); key(f, 'Hand_R', (4, 0, 0))
    key(f, 'Clavicle_L', (0, 0, shrug)); key(f, 'Clavicle_R', (0, 0, -shrug))
    key(f, 'Chest',   (-3.5 * breath + exhale, 0, -0.8 * shift))
    key(f, 'Spine02', (-1.5 * breath + 0.4 * exhale, 0, -0.5 * shift))
    key(f, 'Spine01', (0, 0, -1.2 * shift))
    key(f, 'Neck',    (1.2 * breath - 0.3 * exhale, 0, -0.5 * shift))
    key(f, 'Head',    (-1.2 * breath + 0.2 * exhale, 0, 0.4 * shift))
    key(f, 'Pelvis', rot=(0, 0, 1.8 * shift), loc=(0.026 * shift, -0.006 * shift, 0))

idle_pose(1,   0.0, 0.0,  0.0, 0.0)               # neutral
idle_pose(45,  1.0, 0.0,  1.5, 2.5)               # inhale, chest expands
idle_pose(90,  0.45, 1.0, 0.8, 1.2)               # weight shift left
idle_pose(135, 0.0, 0.35, 0.0, 0.0, exhale=0.8)   # exhale, returning
idle_pose(180, 0.0, 0.0,  0.0, 0.0)               # neutral = frame 1 (loop)

for fc in idle.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
log(f"action 'Idle' frames 1..180 @30fps, {len(idle.fcurves)} fcurves")

# ── 7b. Step4: Walk (30f @30fps full gait cycle, in-place, loop) ─────────────
# L contact f1 -> L down f8 -> passing f15 -> R contact f16 -> R down f23 ->
# loops back into L contact at f31(=f1). IK-driven feet: heel strike,
# flat, heel-off, toe-off; no foot sliding.
walk = bpy.data.actions.new("Walk")
walk.use_fake_user = True
rig.animation_data.action = walk

STRIDE = 0.26   # half stride (m), in-place
LIFT = 0.085
LEAN = 2.5      # proud chest, slight forward intent

def leg_cycle(t):
    """t in [0,1): 0 = this foot's heel contact. Returns (fwd, up, footPitch, toeBend)."""
    t = t % 1.0
    if t < 0.5:                       # stance: travel front -> back, grounded
        ts = t / 0.5
        fwd = STRIDE * (1 - 2 * ts)
        up = 0.0
        if ts < 0.18:                 # heel strike -> foot flat
            pitch = 12 * (1 - ts / 0.18)
        elif ts < 0.62:
            pitch = 0.0
        else:                         # heel-off -> toe-off
            pitch = -20 * (ts - 0.62) / 0.38
        toe = 24 * max(0.0, (ts - 0.60) / 0.40)
        return fwd, up, pitch, toe
    tw = (t - 0.5) / 0.5              # swing: lift and carry forward
    fwd = -STRIDE + 2 * STRIDE * (0.5 - 0.5 * math.cos(math.pi * tw))
    up = LIFT * math.sin(math.pi * tw)
    pitch = -14 * (1 - tw) + 12 * smoothstep((tw - 0.6) / 0.4)
    toe = max(0.0, 16 * (1 - tw * 2.5))
    return fwd, up, pitch, toe

def walk_pose(f, t):
    ph = 2 * math.pi * t
    twist = 6.0 * math.cos(ph)               # pelvis: left hip leads at L contact
    roll = -2.5 * math.sin(ph)
    bob = -0.012 + 0.009 * math.cos(2 * ph + 0.42)
    lat = 0.014 * math.sin(ph + 0.31)
    key(f, 'Pelvis', rot=(2.0, twist, -roll), loc=(lat, bob, 0))
    key(f, 'Spine01', (0, -1.5 * math.cos(ph), 0))
    key(f, 'Spine02', (LEAN, -2.0 * math.cos(ph), 0))
    key(f, 'Chest', (0.5, -3.0 * math.cos(ph), 0))
    key(f, 'Neck', (0.5, 1.5 * math.cos(ph), 0))
    key(f, 'Head', (-1.0, 0.8 * math.cos(ph), 0))
    swing = 23.0 * math.cos(ph)
    key(f, 'UpperArm_L', (-swing - 1, 0, -AD))
    key(f, 'UpperArm_R', (swing - 1, 0, AD))
    key(f, 'LowerArm_L', (16 + 7 * max(0.0, -math.cos(ph)), 0, 0))
    key(f, 'LowerArm_R', (16 + 7 * max(0.0, math.cos(ph)), 0, 0))
    key(f, 'Hand_L', (5, 0, 0)); key(f, 'Hand_R', (5, 0, 0))
    key(f, 'Clavicle_L', (1.2 * math.cos(ph + math.pi), 0, 0.5))
    key(f, 'Clavicle_R', (1.2 * math.cos(ph), 0, -0.5))
    for S, off in (('L', 0.0), ('R', 0.5)):
        fwd, up, pitch, toe = leg_cycle(t + off)
        pb = rig.pose.bones[f'IK_Foot_{S}']
        pb.location = (0, fwd, up)            # IK target local: Y=fwd, Z=up
        pb.keyframe_insert('location', frame=f)
        key(f, f'Foot_{S}', (pitch, 0, 0))
        key(f, f'Toe_{S}', (toe, 0, 0))

for f in (1, 4, 8, 11, 15, 18, 22, 26, 29, 31):
    walk_pose(f, (f - 1) / 30.0)

for fc in walk.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
log(f"action 'Walk' frames 1..31 @30fps, {len(walk.fcurves)} fcurves")

# ── 7c. Step5: equipment (bench / barbell / plates, <=1000 tris) ─────────────
eq_coll = bpy.data.collections.new("Equipment")
scene.collection.children.link(eq_coll)

def eq_object(name, builder, color):
    bm = bmesh.new()
    builder(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    col = me.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')
    for i in range(len(col.data)):
        col.data[i].color = color
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    eq_coll.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = False
    return ob

def add_box(bm, cx, cy, cz, sx, sy, sz):
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=r['verts'], vec=(sx, sy, sz))
    bmesh.ops.translate(bm, verts=r['verts'], vec=(cx, cy, cz))

def add_cyl_x(bm, cx, cy, cz, r, hl, n):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=n,
                                radius1=r, radius2=r, depth=hl * 2)
    import mathutils as _m
    bmesh.ops.rotate(bm, verts=res['verts'],
                     matrix=_m.Matrix.Rotation(math.radians(90), 3, 'Y'))
    bmesh.ops.translate(bm, verts=res['verts'], vec=(cx, cy, cz))

GRAY = (0.74, 0.74, 0.74, 1.0)      # #BDBDBD shadow gray
DARK = (0.30, 0.31, 0.35, 1.0)

def build_bench(bm):
    add_box(bm, 0, 0.33, 0.385, 0.27, 1.04, 0.09)    # pad
    add_box(bm, 0, -0.05, 0.17, 0.20, 0.07, 0.34)    # front leg
    add_box(bm, 0, 0.72, 0.17, 0.20, 0.07, 0.34)     # rear leg
    add_box(bm, 0, 0.33, 0.045, 0.10, 0.85, 0.05)    # floor rail
bench_ob = eq_object("Bench", build_bench, DARK)

def build_barbell(bm):
    add_cyl_x(bm, 0, 0, 0, 0.0145, 0.72, 8)          # bar
    for s in (1, -1):
        add_cyl_x(bm, s * 0.555, 0, 0, 0.030, 0.028, 8)    # collar
        add_cyl_x(bm, s * 0.625, 0, 0, 0.140, 0.0175, 14)  # plate
bar_ob = eq_object("Barbell", build_barbell, (0.0, 0.76, 1.0, 1.0))

BAR_Z = 2.30
def build_pullbar(bm):
    for s in (1, -1):
        add_box(bm, s * 0.55, 0, BAR_Z / 2, 0.06, 0.06, BAR_Z)   # posts
        add_box(bm, s * 0.55, 0, 0.025, 0.20, 0.42, 0.05)        # feet
    add_cyl_x(bm, 0, 0, BAR_Z, 0.017, 0.58, 8)                   # grip bar
pull_ob = eq_object("PullUpBar", build_pullbar, DARK)

EQUIPMENT = (bench_ob, bar_ob, pull_ob)
for o in EQUIPMENT:
    o.data.calc_loop_triangles()
eq_tris = sum(len(o.data.loop_triangles) for o in EQUIPMENT)
log(f"equipment triangles: {eq_tris} (budget 1000)")

# barbell rides the press: follow Hand_R height/depth, stay centered+level
con = bar_ob.constraints.new('COPY_LOCATION')
con.target = rig
con.subtarget = "Hand_R"
con.use_x = False
bar_ob.location = (0, 0, 1.47)

# ── 7d. Step5: BenchPress (60f @30fps, loop) ─────────────────────────────────
bench = bpy.data.actions.new("BenchPress")
bench.use_fake_user = True
rig.animation_data.action = bench

def bench_pose(f, press):
    """press: 1 = lockout (arms extended), 0 = bottom (bar at chest)."""
    key(f, 'Pelvis', rot=(-90, 0, 0), loc=(0, -0.46, 0))
    key(f, 'Spine01', (-1, 0, 0))
    key(f, 'Spine02', (-4, 0, 0))
    key(f, 'Chest', (-6 - 2 * (1 - press), 0, 0))     # open chest, arch at bottom
    key(f, 'Neck', (2, 0, 0)); key(f, 'Head', (4, 0, 0))
    ax = 14 + 58 * press
    el = 84 - 74 * press
    tuck = 16 - 6 * press
    key(f, 'UpperArm_L', (ax, 0, -tuck)); key(f, 'UpperArm_R', (ax, 0, tuck))
    key(f, 'LowerArm_L', (el, 0, 0)); key(f, 'LowerArm_R', (el, 0, 0))
    key(f, 'Hand_L', (4, 0, 0)); key(f, 'Hand_R', (4, 0, 0))
    key(f, 'Clavicle_L', (2 - 5 * (1 - press), 0, 0))  # shoulders open at bottom
    key(f, 'Clavicle_R', (2 - 5 * (1 - press), 0, 0))
    # feet planted on the floor beside the bench (IK), knees aimed up-forward
    for S, sx in (('L', 1), ('R', -1)):
        pb = rig.pose.bones[f'IK_Foot_{S}']
        pb.location = (-sx * 0.08, 0.25, -0.06)
        pb.keyframe_insert('location', frame=f)
        # pole_angle(+90) twists pole->knee mapping by -90 deg around the
        # hip-ankle axis in this lying posture; pre-rotated placement keeps
        # the knees pointing up-forward instead of splaying out
        pb = rig.pose.bones[f'IK_Knee_{S}']
        pb.location = (sx * 0.10, -0.16, 0.22)
        pb.keyframe_insert('location', frame=f)
        key(f, f'Foot_{S}', (-4, 0, 0))
        key(f, f'Toe_{S}', (0, 0, 0))

bench_pose(1, 1.0)     # start / lockout
bench_pose(15, 0.52)   # lowering (controlled)
bench_pose(30, 0.0)    # bottom, bar at chest
bench_pose(33, 0.0)    # touch pause
bench_pose(45, 0.42)   # press, sticking point (slow first half)
bench_pose(61, 1.0)    # lockout = frame 1 (loop)

for fc in bench.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
log(f"action 'BenchPress' frames 1..61 @30fps, {len(bench.fcurves)} fcurves")

# debug: where do the IK feet actually land at the bench bottom?
scene.frame_set(30)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
rig_eval = rig.evaluated_get(dg)
for nm in ("IK_Foot_L", "Foot_L", "Calf_L", "Thigh_L"):
    h = rig_eval.matrix_world @ rig_eval.pose.bones[nm].head
    log(f"  BENCH@30 {nm}: head=({h.x:.3f},{h.y:.3f},{h.z:.3f})")

# ── 7e. Step6: Squat (60f @30fps, loop, barbell on the shoulders) ────────────
squat = bpy.data.actions.new("Squat")
squat.use_fake_user = True
rig.animation_data.action = squat

def squat_pose(f, depth):
    """depth: 0 = standing lockout, 1 = bottom (deep squat)."""
    drop, back = 0.46 * depth, 0.20 * depth
    hinge = 26 * depth
    key(f, 'Pelvis', rot=(hinge, 0, 0), loc=(0, -drop, -back))
    key(f, 'Spine01', (5 * depth, 0, 0))
    key(f, 'Spine02', (3 * depth, 0, 0))
    key(f, 'Chest', (-6 * depth, 0, 0))               # proud chest
    key(f, 'Neck', (-0.5 * hinge, 0, 0))
    key(f, 'Head', (-2 * depth, 0, 0))
    # hands rack the bar beside the shoulders (constant grip)
    key(f, 'UpperArm_L', (-62, 0, -52)); key(f, 'UpperArm_R', (-62, 0, 52))
    key(f, 'LowerArm_L', (152, 0, 0)); key(f, 'LowerArm_R', (152, 0, 0))
    key(f, 'Hand_L', (10, 0, 0)); key(f, 'Hand_R', (10, 0, 0))
    key(f, 'Clavicle_L', (2, 0, 1)); key(f, 'Clavicle_R', (2, 0, -1))
    for S, sx in (('L', 1), ('R', -1)):
        pb = rig.pose.bones[f'IK_Foot_{S}']
        pb.location = (-sx * 0.045, 0.0, 0.0)         # shoulder-width stance
        pb.keyframe_insert('location', frame=f)
        pb = rig.pose.bones[f'IK_Knee_{S}']
        pb.location = (0, 0, 0)
        pb.keyframe_insert('location', frame=f)
        key(f, f'Foot_{S}', (24 * depth, 0, 0))       # keep soles flat vs shin tilt
        key(f, f'Toe_{S}', (0, 0, 0))

squat_pose(1, 0.0)     # start, standing tall
squat_pose(15, 0.56)   # descent
squat_pose(30, 1.0)    # bottom (deep, exaggerated hips)
squat_pose(33, 1.0)    # brief hold
squat_pose(45, 0.58)   # ascent with sticking point
squat_pose(61, 0.0)    # lockout = frame 1 (loop)

for fc in squat.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
log(f"action 'Squat' frames 1..61 @30fps, {len(squat.fcurves)} fcurves")

# debug: bar (hand) path should stay near-vertical; feet planted
for fr in (1, 30):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    rig_eval = rig.evaluated_get(dg)
    for nm in ("Hand_R", "Foot_L"):
        h = rig_eval.matrix_world @ rig_eval.pose.bones[nm].head
        log(f"  SQUAT@{fr} {nm}: head=({h.x:.3f},{h.y:.3f},{h.z:.3f})")

# ── 7f. Step7: PullUp (60f @30fps, loop, hands stay on the bar) ──────────────
pullup = bpy.data.actions.new("PullUp")
pullup.use_fake_user = True
rig.animation_data.action = pullup

# pelvis height/forward calibrated so the hands stay glued to the grip bar
PUP = (0.32, 0.66)
PFW = (-0.045, 0.015)

def pullup_pose(f, u):
    """u: 0 = dead hang, 1 = top (chest approaches the bar)."""
    az = 78 - 33 * u
    ax = -2 - 16 * u
    el = 8 + 112 * u
    pup = PUP[0] + (PUP[1] - PUP[0]) * u
    pfw = PFW[0] + (PFW[1] - PFW[0]) * u
    key(f, 'Pelvis', rot=(-8 * u, 0, 0), loc=(0, pup, pfw))
    key(f, 'Spine01', (2 * (1 - u), 0, 0))            # slight hollow at hang
    key(f, 'Spine02', (-2 * u, 0, 0))
    key(f, 'Chest', (-8 * u, 0, 0))                   # chest to the bar
    key(f, 'Neck', (-6 * u, 0, 0))
    key(f, 'Head', (-5 * u, 0, 0))                    # chin over
    key(f, 'UpperArm_L', (ax, 0, az)); key(f, 'UpperArm_R', (ax, 0, -az))
    key(f, 'LowerArm_L', (el, 0, 0)); key(f, 'LowerArm_R', (el, 0, 0))
    key(f, 'Hand_L', (12, 0, 0)); key(f, 'Hand_R', (12, 0, 0))
    key(f, 'Clavicle_L', (0, 0, 4 - 7 * u)); key(f, 'Clavicle_R', (0, 0, -(4 - 7 * u)))
    for S, sx in (('L', 1), ('R', -1)):
        pb = rig.pose.bones[f'IK_Foot_{S}']
        pb.location = (sx * 0.015, -0.13, pup + 0.10)  # knees soft, feet trail
        pb.keyframe_insert('location', frame=f)
        pb = rig.pose.bones[f'IK_Knee_{S}']
        pb.location = (0, 0, 0)
        pb.keyframe_insert('location', frame=f)
        key(f, f'Foot_{S}', (-18, 0, 0))               # toes pointed
        key(f, f'Toe_{S}', (-8, 0, 0))

pullup_pose(1, 0.0)     # hang
pullup_pose(15, 0.55)   # pull
pullup_pose(30, 1.0)    # top
pullup_pose(33, 1.0)    # hold
pullup_pose(45, 0.45)   # lower (controlled)
pullup_pose(61, 0.0)    # hang = frame 1 (loop)

for fc in pullup.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
log(f"action 'PullUp' frames 1..61 @30fps, {len(pullup.fcurves)} fcurves")

# debug: hands must sit on the bar (z=BAR_Z, y=0) at hang and top
for fr in (1, 30):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    rig_eval = rig.evaluated_get(dg)
    for nm in ("Hand_R", "Foot_L", "Head"):
        h = rig_eval.matrix_world @ rig_eval.pose.bones[nm].head
        log(f"  PULLUP@{fr} {nm}: head=({h.x:.3f},{h.y:.3f},{h.z:.3f})")

# ── 7g. Step8: Run (20f @30fps full cycle, flight phases, loop) ──────────────
run = bpy.data.actions.new("Run")
run.use_fake_user = True
rig.animation_data.action = run

R_ST = 0.35       # stance fraction (rest is swing/flight)
R_STRIDE_F, R_STRIDE_B = 0.26, -0.31

def run_leg(t):
    """t in [0,1): 0 = this foot's contact. Returns (fwd, up, pitch, toe)."""
    t = t % 1.0
    if t < R_ST:
        ts = t / R_ST
        fwd = R_STRIDE_F + (R_STRIDE_B - R_STRIDE_F) * ts
        if ts < 0.15:
            pitch = 6 * (1 - ts / 0.15)
        elif ts < 0.55:
            pitch = 0.0
        else:
            pitch = -24 * (ts - 0.55) / 0.45
        toe = 20 * max(0.0, (ts - 0.6) / 0.4)
        return fwd, 0.0, pitch, toe
    tw = (t - R_ST) / (1 - R_ST)
    fwd = R_STRIDE_B + (R_STRIDE_F - R_STRIDE_B) * (0.5 - 0.5 * math.cos(math.pi * tw))
    up = 0.30 * math.sin(math.pi * tw) ** 1.2
    pitch = -20 + 26 * smoothstep((tw - 0.15) / 0.55) - 4 * smoothstep((tw - 0.85) / 0.15)
    return fwd, up, pitch, 0.0

def run_pose(f, t):
    ph = 2 * math.pi * t
    twist = 8.0 * math.cos(ph)
    bob = -0.018 - 0.032 * math.cos(2 * ph - 0.6 * math.pi)
    key(f, 'Pelvis', rot=(4.0, twist, 2.5 * math.sin(ph)), loc=(0.008 * math.sin(ph), bob, 0))
    key(f, 'Spine01', (4, -2.5 * math.cos(ph), 0))
    key(f, 'Spine02', (6, -3.5 * math.cos(ph), 0))
    key(f, 'Chest', (1, -4.5 * math.cos(ph), 0))
    key(f, 'Neck', (-4, 2 * math.cos(ph), 0))
    key(f, 'Head', (-3, 0, 0))
    swing = 38.0 * math.cos(ph)
    key(f, 'UpperArm_L', (-swing - 4, 0, -(AD + 4)))
    key(f, 'UpperArm_R', (swing - 4, 0, AD + 4))
    key(f, 'LowerArm_L', (86 + 14 * max(0.0, -math.cos(ph)), 0, 0))
    key(f, 'LowerArm_R', (86 + 14 * max(0.0, math.cos(ph)), 0, 0))
    key(f, 'Hand_L', (8, 0, 0)); key(f, 'Hand_R', (8, 0, 0))
    key(f, 'Clavicle_L', (3 * math.cos(ph + math.pi), 0, 1))
    key(f, 'Clavicle_R', (3 * math.cos(ph), 0, -1))
    for S, off in (('L', 0.0), ('R', 0.5)):
        fwd, up, pitch, toe = run_leg(t + off)
        pb = rig.pose.bones[f'IK_Foot_{S}']
        pb.location = (0, fwd, up)
        pb.keyframe_insert('location', frame=f)
        pb = rig.pose.bones[f'IK_Knee_{S}']
        pb.location = (0, 0, 0)
        pb.keyframe_insert('location', frame=f)
        key(f, f'Foot_{S}', (pitch, 0, 0))
        key(f, f'Toe_{S}', (toe, 0, 0))

for f in range(1, 22, 2):
    run_pose(f, (f - 1) / 20.0)

for fc in run.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
log(f"action 'Run' frames 1..21 @30fps, {len(run.fcurves)} fcurves")

rig.animation_data.action = idle
scene.frame_set(1)

# ── 8. viewport: matcap + vertex color workflow, then save ────────────────────
for ws in bpy.data.workspaces:
    for screen in ws.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'SOLID'
                        space.shading.light = 'MATCAP'
                        space.shading.color_type = 'VERTEX'

bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
log(f"SAVED {BLEND_OUT}")

# ── 7. verification turnaround renders (not saved into the .blend) ───────────
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 320
scene.render.resolution_y = 480
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'VERTEX'
scene.display.shading.show_shadows = False
if scene.world is None:
    scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = False
scene.world.color = (0.94, 0.95, 0.96)

import mathutils
def shoot(tag, loc, target=(0, 0, 0.92), ortho=2.05):
    cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = ortho
    cam = bpy.data.objects.new("c", cd)
    scene.collection.objects.link(cam)
    cam.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(RENDER_OUT, f"{tag}.png")
    bpy.ops.render.render(write_still=True)
    log("rendered", tag)

# equipment appears only in its exercise's shots
def show_equipment(*visible):
    for o in EQUIPMENT:
        o.hide_render = o not in visible

show_equipment()

# Idle animation strip (action assigned, sampled at the spec keyframes)
for fr in (1, 45, 90, 135):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    shoot(f"idle_f{fr:03d}_front", (0, -6, 0.92))
scene.frame_set(90)
shoot("idle_f090_side", (6, 0, 0.92))

# Walk strip
rig.animation_data.action = walk
for fr in (1, 8, 15, 22):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    shoot(f"walk_f{fr:02d}_side", (6, 0, 0.92))
scene.frame_set(8)
shoot("walk_f08_front", (0, -6, 0.92))
scene.frame_set(22)
shoot("walk_f22_front", (0, -6, 0.92))

# BenchPress strip (equipment visible)
show_equipment(bench_ob, bar_ob)
rig.animation_data.action = bench
for fr in (1, 15, 30, 45):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    shoot(f"bench_f{fr:02d}_side", (6, 0.25, 0.6), target=(0, 0.25, 0.55), ortho=2.3)
scene.frame_set(30)
shoot("bench_f30_front", (0, -6, 0.6), target=(0, 0, 0.55), ortho=2.3)

# Squat strip (barbell only, no bench)
show_equipment(bar_ob)
rig.animation_data.action = squat
for fr in (1, 15, 30, 45):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    shoot(f"squat_f{fr:02d}_side", (6, 0, 0.92))
scene.frame_set(30)
shoot("squat_f30_front", (0, -6, 0.92))

# Run strip (no equipment)
show_equipment()
rig.animation_data.action = run
for fr in (1, 4, 8, 10, 13):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    shoot(f"run_f{fr:02d}_side", (6, 0, 0.92))
scene.frame_set(11)
shoot("run_f11_front", (0, -6, 0.92))

# PullUp strip (pull-up bar only)
show_equipment(pull_ob)
rig.animation_data.action = pullup
for fr in (1, 15, 30):
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    shoot(f"pullup_f{fr:02d}_side", (6, 0, 1.35), target=(0, 0, 1.35), ortho=2.7)
scene.frame_set(30)
shoot("pullup_f30_front", (0, -6, 1.35), target=(0, 0, 1.35), ortho=2.7)
show_equipment()

# rest-pose turnaround (action detached for comparison with the reference)
rig.animation_data.action = None

def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)

reset_pose()
bpy.context.view_layer.update()
shoot("front", (0, -6, 0.92))
shoot("side", (6, 0, 0.92))
shoot("back", (0, 6, 0.92))

# ── 10. rig pose tests (rendered only — the saved .blend keeps Idle assigned) ─

# IK test: drop the pelvis — knees must bend forward, feet stay planted
reset_pose()
rig.pose.bones['Pelvis'].location = (0, -0.32, 0)
bpy.context.view_layer.update()
shoot("test_ik_drop_side", (6, 0, 0.78))
shoot("test_ik_drop_front", (0, -6, 0.78))

# FK test: left arm forward+elbow, right arm coronal rotation, spine lean
reset_pose()
for nm, rot in (("UpperArm_L", (70, 0, 0)), ("LowerArm_L", (35, 0, 0)),
                ("UpperArm_R", (0, 0, 50)), ("Spine02", (14, 0, 0)), ("Head", (-8, 0, 0))):
    pb = rig.pose.bones[nm]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = tuple(math.radians(a) for a in rot)
bpy.context.view_layer.update()
shoot("test_fk_side", (6, 0, 0.92))
shoot("test_fk_front", (0, -6, 0.92))
reset_pose()
log("STEP2 DONE")
