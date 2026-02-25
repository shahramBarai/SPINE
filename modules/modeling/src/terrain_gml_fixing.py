import os
from lxml import etree

def fix_citygml_relief_order(input_filepath, output_filepath, default_lod='2'):
    """
    Corrects the element ordering within dem:TINRelief blocks 
    to ensure dem:lod precedes dem:tin, which resolves the cvc-complex-type.2.4.a error.
    
    Args:
        input_filepath (str): Path to the original CityGML file.
        output_filepath (str): Path to save the corrected CityGML file.
        default_lod (str): The LoD value to insert if 'dem:lod' is missing.
    """
    
    # 1. Define Namespaces for XPath
    # The prefix 'dem' is mapped to 'http://www.opengis.net/citygml/relief/2.0'
    # The prefix 'core' is mapped to 'http://www.opengis.net/citygml/2.0'
    NSMAP = {
        'dem': 'http://www.opengis.net/citygml/relief/2.0',
        'core': 'http://www.opengis.net/citygml/2.0',
        # Include other namespaces as needed, but these two are essential for targeting
    }

    print(f"Loading file: {input_filepath}...")
    
    # Use iterparse for memory-efficient parsing of large files
    try:
        context = etree.iterparse(input_filepath, events=('end',), tag='{%s}TINRelief' % NSMAP['dem'])
        
        # We need a new tree to hold the modified elements
        tree = etree.parse(input_filepath)
        root = tree.getroot()
        
        # Count fixes
        fix_count = 0
        
        # 2. Iterate through all TINRelief elements
        for element in root.xpath('//dem:TINRelief', namespaces=NSMAP):
            
            tin_element = element.find('{%s}tin' % NSMAP['dem'])
            lod_element = element.find('{%s}lod' % NSMAP['dem'])

            # Check if both 'tin' and 'lod' exist
            if tin_element is None:
                # If no 'tin' is found, skip this element
                continue

            # 3. Handle Missing or Misplaced LOD
            if lod_element is None:
                # Case A: LOD is missing (common issue) -> Create and insert it
                
                # Create the missing LOD element
                lod_element = etree.Element('{%s}lod' % NSMAP['dem'], nsmap=NSMAP)
                lod_element.text = default_lod
                
                # Insert it right before the 'tin' element
                tin_element.addprevious(lod_element)
                fix_count += 1
                
            elif element.index(lod_element) > element.index(tin_element):
                # Case B: LOD exists but is *after* the 'tin' element (the error you described)
                
                # Remove the misplaced LOD element
                element.remove(lod_element)
                
                # Insert it back *before* the 'tin' element
                tin_element.addprevious(lod_element)
                fix_count += 1
                
        # 4. Save the corrected file
        if fix_count > 0:
            print(f"Fixing complete. {fix_count} TINRelief blocks were corrected.")
            # Ensure the output directory exists
            os.makedirs(os.path.dirname(output_filepath), exist_ok=True)
            
            # Save the modified tree
            tree.write(output_filepath, pretty_print=True, encoding='UTF-8', xml_declaration=True)
            print(f"Successfully saved corrected file to: {output_filepath}")
        else:
            print("No TINRelief blocks required correction.")
            
    except Exception as e:
        print(f"An error occurred: {e}")

# --- CONFIGURATION ---
# NOTE: Replace 'your_input.gml' with the actual path to your CityGML file.
INPUT_FILE = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\CityGML\Helsinki\FME_657D6818_1763229756933_8396\FILECOPY_1\EXPORT\0_0_terrain_terrain.gml" 
OUTPUT_FILE = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\CityGML\Helsinki\FME_657D6818_1763229756933_8396\FILECOPY_1\EXPORT\0_0_terrain_terrain_fixed.gml" 
# Terrain TINs are typically LoD2, but verify this is correct for your data.
LOD_VALUE = '2' 

# Run the function
fix_citygml_relief_order(INPUT_FILE, OUTPUT_FILE, LOD_VALUE) 

# --- Example Call (Uncomment to Run) ---
# Assuming your file is named 'data.gml' and you want the output to be 'data_fixed.gml'
#fix_citygml_relief_order('data.gml', 'data_fixed.gml', '2')