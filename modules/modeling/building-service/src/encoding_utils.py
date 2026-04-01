"""
name: encoding_utils.py
description: Fixing Finnish letters (ä, ö, etc.) in TTL files.
"""

import os
from ftfy import fix_text

def check_fin_letter_encoding(file_path):
    with open(file_path, "rb") as f:
        raw = f.read()

    # Look for UTF-8, Latin-1, Java Escapes (\u00E4), and Mojibake (Ã¤)
    patterns = {
        'ä': {
            'utf8': b'\xc3\xa4', 
            'latin1': b'\xe4', 
            'escaped_lower': b'\\u00e4', 
            'escaped_upper': b'\\u00E4',
            'mojibake': b'\xc3\x83\xc2\xa4' # "Ã¤"
        },
        'ö': {
            'utf8': b'\xc3\xb6', 
            'latin1': b'\xf6', 
            'escaped_lower': b'\\u00f6', 
            'escaped_upper': b'\\u00F6',
            'mojibake': b'\xc3\x83\xc2\xb6' # "Ã¶"
        }
    }

    print(f"--- Deep Encoding Audit: {os.path.basename(file_path)} ---")
    
    for char, signatures in patterns.items():
        print(f"Results for '{char}':")
        for sig_name, byte_pattern in signatures.items():
            count = raw.count(byte_pattern)
            if count > 0:
                print(f"  - {sig_name}: {count} found")

def fix_encoding(file_path):
    """
    Renames the original file to include a suffix, saves the fixed version,
    and prints a report of how many Finnish characters were corrected.
    """
    base, ext = os.path.splitext(file_path)
    broken_file_path = f"{base}_broken_encoding{ext}"
    
    # Target characters to track
    target_chars = ['ä', 'ö', 'ü', 'å', 'Ä', 'Ö', 'Å']

    # 1. Read the current content
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(file_path, "r", encoding="latin-1") as f:
            content = f.read()

    # Count occurrences BEFORE fix
    before_counts = {char: content.count(char) for char in target_chars}

    # 2. Apply the fix
    fixed = fix_text(content)

    # Count occurrences AFTER fix
    after_counts = {char: fixed.count(char) for char in target_chars}

    # 3. Rename original as backup
    os.rename(file_path, broken_file_path)

    # 4. Save fixed content to original name
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(fixed)
    
    # 5. Calculate and Print Report
    print(f"--- Encoding Report: {os.path.basename(file_path)} ---")
    total_fixed = 0
    for char in target_chars:
        diff = after_counts[char] - before_counts[char]
        if diff > 0:
            print(f"  Fixed '{char}': {diff} occurrences")
            total_fixed += diff
    
    if total_fixed == 0:
        print("  No encoding issues detected (counts remained stable).")
    else:
        print(f"  Total characters recovered: {total_fixed}")
    print(f"  Backup saved to: {os.path.basename(broken_file_path)}\n")

def process_path(path):
    """
    Processes a single file or all .ttl files in a folder.
    Ignores files containing 'ifcowl' (case-insensitive).
    """
    # 1. Handle if the path is a single file
    if os.path.isfile(path):
        if "ifcowl" not in path.lower() and path.endswith(".ttl"):
            fix_encoding(path)
        else:
            print(f"Skipping file: {path} (Not a TTL or contains 'ifcowl')")

    # 2. Handle if the path is a directory
    elif os.path.isdir(path):
        print(f"Scanning directory: {path}")
        for filename in os.listdir(path):
            # Filtering logic
            if filename.lower().endswith(".ttl") and "ifcowl" not in filename.lower():
                # Avoid re-fixing files that were already backed up in a previous run
                if "_broken_encoding" not in filename:
                    full_path = os.path.join(path, filename)
                    fix_encoding(full_path)
            else:
                continue
    else:
        print(f"Error: Path {path} is not valid.")

# Example usage:
# process_path("C:/MyResearch/Data/TTL") 
# or 
# process_path("C:/MyResearch/Data/TTL/smartLab.ttl")

if __name__ == "__main__":    
    test_arc_ttl = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\temp\yhdistelma-met_l2_detached_a-osa.ttl"
    check_fin_letter_encoding(test_arc_ttl)
    #process_path(test_arc_ttl)



