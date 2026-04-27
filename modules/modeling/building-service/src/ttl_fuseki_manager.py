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
import os
from typing import Optional
from urllib import parse, request
from urllib.error import HTTPError, URLError


class FusekiError(RuntimeError):
    """Raised when a Fuseki HTTP call fails."""


class FusekiTTLManager:
    """Small helper client for managing TTL data in Fuseki."""

    def __init__(self, base_url: str = "http://localhost:3030", dataset: str = "dataset") -> None:
        self.base_url = base_url.rstrip("/")
        self.dataset = dataset.strip("/")
        self.data_endpoint = f"{self.base_url}/{self.dataset}/data"

    def _build_data_url(self, graph_uri: Optional[str] = None) -> str:
        if graph_uri:
            query = parse.urlencode({"graph": graph_uri})
            return f"{self.data_endpoint}?{query}"
        return self.data_endpoint

    def _request(self, method: str, url: str, data: Optional[bytes] = None, content_type: Optional[str] = None) -> str:
        headers = {}
        if content_type:
            headers["Content-Type"] = content_type

        req = request.Request(url=url, method=method, data=data, headers=headers)
        try:
            with request.urlopen(req) as resp:
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


def _build_cli() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage Turtle files in Apache Jena Fuseki.")
    parser.add_argument("action", choices=["load", "delete", "update"], help="Operation to execute.")
    parser.add_argument("--ttl", help="Path to TTL file (required for load/update).")
    parser.add_argument("--graph", help="Named graph URI. If omitted, default graph is used.")
    parser.add_argument("--base-url", default="http://localhost:3030", help="Fuseki base URL.")
    parser.add_argument("--dataset", default="dataset", help="Fuseki dataset name.")
    return parser


def main() -> None:
    parser = _build_cli()
    args = parser.parse_args()

    manager = FusekiTTLManager(base_url=args.base_url, dataset=args.dataset)

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
    main()
