"""
Blender 4.3 bpy — Premium Low-Poly Earth Globe
Matches the Zenly / Poly Pizza reference image.

Run with:
  "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe"
      --background --python build_earth_blender.py

Three.js orientation:
  globe.rotation.y = Math.PI / 2;  // Atlantic faces camera
"""

import bpy, bmesh, math, random, os, sys

random.seed(42)

THIS = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(THIS, "public", "models", "earth_lowpoly_mobile.glb")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# ── 1. Clear scene ─────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
    for x in list(d): d.remove(x)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
bpy.context.scene.render.fps = 24

# ── 2. Palette (sRGB hex → linear RGBA) ───────────────────────────────────────
def hx(s):
    f = lambda c: (c/255)**2.2
    return (f(int(s[1:3],16)), f(int(s[3:5],16)), f(int(s[5:7],16)), 1.0)

PAL = {
    "ocean": hx("#66C4FF"),
    "gd":    hx("#4CAF50"),   # dark green
    "gm":    hx("#7BC043"),   # mid green
    "gl":    hx("#A8D672"),   # light green
    "dy":    hx("#F6E58D"),   # desert yellow
    "mo":    hx("#E8B16D"),   # mountain orange
    "snow":  (1.0, 1.0, 1.0, 1.0),
}
GREENS = ["gd","gm","gl"]

# ── 3. Materials ───────────────────────────────────────────────────────────────
def mk_mat(key, rough=0.9):
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    # Explicitly rebuild node tree for reliability in --background mode
    m.node_tree.nodes.clear()
    out = m.node_tree.nodes.new("ShaderNodeOutputMaterial")
    out.location = (300, 0)
    b   = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    b.location = (0, 0)
    m.node_tree.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    b.inputs["Base Color"].default_value = PAL[key]
    b.inputs["Metallic"].default_value   = 0.0
    b.inputs["Roughness"].default_value  = rough
    try:   b.inputs["Specular IOR Level"].default_value = 0.05
    except: pass
    return m

M = {k: mk_mat(k, 0.72 if k=="ocean" else 0.9) for k in PAL}

# ── 4. Coordinate helpers (Blender Z-up, lon=0° at +X) ────────────────────────
def ll(lat, lon, r=1.0):
    la, lo = math.radians(lat), math.radians(lon)
    return (r*math.cos(la)*math.cos(lo),
            r*math.cos(la)*math.sin(lo),
            r*math.sin(la))

# ── 5. Terrain classification ──────────────────────────────────────────────────
CONT = [
    ( 72, 90,-180, 180,"ice"),(-90,-63,-180, 180,"ice"),
    ( 60, 85, -60,  -15,"ice"),
    ( 50, 72,-142,  -53,"land"),( 24, 50,-130,  -60,"land"),( 14, 24,-92,-77,"land"),
    (-56, 13, -82,  -34,"land"),
    ( 36, 72, -12,   42,"land"),
    (-35, 38, -18,   52,"land"),
    ( 60, 73,  28,  145,"land"),( 35, 60,  28,  145,"land"),
    ( 20, 35,  60,  122,"land"),(  5, 20,  72,  108,"land"),
    ( 22, 48, 124,  148,"land"),( -2, 22,  95,  128,"land"),
    (-39, -8, 112,  156,"land"),
]
DZONE = [
    ( 14, 33,-15,  40,"dy"),( 12, 33, 35,  62,"mo"),
    ( 26, 38, 44,  65,"dy"),( 38, 52, 88, 125,"dy"),( 35, 48, 55,  90,"dy"),
    (-33,-14,113, 142,"mo"),( 24, 40,-118,-95,"dy"),(-33,  5,-78, -67,"mo"),
]

def ter(lat, lon):
    for (a,b,c,d,t) in CONT:
        if a<=lat<=b and c<=lon<=d:
            if t=="ice": return "ice"
            for (da,db,dc,dd,dt) in DZONE:
                if da<=lat<=db and dc<=lon<=dd: return dt
            return "land"
    return "ocean"

def col_key(lat, lon):
    t = ter(lat, lon)
    if t in ("dy","mo"): return t
    if t == "ice":       return "snow"
    return GREENS[abs(hash((round(lat/12)*12, round(lon/12)*12))) % 3]

# ── 6. Ocean sphere (smooth) ────────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.0, location=(0,0,0))
oc = bpy.context.active_object
oc.name = "Ocean"
oc.data.materials.append(M["ocean"])
for p in oc.data.polygons: p.use_smooth = True

# ── 7. Continent grid mesh (flat) ───────────────────────────────────────────────
STEP    = 5.0        # degree step — 5°×5° cells give large polygon look
R_LAND  = 1.033
R_ICE   = 1.015
COL_ORD = ["gd","gm","gl","dy","mo","snow"]
COL_I   = {k:i for i,k in enumerate(COL_ORD)}

bm = bmesh.new()
# Use int layer for reliable material_index mapping after to_mesh()
ml = bm.faces.layers.int.new("mi")
vc = {}  # vertex cache

def gv(lat, lon, r):
    k = (round(lat,1), round(lon,1), round(r,4))
    if k not in vc: vc[k] = bm.verts.new(ll(lat,lon,r))
    return vc[k]

for lat in range(-88, 88, int(STEP)):
    lat2 = lat + STEP
    for lon in range(-180, 180, int(STEP)):
        lon2 = lon + STEP
        cl, co = (lat+lat2)/2, (lon+lon2)/2
        t = ter(cl, co)
        if t == "ocean": continue
        r  = R_ICE if t == "ice" else R_LAND
        ck = "snow" if t == "ice" else col_key(cl, co)
        vs = list(dict.fromkeys([gv(lat,lon,r), gv(lat2,lon,r),
                                  gv(lat2,lon2,r), gv(lat,lon2,r)]))
        if len(vs) < 3: continue
        try:
            f = bm.faces.new(vs)
            f.smooth = False
            f[ml] = COL_I[ck]
        except:
            pass

cm = bpy.data.meshes.new("Continents")
bm.to_mesh(cm)
bm.free()

co_obj = bpy.data.objects.new("Continents", cm)
bpy.context.collection.objects.link(co_obj)
for k in COL_ORD: co_obj.data.materials.append(M[k])

# Apply material indices from the int attribute
if "mi" in cm.attributes:
    attr = cm.attributes["mi"]
    for i, poly in enumerate(cm.polygons):
        poly.material_index = attr.data[i].value
        poly.use_smooth = False
else:
    for poly in cm.polygons: poly.use_smooth = False

# ── 8. Mountain pyramids ────────────────────────────────────────────────────────
MTN_POS = [
    (52,-118),(47,-114),(42,-110),(38,-107),
    (-10,-76),(-20,-68),(-30,-69),(-42,-72),
    (46,8),(47,12),(30,80),(28,86),(32,78),(36,74),
    (33,-6),(64,9),(68,18),(57,60),(42,44),(-3,37),(-36,148),
]

extras = []

def add_pyramid(lat, lon, base_r, h=0.046, half=0.035):
    la, lo = math.radians(lat), math.radians(lon)
    def pt(r): return (r*math.cos(la)*math.cos(lo), r*math.cos(la)*math.sin(lo), r*math.sin(la))
    base_c = pt(base_r)
    apex   = pt(base_r + h)
    mid_pt = tuple((base_c[i]+apex[i])/2 for i in range(3))
    ux,uy,uz = base_c; un=math.sqrt(ux*ux+uy*uy+uz*uz); ux/=un; uy/=un; uz/=un
    ref = (0,0,1) if abs(uz)<0.9 else (1,0,0)
    ex = uy*ref[2]-uz*ref[1]; ey = uz*ref[0]-ux*ref[2]; ez = ux*ref[1]-uy*ref[0]
    en = math.sqrt(ex*ex+ey*ey+ez*ez); ex/=en; ey/=en; ez/=en
    nx = ey*uz-ez*uy; ny = ez*ux-ex*uz; nz = ex*uy-ey*ux
    nn = math.sqrt(nx*nx+ny*ny+nz*nz); nx/=nn; ny/=nn; nz/=nn
    bp = [(base_c[0]+math.cos(math.radians(a))*nx*half+math.sin(math.radians(a))*ex*half,
           base_c[1]+math.cos(math.radians(a))*ny*half+math.sin(math.radians(a))*ey*half,
           base_c[2]+math.cos(math.radians(a))*nz*half+math.sin(math.radians(a))*ez*half)
          for a in (0,120,240)]
    bm2 = bmesh.new()
    bvs  = [bm2.verts.new(p) for p in bp] + [bm2.verts.new(apex), bm2.verts.new(mid_pt)]
    ai, mi2 = 3, 4
    for (a,b,c,mat) in [(0,1,mi2,0),(1,2,mi2,0),(2,0,mi2,0),
                         (0,1,ai, 1),(1,2,ai, 1),(2,0,ai, 1)]:
        try: f=bm2.faces.new([bvs[a],bvs[b],bvs[c]]); f.smooth=False; f.material_index=mat
        except: pass
    mesh2 = bpy.data.meshes.new("mtn")
    bm2.to_mesh(mesh2); bm2.free()
    obj2 = bpy.data.objects.new("mtn", mesh2)
    bpy.context.collection.objects.link(obj2)
    mesh2.materials.append(M["mo"]); mesh2.materials.append(M["snow"])
    for p in mesh2.polygons: p.use_smooth=False
    extras.append(obj2)

for (la,lo) in MTN_POS:
    t = ter(la,lo)
    if t != "ocean":
        add_pyramid(la, lo, R_ICE if t=="ice" else R_LAND)

# ── 9. Islands ─────────────────────────────────────────────────────────────────
ISLES = [(21,-158,.020),(64,-18,.028),(-14,-170,.013),
         (14,-24,.012),(-21,55,.012),(1,104,.016),(-8,115,.016)]

def add_isle(lat, lon, half, r=1.007):
    la, lo = math.radians(lat), math.radians(lon)
    def pt(rr): return (rr*math.cos(la)*math.cos(lo), rr*math.cos(la)*math.sin(lo), rr*math.sin(la))
    cx,cy,cz = pt(r); tx,ty,tz = pt(r+0.014)
    un=math.sqrt(cx*cx+cy*cy+cz*cz); ux,uy,uz=cx/un,cy/un,cz/un
    ref=(0,0,1) if abs(uz)<0.9 else (1,0,0)
    ex=uy*ref[2]-uz*ref[1]; ey=uz*ref[0]-ux*ref[2]; ez=ux*ref[1]-uy*ref[0]
    en=math.sqrt(ex*ex+ey*ey+ez*ez); ex/=en; ey/=en; ez/=en
    nx=ey*uz-ez*uy; ny=ez*ux-ex*uz; nz=ex*uy-ey*ux; nn=math.sqrt(nx*nx+ny*ny+nz*nz); nx/=nn; ny/=nn; nz/=nn
    pts=[(cx+math.cos(math.radians(a))*nx*half+math.sin(math.radians(a))*ex*half,
          cy+math.cos(math.radians(a))*ny*half+math.sin(math.radians(a))*ey*half,
          cz+math.cos(math.radians(a))*nz*half+math.sin(math.radians(a))*ez*half) for a in range(0,360,60)]
    bm3=bmesh.new(); bvs=[bm3.verts.new(p) for p in pts]; top=bm3.verts.new((tx,ty,tz))
    for i in range(len(pts)):
        try: f=bm3.faces.new([bvs[i],bvs[(i+1)%len(pts)],top]); f.smooth=False
        except: pass
    im=bpy.data.meshes.new("isle"); bm3.to_mesh(im); bm3.free()
    io=bpy.data.objects.new("isle",im); bpy.context.collection.objects.link(io)
    im.materials.append(M["gm"])
    for p in im.polygons: p.use_smooth=False
    extras.append(io)

for args in ISLES: add_isle(*args)

# ── 10. Earth_Globe parent empty + collection ───────────────────────────────────
coll = bpy.data.collections.new("Earth_LowPoly")
bpy.context.scene.collection.children.link(coll)

bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0))
globe = bpy.context.active_object
globe.name = "Earth_Globe"

for obj in [oc, co_obj] + extras:
    obj.parent = globe
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll.objects.link(obj)
for c in list(globe.users_collection): c.objects.unlink(globe)
coll.objects.link(globe)

# ── 11. Friend anchor empties (Fibonacci sphere) ────────────────────────────────
def fib_sphere(n, r=1.09):
    g = (1+math.sqrt(5))/2
    pts=[]
    for i in range(n):
        theta = math.acos(1-2*(i+.5)/n)
        phi   = 2*math.pi*i/g
        pts.append((r*math.sin(theta)*math.cos(phi),
                    r*math.sin(theta)*math.sin(phi),
                    r*math.cos(theta)))
    return pts

for i, pos in enumerate(fib_sphere(20)):
    bpy.ops.object.empty_add(type='SPHERE', radius=0.01, location=pos)
    e = bpy.context.active_object
    e.name = f"Friend_{i+1:02d}"
    e.parent = globe
    for c in list(e.users_collection): c.objects.unlink(e)
    coll.objects.link(e)

# ── 12. Idle rotation animation (360° / 60 s around Z → GLTF Y) ────────────────
FPS, DUR = 24, 60
FRAMES = FPS * DUR   # 1440
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end   = FRAMES

globe.rotation_mode = 'XYZ'
for fr in range(0, FRAMES + 1, FPS):   # keyframe every second
    globe.rotation_euler.z = 2*math.pi * fr / FRAMES
    globe.keyframe_insert(data_path="rotation_euler", frame=fr, index=2)

# Name the action and force LINEAR interpolation
if globe.animation_data and globe.animation_data.action:
    globe.animation_data.action.name = "IdleRotation"
    for fc in globe.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

# ── 13. GLB export ─────────────────────────────────────────────────────────────
print(f"\nExporting to: {OUT}")
bpy.ops.export_scene.gltf(
    filepath          = OUT,
    export_format     = 'GLB',
    use_selection     = False,
    export_apply      = True,
    export_animations = True,
    export_nla_strips = False,
    export_yup        = True,
    export_materials  = 'EXPORT',
    export_normals    = True,
    export_cameras    = False,
    export_lights     = False,
    export_image_format = 'NONE',
)

sz = os.path.getsize(OUT)
print(f"✓  Written: {OUT}")
print(f"   Size   : {sz/1024:.1f} KB")
