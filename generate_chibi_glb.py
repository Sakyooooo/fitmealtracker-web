"""
generate_chibi_glb.py — Low-poly chibi mannequin pin GLBs (4 variants)

Variants:
  chibi_standard.glb  — boy in white hoodie / blue shorts
  chibi_casual.glb    — girl with bucket hat / yellow top
  chibi_active.glb    — runner with orange headband
  chibi_themed.glb    — Santa costume

All geometry is flat-shaded to match the low-poly earth style.
Y=0 is the floor (top of pin disc). Pin spike extends downward.
"""

import math, struct, json, os
import numpy as np

# ── Palette helpers ────────────────────────────────────────────────────────────
def hx(s):
    r,g,b = int(s[1:3],16), int(s[3:5],16), int(s[5:7],16)
    return [r/255, g/255, b/255, 1.0]

WHITE      = hx("#FFFFFF")
OFFWHITE   = hx("#F0EDE8")
GREY_LT    = hx("#DDDDDD")
GREY       = hx("#AAAAAA")
SKIN       = hx("#F5CCB0")
BRN_HAIR   = hx("#7A4520")
BLK_HAIR   = hx("#1A1008")

# ── Flat-shaded mesh builder ────────────────────────────────────────────────────
def _norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v

class Mesh:
    def __init__(self):
        self.P=[]; self.N=[]; self.C=[]; self.I=[]; self._n=0

    def tri(self, v0, v1, v2, col):
        v0,v1,v2 = (np.asarray(x, np.float32) for x in (v0,v1,v2))
        n = _norm(np.cross(v1-v0, v2-v0)).tolist()
        for v in (v0,v1,v2):
            self.P.extend(v.tolist()); self.N.extend(n); self.C.extend(col)
        self.I.extend([self._n, self._n+1, self._n+2]); self._n += 3

    def quad(self, v0, v1, v2, v3, col):
        self.tri(v0,v1,v2,col); self.tri(v0,v2,v3,col)

    def arrays(self):
        return (np.array(self.P,np.float32).reshape(-1,3),
                np.array(self.N,np.float32).reshape(-1,3),
                np.array(self.C,np.float32).reshape(-1,4),
                np.array(self.I,np.uint32))

# ── Geometry primitives ────────────────────────────────────────────────────────
def mk_cylinder(m, col, y0, y1, r, cx=0.0, cz=0.0, sides=8, cap_bot=True, cap_top=True):
    a = [2*math.pi*i/sides for i in range(sides)]
    bot = [[cx+r*math.cos(x), y0, cz+r*math.sin(x)] for x in a]
    top = [[cx+r*math.cos(x), y1, cz+r*math.sin(x)] for x in a]
    for i in range(sides):
        j = (i+1)%sides
        m.quad(bot[i], bot[j], top[j], top[i], col)
    if cap_bot:
        bc = [cx,y0,cz]
        for i in range(sides): m.tri(bc, bot[(i+1)%sides], bot[i], col)
    if cap_top:
        tc = [cx,y1,cz]
        for i in range(sides): m.tri(tc, top[i], top[(i+1)%sides], col)

def mk_cone(m, col, tip_y, base_y, base_r, cx=0.0, cz=0.0, sides=8, cap=True):
    tip = [cx, tip_y, cz]
    a = [2*math.pi*i/sides for i in range(sides)]
    base = [[cx+base_r*math.cos(x), base_y, cz+base_r*math.sin(x)] for x in a]
    for i in range(sides):
        m.tri(tip, base[(i+1)%sides], base[i], col)
    if cap:
        bc = [cx,base_y,cz]
        for i in range(sides): m.tri(bc, base[i], base[(i+1)%sides], col)

def mk_sphere(m, col, cx, cy, cz, r, rings=5, sectors=8):
    V = []
    for ri in range(rings+1):
        phi = math.pi*ri/rings
        for s in range(sectors):
            theta = 2*math.pi*s/sectors
            V.append([cx+r*math.sin(phi)*math.cos(theta),
                      cy+r*math.cos(phi),
                      cz+r*math.sin(phi)*math.sin(theta)])
    for ri in range(rings):
        for s in range(sectors):
            a=V[ri*sectors+s]; b=V[ri*sectors+(s+1)%sectors]
            c=V[(ri+1)*sectors+(s+1)%sectors]; d=V[(ri+1)*sectors+s]
            m.quad(a,b,c,d, col)

def mk_sphere_cap(m, col, cx, cy, cz, r, rings=3, sectors=8, upper=True):
    """Upper or lower hemisphere."""
    V = []
    for ri in range(rings+1):
        if upper:
            phi = math.pi/2 * ri/rings          # 0 → π/2  (top → equator)
        else:
            phi = math.pi/2 + math.pi/2*ri/rings # π/2 → π  (equator → bottom)
        for s in range(sectors):
            theta = 2*math.pi*s/sectors
            V.append([cx+r*math.sin(phi)*math.cos(theta),
                      cy+r*math.cos(phi),
                      cz+r*math.sin(phi)*math.sin(theta)])
    for ri in range(rings):
        for s in range(sectors):
            a=V[ri*sectors+s]; b=V[ri*sectors+(s+1)%sectors]
            c=V[(ri+1)*sectors+(s+1)%sectors]; d=V[(ri+1)*sectors+s]
            m.quad(a,b,c,d, col)

def mk_box(m, col, cx, cy, cz, w, h, d):
    hw,hh,hd = w/2, h/2, d/2
    v = [
        [cx-hw, cy-hh, cz+hd], [cx+hw, cy-hh, cz+hd],  # 0,1 front-bot
        [cx+hw, cy+hh, cz+hd], [cx-hw, cy+hh, cz+hd],  # 2,3 front-top
        [cx-hw, cy-hh, cz-hd], [cx+hw, cy-hh, cz-hd],  # 4,5 back-bot
        [cx+hw, cy+hh, cz-hd], [cx-hw, cy+hh, cz-hd],  # 6,7 back-top
    ]
    m.quad(v[0],v[1],v[2],v[3], col)  # front
    m.quad(v[5],v[4],v[7],v[6], col)  # back
    m.quad(v[4],v[0],v[3],v[7], col)  # left
    m.quad(v[1],v[5],v[6],v[2], col)  # right
    m.quad(v[3],v[2],v[6],v[7], col)  # top
    m.quad(v[4],v[5],v[1],v[0], col)  # bottom

# ── Pin base ───────────────────────────────────────────────────────────────────
def add_pin_base(m):
    mk_cone(m, GREY_LT, tip_y=-0.27, base_y=-0.06, base_r=0.055, sides=8)
    mk_cylinder(m, WHITE, y0=-0.06, y1=0.01, r=0.23, sides=16)

# ── Character body (shared) ───────────────────────────────────────────────────
# Layout (y=0 at disc top / floor):
#   shoes    : y  0.00 → 0.04,  cx ±0.063
#   legs     : y  0.04 → 0.18,  cx ±0.063, r=0.040
#   body     : y  0.18 → 0.42,  center (0, 0.30, 0),  w=0.22 h=0.24 d=0.16
#   arms     : y  0.22 → 0.38,  cx ±0.175  (box 0.08×0.16×0.08)
#   hands    : sphere cy=0.20,  cx ±0.175, r=0.040
#   neck     : y  0.42 → 0.47,  r=0.052
#   head     : sphere cy=0.67,  r=0.21
#   (hair/hat added per variant)

def add_body(m, top_col, bot_col, shoe_col):
    # Shoes
    for sx in (-0.063, 0.063):
        mk_box(m, shoe_col, sx, 0.020, 0.010, 0.090, 0.040, 0.130)
    # Legs
    for lx in (-0.063, 0.063):
        mk_cylinder(m, bot_col, y0=0.040, y1=0.180, r=0.040, cx=lx, sides=6)
    # Body
    mk_box(m, top_col, 0, 0.300, 0, 0.220, 0.240, 0.160)
    # Arms
    for ax in (-0.175, 0.175):
        mk_box(m, top_col, ax, 0.300, 0, 0.080, 0.160, 0.080)
    # Hands
    for ax in (-0.175, 0.175):
        mk_sphere(m, SKIN, ax, 0.210, 0, 0.040, rings=3, sectors=6)
    # Neck
    mk_cylinder(m, SKIN, y0=0.420, y1=0.470, r=0.052, sides=6)
    # Head
    mk_sphere(m, SKIN, 0, 0.670, 0, 0.210, rings=6, sectors=10)

# ── 4 variants ─────────────────────────────────────────────────────────────────
def build_standard():
    """Boy: white hoodie, blue shorts, brown hair"""
    m = Mesh()
    add_pin_base(m)
    add_body(m,
             top_col  = WHITE,
             bot_col  = hx("#2A6DB5"),
             shoe_col = hx("#303030"))
    hair = BRN_HAIR
    # Hair cap (upper hemisphere slightly larger)
    mk_sphere_cap(m, hair, 0, 0.670, 0, 0.218, rings=4, sectors=10, upper=True)
    # Side & back hair chunks
    mk_box(m, hair, -0.185, 0.670, -0.050, 0.035, 0.130, 0.170)
    mk_box(m, hair,  0.185, 0.670, -0.050, 0.035, 0.130, 0.170)
    mk_box(m, hair,  0.000, 0.670, -0.200, 0.180, 0.110, 0.030)
    # Front fringe
    mk_box(m, hair,  0.000, 0.855,  0.190, 0.200, 0.030, 0.040)
    return m.arrays()

def build_casual():
    """Girl: yellow top, cream pants, black hair, blue bucket hat"""
    m = Mesh()
    add_pin_base(m)
    add_body(m,
             top_col  = hx("#F5A623"),
             bot_col  = hx("#E8D5B0"),
             shoe_col = hx("#8B6355"))
    hair = BLK_HAIR
    hat  = hx("#5B99E6")
    # Hair base
    mk_sphere_cap(m, hair, 0, 0.670, 0, 0.218, rings=2, sectors=10, upper=True)
    # Ponytail (back)
    mk_cylinder(m, hair, y0=0.560, y1=0.790, r=0.048, cx=0, cz=-0.220)
    mk_sphere(m, hair, 0, 0.555, -0.220, 0.050, rings=3, sectors=6)
    # Bucket hat
    mk_cylinder(m, hat, y0=0.858, y1=0.900, r=0.250, sides=12, cap_bot=False, cap_top=False)  # brim
    mk_cylinder(m, hat, y0=0.900, y1=0.965, r=0.196, sides=12)                                 # crown
    # Hat top cap
    mk_cone(m, hat, tip_y=0.960, base_y=0.900, base_r=0.196, sides=12)
    return m.arrays()

def build_active():
    """Runner: red jersey, dark shorts, white shoes, orange headband"""
    m = Mesh()
    add_pin_base(m)
    add_body(m,
             top_col  = hx("#CC2222"),
             bot_col  = hx("#111122"),
             shoe_col = hx("#F0F0F0"))
    hair = hx("#4A2800")
    # Short hair cap
    mk_sphere_cap(m, hair, 0, 0.670, 0, 0.218, rings=3, sectors=10, upper=True)
    mk_box(m, hair, 0.000, 0.670, -0.185, 0.180, 0.100, 0.030)  # back
    # Headband ring
    mk_cylinder(m, hx("#FF6600"), y0=0.815, y1=0.850, r=0.224, sides=12,
                cap_bot=False, cap_top=False)
    return m.arrays()

def build_themed():
    """Santa: red suit, white beard & hat trim, pompom"""
    m = Mesh()
    add_pin_base(m)
    add_body(m,
             top_col  = hx("#CC2222"),
             bot_col  = hx("#CC2222"),
             shoe_col = hx("#111111"))
    red   = hx("#CC2222")
    white = WHITE
    # White beard (covers lower face)
    mk_sphere_cap(m, white, 0, 0.630, 0.050, 0.155, rings=3, sectors=8, upper=False)
    # Santa hat — red cone
    mk_cone(m, red, tip_y=1.020, base_y=0.860, base_r=0.228, sides=12)
    # White hat brim
    mk_cylinder(m, white, y0=0.845, y1=0.875, r=0.238, sides=12)
    # Pompom
    mk_sphere(m, white, 0, 1.035, 0, 0.058, rings=3, sectors=6)
    return m.arrays()

# ── GLB packer ─────────────────────────────────────────────────────────────────
def _align4(b, pad=b"\x00"):
    r = len(b) % 4
    return b + (pad * (4 - r) if r else b"")

def pack_glb(pos, nor, col, idx, name="chibi"):
    BVs=[]; ACs=[]; chunks=[]; boff=0

    def bv(data, tgt=None):
        nonlocal boff
        e = {"buffer":0,"byteOffset":boff,"byteLength":len(data)}
        if tgt: e["target"] = tgt
        BVs.append(e); chunks.append(data); boff += len(data)
        return len(BVs)-1

    pos=pos.astype(np.float32); nor=nor.astype(np.float32)
    col=col.astype(np.float32); idx=idx.astype(np.uint32)
    nv,ni = len(pos), len(idx)

    bvp=bv(pos.tobytes(),34962); bvn=bv(nor.tobytes(),34962)
    bvc=bv(col.tobytes(),34962); bvi=bv(idx.tobytes(),34963)
    ACs += [
        {"bufferView":bvp,"byteOffset":0,"componentType":5126,"count":nv,"type":"VEC3",
         "min":pos.min(0).tolist(),"max":pos.max(0).tolist()},
        {"bufferView":bvn,"byteOffset":0,"componentType":5126,"count":nv,"type":"VEC3"},
        {"bufferView":bvc,"byteOffset":0,"componentType":5126,"count":nv,"type":"VEC4"},
        {"bufferView":bvi,"byteOffset":0,"componentType":5125,"count":ni,"type":"SCALAR"},
    ]
    mat = {"name":"mat","pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1],
           "metallicFactor":0.0,"roughnessFactor":0.88},"doubleSided":True}
    mesh = {"name":name,"primitives":[{
        "attributes":{"POSITION":0,"NORMAL":1,"COLOR_0":2},
        "indices":3,"mode":4,"material":0}]}

    bin_data = _align4(b"".join(chunks), pad=b"\x00")
    gltf = {"asset":{"version":"2.0","generator":"FitMealTracker Chibi"},
            "scene":0,"scenes":[{"nodes":[0]}],
            "nodes":[{"name":name,"mesh":0}],
            "meshes":[mesh],"materials":[mat],
            "accessors":ACs,"bufferViews":BVs,
            "buffers":[{"byteLength":len(bin_data)}]}
    j = _align4(json.dumps(gltf,separators=(",",":")).encode(), pad=b" ")
    total = 12+8+len(j)+8+len(bin_data)
    hdr = struct.pack("<III",0x46546C67,2,total)
    return (hdr
            + struct.pack("<II",len(j),0x4E4F534A)+j
            + struct.pack("<II",len(bin_data),0x004E4942)+bin_data)

# ── Entry ───────────────────────────────────────────────────────────────────────
VARIANTS = {
    "chibi_standard": build_standard,
    "chibi_casual":   build_casual,
    "chibi_active":   build_active,
    "chibi_themed":   build_themed,
}

if __name__ == "__main__":
    out_dir = "public/models"
    os.makedirs(out_dir, exist_ok=True)
    for name, builder in VARIANTS.items():
        arrays = builder()
        data = pack_glb(*arrays, name=name)
        path = os.path.join(out_dir, f"{name}.glb")
        with open(path, "wb") as f:
            f.write(data)
        print(f"Written: {path}  ({len(data)/1024:.1f} KB)")
