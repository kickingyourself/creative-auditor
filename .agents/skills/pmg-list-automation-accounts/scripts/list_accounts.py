#!/usr/bin/env python3
import subprocess
import json
import sys
import os

def get_op_path():
    """Finds the 1Password CLI binary whether in PATH or standard Homebrew paths."""
    # First try using 'which' if it's in the environment PATH
    try:
        path = subprocess.check_output(['which', 'op'], text=True).strip()
        if path: return path
    except subprocess.CalledProcessError:
        pass
    
    # Fallback to common locations, especially for Apple Silicon
    common_paths = [
        '/opt/homebrew/bin/op',
        '/usr/local/bin/op',
        '/usr/bin/op'
    ]
    for p in common_paths:
        if os.path.exists(p) and os.access(p, os.X_OK):
            return p
            
    return 'op'  # Let subprocess try to find it natively as a last resort

def main():
    try:
        # Run 1Password CLI to fetch items from all accessible vaults
        op_bin = get_op_path()
        result = subprocess.run(
            [op_bin, 'item', 'list', '--format=json'],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error calling 1Password CLI:", file=sys.stderr)
        print(e.stderr, file=sys.stderr)
        print("Tip: Are you authenticated with 1Password? Try running `eval $(op signin)`.", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: 1Password CLI ('op') not found. Please ensure it is installed and in your PATH.", file=sys.stderr)
        sys.exit(1)
        
    try:
        items = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("Error: Failed to parse JSON output from 1Password CLI.", file=sys.stderr)
        sys.exit(1)
        
    print("Available AI Automation Accounts:")
    print("-" * 35)
    
    found_accounts = 0
    for item in items:
        # The 1Password item structure returns a title. We'll filter based on the "AI Automation - " prefix
        title = item.get("title", "")
        if title.startswith("AI Automation - "):
            found_accounts += 1
            # You can extract the actual value if needed here:
            # account_name = title.replace("AI Automation - ", "").strip()
            print(f"- {title}")
            
    if found_accounts == 0:
        print("No accounts found with the prefix 'AI Automation - ' across any accessible vault.")
    else:
        print("-" * 35)
        print(f"Total Found: {found_accounts}")

if __name__ == "__main__":
    main()
