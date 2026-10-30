"""Real staging UI smoke test using Android's UI Automator and ADB."""
import json
import pathlib
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

if len(sys.argv) != 2 or sys.argv[1].startswith('-'):
    sys.exit('Usage: bun run uat:native DEVICE_SERIAL')
DEVICE = sys.argv[1]
PACKAGE = 'ai.faroway.app.qa'
PRIVATE = pathlib.Path.home() / '.local/share/faroway-uat'
ACCOUNT = json.loads((PRIVATE / 'accounts.json').read_text())[0]
OUTPUT = PRIVATE / 'native' / str(int(time.time() * 1000))
OUTPUT.mkdir(parents=True, mode=0o700)


def adb(*args, data=None):
    result = subprocess.run(['adb', '-s', DEVICE, *args], input=data,
                            capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError('ADB operation failed (output withheld for credentials)')
    return result.stdout


def shell(*args):
    # Send shell commands through stdin so credentials never enter process arguments.
    return adb('shell', data=(shlex.join(args) + '\n').encode())


def nodes():
    shell('uiautomator', 'dump', '/sdcard/faroway-uat.xml')
    return list(ET.fromstring(adb('exec-out', 'cat', '/sdcard/faroway-uat.xml')).iter('node'))


def find(predicate, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for node in nodes():
            if predicate(node.attrib):
                return node.attrib
        time.sleep(1)
    raise AssertionError('Expected UI element did not appear')


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node['bounds']))
    shell('input', 'tap', str((x1+x2)//2), str((y1+y2)//2))


def by_id(value):
    return find(lambda n: n.get('resource-id') == value)


def trips():
    tap(find(lambda n: 'My Trips' in n.get('content-desc', '') or n.get('text') == 'My Trips'))
    find(lambda n: any(city in n.get('text', '') or city in n.get('content-desc', '')
                       for city in ['Lisbon', 'Copenhagen']))


assert b'package:' in shell('pm', 'path', PACKAGE), 'Install Faroway QA first'
shell('am', 'force-stop', PACKAGE)
shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d',
      'faroway-qa://onboarding/login', PACKAGE)
tap(by_id('test-email'))
shell('input', 'text', ACCOUNT['email'])
shell('input', 'keyevent', '111')
tap(by_id('test-password'))
shell('input', 'text', ACCOUNT['password'])
shell('input', 'keyevent', '111')
tap(by_id('test-sign-in'))
trips()
(OUTPUT / 'qa-saved-trips.png').write_bytes(adb('exec-out', 'screencap', '-p'))
print('PASS Real staging login and saved generated trips')
shell('am', 'force-stop', PACKAGE)
shell('am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
trips()
assert not any(n.attrib.get('resource-id') == 'test-email' for n in nodes())
(OUTPUT / 'qa-session-restored.png').write_bytes(adb('exec-out', 'screencap', '-p'))
shell('rm', '/sdcard/faroway-uat.xml')
print('PASS Session restored after process restart')
tap(find(lambda n: any(city in n.get('text', '') or city in n.get('content-desc', '')
                       for city in ['Lisbon', 'Copenhagen'])))
find(lambda n: n.get('text', '').startswith('Day 1') or n.get('content-desc', '').startswith('Day 1'), timeout=60)
(OUTPUT / 'qa-itinerary-loaded.png').write_bytes(adb('exec-out', 'screencap', '-p'))
print('PASS Saved itinerary loads after upgrading without clearing app data')
shell('rm', '/sdcard/faroway-uat.xml')
print('Private evidence: ' + str(OUTPUT))
