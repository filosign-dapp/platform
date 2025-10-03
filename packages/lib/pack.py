import argparse
import json
import os
import subprocess
import sys
import termios
import tty

HISTORY_TO_MAINTAIN = 10

parser = argparse.ArgumentParser()
parser.add_argument('--force', action='store_true')
parser.add_argument('-y', '--yes', action='store_true')
args = parser.parse_args()
force_present = args.force
yes_present = args.yes

def getch():
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch

with open('package.json') as f:
    data = json.load(f)
current_version = data['version']

os.makedirs('releases', exist_ok=True)
releases = os.listdir('releases')
versions = []
for f in releases:
    if f.startswith('filosign-sdk-') and f.endswith('.tgz'):
        v = f[len('filosign-sdk-'):-len('.tgz')]
        versions.append(v)

latest = None
if versions:
    latest = max(versions, key=lambda v: tuple(map(int, v.split('.'))))

def version_tuple(v):
    return tuple(map(int, v.split('.')))

current_tuple = version_tuple(current_version)

if force_present and not yes_present:
    print(f"Force flag is present. Packing the version {current_version} again, are you sure to proceed? (y/n).", end=" \n")
    ans = getch().lower()
    if ans != 'y':
        print("\nAborting.")
        exit(0)

if (not latest or current_tuple > version_tuple(latest)) or force_present:
    subprocess.run(['npm', 'pack', '--pack-destination', 'releases'], check=True)
    subprocess.run(['rm', '-rf', 'dist'], check=True)

    releases_files = os.listdir('releases')
    version_files = []
    for f in releases_files:
        if f.startswith('filosign-sdk-') and f.endswith('.tgz'):
            v = f[len('filosign-sdk-'):-len('.tgz')]
            version_files.append((v, f))
    sorted_version_files = sorted(version_files, key=lambda x: version_tuple(x[0]), reverse=True)
    to_delete = sorted_version_files[HISTORY_TO_MAINTAIN:]
    for _, fname in to_delete:
        os.remove(os.path.join('releases', fname))
else:
    print(f"Current version {current_version} is not greater than the latest packed version {latest}. Use --force to pack anyway.")
    if not force_present:
        print("\nAborting.")
        exit(0)
