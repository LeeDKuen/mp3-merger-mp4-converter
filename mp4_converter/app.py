import os
import subprocess
import sys
from tkinter import Tk, filedialog

from PIL import Image

IMAGE_FILE = "bg.jpg"
OUTPUT_DIRNAME = "output"


def get_app_dir():
    # Keep resources and outputs next to the executable when packaged.
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def create_black_background(image_path):
    if not os.path.exists(image_path):
        print("Background image not found. Creating a black 1920x1080 image...")
        img = Image.new("RGB", (1920, 1080), color="black")
        img.save(image_path, quality=95)
        print(f"Created background image: {image_path}")


def convert_single_file(mp3_path, image_path, output_folder):
    if not os.path.exists(mp3_path):
        print(f"File not found: {mp3_path}")
        return

    os.makedirs(output_folder, exist_ok=True)

    filename = os.path.basename(mp3_path)
    name_only, _ = os.path.splitext(filename)
    output_path = os.path.join(output_folder, f"{name_only}.mp4")

    print(f"Converting: {filename}")

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-loop",
        "1",
        "-i",
        image_path,
        "-i",
        mp3_path,
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-fflags",
        "+shortest",
        "-max_interleave_delta",
        "100M",
        output_path,
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"Done: {output_path}")
    except subprocess.CalledProcessError:
        print(f"Failed: {mp3_path}")


def choose_mode():
    print("\nChoose conversion mode:")
    print("1) Select a folder and convert all MP3 files in it")
    print("2) Select multiple MP3 files")
    print("3) Select one MP3 file")
    return input("Select (1/2/3): ").strip()


def select_folder():
    root = Tk()
    root.withdraw()
    folder = filedialog.askdirectory(title="Select folder containing MP3 files")
    root.destroy()
    return folder


def select_files(multiple=True):
    root = Tk()
    root.withdraw()
    filetypes = [("MP3 files", "*.mp3"), ("All files", "*.*")]
    if multiple:
        paths = filedialog.askopenfilenames(title="Select MP3 files to convert", filetypes=filetypes)
    else:
        paths = filedialog.askopenfilename(title="Select an MP3 file to convert", filetypes=filetypes)
    root.destroy()

    if not paths:
        return []
    if isinstance(paths, str):
        return [paths]
    return list(paths)


def list_mp3_in_folder(folder):
    if not os.path.isdir(folder):
        return []
    mp3s = []
    for name in os.listdir(folder):
        if name.lower().endswith(".mp3"):
            mp3s.append(os.path.join(folder, name))
    mp3s.sort()
    return mp3s


def main():
    app_dir = get_app_dir()
    image_path = os.path.join(app_dir, IMAGE_FILE)
    output_folder = os.path.join(app_dir, OUTPUT_DIRNAME)

    create_black_background(image_path)

    mode = choose_mode()

    if mode == "1":
        folder = select_folder()
        if not folder:
            print("Folder selection canceled.")
            return
        target_files = list_mp3_in_folder(folder)
    elif mode == "2":
        target_files = select_files(multiple=True)
    elif mode == "3":
        target_files = select_files(multiple=False)
    else:
        print("Invalid selection.")
        return

    if not target_files:
        print("No MP3 files selected.")
        return

    print(f"\nTotal files: {len(target_files)}")
    print(f"Output folder: {output_folder}\n")

    for mp3_path in target_files:
        convert_single_file(mp3_path, image_path, output_folder)

    print("\nAll jobs completed.")


if __name__ == "__main__":
    main()
