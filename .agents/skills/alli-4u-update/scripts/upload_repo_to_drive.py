#!/usr/bin/env python3
import os
import sys
import subprocess
try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload, MediaIoBaseDownload
    import markdown
    import io
except ImportError:
    print("Error: Missing required Python packages.", file=sys.stderr)
    print("Run: pip3 install google-api-python-client google-auth-httplib2 google-auth-oauthlib", file=sys.stderr)
    sys.exit(1)

def load_env():
    """Simple parser to load .env into os.environ."""
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
        
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

def main():
    load_env()
    
    import tempfile
    import shutil
    
    # Configuration
    zip_filename = "ai-impact-automations.zip"
    zip_basename = "ai-impact-automations"
    repo_url = "git@github.com:AgencyPMG/ai-impact-automations.git"
    folder_id = "1YfS8ix4pNa-rsEhj3mF4MiFWK21q3jdM"
    
    # 1. Download repo as zip using git clone & zip
    print("Cloning repository into temporary directory...")
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            subprocess.run(
                ['git', 'clone', '--depth', '1', repo_url, temp_dir],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            print("Repository successfully cloned. Zipping...")
            shutil.make_archive(zip_basename, 'zip', temp_dir)
            print("Repository successfully zipped.")
    except subprocess.CalledProcessError as e:
        print(f"Error cloning repository: {e}", file=sys.stderr)
        print("Ensure you have SSH access to GitHub right now.", file=sys.stderr)
        sys.exit(1)

    # 2. Upload to Google Drive
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    refresh_token = os.environ.get('GOOGLE_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("Error: Required Google authentication environment variables are missing.", file=sys.stderr)
        print("Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set.", file=sys.stderr)
        if os.path.exists(zip_filename):
            os.remove(zip_filename)
        sys.exit(1)
        
    SCOPES = ['https://www.googleapis.com/auth/drive']

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
        
        # Check if file exists in the destination folder
        query = f"name='{zip_filename}' and '{folder_id}' in parents and trashed=false"
        results = service.files().list(
            q=query, spaces='drive', fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True
        ).execute()
        items = results.get('files', [])
        
        media = MediaFileUpload(zip_filename, mimetype='application/zip', resumable=True)
        
        if items:
            # File exists in the folder, update it
            file_id = items[0]['id']
            print(f"File already exists (ID: {file_id}). Updating...")
            service.files().update(
                fileId=file_id, 
                media_body=media,
                supportsAllDrives=True
            ).execute()
            print("File updated successfully.")
        else:
            # File does not exist, create it
            print("File does not exist in the folder. Creating new...")
            file_metadata = {
                'name': zip_filename,
                'parents': [folder_id]
            }
            service.files().create(
                body=file_metadata, 
                media_body=media, 
                fields='id',
                supportsAllDrives=True
            ).execute()
            print("File uploaded successfully.")
            
        # ====== README TO PDF LOGIC ======
        readme_path = os.path.join(os.getcwd(), 'README.md')
        pdf_filename = "ai-impact-automations-README.pdf"
        
        if os.path.exists(readme_path):
            print("Converting README.md to PDF via Google Drive...")
            with open(readme_path, 'r', encoding='utf-8') as f:
                readme_text = f.read()
                
            html_content = markdown.markdown(readme_text, extensions=['tables', 'fenced_code'])
            styled_html = f"""
            <html>
            <head>
            <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: auto; padding: 20px; }}
            h1, h2, h3, h4 {{ color: #2c3e50; margin-top: 24px; }}
            code {{ background-color: #f8f9fa; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }}
            pre {{ background-color: #f8f9fa; padding: 16px; border-radius: 4px; overflow-x: auto; }}
            table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            </style>
            </head>
            <body>{html_content}</body>
            </html>
            """
            
            # Create temporary Google Doc
            doc_metadata = {
                'name': 'Temp README Document',
                'mimeType': 'application/vnd.google-apps.document'
            }
            html_bytes = io.BytesIO(styled_html.encode('utf-8'))
            doc_media = MediaIoBaseUpload(html_bytes, mimetype='text/html', resumable=True)
            
            temp_doc = service.files().create(
                body=doc_metadata, 
                media_body=doc_media, 
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            temp_doc_id = temp_doc.get('id')
            
            try:
                # Export to PDF memory
                request = service.files().export_media(fileId=temp_doc_id, mimeType='application/pdf')
                pdf_bytes = io.BytesIO()
                downloader = MediaIoBaseDownload(pdf_bytes, request)
                done = False
                while done is False:
                    status, done = downloader.next_chunk()
                
                pdf_bytes.seek(0)
                
                # Upload PDF alongside the zip
                query_pdf = f"name='{pdf_filename}' and '{folder_id}' in parents and trashed=false"
                results_pdf = service.files().list(
                    q=query_pdf, spaces='drive', fields='files(id, name)', supportsAllDrives=True, includeItemsFromAllDrives=True
                ).execute()
                items_pdf = results_pdf.get('files', [])
                
                pdf_upload_media = MediaIoBaseUpload(pdf_bytes, mimetype='application/pdf', resumable=True)
                
                if items_pdf:
                    pdf_id = items_pdf[0]['id']
                    print(f"PDF already exists (ID: {pdf_id}). Updating...")
                    service.files().update(
                        fileId=pdf_id,
                        media_body=pdf_upload_media,
                        supportsAllDrives=True
                    ).execute()
                    print("PDF updated successfully.")
                else:
                    print("PDF does not exist. Creating new...")
                    pdf_metadata = {
                        'name': pdf_filename,
                        'parents': [folder_id]
                    }
                    service.files().create(
                        body=pdf_metadata,
                        media_body=pdf_upload_media,
                        fields='id',
                        supportsAllDrives=True
                    ).execute()
                    print("PDF uploaded successfully.")
            finally:
                # Always delete the temporary Google Doc
                print("Cleaning up temporary Google Document...")
                service.files().delete(fileId=temp_doc_id, supportsAllDrives=True).execute()
            
    except Exception as e:
        print(f"Google Drive API Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Cleanup the local zip file
        if os.path.exists(zip_filename):
            os.remove(zip_filename)
            print("Cleaned up local zip file.")

if __name__ == '__main__':
    main()
