import sys

import agentpage_bench


def test_package_imports():
    assert agentpage_bench.__version__ == "0.0.0"


def test_python_version_meets_floor():
    assert sys.version_info >= (3, 11), "bench/ requires Python 3.11+"
