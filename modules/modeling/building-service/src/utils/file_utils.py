# TODO: Add comments and docstrings to all functions in this file. Check if any of the functions can be moved to a more general utility module if they are not specific to file handling in this context.

import json
from pathlib import Path

def get_source_root() -> Path:
	return Path(__file__).resolve().parent.parent

def get_hardware_config(path: Path) -> list:
    """
    Reads the hardware configuration from the config.json file.

    Returns:
        A list of hardware configuration options, otherwise an empty list.
    """
    if not path.exists():
        return []
    
    try:
        with open(path, 'r') as file:
            config = json.load(file)
            return config.get("hardware", [])
    except Exception:
        return []

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


def valid_file_name(filename: str, allowed_extensions: list[str]) -> bool:
    """
    Checks if the filename has a valid extension and does not contain path traversal characters.

    Args:
        filename: The name of the file to check
        allowed_extensions: A list of allowed file extensions (e.g., ["ifc", "ttl"])
    
    Returns:
        True if the filename is valid, False otherwise
    """
    # Check for valid extension
    if not any(filename.lower().endswith(f".{ext}") for ext in allowed_extensions):
        return False
    
    # Check for path traversal characters
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    
    return True