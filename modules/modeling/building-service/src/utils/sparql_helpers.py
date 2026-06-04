from typing import Any

def get_binding_value(binding: dict[str, Any], key: str, default: str = "") -> str:
	value = binding.get(key)
	if isinstance(value, dict):
		return str(value.get("value", default))
	return default

def get_binding_type(binding: dict[str, Any], key: str) -> str:
	value = binding.get(key)
	if isinstance(value, dict):
		return str(value.get("type", ""))
	return ""

def uri_to_id(uri: str) -> str:
	if "#" in uri:
		return uri.rsplit("#", maxsplit=1)[-1]
	if "/" in uri:
		return uri.rsplit("/", maxsplit=1)[-1]
	return uri