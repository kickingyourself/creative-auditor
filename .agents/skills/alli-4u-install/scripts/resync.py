import os
import sys
import json
import subprocess
from dotenv import set_key

def get_op_path():
    """Finds the 1Password CLI binary whether in PATH or standard Homebrew paths."""
    try:
        path = subprocess.check_output(['which', 'op'], text=True).strip()
        if path: return path
    except subprocess.CalledProcessError:
        pass
    
    common_paths = ['/opt/homebrew/bin/op', '/usr/local/bin/op', '/usr/bin/op']
    for p in common_paths:
        if os.path.exists(p) and os.access(p, os.X_OK):
            return p
            
    return 'op'

def main():
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
    
    op_bin = get_op_path()
    
    # Verify op is installed
    try:
        subprocess.run([op_bin, '--version'], capture_output=True, check=True)
    except FileNotFoundError:
        print("Error: 1Password CLI (op) is not installed or not found.")
        sys.exit(1)
        
    print("Fetching 'AI Automation Global Setup' from 1Password 'Team' vault...")
    
    try:
        result = subprocess.run(
            [op_bin, 'item', 'get', 'AI Automation Global Setup', '--vault', 'Team', '--format', 'json'],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error fetching from 1Password: {e.stderr}")
        sys.exit(1)
        
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("Error: Could not parse JSON output from 1Password.")
        sys.exit(1)
        
    fields = data.get('fields', [])
    notes_content = None
    
    for field in fields:
        if field.get('id') == 'notesPlain':
            notes_content = field.get('value', '')
            break
            
    if not notes_content:
        print("Error: Could not find 'notesPlain' field in 1Password item.")
        sys.exit(1)
        
    # Make sure the .env file exists so dotenv can write to it
    if not os.path.exists(dotenv_path):
        open(dotenv_path, 'a').close()
        print(f"Created new .env file at {dotenv_path}")
        
    lines = notes_content.splitlines()
    updates = 0
    
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
            
        if '=' in line:
            # Only split on the first '=' in case values contain '='
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip()
            
            # Clean up potential quotes around the value
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            elif val.startswith("'") and val.endswith("'"):
                val = val[1:-1]
                
            if key:
                set_key(dotenv_path, key, val)
                updates += 1
                print(f"Synced {key} to .env")
                
    print(f"Successfully synced {updates} environment variables from 1Password!")

if __name__ == '__main__':
    main()
