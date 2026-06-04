"""
name: ifc_lbd_converter.py
description: IFC to TTL conversion using IFC2LBD converter.
"""
from __future__ import annotations

import sys
import argparse
from pathlib import Path

from utils import file_utils
from conversion import run_conversion


def main():
    parser = argparse.ArgumentParser(description="Batch or single file IFC to LBD Converter.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("-f", "--file", type=str, help="Path to a single .ifc file")
    group.add_argument("-d", "--dir", type=str, help="Path to the source IFC directory")
    args = parser.parse_args()

    # Load configs    
    config = file_utils.load_json('config.json')
    hw_config = config.get('hardware', [])
    app_config = config.get('ifc2lbd', {})

    if args.file:
        # SINGLE FILE MODE
        source_path = Path(args.file).resolve()
        if not source_path.exists():
            print(f"Error: File '{source_path}' does not exist.")
            sys.exit(1)
            
        target_path = file_utils.get_target_file_path(source_path)
        ok = run_conversion(source_path, target_path, hw_config, app_config)
        if not ok:
            sys.exit(1)

    elif args.dir:
        # DIRECTORY (BATCH) MODE
        source_dir = Path(args.dir).resolve()
        if not source_dir.exists() or not source_dir.is_dir():
            print(f"Error: Directory '{source_dir}' does not exist.")
            sys.exit(1)

        # Find all .ifc files in the directory
        ifc_files = list(source_dir.glob("*.ifc"))
        
        if not ifc_files:
            print(f"No .ifc files found in {source_dir}")
            sys.exit(0)
            
        print(f"Found {len(ifc_files)} file(s) to process.")

        success_count = 0
        for source_path in ifc_files:
            target_path = file_utils.get_target_file_path(source_path)
            ok = run_conversion(source_path, target_path, hw_config, app_config)
            if ok:
                success_count += 1

        print(f"Completed {success_count}/{len(ifc_files)} file(s) successfully.")
        if success_count != len(ifc_files):
            sys.exit(1)

if __name__ == "__main__":
    main()