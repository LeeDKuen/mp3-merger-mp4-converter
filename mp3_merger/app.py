import os
import sys
from tkinter import Tk, filedialog

from pydub import AudioSegment

OUTPUT_DIRNAME = "output"
OUTPUT_FILENAME = "merged_output.mp3"


def get_app_dir():
    # Keep generated files next to the executable when packaged.
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def select_folder():
    root = Tk()
    root.withdraw()
    folder_path = filedialog.askdirectory(title="Select folder with MP3 files")
    root.destroy()
    return folder_path


def merge_mp3(folder_path, output_path, reverse=False):
    mp3_files = [f for f in os.listdir(folder_path) if f.lower().endswith(".mp3")]

    if not mp3_files:
        print("No MP3 files found.")
        return

    mp3_files.sort(reverse=reverse)

    print("Merge order:")
    for file_name in mp3_files:
        print(" -", file_name)

    combined = AudioSegment.empty()
    for file_name in mp3_files:
        audio = AudioSegment.from_mp3(os.path.join(folder_path, file_name))
        combined += audio

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    combined.export(output_path, format="mp3")

    print(f"\nMerged file saved: {output_path}")


if __name__ == "__main__":
    folder = select_folder()
    if not folder:
        print("Folder selection canceled.")
        raise SystemExit(1)

    order = input("Sort order (1: ascending / 2: descending): ").strip()
    reverse = order == "2"

    app_dir = get_app_dir()
    output_path = os.path.join(app_dir, OUTPUT_DIRNAME, OUTPUT_FILENAME)
    merge_mp3(folder, output_path, reverse)
