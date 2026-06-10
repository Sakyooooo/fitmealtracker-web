"""
Step9 Export — bake constraints, stage NLA tracks, export /public/models/Avatar.glb.

Per docs/avatar-rig-spec.md.txt export rules: Apply Transform, Skinning,
Animations enabled. Fixed animation names. Target < 2MB.

Run (opens the saved source .blend, does NOT save it back):
  & "...blender.exe" --background "blender\\Avatar.blend" --python scripts\\export_avatar_glb.py
"""
import bpy, os

OUT = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\Avatar.glb"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

def log(*a): print("[EXPORT]", *a)

scene = bpy.context.scene
rig = bpy.data.objects['AvatarRig']
bar = bpy.data.objects['Barbell']

CLIPS = ['Idle', 'Walk', 'BenchPress', 'Squat', 'PullUp', 'Run']
BAR_CLIPS = ['BenchPress', 'Squat']   # clips where the barbell moves

# ── 1. bake the barbell constraint into per-clip object actions ──────────────
if not bar.animation_data:
    bar.animation_data_create()
bar_actions = {}
for nm in BAR_CLIPS:
    act = bpy.data.actions[nm]
    rig.animation_data.action = act
    f_end = int(act.frame_range[1])
    bake = bpy.data.actions.new(nm + "_Bar")
    bake.use_fake_user = True
    fcs = [bake.fcurves.new('location', index=i) for i in range(3)]
    for f in range(1, f_end + 1):
        scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        w = bar.evaluated_get(dg).matrix_world.translation
        for i in range(3):
            fcs[i].keyframe_points.insert(f, w[i], options={'FAST'})
    for fc in fcs:
        fc.update()
    bar_actions[nm] = bake
    log(f"baked barbell for '{nm}' ({f_end} frames)")

# constraint no longer needed in the export
for con in list(bar.constraints):
    bar.constraints.remove(con)
rig.animation_data.action = None

# ── 2. stage NLA tracks (same-named tracks merge into one glTF animation) ────
def clear_nla(ob):
    if ob.animation_data:
        for tr in list(ob.animation_data.nla_tracks):
            ob.animation_data.nla_tracks.remove(tr)

def stash(ob, action, name):
    ad = ob.animation_data if ob.animation_data else ob.animation_data_create()
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, max(1, int(action.frame_range[0])), action)
    st.name = name

clear_nla(rig)
clear_nla(bar)
for nm in CLIPS:
    stash(rig, bpy.data.actions[nm], nm)
for nm in BAR_CLIPS:
    stash(bar, bar_actions[nm], nm)
log(f"NLA tracks staged: rig={len(CLIPS)} bar={len(BAR_CLIPS)}")

# ── 3. Root joins the exported skeleton (spec lists it) ──────────────────────
rig.data.bones['Root'].use_deform = True
# IK_Foot_* / IK_Knee_* stay non-deform -> excluded by export_def_bones

# ── 4. export ────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=True,                  # Apply Transform: Enabled
    export_animations=True,
    export_animation_mode='NLA_TRACKS', # merge same-named tracks across objects
    export_skins=True,                  # Skinning: Enabled
    export_def_bones=True,              # drop IK helper bones
    export_materials='EXPORT',
    export_normals=True,
    export_force_sampling=True,
)
sz = os.path.getsize(OUT)
log(f"WROTE {OUT}  ({sz / 1024:.1f} KB, budget 2048 KB)")
log("EXPORT DONE")
