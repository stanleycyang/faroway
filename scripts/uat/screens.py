"""Capture read-only QA routes on a selected Android; never submit a plan or form."""
import pathlib
import shlex
import subprocess
import sys
import time

if len(sys.argv) < 2:
    sys.exit('Usage: python3 scripts/uat/screens.py DEVICE [OUTPUT_DIRECTORY]')
device = sys.argv[1]
output = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'artifacts/uat/ux/screens')
output.mkdir(parents=True, exist_ok=True)
routes = {
    'explore': '/(tabs)',
    'trips': '/(tabs)/trips',
    'profile': '/(tabs)/profile',
    'edit-profile': '/profile/edit-profile',
    'preferences': '/profile/preferences',
    'notifications': '/profile/notifications',
    'inspiration': '/inspiration/beach-getaway',
    'create': '/create',
    'itinerary': '/trip/626ca950-d594-4701-889f-39b43c11295d',
    'login': '/onboarding/login',
    'onboarding': '/onboarding',
}
for name, route in routes.items():
    command = shlex.join(['am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d',
                         'faroway-qa://' + route, 'ai.faroway.app.qa'])
    subprocess.run(['adb', '-s', device, 'shell'], input=(command+'\n').encode(),
                   check=True, capture_output=True, timeout=30)
    time.sleep(15 if name == 'itinerary' else 3)
    data = subprocess.run(['adb', '-s', device, 'exec-out', 'screencap', '-p'],
                          check=True, capture_output=True, timeout=15).stdout
    (output / (name+'.png')).write_bytes(data)
    print('Captured ' + name, flush=True)
