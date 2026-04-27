"""
name: ifc_ttl_fuseki_pipeline.py
description: Convert IFC to TTL, fix encoding, then upload corrected TTL to Fuseki.
"""

import argparse
import sys
from pathlib import Path

from encoding_utils import fix_encoding
from ifc_lbd_converter import get_target_file_path, load_json, run_conversion
from ttl_fuseki_manager import FusekiError, FusekiTTLManager


def _collect_ifc_files(file_arg: str | None, dir_arg: str | None) -> list[Path]:
    if file_arg:
        source_path = Path(file_arg).resolve()
        if not source_path.exists():
            print(f"Error: File '{source_path}' does not exist.")
            sys.exit(1)
        return [source_path]

    source_dir = Path(dir_arg).resolve()
    if not source_dir.exists() or not source_dir.is_dir():
        print(f"Error: Directory '{source_dir}' does not exist.")
        sys.exit(1)

    ifc_files = list(source_dir.glob("*.ifc"))
    if not ifc_files:
        print(f"No .ifc files found in {source_dir}")
        sys.exit(0)

    return ifc_files


def _build_graph_uri(template: str | None, target_file: Path) -> str | None:
    if not template:
        return None
    return template.format(stem=target_file.stem, name=target_file.name)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pipeline: IFC conversion -> encoding fix -> Fuseki upload."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("-f", "--file", type=str, help="Path to a single .ifc file")
    group.add_argument("-d", "--dir", type=str, help="Path to the source IFC directory")

    parser.add_argument(
        "--fuseki-base-url",
        default="http://localhost:3030",
        help="Fuseki base URL.",
    )
    parser.add_argument(
        "--fuseki-dataset",
        default="dataset",
        help="Fuseki dataset name.",
    )
    parser.add_argument(
        "--fuseki-graph",
        default=None,
        help="Optional named graph URI. If omitted, default graph is used.",
    )
    parser.add_argument(
        "--fuseki-graph-template",
        default=None,
        help=(
            "Optional graph URI template using {stem} or {name}, "
            "for example http://example.org/graph/{stem}."
        ),
    )
    parser.add_argument(
        "--fuseki-replace",
        action="store_true",
        help="Replace graph content (PUT) instead of appending (POST).",
    )

    args = parser.parse_args()

    if args.fuseki_graph and args.fuseki_graph_template:
        parser.error("Use either --fuseki-graph or --fuseki-graph-template, not both.")

    config = load_json("config.json")
    hw_config = config.get("hardware", [])
    app_config = config.get("ifc2lbd", {})

    source_files = _collect_ifc_files(args.file, args.dir)
    manager = FusekiTTLManager(base_url=args.fuseki_base_url, dataset=args.fuseki_dataset)

    print(f"Found {len(source_files)} file(s) to process.")
    print("Order per file: convert -> fix encoding -> upload to Fuseki")

    success_count = 0
    for source_path in source_files:
        target_path = get_target_file_path(source_path)

        converted = run_conversion(source_path, target_path, hw_config, app_config)
        if not converted:
            continue

        try:
            print(f"Checking and fixing encoding for {target_path.name}...")
            fix_encoding(str(target_path))

            graph_uri = _build_graph_uri(args.fuseki_graph_template, target_path) or args.fuseki_graph
            upload_mode = "replace" if args.fuseki_replace else "append"
            print(f"Uploading corrected {target_path.name} to Fuseki ({upload_mode})...")
            manager.load_ttl_file(
                ttl_path=str(target_path),
                graph_uri=graph_uri,
                replace=args.fuseki_replace,
            )
            print(f"Successfully uploaded corrected {target_path.name}")
            success_count += 1
        except (OSError, FusekiError) as exc:
            print(f"Post-conversion step failed for {target_path.name}: {exc}")

    print(f"Completed {success_count}/{len(source_files)} file(s) successfully.")
    if success_count != len(source_files):
        sys.exit(1)


if __name__ == "__main__":
    main()
