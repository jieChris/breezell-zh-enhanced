#!/usr/bin/env python3
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("--mode", choices=["packages"], required=True)
parser.parse_args()
print(json.dumps({"packages": [{"name": "extension", "path": ".", "spec": ".trellis/spec/extension"}]}))
