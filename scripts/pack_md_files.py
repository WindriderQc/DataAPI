#!/usr/bin/env python3
import os
import zipfile
import argparse
import sys

def pack_md_files(source_dir, output_zip):
    """
    Packs all .md files from source_dir and its subdirectories into a zip file.
    Preserves the directory structure relative to source_dir.
    """
    source_dir = os.path.abspath(source_dir)
    
    if not os.path.exists(source_dir):
        print(f"Error: Source directory '{source_dir}' does not exist.")
        sys.exit(1)

    md_files = []
    for root, dirs, files in os.walk(source_dir):
        # Modify dirs in-place to skip ignored directories
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.vscode']]
        
        for file in files:
            if file.lower().endswith(".md"):
                full_path = os.path.join(root, file)
                # Calculate path relative to the source_dir
                rel_path = os.path.relpath(full_path, source_dir)
                md_files.append((full_path, rel_path))

    if not md_files:
        print(f"No .md files found in '{source_dir}'.")
        return

    print(f"Found {len(md_files)} .md files in '{source_dir}'.")
    print(f"Creating archive '{output_zip}'...")

    try:
        # Create directory for output file if it doesn't exist
        output_dir = os.path.dirname(os.path.abspath(output_zip))
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for full_path, rel_path in md_files:
                print(f"  Adding: {rel_path}")
                zipf.write(full_path, rel_path)
        
        print(f"\nSuccessfully packed {len(md_files)} files into '{output_zip}'")
        
    except Exception as e:
        print(f"Error creating zip file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pack all .md files from a directory into a zip archive.")
    parser.add_argument("source_dir", help="The directory to search for .md files")
    parser.add_argument("output_zip", help="The output zip filename (e.g., docs.zip)")
    
    args = parser.parse_args()
    
    pack_md_files(args.source_dir, args.output_zip)
