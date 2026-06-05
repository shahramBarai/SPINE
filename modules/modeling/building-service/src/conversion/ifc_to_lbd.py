
from __future__ import annotations

import subprocess
from pathlib import Path

def run_conversion(source_file: Path, target_file: Path, hw_config: list, app_config: dict) -> bool:
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
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to convert {source_file.name}. Exit code: {e.returncode}")
        return False
