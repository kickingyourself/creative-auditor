import os
import shutil
import sys
import argparse

parser = argparse.ArgumentParser(description="Bootstrap skills")
parser.add_argument('--claude', action='store_true', help="Use .claude instead of .agents")
args = parser.parse_args()

agent_folder = '.claude' if args.claude else '.agents'

# The current workspace directory the user is in when they run this script
target_dir = os.getcwd()
skills_dest = os.path.join(target_dir, agent_folder, 'skills')

# The central repository source directory
source_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))

skills_to_copy = ['alli-4u-install', 'alli-4u-update', 'pmg-cowork-login']

print(f"Bootstrapping Alli-4u skills into current workspace ({agent_folder})...")

if not os.path.exists(skills_dest):
    os.makedirs(skills_dest, exist_ok=True)
    print(f"Created {agent_folder}/skills directory at {target_dir}")

for skill in skills_to_copy:
    src_path = os.path.join(source_dir, skill)
    dest_path = os.path.join(skills_dest, skill)
    
    if os.path.exists(src_path):
        if os.path.exists(dest_path):
            print(f"Skill {skill} already exists in target directory. Re-copying and overwriting...")
            shutil.rmtree(dest_path)
            
        shutil.copytree(src_path, dest_path)
        print(f" -> Successfully copied {skill}")
    else:
        print(f"Error: Could not locate source skill {skill} at {src_path}", file=sys.stderr)
        
print("\nBootstrap complete! The core skills are now available in your current workspace.")
