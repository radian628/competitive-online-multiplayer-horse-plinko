import json
json.dumps([({ 
  "name": b.name, 
  "tail": {
    "x": b.tail_local.x, 
    "y": b.tail_local.y, 
    "z": b.tail_local.z, 
  },
  "head": {
    "x": b.head_local.x, 
    "y": b.head_local.y, 
    "z": b.head_local.z, 
  }
}) for b in bpy.context.selected_objects[0].data.bones])