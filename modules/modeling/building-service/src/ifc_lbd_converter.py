import json
import subprocess
import sys
import argparse
from pathlib import Path

def load_json(filepath):
    try:
        with open(filepath, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: Configuration file '{filepath}' missing.")
        sys.exit(1)

def run_conversion(source_file: Path, target_file: Path, hw_config: list, app_config: dict):
    """Executes the Java command for a single file pair."""
    command = ["java"]
    command.extend(hw_config)
    command.extend(["-jar", app_config["jar_file"]])
    
    # Path objects need to be converted to strings for subprocess
    command.append(str(source_file))
    command.extend(["--level", str(app_config["level"])])
    
    if app_config.get("ifcOWL", False):
        command.append("--ifcOWL")
        
    command.extend(["--target_file", str(target_file)])

    print(f"\nProcessing: {source_file.name} -> {target_file.name}")
    
    try:
        subprocess.run(command, check=True)
        print(f"Successfully converted {source_file.name}")
    except subprocess.CalledProcessError as e:
        print(f"Failed to convert {source_file.name}. Exit code: {e.returncode}")

def get_target_file_path(source_file: Path) -> Path:
    """
    Calculates the target TTL path. 
    Mirrors the folder structure inside the 'IFC' folder to the 'TTL' folder.
    """
    parts = source_file.parts
    
    if 'IFC' in parts:
        # Find exactly where 'IFC' is in the folder structure
        ifc_index = parts.index('IFC')
        
        # The base path is everything right before the 'IFC' folder
        base_path = Path(*parts[:ifc_index])
        
        # The sub-path is any folders between 'IFC' and the actual file
        # If the file is directly inside 'IFC', this will be empty
        sub_path_parts = parts[ifc_index + 1 : -1] 
        
        # Construct the new target directory
        if sub_path_parts:
            target_dir = base_path / "TTL" / Path(*sub_path_parts)
        else:
            target_dir = base_path / "TTL"
            
    else:
        # Fallback just in case the file isn't inside an 'IFC' folder at all
        target_dir = source_file.parent.parent / "TTL"

    # Ensure the target directory (and any necessary subdirectories) exist
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Create the target file path with the same name but .ttl extension
    return target_dir / f"{source_file.stem}.ttl"

def main():
    parser = argparse.ArgumentParser(description="Batch or single file IFC to LBD Converter.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("-f", "--file", type=str, help="Path to a single .ifc file")
    group.add_argument("-d", "--dir", type=str, help="Path to the source IFC directory")
    
    args = parser.parse_args()

    # Load configs    
    config = load_json('config.json')
    hw_config = config.get('hardware', [])
    app_config = config.get('ifc2lbd', {})    

    if args.file:
        # SINGLE FILE MODE
        source_path = Path(args.file).resolve()
        if not source_path.exists():
            print(f"Error: File '{source_path}' does not exist.")
            sys.exit(1)
            
        target_path = get_target_file_path(source_path)
        run_conversion(source_path, target_path, hw_config, app_config)

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
        
        for source_path in ifc_files:
            target_path = get_target_file_path(source_path)
            run_conversion(source_path, target_path, hw_config, app_config)

if __name__ == "__main__":
    main()