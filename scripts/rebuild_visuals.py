"""Rebuild the report's registered custom visuals from the checked-in source."""

import argparse
import base64
import json
from pathlib import Path


MODES = {"Overview": "overview", "Investment": "investment", "Economy": "economy", "Benchmark": "benchmark"}


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, content):
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def asset_uri(path, mime):
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode()


def rebuild(project, version):
    source = project / "visuals"
    assets = source / "assets"
    css = (source / "visual.css").read_text(encoding="utf-8").replace(
        "FIELD_PHOTO", asset_uri(assets / "equipment.jpg", "image/jpeg")
    )
    code = (source / "visual.js").read_text(encoding="utf-8")
    icon = asset_uri(assets / "icon.png", "image/png")
    report = project / "Capital Atlas.Report"
    report_data = read(report/"definition"/"report.json")
    registry = report_data["resourcePackages"]
    packages = report / "CustomVisuals"
    for suffix, mode in MODES.items():
        directory, = packages.glob(f"CapitalAtlas{suffix}*")
        manifest_path = directory / "package.json"
        manifest = read(manifest_path)
        guid = manifest["visual"]["guid"]
        assert guid == directory.name and any(p["name"] == guid for p in registry)
        resource_path = directory / manifest["resources"][0]["file"]
        resource = read(resource_path)
        widget = resource["visual"]
        widget["version"] = version or widget["version"]

        flags = read(assets / "flags.json") if mode in {"overview", "benchmark"} else {}
        geometry = read(assets / "atlas-map.json") if mode == "overview" else []
        js = f"""var {guid};
(() => {{
  const FieldNotesFlags = {json.dumps(flags,separators=(",",":"))};
  const CapitalAtlasMap = {json.dumps(geometry,ensure_ascii=False,separators=(",",":"))};
  {code}
  const pbi = window.powerbi;
  const plugin = {{
    name: {json.dumps(guid)}, displayName: {json.dumps(widget['displayName'])},
    class: "Visual", version: {json.dumps(widget['version'])}, apiVersion: {json.dumps(resource['apiVersion'])},
    custom: true, create: options => new FieldNotesRuntime.Visual(options,{json.dumps(mode)}),
    createModalDialog() {{}}
  }};
  if (pbi) {{
    pbi.visuals = pbi.visuals || {{}};
    pbi.visuals.plugins = pbi.visuals.plugins || {{}};
    pbi.visuals.plugins[{json.dumps(guid)}] = plugin;
  }}
  {guid} = {{ default: plugin }};
}})();
"""
        if mode in {"investment", "economy"}:
            caps = resource["capabilities"]
            caps["dataRoles"] = [role for role in caps["dataRoles"] if role["name"] != "flagUrl"]
            for mapping in caps["dataViewMappings"]:
                for condition in mapping["conditions"]:
                    condition.pop("flagUrl", None)
                rows = mapping["table"]["rows"]
                rows["select"] = [role for role in rows["select"] if role["bind"]["to"] != "flagUrl"]
        resource["content"] = {"js":js,"css":css,"iconBase64":icon}
        manifest["version"] = widget["version"]
        manifest["visual"] = widget
        write(resource_path, resource)
        write(manifest_path, manifest)
        print(f"{mode}: {resource_path.stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", help="Set the four-part Power BI visual version.")
    args = parser.parse_args()
    rebuild(Path(__file__).resolve().parent.parent, args.version)
