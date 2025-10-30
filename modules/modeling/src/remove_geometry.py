from rdflib import Graph, Namespace, RDF
import os
import time
import datetime
import re

# Define the IFC namespaces
ifc_namespaces = {
    'IFC2x3': Namespace("https://standards.buildingsmart.org/IFC/DEV/IFC2x3/TC1/OWL#"),   
    'IFC4': Namespace("https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#"),
    'IFC4_3':Namespace("https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/OWL#")
}

# IFC2x3 geometry classes
# https://standards.buildingsmart.org/IFC/RELEASE/IFC2x3/TC1/HTML/ifcgeometryresource/ifcgeometryresource.htm
geom_classes_ifc2x3 = [
    "Ifc2DCompositeCurve",
    "IfcAxis1Placement",
    "IfcAxis2Placement2D",
    "IfcAxis2Placement3D",
    "IfcBSplineCurve",
    "IfcBezierCurve",
    "IfcBoundedCurve",
    "IfcBoundedSurface",
    "IfcCartesianPoint",
    "IfcCartesianTransformationOperator",
    "IfcCartesianTransformationOperator2D",
    "IfcCartesianTransformationOperator2DnonUniform",
    "IfcCartesianTransformationOperator3D",
    "IfcCartesianTransformationOperator3DnonUniform",
    "IfcCircle",
    "IfcCompositeCurve",
    "IfcCompositeCurveSegment",
    "IfcConic",
    "IfcCurve",
    "IfcCurveBoundedPlane",
    "IfcDirection",
    "IfcElementarySurface",
    "IfcEllipse",
    "IfcGeometricRepresentationItem",
    "IfcLine",
    "IfcMappedItem",
    "IfcOffsetCurve2D",
    "IfcOffsetCurve3D",
    "IfcPlacement",
    "IfcPlane",
    "IfcPoint",
    "IfcPointOnCurve",
    "IfcPointOnSurface",
    "IfcPolyline",
    "IfcRationalBezierCurve",
    "IfcRectangularTrimmedSurface",
    "IfcRepresentationItem",
    "IfcRepresentationMap",
    "IfcSurface",
    "IfcSurfaceOfLinearExtrusion",
    "IfcSurfaceOfRevolution",
    "IfcSweptSurface",
    "IfcTrimmedCurve",
    "IfcVector",
]

# IFC4 geometry classes
# https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/
geom_classes_ifc4 = [
    "IfcAnnotationFillArea",
    "IfcBooleanResult",
    "IfcBooleanClippingResult",
    "IfcBoundingBox",
    "IfcCartesianPointList",
    "IfcCartesianPointList2D",
    "IfcCartesianPointList3D",
    "IfcCartesianTransformationOperator",
    "IfcCartesianTransformationOperator2D",
    "IfcCartesianTransformationOperator3D",
    "IfcCompositeCurveSegment",
    "IfcReparametrisedCompositeCurveSegment",
    "IfcCsgPrimitive3D",
    "IfcBlock",
    "IfcRectangularPyramid",
    "IfcRightCircularCone",
    "IfcRightCircularCylinder",
    "IfcSphere",
    "IfcCurve",
    "IfcBoundedCurve",
    "IfcConic",
    "IfcCircle",
    "IfcEllipse",
    "IfcLine",
    "IfcOffsetCurve2D",
    "IfcOffsetCurve3D",
    "IfcPcurve",
    "IfcSurfaceCurve",
    "IfcDirection",
    "IfcFillAreaStyleHatching",
    "IfcFillAreaStyleTiles",
    "IfcGeometricSet",
    "IfcGeometricCurveSet",
    "IfcHalfSpaceSolid",
    "IfcBoxedHalfSpace",
    "IfcPolygonalBoundedHalfSpace",
    "IfcLightSource",
    "IfcLightSourceAmbient",
    "IfcLightSourceDirectional",
    "IfcLightSourceGoniometric",
    "IfcLightSourcePositional",
    "IfcLightSourceSpot",
    "IfcPlacement",
    "IfcAxis1Placement",
    "IfcAxis2Placement2D",
    "IfcAxis2Placement3D",
    "IfcPlanarExtent",
    "IfcPlanarBox",
    "IfcPoint",
    "IfcCartesianPoint",
    "IfcPointOnCurve",
    "IfcPointOnSurface",
    "IfcSectionedSpine",
    "IfcShellBasedSurfaceModel",
    "IfcSolidModel",
    "IfcCsgSolid",
    "IfcManifoldSolidBrep",
    "IfcAdvancedBrep",
    "IfcFacetedBrep",
    "IfcSweptAreaSolid",
    "IfcExtrudedAreaSolid",
    "IfcFixedReferenceSweptAreaSolid",
    "IfcRevolvedAreaSolid",
    "IfcRevolvedAreaSolidTapered",
    "IfcSurfaceCurveSweptAreaSolid",
    "IfcSweptDiskSolid",
    "IfcSurface",
    "IfcBoundedSurface",
    "IfcBSplineSurface",
    "IfcBSplineSurfaceWithKnots",
    "IfcCurveBoundedPlane",
    "IfcCurveBoundedSurface",
    "IfcRectangularTrimmedSurface",
    "IfcElementarySurface",
    "IfcCylindricalSurface",
    "IfcPlane",
    "IfcSphericalSurface",
    "IfcToroidalSurface",
    "IfcSweptSurface",
    "IfcSurfaceOfLinearExtrusion",
    "IfcSurfaceOfRevolution",
    "IfcTessellatedItem",
    "IfcIndexedPolygonalFace",
    "IfcTessellatedFaceSet",
    "IfcPolygonalFaceSet",
    "IfcTriangulatedFaceSet",
    "IfcTextLiteral",
    "IfcTextLiteralWithExtent",
    "IfcVector",
]

# IFC4.3 geometry classes
# https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcGeometricRepresentationItem.htm
geom_classes_ifc4_3 = geom_classes_ifc4 # to be updated

geom_classes = {
    'IFC2x3': geom_classes_ifc2x3,   
    'IFC4': geom_classes_ifc4,
    'IFC4_3': geom_classes_ifc4_3
}

def remove_ifc_geometry(input_ttl, output_ttl):
    # Record the start time
    start_time = time.time()
    g = Graph()
    print(f"Start parsing {input_ttl} at {datetime.datetime.now()}.")
    g.parse(input_ttl, format='ttl')    
    print(f"Graph has {len(g)} triples.")

    # Detect IFC schema
    # Get all namespace URIs from the graph (as strings)
    graph_namespaces = [str(ns_uri) for prefix, ns_uri in g.namespaces()]
    
    # Check which IFC namespace is present
    version = None
    for schema_name, ns in ifc_namespaces.items():
        if str(ns) in graph_namespaces:
            version = schema_name
            print(f'The IFC Schema is {version}.')
    if version:        
        IFC = ifc_namespaces[version]
    else:
        print('Unknown IFC Schema.')    

    geom_uris = [IFC[cls] for cls in geom_classes[version]]

    # Find all subjects that are instances of geometric classes
    geom_subjects = set()
    for cls in geom_uris:
        for s in g.subjects(RDF.type, cls):
            geom_subjects.add(s)
    print(f"Found {len(geom_subjects)} geometry instances.")

    # Remove all triples related to geometric subjects
    for s in geom_subjects:
        g.remove((s, None, None))
        g.remove((None, None, s))
    print(f"Graph now has {len(g)} triples (removed {len(geom_subjects)})")

    # Save the cleaned graph
    g.serialize(destination=output_ttl, format='ttl')
    
    # Record the end time
    end_time = time.time()
    # Calculate the elapsed time
    elapsed_time = end_time - start_time
    print(f"Function execution ended at {datetime.datetime.now()}.")
    print(f"Function execution time: {elapsed_time:.4f} seconds.")
    print(f"Geometry removed and saved to {output_ttl}")

def validate_ttl_syntax(file_path):
    start_time = time.time()
    g = Graph()
    print(f"Start validating {file_path} at {datetime.datetime.now()}.")
    try:
        g.parse(file_path, format='ttl')
        print(f"✅ {file_path} is syntactically valid RDF/Turtle.")
        print(f"📦 Contains {len(g)} triples.")
        # Record the end time
        end_time = time.time()
        # Calculate the elapsed time
        elapsed_time = end_time - start_time
        print(f"Validation ended at {datetime.datetime.now()}.")
        print(f"Validation time: {elapsed_time:.4f} seconds.")
        return True
    except Exception as e:
        print(f"❌ Syntax error in {file_path}: {e}")
        return False

if __name__ == "__main__":   

    input_ttl = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/scripts/docs/AC20-FZK-Haus-40_ifcOWL.ttl"    
    output_ttl = "C:/Users/yanpe/OneDrive - Metropolia Ammattikorkeakoulu Oy/Research/MD2MV/scripts/docs/AC20-FZK-Haus-40_ifcOWL_no_geometry.ttl"
    remove_ifc_geometry(input_ttl, output_ttl)
    validate_ttl_syntax(output_ttl)
