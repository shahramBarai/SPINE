"""
name: ifc_ttl_fuseki_pipeline.py
description: Convert IFC to TTL, fix encoding, then upload corrected TTL to Fuseki.
"""

import argparse
import os
import sys
from pathlib import Path

from utils import encoding_utils
from conversion import IfcToLbd
from utils import file_utils
from db.fuseki_client import FusekiClient


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
        "--fuseki-username",
        default=os.getenv("FUSEKI_USERNAME"),
        help="Fuseki username (or env FUSEKI_USERNAME).",
    )
    parser.add_argument(
        "--fuseki-password",
        default=os.getenv("FUSEKI_PASSWORD"),
        help="Fuseki password (or env FUSEKI_PASSWORD).",
    )
    parser.add_argument(
        "--fuseki-timeout",
        type=float,
        default=float(os.getenv("FUSEKI_TIMEOUT_SECONDS", "120")),
        help="Fuseki HTTP timeout in seconds.",
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

    source_files = _collect_ifc_files(args.file, args.dir)

    FUSEKI_BASE_URL = args.fuseki_base_url
    FUSEKI_USERNAME = args.fuseki_username
    FUSEKI_PASSWORD = args.fuseki_password
    FUSEKI_DATASET = args.fuseki_dataset

    fusekiClient = FusekiClient(
        base_url=FUSEKI_BASE_URL,
        username=FUSEKI_USERNAME,
        password=FUSEKI_PASSWORD,
    )

    print(f"Found {len(source_files)} file(s) to process.")
    print("Order per file: convert -> fix encoding -> upload to Fuseki")

    success_count = 0
    for source_path in source_files:
        target_path = file_utils.get_target_file_path(source_path)

        converted = IfcToLbd._run_java_command(source_path, target_path, IfcToLbd.IfcToLbdOptions(level=1, ifcOWL=False))
        if not converted:
            continue

        try:
            print(f"Checking and fixing encoding for {target_path.name}...")
            encoding_utils.fix_encoding(str(target_path))

            graph_uri = _build_graph_uri(args.fuseki_graph_template, target_path) or args.fuseki_graph
            upload_mode = "replace" if args.fuseki_replace else "append"
            print(f"Uploading corrected {target_path.name} to Fuseki ({upload_mode})...")
            if not os.path.isfile(target_path):
                raise FileNotFoundError(f"TTL file not found: {target_path}")

            with open(target_path, "rb") as ttl_file:
                payload = ttl_file.read()

            fusekiClient.graph_upload_ttl(
                dataset_name=FUSEKI_DATASET, 
                graph_uri=graph_uri,
                payload=payload,
                replace=args.fuseki_replace
            )
            print(f"Successfully uploaded corrected {target_path.name}")
            success_count += 1
        except (OSError, Exception) as exc:
            print(f"Post-conversion step failed for {target_path.name}: {exc}")

    print(f"Completed {success_count}/{len(source_files)} file(s) successfully.")
    if success_count != len(source_files):
        sys.exit(1)


if __name__ == "__main__":
    main()
