#!/usr/bin/env python3
"""Run a test command in a fresh Linux network namespace with loopback only.

Usage: python3 scripts/run-without-network.py -- node <test script> [args...]
Requires unprivileged user/network namespaces and iproute2. Fails closed if
isolation is unavailable; never falls back to running with external networking.
"""

import errno
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys


def loopback_only(ip):
    links = json.loads(subprocess.check_output([ip, "-j", "link", "show"]))
    if len(links) != 1 or links[0]["ifname"] != "lo":
        raise RuntimeError("Refusing tests: network namespace is not loopback-only")


def verify(ip):
    loopback_only(ip)
    # TEST-NET destinations are never reached: the kernel must reject routing
    # before any packet can leave. Test both TCP and UDP in both IP families.
    denied = []
    for family, address in [
        (socket.AF_INET, "192.0.2.1"),
        (socket.AF_INET6, "2001:db8::1"),
    ]:
        for kind, label in [(socket.SOCK_STREAM, "tcp"), (socket.SOCK_DGRAM, "udp")]:
            with socket.socket(family, kind) as client:
                client.settimeout(1)
                try:
                    if kind == socket.SOCK_STREAM:
                        client.connect((address, 9))
                    else:
                        client.sendto(b"offline-guard-probe", (address, 9))
                except OSError as error:
                    if error.errno != errno.ENETUNREACH:
                        raise RuntimeError("Network guard did not reject routing") from error
                    denied.append(f"{label}:{address}")
                else:
                    raise RuntimeError("Refusing tests: outbound network probe succeeded")

    with socket.socket() as server, socket.socket() as client:
        server.settimeout(1)
        client.settimeout(1)
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        client.connect(server.getsockname())
        peer, _ = server.accept()
        with peer:
            peer.settimeout(1)
            client.sendall(b"ok")
            if peer.recv(2) != b"ok":
                raise RuntimeError("Loopback TCP probe failed")
    with socket.socket(type=socket.SOCK_DGRAM) as server:
        server.settimeout(1)
        server.bind(("127.0.0.1", 0))
        server.sendto(b"ok", server.getsockname())
        if server.recv(2) != b"ok":
            raise RuntimeError("Loopback UDP probe failed")

    return {
        "enforcement": "linux-network-namespace",
        "namespace": os.readlink("/proc/self/ns/net"),
        "interfaces": ["lo"],
        "externalRoutingDenied": denied,
        "loopbackTcp": "passed",
        "loopbackUdp": "passed",
    }


def main():
    if sys.platform != "linux":
        raise RuntimeError("Linux network namespace support is required")
    ip = shutil.which("ip")
    unshare = shutil.which("unshare")
    if not ip or not unshare:
        raise RuntimeError("iproute2 and unshare are required; refusing unguarded tests")
    args = sys.argv[1:]
    if args == ["--verify"]:
        print(json.dumps(verify(ip)))
        return 0
    if args and args[0] == "--inside":
        # Validate before changing the interface, including when this internal
        # mode is invoked directly. A host namespace cannot bypass the guard.
        loopback_only(ip)
        subprocess.run([ip, "link", "set", "lo", "up"], check=True)
        evidence = verify(ip)
        command = args[1:]
        if not command:
            raise RuntimeError("A test command is required")
        print("Offline network guard: " + json.dumps(evidence), file=sys.stderr, flush=True)
        env = {**os.environ, "FAROWAY_OFFLINE_NETNS": evidence["namespace"]}
        # exec preserves the isolated namespace for the entire process tree,
        # including native subprocesses and children with an empty environment.
        os.execvpe(command[0], command, env)
    if not args or args[0] != "--" or len(args) < 2:
        raise RuntimeError("Usage: run-without-network.py -- <command> [args...]")
    return subprocess.call([
        unshare, "--user", "--map-root-user", "--net", "--",
        sys.executable, str(Path(__file__).resolve()), "--inside", *args[1:],
    ])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Offline network guard failed: {error}", file=sys.stderr)
        sys.exit(1)
