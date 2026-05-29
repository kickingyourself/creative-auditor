#!/usr/bin/env python3
import os
import sys

def main():
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    
    # Try reading from .env first, looking for CUSTOMER_NAME
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith("CUSTOMER_NAME="):
                    name = line.strip().split('=', 1)[1].strip('"\'')
                    print(f"Current Customer: {name}")
                    sys.exit(0)
                    
    # Fallback checking .current_customer
    tracking_path = os.path.join(cwd, '.current_customer')
    if os.path.exists(tracking_path):
        with open(tracking_path, 'r') as f:
            name = f.read().strip()
            if name:
                print(f"Current Customer: {name}")
                sys.exit(0)
                
    print("Warning: No customer selected. Please run the set_customer_env skill.")
    sys.exit(1)

if __name__ == "__main__":
    main()
