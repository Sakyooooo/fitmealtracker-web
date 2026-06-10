"""Print node/mesh/animation inventory of a GLB. Usage: blender -b -P inspect_glb.py -- <path>"""
import json, struct, sys

path = sys.argv[sys.argv.index("--") + 1]
d = open(path, "rb").read()
ln = struct.unpack("<I", d[12:16])[0]
j = json.loads(d[20:20 + ln])
print("MESHES:", [m.get("name") for m in j.get("meshes", [])])
print("NODES:", [n.get("name") for n in j.get("nodes", [])])
print("ANIMS:", [a.get("name") for a in j.get("animations", [])])
print("MATERIALS:", [m.get("name") for m in j.get("materials", [])])
acc = j.get("accessors", [])
for i, m in enumerate(j.get("meshes", [])):
    for p in m.get("primitives", []):
        pos = acc[p["attributes"]["POSITION"]]
        print(f"  mesh '{m.get('name')}' verts={pos['count']}")

nodes = j.get("nodes", [])
for a in j.get("animations", []):
    tgt_names = {}
    for ch in a["channels"]:
        n = nodes[ch["target"]["node"]].get("name")
        tgt_names[n] = tgt_names.get(n, 0) + 1
    bar_ch = {k: v for k, v in tgt_names.items() if "Barbell" in (k or "")}
    print(f"ANIM '{a['name']}': channels={len(a['channels'])} targets={len(tgt_names)} barbell={bar_ch}")
for a in j.get("animations", []):
    if a.get("name") in ("Squat", "Deadlift"):
        paths = {}
        for ch in a["channels"]:
            tgt = ch["target"]
            key = (nodes[tgt["node"]].get("name"), tgt["path"])
            paths[key] = paths.get(key, 0) + 1
        bin_start = 20 + ln
        # skip BIN chunk header (8 bytes)
        bin_data = d[bin_start + 8:]
        bvs = j.get("bufferViews", [])
        for ch in a["channels"]:
            tgt = ch["target"]
            if nodes[tgt["node"]].get("name") == "Hips" and tgt["path"] == "translation":
                samp = a["samplers"][ch["sampler"]]
                out = acc[samp["output"]]
                bv = bvs[out["bufferView"]]
                off = bv.get("byteOffset", 0) + out.get("byteOffset", 0)
                n = out["count"]
                vals = struct.unpack_from(f"<{n * 3}f", bin_data, off)
                xs, ys, zs = vals[0::3], vals[1::3], vals[2::3]
                print(f"ANIM '{a['name']}' Hips.translation n={n}")
                print(f"  x {min(xs):.3f}..{max(xs):.3f}  y {min(ys):.3f}..{max(ys):.3f}  z {min(zs):.3f}..{max(zs):.3f}")
