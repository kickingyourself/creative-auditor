import subprocess
import sys
import os
import re

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

def clean_op_output(val):
    val = val.strip()
    if val.startswith('"') and val.endswith('"'):
        val = val[1:-1]
        val = val.replace('\\"', '"')
    
    # 1Password CLI sometimes escapes internal quotes in JSON blocks as double-quotes ("") instead of backslash quotes depending on shell formatting
    val = val.replace('""', '"')
    return val

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 set_env.py <client_name_or_item_name>")
        sys.exit(1)
        
    client_name = sys.argv[1]
    
    # Check for prefix or add it if missing
    if not client_name.startswith("AI Automation - "):
        item_name = f"AI Automation - {client_name}"
    else:
        item_name = client_name
        
    clean_client_name = item_name.replace("AI Automation - ", "").strip()
    file_safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', clean_client_name)
        
    print(f"Fetching .env contents from 1Password for '{item_name}'...", file=sys.stderr)
    
    op_bin = get_op_path()
    
    try:
        # Run 1Password CLI to fetch the notesPlain
        result = subprocess.run(
            [op_bin, 'item', 'get', item_name, '--fields', 'notesPlain'],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error fetching notesPlain from 1Password. Did you type the name correctly?", file=sys.stderr)
        print(e.stderr, file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: 1Password CLI ('op') not found. Please ensure it is installed or accessible.", file=sys.stderr)
        sys.exit(1)
    
    env_content = clean_op_output(result.stdout)
    
    if not env_content.strip():
        print("Warning: The 'notesPlain' field for this item appears to be empty.", file=sys.stderr)
        
        
    print(f"Fetching google_credentials from 1Password for '{item_name}'...", file=sys.stderr)
    
    try:
        gcp_result = subprocess.run(
            [op_bin, 'item', 'get', item_name, '--fields', 'google_credentials'],
            capture_output=True,
            text=True,
            check=True
        )
        gcp_content = clean_op_output(gcp_result.stdout)
    except subprocess.CalledProcessError:
        gcp_content = None
        print(f"Warning: 'google_credentials' field not found inside item '{item_name}'.", file=sys.stderr)

    # Paths for .env and tracking file
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    tracking_path = os.path.join(cwd, '.current_customer')
    
    gcp_file_path_relative = ""
    if gcp_content:
        # Make the folder if it doesn't exist
        gcp_dir = os.path.join(cwd, 'google_credentials')
        os.makedirs(gcp_dir, exist_ok=True)
        # Create output json filename using the client name
        gcp_file_path_relative = os.path.join('google_credentials', f"{file_safe_name}.json")
        gcp_file_path = os.path.join(cwd, gcp_file_path_relative)
        
        try:
            import json
            
            with open(gcp_file_path, 'w') as f:
                try:
                    # Sanitize the output strictly through the json module to guarantee valid formatting
                    parsed = json.loads(gcp_content)
                    f.write(json.dumps(parsed, indent=2))
                except Exception:
                    # Fallback to direct writing if not parseable
                    f.write(gcp_content)
            
            print(f"Successfully wrote google_credentials to {gcp_file_path_relative}")
        except IOError as e:
            print(f"Error writing google_credentials file: {e}", file=sys.stderr)

    # Write the payload out to .env
    try:
        env_dict = {}
        # Load existing .env configurations to preserve them
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        if '=' in line:
                            key, val = line.split('=', 1)
                            env_dict[key.strip()] = val.strip()
                            
        # Override with 1Password fetched info
        env_dict['CUSTOMER_NAME'] = item_name
        
        if gcp_content:
            env_dict['GOOGLE_APPLICATION_CREDENTIALS'] = gcp_file_path_relative
            
        if env_content:
            for line in env_content.splitlines():
                line = line.strip()
                if line and not line.startswith('#'):
                    if '=' in line:
                        key, val = line.split('=', 1)
                        env_dict[key.strip()] = val.strip()
                        
        with open(env_path, 'w') as f:
            for k, v in env_dict.items():
                f.write(f"{k}={v}\n")
                
        print(f"Successfully updated {env_path} (merged with existing items)")
        
        # Track active customer so which_customer can find it later
        with open(tracking_path, 'w') as f:
            f.write(item_name)
    except IOError as e:
        print(f"Error writing to file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
