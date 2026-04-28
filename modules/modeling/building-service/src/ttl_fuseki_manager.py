"""
name: ttl_fuseki_manager.py
description: Upload, delete, and update Turtle (.ttl) files in Apache Jena Fuseki.

This module uses Fuseki Graph Store Protocol endpoints:
- POST /data  -> append triples
- PUT  /data  -> replace graph contents
- DELETE /data -> delete graph contents

By default it targets:
http://localhost:3030/{dataset}/data
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
from typing import Optional
from urllib import parse, request
from urllib.error import HTTPError, URLError


class FusekiError(RuntimeError):
    """Raised when a Fuseki HTTP call fails."""


class FusekiTTLManager:
    """Small helper client for managing TTL data in Fuseki."""

    def __init__(
        self,
        base_url: str = "http://localhost:3030",
        dataset: str = "dataset",
        username: Optional[str] = None,
        password: Optional[str] = None,
        timeout_seconds: float = 120.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.dataset = dataset.strip("/")
        self.data_endpoint = f"{self.base_url}/{self.dataset}/data"
        self.update_endpoint = f"{self.base_url}/{self.dataset}/update"
        self.username = username
        self.password = password
        self.timeout_seconds = timeout_seconds

    def _build_data_url(self, graph_uri: Optional[str] = None) -> str:
        if graph_uri:
            query = parse.urlencode({"graph": graph_uri})
            return f"{self.data_endpoint}?{query}"
        return self.data_endpoint

    def _request(self, method: str, url: str, data: Optional[bytes] = None, content_type: Optional[str] = None) -> str:
        headers = {}
        if content_type:
            headers["Content-Type"] = content_type

        if self.username is not None:
            raw = f"{self.username}:{self.password or ''}".encode("utf-8")
            headers["Authorization"] = f"Basic {base64.b64encode(raw).decode('ascii')}"

        req = request.Request(url=url, method=method, data=data, headers=headers)
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                return body or f"{method} {url} -> HTTP {resp.status}"
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise FusekiError(
                f"Fuseki request failed: {method} {url} -> HTTP {exc.code}. {error_body}"
            ) from exc
        except URLError as exc:
            raise FusekiError(f"Cannot reach Fuseki at {url}: {exc.reason}") from exc

    def load_ttl_file(self, ttl_path: str, graph_uri: Optional[str] = None, replace: bool = False) -> str:
        """
        Load a TTL file into Fuseki.

        Args:
            ttl_path: Path to a .ttl file.
            graph_uri: Optional named graph URI. If omitted, default graph is used.
            replace: If True, replace graph content (PUT). If False, append (POST).
        """
        if not os.path.isfile(ttl_path):
            raise FileNotFoundError(f"TTL file not found: {ttl_path}")

        with open(ttl_path, "rb") as ttl_file:
            payload = ttl_file.read()

        method = "PUT" if replace else "POST"
        url = self._build_data_url(graph_uri)
        return self._request(method, url, data=payload, content_type="text/turtle")

    def delete_graph(self, graph_uri: Optional[str] = None) -> str:
        """
        Delete all triples in the target graph.

        Args:
            graph_uri: Optional named graph URI. If omitted, default graph is targeted.
        """
        url = self._build_data_url(graph_uri)
        return self._request("DELETE", url)

    def update_ttl_file(self, ttl_path: str, graph_uri: Optional[str] = None) -> str:
        """
        Replace existing graph data with the TTL file content.

        This is equivalent to load_ttl_file(..., replace=True).
        """
        return self.load_ttl_file(ttl_path=ttl_path, graph_uri=graph_uri, replace=True)

    def clear_dataset(self) -> str:
        """Remove all triples/quads from the dataset using SPARQL UPDATE."""
        payload = b"CLEAR ALL"
        return self._request("POST", self.update_endpoint, data=payload, content_type="application/sparql-update")


def _build_cli() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage Turtle files in Apache Jena Fuseki.")
    parser.add_argument("action", choices=["load", "delete", "update"], help="Operation to execute.")
    parser.add_argument("--ttl", help="Path to TTL file (required for load/update).")
    parser.add_argument("--graph", help="Named graph URI. If omitted, default graph is used.")
    parser.add_argument("--base-url", default="http://localhost:3030", help="Fuseki base URL.")
    parser.add_argument("--dataset", default="dataset", help="Fuseki dataset name.")
    parser.add_argument("--username", default=os.getenv("FUSEKI_USERNAME"), help="Fuseki username (or env FUSEKI_USERNAME).")
    parser.add_argument("--password", default=os.getenv("FUSEKI_PASSWORD"), help="Fuseki password (or env FUSEKI_PASSWORD).")
    parser.add_argument("--timeout", type=float, default=float(os.getenv("FUSEKI_TIMEOUT_SECONDS", "120")), help="HTTP timeout in seconds.")
    return parser


def main() -> None:
    parser = _build_cli()
    args = parser.parse_args()

    manager = FusekiTTLManager(
        base_url=args.base_url,
        dataset=args.dataset,
        username=args.username,
        password=args.password,
        timeout_seconds=args.timeout,
    )

    if args.action in {"load", "update"} and not args.ttl:
        parser.error("--ttl is required for 'load' and 'update'.")

    if args.action == "load":
        result = manager.load_ttl_file(ttl_path=args.ttl, graph_uri=args.graph, replace=False)
    elif args.action == "delete":
        result = manager.delete_graph(graph_uri=args.graph)
    else:
        result = manager.update_ttl_file(ttl_path=args.ttl, graph_uri=args.graph)

    print(result)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        main()
        sys.exit(0)

    # Examples:
    #   Load (append) TTL to Fuseki dataset "spine":
    #   python ttl_fuseki_manager.py load --ttl "C:\path\to\building.ttl" --dataset "spine" --username "admin" --password "admin123"
    #
    #   Update (replace) TTL in a named graph:
    #   python ttl_fuseki_manager.py update --ttl "C:\path\to\building.ttl" --dataset "spine" --graph "http://example.org/graph/building1" --username "admin" --password "admin123"
    #
    # Direct Python calls (uncomment to run):
    # manager = FusekiTTLManager(base_url="http://localhost:3030", dataset="spine", username="admin", password="admin123")
    # print(manager.load_ttl_file(ttl_path=r"C:\path\to\building.ttl"))
    # print(manager.update_ttl_file(ttl_path=r"C:\path\to\building.ttl", graph_uri="http://example.org/graph/building1"))
 
    # For bulk folder uploads, prefer a separate utility script to avoid
    # accidental long-running loads when this CLI is executed.

    # MD2MV building ttl loading example (uncomment to run):
    
    manager = FusekiTTLManager(
        base_url="http://localhost:3030",
        dataset="spine",
        username=os.getenv("FUSEKI_USERNAME", "admin"),
        password=os.getenv("FUSEKI_PASSWORD", "admin123"),
        timeout_seconds=float(os.getenv("FUSEKI_TIMEOUT_SECONDS", "600")),
    )
    
    # Loading architecture:
    arc_ttl_path = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\01ARK\ARK_MET.ttl"
    print("Loading Architecture TTL to Fuseki...")
    print(manager.load_ttl_file(ttl_path=arc_ttl_path))
    print(f"Loaded {os.path.basename(arc_ttl_path)} to Fuseki.")

    # Loading HVAC:
    hvac_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\03LVI" 
    print("Loading HVAC TTL to Fuseki...")
    for filename in os.listdir(hvac_ttl_folder):
        if filename.endswith(".ttl"):
            hvac_ttl_path = os.path.join(hvac_ttl_folder, filename)
            print(f"Loading {filename} to Fuseki...")
            print(manager.load_ttl_file(ttl_path=hvac_ttl_path))
            print(f"Loaded {filename} to Fuseki.")

    # Loading electrical:
    el_ttl_folder =  r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\04SAHKO"
    print("Loading Electrical TTL to Fuseki...")
    for filename in os.listdir(el_ttl_folder):
        if filename.endswith(".ttl"):
            el_ttl_path = os.path.join(el_ttl_folder, filename)
            print(f"Loading {filename} to Fuseki...")
            print(manager.load_ttl_file(ttl_path=el_ttl_path))
            print(f"Loaded {filename} to Fuseki.")
    
    # Loading linkset:
    linkset_folder = r"C:\Users\yanpe\OneDrive - Metropolia Ammattikorkeakoulu Oy\Research\MD2MV\data\TTL\Linkset"  
    print("Loading Linkset TTL to Fuseki...")
    for filename in os.listdir(linkset_folder):
        if filename.endswith(".ttl"):
            linkset_ttl_path = os.path.join(linkset_folder, filename)
            print(f"Loading {filename} to Fuseki...")
            print(manager.load_ttl_file(ttl_path=linkset_ttl_path))
            print(f"Loaded {filename} to Fuseki.")
    
    # Clear dataset example (uncomment to run):
    #print("Cleaning Fuseki dataset (CLEAR ALL)...")
    #print(manager.clear_dataset())
    #print("Dataset cleaned. Fuseki dataset is now empty.")