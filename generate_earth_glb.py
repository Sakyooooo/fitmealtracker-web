"""
Premium low-poly Earth — Zenly / Poly Pizza style
Coordinate convention: x=cos(lat)*sin(lon), y=sin(lat), z=cos(lat)*cos(lon)
  → lon=0° (West Africa / UK) faces +Z camera default
  → South America (lon≈-60°) at -X = viewer LEFT  ✓
  → Africa      (lon≈+20°) at +X = viewer RIGHT ✓
Output: public/models/earth_lowpoly_mobile.glb
"""

import math, struct, json, os, random
import numpy as np

random.seed(42)

# ── Exact hex palette from spec ───────────────────────────────────────────────

def hx(s):
    r,g,b = int(s[1:3],16), int(s[3:5],16), int(s[5:7],16)
    return (r/255, g/255, b/255, 1.0)

OCEAN      = hx("#66C4FF")
GRN_DARK   = hx("#4CAF50")
GRN_MED    = hx("#7BC043")
GRN_LIGHT  = hx("#A8D672")
DESERT_YEL = hx("#F6E58D")
MTN_ORA    = hx("#E8B16D")
SNOW       = (1.0, 1.0, 1.0, 1.0)

GREENS  = [GRN_DARK, GRN_MED, GRN_LIGHT]
SANDS   = [DESERT_YEL, MTN_ORA]

# ── Continent regions (lat_min,lat_max,lon_min,lon_max,label) ─────────────────
# Checked in order — first match wins.

CONT_REGIONS = [
    # Poles — highest priority
    ( 72,  90, -180,  180, "ice_n"),
    (-90, -63, -180,  180, "ice_s"),
    # Greenland
    ( 60,  85,  -60,  -15, "greenland"),
    # North America
    ( 50,  72, -142,  -53, "na"),
    ( 24,  50, -130,  -60, "na"),
    ( 14,  24,  -92,  -77, "na"),    # Central America
    # South America
    (-56,  13,  -82,  -34, "sa"),
    # Europe
    ( 36,  72,  -12,   42, "eu"),
    # Africa
    (-35,  38,  -18,   52, "af"),
    # Asia — multiple boxes
    ( 60,  73,   28,  145, "as"),
    ( 35,  60,   28,  145, "as"),
    ( 20,  35,   60,  122, "as"),
    (  5,  20,   72,  108, "as"),
    ( 22,  48,  124,  148, "as"),    # Japan/Korea
    ( -2,  22,   95,  128, "as"),    # SE Asia
    # Australia
    (-39,  -8,  112,  156, "au"),
]

# Desert / mountain sub-terrain overrides
DESERT_ZONES = [
    # Sahara — very prominent
    ( 14,  33,  -15,   40, DESERT_YEL),
    ( 20,  30,   38,   52, DESERT_YEL),  # NE Africa / Sinai
    # Arabian Peninsula
    ( 12,  33,   35,   62, MTN_ORA),
    # Iranian Plateau
    ( 26,  38,   44,   65, DESERT_YEL),
    # Central Asia / Gobi
    ( 38,  52,   88,  125, DESERT_YEL),
    ( 35,  48,   55,   90, DESERT_YEL),
    # Australian outback
    (-33, -14,  113,  142, MTN_ORA),
    # US Southwest / Mexico
    ( 24,  40, -118,  -95, DESERT_YEL),
    # Atacama / west Andes strip
    (-33,   5,  -78,  -67, MTN_ORA),
    # Patagonia grassland (lighter green, not desert)
    (-56, -40,  -76,  -62, GRN_LIGHT),
]

# Mountain pyramid positions (lat, lon)
MTN_LOCS = [
    # Rockies
    (52,-118),(47,-114),(42,-110),(38,-107),
    # Andes
    (-10,-76),(-20,-68),(-30,-69),(-42,-72),
    # Alps
    (46, 8),(47,12),
    # Himalayas / Hindu Kush
    (32,78),(30,82),(28,86),(36,74),
    # Atlas
    (33,-6),
    # Scandinavian
    (64, 9),(68,18),
    # Ural
    (57,60),
    # Caucasus
    (42,44),
    # Kilimanjaro
    (-3,37),
    # Australian Alps
    (-36,148),
]

# Tiny islands (lat, lon, half-size)
ISLAND_LOCS = [
    (21,-158, 0.020),   # Hawaii
    (64, -18, 0.028),   # Iceland
    (-14,-170, 0.013),  # Samoa
    (14, -24, 0.012),   # Cape Verde
    (-21,  55, 0.012),  # Réunion/Mauritius area
    (  1, 104, 0.016),  # Singapore
    ( -8, 115, 0.016),  # Bali
    (  0, 127, 0.013),  # Maluku
]

CONT_NAMES = {
    "na":"North_America","sa":"South_America","eu":"Europe",
    "af":"Africa","as":"Asia","au":"Australia",
    "greenland":"Greenland","ice_n":"Ice_North","ice_s":"Ice_South",
}
EXTRUSION = {
    "na":1.032,"sa":1.034,"eu":1.030,"af":1.033,
    "as":1.035,"au":1.027,"greenland":1.016,
    "ice_n":1.014,"ice_s":1.014,
}

# ── Coordinate helpers (Convention B) ────────────────────────────────────────
# x = cos(lat)*sin(lon), y = sin(lat), z = cos(lat)*cos(lon)
# → lon=0° faces +Z  →  SA left, Africa right from default +Z camera

def ll2xyz(lat, lon, r=1.0):
    la, lo = math.radians(lat), math.radians(lon)
    return np.array([
        r * math.cos(la) * math.sin(lo),
        r * math.sin(la),
        r * math.cos(la) * math.cos(lo),
    ], dtype=np.float32)

def xyz2ll(v):
    v = np.array(v, dtype=np.float64)
    v /= np.linalg.norm(v) + 1e-12
    lat = math.degrees(math.asin(max(-1.0, min(1.0, float(v[1])))))
    lon = math.degrees(math.atan2(float(v[0]), float(v[2])))
    return lat, lon

def norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v

# ── Icosphere (Convention B: swap x↔z of raw icosahedron verts) ──────────────

def icosphere(subs=4):
    t = (1 + math.sqrt(5)) / 2
    raw = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],
           [0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]]
    # Normalise AND swap x↔z so lon=0° faces +Z
    verts = [norm(np.array([v[2],v[1],v[0]], dtype=np.float64)) for v in raw]
    faces = [
        [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
        [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
        [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
        [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
    ]
    cache = {}
    def mid(i, j):
        key = (min(i,j), max(i,j))
        if key not in cache:
            cache[key] = len(verts)
            verts.append(norm((verts[i]+verts[j])*0.5))
        return cache[key]
    for _ in range(subs):
        faces = [t_ for f in faces for t_ in [
            [f[0],mid(f[0],f[1]),mid(f[2],f[0])],
            [f[1],mid(f[1],f[2]),mid(f[0],f[1])],
            [f[2],mid(f[2],f[0]),mid(f[1],f[2])],
            [mid(f[0],f[1]),mid(f[1],f[2]),mid(f[2],f[0])],
        ]]
    return [np.array(v, dtype=np.float32) for v in verts], faces

# ── Terrain classification ────────────────────────────────────────────────────

def continent_of(lat, lon):
    for (la0,la1,lo0,lo1,lbl) in CONT_REGIONS:
        if la0<=lat<=la1 and lo0<=lon<=lo1:
            return lbl
    return "ocean"

def land_color(lat, lon):
    """Return colour for a land face, using coarse grid for large colour blocks."""
    for (la0,la1,lo0,lo1,col) in DESERT_ZONES:
        if la0<=lat<=la1 and lo0<=lon<=lo1:
            return col
    # Greens: choose by coarse 12°×12° cell for big flat blocks
    seed = abs(hash((round(lat/12)*12, round(lon/12)*12))) % 3
    return GREENS[seed]

def ice_color():
    return SNOW

# ── Mesh builders ─────────────────────────────────────────────────────────────

class FlatMesh:
    """Flat-shaded — unique verts per face."""
    def __init__(self):
        self.P=[]; self.N=[]; self.C=[]; self.I=[]; self._n=0

    def add(self, v0, v1, v2, col):
        n = norm(np.cross(v1-v0, v2-v0)).astype(np.float32)
        for v in (v0,v1,v2):
            self.P.extend(v.tolist()); self.N.extend(n.tolist()); self.C.extend(col)
        self.I.extend([self._n, self._n+1, self._n+2]); self._n+=3

    def merge(self, other):
        off = self._n
        self.P.extend(other.P); self.N.extend(other.N); self.C.extend(other.C)
        self.I.extend(i+off for i in other.I); self._n += other._n

    def arrays(self):
        return (np.array(self.P,np.float32).reshape(-1,3),
                np.array(self.N,np.float32).reshape(-1,3),
                np.array(self.C,np.float32).reshape(-1,4),
                np.array(self.I,np.uint32))
    def empty(self): return self._n==0


def ocean_arrays(verts, ocean_faces):
    pos = np.array([v.tolist() for v in verts], np.float32)
    nor = pos / (np.linalg.norm(pos, axis=1, keepdims=True) + 1e-9)
    col = np.tile(np.array(OCEAN, np.float32), (len(verts),1))
    idx = np.array([i for f in ocean_faces for i in f], np.uint32)
    return pos, nor, col, idx


def make_pyramid(lat, lon, base_r, height=0.045, half=0.034):
    center = ll2xyz(lat, lon, base_r+0.004)
    apex   = ll2xyz(lat, lon, base_r+height)
    mid_pt = ((center+apex)*0.5).astype(np.float32)
    up  = norm(center.astype(np.float64)).astype(np.float32)
    ref = np.array([0,1,0],np.float32)
    if abs(np.dot(up,ref))>0.9: ref=np.array([1,0,0],np.float32)
    e = norm(np.cross(up,ref)).astype(np.float32)
    n_ = norm(np.cross(e,up)).astype(np.float32)
    base = [(center+(math.cos(math.radians(a))*n_+math.sin(math.radians(a))*e)*half).astype(np.float32)
            for a in (0,120,240)]
    m = FlatMesh()
    for i in range(3):
        b0,b1 = base[i], base[(i+1)%3]
        m.add(b0, b1, mid_pt, list(MTN_ORA))
        m.add(mid_pt, b1, apex.astype(np.float32), list(SNOW))
    return m


def make_island(lat, lon, half=0.020):
    r = 1.006
    c = ll2xyz(lat,lon,r); top = ll2xyz(lat,lon,r+0.012)
    up = norm(c.astype(np.float64)).astype(np.float32)
    ref = np.array([0,1,0],np.float32)
    if abs(np.dot(up,ref))>0.9: ref=np.array([1,0,0],np.float32)
    e = norm(np.cross(up,ref)).astype(np.float32)
    n_ = norm(np.cross(e,up)).astype(np.float32)
    pts = [(c+(math.cos(math.radians(a))*n_+math.sin(math.radians(a))*e)*half).astype(np.float32)
           for a in range(0,360,60)]
    m = FlatMesh()
    for i in range(len(pts)):
        m.add(pts[i], pts[(i+1)%len(pts)], top.astype(np.float32), list(GRN_MED))
    return m


def fibonacci_sphere(n, r=1.08):
    g = (1+math.sqrt(5))/2
    return [[r*math.sin(math.acos(1-2*(i+.5)/n))*math.cos(2*math.pi*i/g),
             r*math.cos(math.acos(1-2*(i+.5)/n)),
             r*math.sin(math.acos(1-2*(i+.5)/n))*math.sin(2*math.pi*i/g)]
            for i in range(n)]

# ── GLB packer ────────────────────────────────────────────────────────────────

def align4(b, pad=b"\x00"): r=len(b)%4; return b+(pad*(4-r) if r else b"")

class Packer:
    def __init__(self):
        self.chunks=[]; self.boff=0
        self.BVs=[]; self.ACs=[]; self.meshes=[]; self.mats=[]; self.nodes=[]; self.anims=[]

    def _bv(self, data, tgt=None):
        e={"buffer":0,"byteOffset":self.boff,"byteLength":len(data)}
        if tgt: e["target"]=tgt
        self.BVs.append(e); self.chunks.append(data); self.boff+=len(data)
        return len(self.BVs)-1

    def add_mesh(self, pos, nor, col, idx, name, mat):
        pos=np.array(pos,np.float32).reshape(-1,3)
        nor=np.array(nor,np.float32).reshape(-1,3)
        col=np.array(col,np.float32).reshape(-1,4)
        idx=np.array(idx,np.uint32)
        nv,ni=len(pos),len(idx)
        bvp=self._bv(pos.tobytes(),34962); bvn=self._bv(nor.tobytes(),34962)
        bvc=self._bv(col.tobytes(),34962); bvi=self._bv(idx.tobytes(),34963)
        a0=len(self.ACs)
        self.ACs+=[
            {"bufferView":bvp,"byteOffset":0,"componentType":5126,"count":nv,"type":"VEC3",
             "min":pos.min(0).tolist(),"max":pos.max(0).tolist()},
            {"bufferView":bvn,"byteOffset":0,"componentType":5126,"count":nv,"type":"VEC3"},
            {"bufferView":bvc,"byteOffset":0,"componentType":5126,"count":nv,"type":"VEC4"},
            {"bufferView":bvi,"byteOffset":0,"componentType":5125,"count":ni,"type":"SCALAR"},
        ]
        mi=len(self.meshes)
        self.meshes.append({"name":name,"primitives":[{
            "attributes":{"POSITION":a0,"NORMAL":a0+1,"COLOR_0":a0+2},
            "indices":a0+3,"mode":4,"material":mat}]})
        return mi

    def add_anim(self, node_idx):
        # 360°/60s Y-rotation, 61 keyframes
        times = np.array([float(i) for i in range(61)], np.float32)
        quats  = np.array([v for t in times
                           for v in [0., math.sin(math.pi*t/60), 0., math.cos(math.pi*t/60)]],
                          np.float32)
        bvt=self._bv(times.tobytes()); bvq=self._bv(quats.tobytes())
        a0=len(self.ACs)
        self.ACs+=[
            {"bufferView":bvt,"byteOffset":0,"componentType":5126,"count":61,
             "type":"SCALAR","min":[0.],"max":[60.]},
            {"bufferView":bvq,"byteOffset":0,"componentType":5126,"count":61,"type":"VEC4"},
        ]
        self.anims.append({"name":"IdleRotation",
            "samplers":[{"input":a0,"output":a0+1,"interpolation":"LINEAR"}],
            "channels":[{"sampler":0,"target":{"node":node_idx,"path":"rotation"}}]})

    def build(self):
        bin_data = align4(b"".join(self.chunks))
        gltf = {"asset":{"version":"2.0","generator":"FitMealTracker Earth"},
                "scene":0,"scenes":[{"nodes":[0]}],
                "nodes":self.nodes,"meshes":self.meshes,"materials":self.mats,
                "accessors":self.ACs,"bufferViews":self.BVs,
                "buffers":[{"byteLength":len(bin_data)}]}
        if self.anims: gltf["animations"]=self.anims
        j = align4(json.dumps(gltf,separators=(",",":")).encode(), pad=b" ")
        total = 12+8+len(j)+8+len(bin_data)
        hdr = struct.pack("<III",0x46546C67,2,total)
        return hdr+struct.pack("<II",len(j),0x4E4F534A)+j+struct.pack("<II",len(bin_data),0x004E4942)+bin_data

# ── Build ─────────────────────────────────────────────────────────────────────

def build():
    pk = Packer()

    def mat(name, r=0.88):
        pk.mats.append({"name":name,
            "pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1],
            "metallicFactor":0.,"roughnessFactor":r},"doubleSided":False})
        return len(pk.mats)-1

    m_ocean = mat("Ocean",   0.72)
    m_land  = mat("Land",    0.90)
    m_mtn   = mat("Mtn",     0.95)
    m_isle  = mat("Island",  0.88)

    verts, faces = icosphere(subs=3)

    ocean_faces = []
    builders = {k: FlatMesh() for k in CONT_NAMES}

    for face in faces:
        c_pos = norm(sum(verts[i] for i in face) / 3.0)
        lat, lon = xyz2ll(c_pos)
        label = continent_of(lat, lon)

        if label == "ocean":
            ocean_faces.append(face)
            continue

        r  = EXTRUSION[label]
        v0 = (verts[face[0]]*r).astype(np.float32)
        v1 = (verts[face[1]]*r).astype(np.float32)
        v2 = (verts[face[2]]*r).astype(np.float32)

        col = list(ice_color() if label in ("ice_n","ice_s","greenland")
                   else land_color(lat, lon))
        builders[label].add(v0, v1, v2, col)

    # Ocean
    op,on,oc,oi = ocean_arrays(verts, ocean_faces)
    ocean_mesh = pk.add_mesh(op,on,oc,oi,"Ocean",m_ocean)

    # Continents
    cont_meshes = {}
    for key in CONT_NAMES:
        if not builders[key].empty():
            p,n,c,i = builders[key].arrays()
            cont_meshes[key] = pk.add_mesh(p,n,c,i,CONT_NAMES[key],m_land)

    # Mountains
    mtn = FlatMesh()
    for (lat,lon) in MTN_LOCS:
        if continent_of(lat,lon)!="ocean":
            r = EXTRUSION.get(continent_of(lat,lon),1.032)
            mtn.merge(make_pyramid(lat,lon,r))
    mtn_mesh = None
    if not mtn.empty():
        p,n,c,i = mtn.arrays(); mtn_mesh = pk.add_mesh(p,n,c,i,"Mountains",m_mtn)

    # Islands
    isle = FlatMesh()
    for (lat,lon,half) in ISLAND_LOCS:
        isle.merge(make_island(lat,lon,half))
    isle_mesh = None
    if not isle.empty():
        p,n,c,i = isle.arrays(); isle_mesh = pk.add_mesh(p,n,c,i,"Islands",m_isle)

    # ── Nodes ─────────────────────────────────────────────────────────────────
    pk.nodes.append({})  # placeholder: Earth_Globe at index 0
    children = []

    def child(name, mesh=None, translation=None):
        node = {"name":name}
        if mesh is not None: node["mesh"]=mesh
        if translation: node["translation"]=translation
        pk.nodes.append(node); children.append(len(pk.nodes)-1)

    child("Ocean", ocean_mesh)
    for key in CONT_NAMES:
        if key in cont_meshes:
            child(CONT_NAMES[key], cont_meshes[key])
    if mtn_mesh  is not None: child("Mountains", mtn_mesh)
    if isle_mesh is not None: child("Islands",   isle_mesh)

    for i, pos in enumerate(fibonacci_sphere(20, r=1.08)):
        child(f"Friend_{i+1:02d}", translation=pos)

    pk.nodes[0] = {"name":"Earth_Globe","children":children}

    pk.add_anim(0)
    return pk.build()

# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    out = "public/models/earth_lowpoly_mobile.glb"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    data = build()
    with open(out,"wb") as f: f.write(data)
    print(f"Written: {out}  ({len(data)/1024:.1f} KB)")
