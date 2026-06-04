# TODO: Add comments and docstrings to all functions in this file. Check if any of the functions can be moved to a more general utility module if they are not specific to file handling in this context.

import sys
import json
from pathlib import Path

def load_json(filepath):
    try:
        with open(filepath, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: Configuration file '{filepath}' missing.")
        sys.exit(1)

def get_source_root() -> Path:
	return Path(__file__).resolve().parent

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