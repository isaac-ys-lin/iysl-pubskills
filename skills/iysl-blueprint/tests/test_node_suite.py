"""Run the skill's Node test suite from the repository's pytest release gate."""

import shutil
import subprocess
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]


class NodeSuiteTest(unittest.TestCase):
    def test_node_suite_passes(self):
        node = shutil.which("node")
        if node is None or not (SKILL / "node_modules").is_dir():
            self.skipTest("Node.js or node_modules missing; run `npm ci` in the skill folder")
        result = subprocess.run([node, "--test"], cwd=SKILL, capture_output=True, text=True, encoding="utf-8")
        failed = [line.strip() for line in result.stdout.splitlines() if line.lstrip().startswith("not ok")]
        self.assertEqual(result.returncode, 0, "\n".join(failed) + "\n" + result.stdout[-3000:] + result.stderr[-1500:])


if __name__ == "__main__":
    unittest.main()
