"""
Extract individual low-poly human figures ("statues") from the bundled
`lowpoly_people__waldo.glb` library and pack a small, web-friendly GLB.

Source file contains 283 person meshes, all centred at the origin (Z-up,
feet at Z=0, height ~1.0), each ~1500 verts, sharing a plain white material.
We pick N evenly-spaced figures, re-orient them Y-up, normalise height to 1.0,
and emit `public/models/statues.glb` with named nodes `Statue_00..Statue_NN`.

Figures are stored WHITE / untextured on purpose — the web app tints each
statue per-user (see Globe3D.tsx). This keeps the file tiny (<1 MB) and avoids
shipping the source texture atlas.

Run:
  python extract_statues.py
"""

import os, struct, json
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────
SRC = os.path.join(os.path.expanduser("~"), "Downloads", "lowpoly_people__waldo.glb")
THIS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(THIS, "public", "models", "statues.glb")

N_FIGURES = 24          # how many distinct figures to include
TARGET_HEIGHT = 1.0     # normalised height (feet=0 .. head=1)

# ── GLB reader ────────────────────────────────────────────────────────────────

def load_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, total = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67, "not a GLB"
    off = 12
    jlen, jtyp = struct.unpack("<II", data[off:off + 8]); off += 8
    j = json.loads(data[off:off + jlen]); off += jlen
    blen, btyp = struct.unpack("<II", data[off:off + 8]); off += 8
    bin_ = data[off:off + blen]
    return j, bin_

_CT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
       5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
_NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_accessor(j, bin_, acc_idx):
    acc = j["accessors"][acc_idx]
    bv = j["bufferViews"][acc["bufferView"]]
    comp = _CT[acc["componentType"]]
    ncomp = _NCOMP[acc["type"]]
    count = acc["count"]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride") or comp[1] * ncomp
    dt = np.dtype("<" + comp[0])
    out = np.empty((count, ncomp), dtype=dt)
    for i in range(count):
        s = base + i * stride
        out[i] = np.frombuffer(bin_, dtype=dt, count=ncomp, offset=s)
    return out


# ── GLB writer (POSITION + NORMAL + indices, vertex-coloured by app) ──────────

def align4(b):
    r = len(b) % 4
    return b + b"\x00" * (4 - r if r else 0)


class Packer:
    def __init__(self):
        self.chunks = []; self.boff = 0
        self.BVs = []; self.ACs = []; self.meshes = []; self.mats = []; self.nodes = []

    def _bv(self, data, tgt=None):
        e = {"buffer": 0, "byteOffset": self.boff, "byteLength": len(data)}
        if tgt:
            e["target"] = tgt
        self.BVs.append(e); self.chunks.append(data); self.boff += len(data)
        return len(self.BVs) - 1

    def add_mesh(self, pos, nor, idx, name, mat):
        pos = np.asarray(pos, np.float32).reshape(-1, 3)
        nor = np.asarray(nor, np.float32).reshape(-1, 3)
        idx = np.asarray(idx, np.uint32)
        nv, ni = len(pos), len(idx)
        bvp = self._bv(pos.tobytes(), 34962)
        bvn = self._bv(nor.tobytes(), 34962)
        bvi = self._bv(idx.tobytes(), 34963)
        a0 = len(self.ACs)
        self.ACs += [
            {"bufferView": bvp, "componentType": 5126, "count": nv, "type": "VEC3",
             "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
            {"bufferView": bvn, "componentType": 5126, "count": nv, "type": "VEC3"},
            {"bufferView": bvi, "componentType": 5125, "count": ni, "type": "SCALAR"},
        ]
        mi = len(self.meshes)
        self.meshes.append({"name": name, "primitives": [{
            "attributes": {"POSITION": a0, "NORMAL": a0 + 1},
            "indices": a0 + 2, "mode": 4, "material": mat}]})
        return mi

    def build(self):
        bin_data = align4(b"".join(self.chunks))
        gltf = {"asset": {"version": "2.0", "generator": "FitMealTracker Statues"},
                "scene": 0, "scenes": [{"nodes": [0]}],
                "nodes": self.nodes, "meshes": self.meshes, "materials": self.mats,
                "accessors": self.ACs, "bufferViews": self.BVs,
                "buffers": [{"byteLength": len(bin_data)}]}
        jb = json.dumps(gltf, separators=(",", ":")).encode()
        r = len(jb) % 4
        j = jb + b"\x20" * (4 - r if r else 0)   # JSON chunk padded with spaces (glTF spec)
        total = 12 + 8 + len(j) + 8 + len(bin_data)
        hdr = struct.pack("<III", 0x46546C67, 2, total)
        return (hdr + struct.pack("<II", len(j), 0x4E4F534A) + j
                + struct.pack("<II", len(bin_data), 0x004E4942) + bin_data)


# ── Build ─────────────────────────────────────────────────────────────────────

def build():
    j, bin_ = load_glb(SRC)
    nodes = j["nodes"]; meshes = j["meshes"]

    # person nodes (each '<id>_person' wraps a single mesh child)
    persons = [n for n in nodes
               if isinstance(n.get("name"), str) and n["name"].endswith("_person")
               and n.get("children")]
    if not persons:
        raise SystemExit("no person nodes found in source")

    # pick N evenly spaced figures for variety
    step = max(1, len(persons) // N_FIGURES)
    picked = persons[::step][:N_FIGURES]

    pk = Packer()
    pk.mats.append({
        "name": "Statue",
        "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                 "metallicFactor": 0.0, "roughnessFactor": 0.85},
        "doubleSided": True})
    m_statue = 0

    pk.nodes.append({})  # root placeholder
    children = []

    for k, n in enumerate(picked):
        prim = meshes[nodes[n["children"][0]]["mesh"]]["primitives"][0]
        pos = read_accessor(j, bin_, prim["attributes"]["POSITION"]).astype(np.float64)
        nor = read_accessor(j, bin_, prim["attributes"]["NORMAL"]).astype(np.float64)
        idx = read_accessor(j, bin_, prim["indices"]).reshape(-1).astype(np.uint32)

        # Z-up -> Y-up : (x,y,z) -> (x, z, -y)   (rotate -90deg about X)
        pos = np.column_stack([pos[:, 0], pos[:, 2], -pos[:, 1]])
        nor = np.column_stack([nor[:, 0], nor[:, 2], -nor[:, 1]])

        # centre XZ, put feet on Y=0, normalise height
        mn = pos.min(0); mx = pos.max(0)
        cx = (mn[0] + mx[0]) * 0.5
        cz = (mn[2] + mx[2]) * 0.5
        h = max(mx[1] - mn[1], 1e-6)
        s = TARGET_HEIGHT / h
        pos[:, 0] = (pos[:, 0] - cx) * s
        pos[:, 1] = (pos[:, 1] - mn[1]) * s
        pos[:, 2] = (pos[:, 2] - cz) * s

        # renormalise normals (uniform scale keeps direction, but be safe)
        ln = np.linalg.norm(nor, axis=1, keepdims=True)
        nor = nor / np.clip(ln, 1e-9, None)

        mi = pk.add_mesh(pos, nor, idx, f"Statue_{k:02d}", m_statue)
        pk.nodes.append({"name": f"Statue_{k:02d}", "mesh": mi})
        children.append(len(pk.nodes) - 1)

    pk.nodes[0] = {"name": "Statues", "children": children}
    return pk.build(), len(picked)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data, count = build()
    with open(OUT, "wb") as f:
        f.write(data)
    print(f"Written: {OUT}  ({len(data)/1024:.1f} KB, {count} figures)")
