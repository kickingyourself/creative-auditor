#!/usr/bin/env python3
import os
import sys
import io
import filecmp
import tempfile
import shutil
import zipfile
import argparse
import urllib.request
import datetime

try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    print("Error: Missing required Python packages.", file=sys.stderr)
    print("Run: pip3 install google-api-python-client google-auth-httplib2 google-auth-oauthlib", file=sys.stderr)
    sys.exit(1)

def load_env():
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip()
                        if val.startswith('"') and val.endswith('"'): val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"): val = val[1:-1]
                        os.environ[key] = val

def compare_directories(src_dir, dest_dir, exclude_paths, include_paths=None):
    added = []
    replaced = []
    
    for root, dirs, files in os.walk(src_dir):
        rel_path = os.path.relpath(root, src_dir)
        if rel_path == '.':
            rel_path = ''
            
        # Filter directories
        dirs[:] = [d for d in dirs if os.path.join(rel_path, d).replace('\\', '/') not in exclude_paths and not any(os.path.join(rel_path, d).replace('\\', '/').startswith(e + '/') for e in exclude_paths)]
        
        for file in files:
            file_rel_path = os.path.join(rel_path, file).replace('\\', '/')
            
            # Check exclusions again just in case
            if file_rel_path in exclude_paths or any(file_rel_path.startswith(e + '/') for e in exclude_paths):
                continue
            if include_paths is not None:
                if not any(file_rel_path.startswith(p) for p in include_paths):
                    continue
                
            src_file_path = os.path.join(src_dir, file_rel_path)
            dest_file_path = os.path.join(dest_dir, file_rel_path)
            
            # Use os.path.normpath to ensure consistent comparisons
            if not os.path.exists(dest_file_path):
                added.append(file_rel_path)
            else:
                if file_rel_path.lower() == 'agents.md':
                    continue
                    
                if not filecmp.cmp(src_file_path, dest_file_path, shallow=False):
                    replaced.append(file_rel_path)
                    
    return added, replaced

def apply_changes(src_dir, dest_dir, added, replaced):
    for rel_path in added + replaced:
        src_file = os.path.join(src_dir, rel_path)
        dest_file = os.path.join(dest_dir, rel_path)
        
        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
        shutil.copy2(src_file, dest_file)

def record_installation(creds):
    try:
        oauth2_service = build('oauth2', 'v2', credentials=creds)
        user_info = oauth2_service.userinfo().get().execute()
        email = user_info.get('email', 'Unknown Email')
        
        sheets_service = build('sheets', 'v4', credentials=creds)
        spreadsheet_id = '1QMggKAU9_2Ab0TrzHbz1XEn4g7YppxltLB8Kk0qsiU4'
        range_name = 'A:B'
        
        now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        values = [[email, now]]
        body = {'values': values}
        
        sheets_service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
    except Exception:
        pass

def main():
    parser = argparse.ArgumentParser(description="Upgrade automations")
    parser.add_argument('target_dir', nargs='?', default=None, help="Optional directory to patch only .agents/skills and .agents/workflows")
    parser.add_argument('--claude', action='store_true', help="Use .claude instead of .agents")
    args = parser.parse_args()
    
    agent_folder = '.claude' if args.claude else '.agents'
    
    load_env()
    
    zip_filename = "ai-impact-automations.zip"
    folder_id = "1YfS8ix4pNa-rsEhj3mF4MiFWK21q3jdM"
    exclude_paths = {'.git', '.env', 'google_credentials'}
    
    if args.target_dir:
        dest_dir = os.path.abspath(args.target_dir)
        include_paths = [f'{agent_folder}/skills', f'{agent_folder}/workflows']
        print(f"Patch mode enabled for directory: {dest_dir} ({agent_folder})")
    else:
        dest_dir = os.getcwd()
        include_paths = None

    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    refresh_token = os.environ.get('GOOGLE_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("Error: Required Google authentication environment variables are missing.", file=sys.stderr)
        print("Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set.", file=sys.stderr)
        sys.exit(1)

    SCOPES = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/userinfo.email'
    ]
    print("Authenticating with Google Drive...")
    try:
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES
        )
        service = build('drive', 'v3', credentials=creds)
        
        query = f"name='{zip_filename}' and '{folder_id}' in parents and trashed=false"
        results = service.files().list(
            q=query, spaces='drive', fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True
        ).execute()
        items = results.get('files', [])
        
        if not items:
            print(f"Error: {zip_filename} not found in the remote folder.")
            sys.exit(1)
            
        file_id = items[0]['id']
        
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, zip_filename)
            print(f"Downloading {zip_filename} (ID: {file_id})...")
            
            request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
            fh = io.FileIO(zip_path, 'wb')
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                # print(f"Download {int(status.progress() * 100)}%.")
                
            print("Download complete. Analyzing changes...")
            
            extract_dir = os.path.join(temp_dir, 'extracted')
            os.makedirs(extract_dir)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                
            if args.claude:
                extracted_agents_dir = os.path.join(extract_dir, '.agents')
                extracted_claude_dir = os.path.join(extract_dir, '.claude')
                if os.path.exists(extracted_agents_dir):
                    os.rename(extracted_agents_dir, extracted_claude_dir)
                
            # Fetch Anthropic skills seamlessly into the staging directory before comparison
            print("Downloading Anthropic skills (pdf, pptx, xlsx, docx)...")
            anthropic_zip_url = "https://github.com/anthropics/skills/archive/refs/heads/main.zip"
            anthropic_zip_path = os.path.join(temp_dir, 'anthropic_skills.zip')
            try:
                urllib.request.urlretrieve(anthropic_zip_url, anthropic_zip_path)
                anthropic_extract_dir = os.path.join(temp_dir, 'anthropic_extracted')
                with zipfile.ZipFile(anthropic_zip_path, 'r') as anthropic_zip_ref:
                    anthropic_zip_ref.extractall(anthropic_extract_dir)
                
                # Copy targeted skills directly into the staging structure so they are processed
                for askill in ['pdf', 'pptx', 'xlsx', 'docx']:
                    src_askill = os.path.join(anthropic_extract_dir, 'skills-main', 'skills', askill)
                    dest_askill = os.path.join(extract_dir, agent_folder, 'skills', askill)
                    if os.path.exists(src_askill):
                        if not os.path.exists(dest_askill):
                            # Ensure the path exists first if parent .agents/skills isn't there for some reason
                            os.makedirs(os.path.dirname(dest_askill), exist_ok=True)
                            shutil.copytree(src_askill, dest_askill)
            except Exception as e:
                print(f"Warning: Failed to fetch Anthropic skills: {e}", file=sys.stderr)
                
            # Perform comparison against target directory
            added, replaced = compare_directories(extract_dir, dest_dir, exclude_paths, include_paths)
            
            if not added and not replaced:
                print("No changes found. Everything is up to date.")
                sys.exit(0)
                
            if added:
                print("\n--- Files to be ADDED ---")
                for f in sorted(added):
                    print(f" + {f}")
            
            if replaced:
                print("\n--- Files to be REPLACED ---")
                for f in sorted(replaced):
                    print(f" ~ {f}")
                    
            print()
            if not args.target_dir:
                print("Install mode detected. Automatically applying changes...")
                apply_changes(extract_dir, dest_dir, added, replaced)
                record_installation(creds)
                print("Updates applied successfully.")
            else:
                while True:
                    choice = input("Do you want to proceed with applying these updates? (y/n): ").strip().lower()
                    if choice in ['y', 'yes']:
                        print("Applying changes...")
                        apply_changes(extract_dir, dest_dir, added, replaced)
                        record_installation(creds)
                        print("Updates applied successfully.")
                        break
                    elif choice in ['n', 'no']:
                        print("Operation cancelled by the user.")
                        break
                    else:
                        print("Please enter 'y' or 'n'.")

    except Exception as e:
        print(f"Google Drive API Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
