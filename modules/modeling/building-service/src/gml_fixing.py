from lxml import etree
import uuid

input_file = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\CityGML\yhdistelma-met_l2_detached_b-osa.gml"
output_file = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\CityGML\yhdistelma-met_l2_detached_b-osa_fixed.gml"

tree = etree.parse(input_file)
root = tree.getroot()

ns = {"gml": "http://www.opengis.net/gml"}

# Dictionary to ensure uniqueness
seen = {}

for el in root.xpath("//*[@gml:id]", namespaces=ns):
    old_id = el.get("{http://www.opengis.net/gml}id")
    if old_id in seen:
        # Generate a new unique ID
        new_id = "GML_" + str(uuid.uuid4())
        el.set("{http://www.opengis.net/gml}id", new_id)
    else:
        seen[old_id] = True

# Write repaired document
tree.write(output_file, pretty_print=True, encoding="UTF-8", xml_declaration=True)

print(f"✅ Fixed file saved as: {output_file}")
print(f"🔢 Unique IDs generated: {len(seen)}")
