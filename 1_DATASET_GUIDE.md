# Step 1: Building Your Custom Dataset

To genuinely fine-tune YOLOv8, you need images of YOUR specific scenario
(your desk/camera angle/room) labeled with bounding boxes around people.

## How many images do you need?
- Minimum: 100 images (50 with a person, 50 without / other objects)
- Better: 200-300 images for a more robust model
- Vary: lighting, distance, angle, sitting vs standing, partial occlusion

## How to collect them
1. Use your phone or webcam to record a short video (2-3 minutes) of the
   camera spot with people walking in/out, sitting, standing, leaving empty.
2. Extract frames from the video using the provided `extract_frames.py`
   script (grabs 1 frame every N frames so you don't have 1000s of near-
   duplicate images).
3. Also capture ~30-50 images of the EMPTY scene (no person) in different
   lighting conditions — these are just as important as the "person" images.

## How to label them
Use a free labeling tool:
- **Roboflow** (https://roboflow.com) — free tier, browser-based, exports
  directly in YOLOv8 format. Easiest option for a college project.
- **LabelImg** (open-source, installs via pip) — offline alternative.

Steps in Roboflow (recommended):
1. Create a free account, create a new project (Object Detection).
2. Upload your extracted frames.
3. Draw bounding boxes around each person in each image, label class "person".
4. Use Roboflow's auto-split (train/valid/test, e.g., 70/20/10).
5. Export dataset -> Format: "YOLOv8" -> Download zip.
6. Unzip it into this project folder as `dataset/` — it will contain:
   ```
   dataset/
     data.yaml
     train/images, train/labels
     valid/images, valid/labels
     test/images, test/labels
   ```

Once you have `dataset/data.yaml`, you're ready for Step 2 (training).
