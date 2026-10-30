"""
Extract frames from a recorded video to build your labeling dataset.

Usage:
    python extract_frames.py --video my_recording.mp4 --every 15 --out raw_frames

This grabs every Nth frame (default 15) so you get a variety of moments
without thousands of near-duplicate images to label.
"""

import cv2
import os
import argparse


def extract_frames(video_path, every_n, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: could not open video {video_path}")
        return

    frame_count = 0
    saved_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % every_n == 0:
            filename = os.path.join(out_dir, f"frame_{saved_count:04d}.jpg")
            cv2.imwrite(filename, frame)
            saved_count += 1

        frame_count += 1

    cap.release()
    print(f"Done. Extracted {saved_count} frames from {frame_count} total frames.")
    print(f"Saved to: {out_dir}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True, help="Path to recorded video file")
    parser.add_argument("--every", type=int, default=15, help="Save every Nth frame")
    parser.add_argument("--out", default="raw_frames", help="Output folder for extracted frames")
    args = parser.parse_args()

    extract_frames(args.video, args.every, args.out)
