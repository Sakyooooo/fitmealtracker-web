import bpy, math, os, mathutils

GLB = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\fitness_avatar_complete.glb"
OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render\anim"
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type=='MESH')

scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=300; scene.render.resolution_y=380
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='SINGLE'; scene.display.shading.single_color=(0.45,0.55,0.78)
if scene.world is None: scene.world=bpy.data.worlds.new("W")
scene.world.use_nodes=False; scene.world.color=(0.96,0.96,0.98)

# 3/4 view camera, framing a 2m tall region centred ~0.9
cd=bpy.data.cameras.new("c"); cd.type='ORTHO'; cd.ortho_scale=2.6
cam=bpy.data.objects.new("c",cd); scene.collection.objects.link(cam)
cam.location=(3.2,-4.2,1.4)
d=mathutils.Vector((0,0,0.7))-cam.location; cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
scene.camera=cam

REP = {'Idle':0.5,'Walking':0.25,'Run':0.25,'Squat':0.5,'PushUp':0.5,'JumpingJack':0.5,
       'Plank':0.5,'BicycleCrunch':0.25,'Stretch':0.58,'BenchPress':0.5,'Deadlift':0.5,
       'PullUp':0.5,'Cycling':0.3,'Sleeping':0.5,'Studying':0.5,'Celebration':0.28}

if not arm.animation_data: arm.animation_data_create()
for act in bpy.data.actions:
    arm.animation_data.action = act
    f0,f1 = act.frame_range
    t = REP.get(act.name, 0.5)
    fr = int(f0 + t*(f1-f0))
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    scene.render.filepath=os.path.join(OUT,f"{act.name}.png")
    bpy.ops.render.render(write_still=True)
    print("R", act.name, "frame", fr)
print("MONTAGE RENDER DONE")
