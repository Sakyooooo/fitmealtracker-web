import bpy, math, os

OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render"
os.makedirs(OUT, exist_ok=True)

obj = next(o for o in bpy.data.objects if o.type == 'MESH')

# UV check
uvs = [l.name for l in obj.data.uv_layers]
print("UV_LAYERS:", uvs)

# Apply mirror for a faithful full-body silhouette (on a temp eval copy via depsgraph render — modifiers render anyway)
# bounding box of full (mirrored) — mirror across local X=0, so full x = [-1.68,1.68]
# Scene setup
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 420
scene.render.resolution_y = 620
scene.render.film_transparent = False
try:
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.55, 0.6, 0.7)
except Exception as e:
    print("shading set err", e)

# world bg white
if scene.world is None:
    scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = False
scene.world.color = (1, 1, 1)

# center/height
zc = 5.72 / 2.0

def add_cam(name, loc, look_at, ortho_scale):
    cam_data = bpy.data.cameras.new(name)
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    d = (look_at[0]-loc[0], look_at[1]-loc[1], look_at[2]-loc[2])
    import mathutils
    cam.rotation_euler = mathutils.Vector(d).to_track_quat('-Z', 'Y').to_euler()
    return cam

front = add_cam("front", (0, -20, zc), (0, 0, zc), 7.0)
side  = add_cam("side",  (20, 0, zc), (0, 0, zc), 7.0)

for nm, cam in (("front", front), ("side", side)):
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, f"view_{nm}.png")
    bpy.ops.render.render(write_still=True)
    print("WROTE", scene.render.filepath)
print("RENDER DONE")
